/**
 * Store Pinia del Muro de Trabajos y Portafolios.
 *
 * - Una instantánea por pestaña (lista paginada, cursor, momento de carga, filtros usados,
 *   posición de scroll y filtros disponibles). Categoría y ciudad se comparten entre pestañas.
 * - `loadMore` ignora la llamada si ya hay una solicitud en vuelo en esa pestaña.
 * - Un fallo conserva tarjetas y cursor; `retry` repite la misma solicitud.
 * - `setFilters` reinicia las listas y cursores de ambas pestañas.
 * - Me gusta y Guardar son optimistas, con reversión y aviso si fallan (timeout de 10 s en el servicio).
 *
 * Requisitos: 1.2 a 1.5, 8.2 a 8.5, 8.13, 8.14, 9, 10.4, 13.2, 13.4.
 */
import { wallService } from '@/services/wall'
import type {
  InteractionState,
  WallFilters,
  WallJobCard,
  WallPortfolioCard,
  WallPortfolioFilters,
  WallTabParams,
} from '@/services/wall'
import { applyInteraction, rollbackInteraction, snapshotInteraction } from '@/utils/wall'
import type { InteractionAction } from '@/utils/wall'
import { applyFailure, applyPage, emptyPagedList, retryKind, startRequest } from '@/utils/pagedList'
import type { PagedListState } from '@/utils/pagedList'
import { DEFAULT_BOARD_TAB, boardFiltersKey, restoreDecision } from '@/utils/wallBoard'
import type { BoardFilters, BoardTab } from '@/utils/wallBoard'

export const ACTION_FAILED_MESSAGE = 'La acción no se completó'
export const LOAD_FAILED_MESSAGE = 'No se pudo cargar el Muro'

export type BoardCard = WallJobCard | WallPortfolioCard

export interface BoardPrivacyState {
  answered: boolean
  enabled: boolean
}

interface TabSnapshot {
  list: PagedListState<BoardCard>
  /** Momento de la última primera página completada; `null` si no hay instantánea válida. */
  loadedAt: number | null
  /** Clave de los filtros con que se cargó la instantánea. */
  filtersKey: string | null
  scrollY: number
  available: WallFilters | WallPortfolioFilters | null
}

function emptySnapshot(): TabSnapshot {
  return { list: emptyPagedList<BoardCard>(), loadedAt: null, filtersKey: null, scrollY: 0, available: null }
}

export const useWallBoardStore = defineStore('wallBoard', () => {
  const tabs = ref<Record<BoardTab, TabSnapshot>>({ jobs: emptySnapshot(), portfolios: emptySnapshot() })
  const filters = ref<BoardFilters>({ category: null, city: null })
  const activeTab = ref<BoardTab>(DEFAULT_BOARD_TAB)
  const privacy = ref<BoardPrivacyState>({ answered: false, enabled: false })
  /** Mensaje de la última acción fallida. La vista lo muestra y lo limpia. */
  const actionError = ref<string | null>(null)

  const tokens: Record<BoardTab, number> = { jobs: 0, portfolios: 0 }
  const filterTokens: Record<BoardTab, number> = { jobs: 0, portfolios: 0 }
  let pendingActions = new Set<string>()

  function listOf(tab: BoardTab): PagedListState<BoardCard> {
    return tabs.value[tab].list
  }

  function params(cursor: string | null): WallTabParams {
    return { cursor, category_id: filters.value.category, city: filters.value.city }
  }

  async function fetchPage(tab: BoardTab, cursor: string | null) {
    return tab === 'jobs'
      ? await wallService.jobs(params(cursor))
      : await wallService.portfolios(params(cursor))
  }

  async function run(tab: BoardTab, kind: 'first' | 'more'): Promise<void> {
    const request = startRequest(listOf(tab), kind)

    if (!request.started)
      return

    const token = ++tokens[tab]
    const snapshot = tabs.value[tab]

    snapshot.list = request.state
    if (kind === 'first') {
      snapshot.loadedAt = null
      snapshot.filtersKey = null
    }

    const usedFilters = { ...filters.value }

    try {
      const result = await fetchPage(tab, request.cursor)

      if (token !== tokens[tab])
        return

      const current = tabs.value[tab]

      current.list = applyPage(current.list, { items: result.items as BoardCard[], next_cursor: result.next_cursor })
      if (kind === 'first' || current.filtersKey === null) {
        current.loadedAt = Date.now()
        current.filtersKey = boardFiltersKey(usedFilters)
      }
      privacy.value = {
        answered: Boolean(result.meta?.privacy_answered),
        enabled: Boolean(result.meta?.behavior_logging),
      }
    }
    catch {
      if (token !== tokens[tab])
        return
      tabs.value[tab].list = applyFailure(tabs.value[tab].list)
    }
  }

  function loadFirst(tab: BoardTab = activeTab.value): Promise<void> {
    return run(tab, 'first')
  }

  function loadMore(tab: BoardTab = activeTab.value): Promise<void> {
    return run(tab, 'more')
  }

  /** Repite la solicitud que falló en la pestaña. */
  function retry(tab: BoardTab = activeTab.value): Promise<void> {
    return run(tab, retryKind(listOf(tab)))
  }

  /** Filtros disponibles de la pestaña (`GET /wall/filters?tab=`). Un fallo conserva los anteriores. */
  async function loadAvailableFilters(tab: BoardTab = activeTab.value): Promise<void> {
    const token = ++filterTokens[tab]

    try {
      const result = tab === 'jobs' ? await wallService.filters('jobs') : await wallService.filters('portfolios')

      if (token === filterTokens[tab])
        tabs.value[tab].available = result
    }
    catch {
      // Se conservan los filtros disponibles previos.
    }
  }

  function invalidateAll() {
    for (const tab of ['jobs', 'portfolios'] as BoardTab[]) {
      tokens[tab]++
      tabs.value[tab] = { ...emptySnapshot(), scrollY: 0, available: tabs.value[tab].available }
    }
  }

  /** Cambia filtros (parcial), reinicia listas y cursores de ambas pestañas y recarga la activa. */
  async function setFilters(next: Partial<BoardFilters>): Promise<void> {
    filters.value = { ...filters.value, ...next }
    invalidateAll()
    await loadFirst(activeTab.value)
  }

  function setTab(tab: BoardTab) {
    activeTab.value = tab
  }

  /**
   * Restaura la instantánea de la pestaña si tiene los mismos filtros y no superó 15 minutos;
   * si no, pide la primera página. Devuelve la decisión tomada.
   */
  async function restoreOrLoad(tab: BoardTab = activeTab.value, now: number = Date.now()): Promise<'restore' | 'load'> {
    const snapshot = tabs.value[tab]
    const decision = snapshot.loadedAt !== null && snapshot.filtersKey !== null
      ? restoreDecision({ filtersKey: snapshot.filtersKey, loadedAt: snapshot.loadedAt }, tab, filters.value, now)
      : 'load'

    if (decision === 'load')
      await loadFirst(tab)

    return decision
  }

  function saveScroll(tab: BoardTab, y: number) {
    tabs.value[tab].scrollY = Math.max(0, Math.round(y))
  }

  function getScroll(tab: BoardTab): number {
    return tabs.value[tab].scrollY
  }

  function patchItem(tab: BoardTab, id: number, patch: (item: BoardCard) => BoardCard) {
    const list = listOf(tab)

    tabs.value[tab].list = { ...list, items: list.items.map(i => (i.id === id ? patch(i) : i)) }
  }

  function serviceCall(tab: BoardTab, action: InteractionAction, id: number): Promise<InteractionState> {
    if (tab === 'jobs') {
      return { like: wallService.likeJob, unlike: wallService.unlikeJob, save: wallService.saveJob, unsave: wallService.unsaveJob }[action](id)
    }

    return { like: wallService.likePortfolio, unlike: wallService.unlikePortfolio, save: wallService.savePortfolio, unsave: wallService.unsavePortfolio }[action](id)
  }

  async function interact(tab: BoardTab, id: number, kind: 'like' | 'save'): Promise<void> {
    const key = `${tab}:${kind}:${id}`
    const current = listOf(tab).items.find(i => i.id === id)

    if (!current || pendingActions.has(key))
      return

    const action: InteractionAction = kind === 'like'
      ? (current.liked_by_me ? 'unlike' : 'like')
      : (current.saved_by_me ? 'unsave' : 'save')
    const snapshot = snapshotInteraction(current)
    const pendingSet = pendingActions

    pendingActions.add(key)
    patchItem(tab, id, i => applyInteraction(i, action))
    try {
      const state = await serviceCall(tab, action, id)

      patchItem(tab, id, i => ({
        ...i,
        liked_by_me: state.liked,
        saved_by_me: state.saved,
        likes_count: state.likes_count,
      }))
    }
    catch {
      // Solo se revierte el campo de esta acción; el otro control puede haber cambiado entretanto.
      patchItem(tab, id, (i) => {
        const reverted = rollbackInteraction(i, snapshot)

        return kind === 'like'
          ? { ...i, liked_by_me: reverted.liked_by_me, likes_count: reverted.likes_count }
          : { ...i, saved_by_me: reverted.saved_by_me }
      })
      actionError.value = ACTION_FAILED_MESSAGE
    }
    finally {
      pendingSet.delete(key)
    }
  }

  function toggleLike(tab: BoardTab, id: number): Promise<void> {
    return interact(tab, id, 'like')
  }

  function toggleSave(tab: BoardTab, id: number): Promise<void> {
    return interact(tab, id, 'save')
  }

  function clearActionError() {
    actionError.value = null
  }

  /** Retira una tarjeta que dejó de estar disponible. */
  function removeItem(tab: BoardTab, id: number) {
    const list = listOf(tab)

    tabs.value[tab].list = { ...list, items: list.items.filter(i => i.id !== id) }
  }

  /** Descarta todo el estado (se invoca al cerrar sesión). */
  function reset() {
    for (const tab of ['jobs', 'portfolios'] as BoardTab[]) {
      tokens[tab]++
      filterTokens[tab]++
    }
    tabs.value = { jobs: emptySnapshot(), portfolios: emptySnapshot() }
    filters.value = { category: null, city: null }
    activeTab.value = DEFAULT_BOARD_TAB
    privacy.value = { answered: false, enabled: false }
    actionError.value = null
    pendingActions = new Set<string>()
  }

  return {
    tabs,
    filters,
    activeTab,
    privacy,
    actionError,
    loadFirst,
    loadMore,
    retry,
    loadAvailableFilters,
    setFilters,
    setTab,
    restoreOrLoad,
    saveScroll,
    getScroll,
    toggleLike,
    toggleSave,
    clearActionError,
    removeItem,
    reset,
  }
})

export default useWallBoardStore
