/**
 * Store Pinia de Guardados con dos pestañas (Trabajos y Portafolios), cada una con su
 * lista paginada y "Ver más". Quitar un guardado retira la tarjeta cuando el servidor
 * confirma y la deja en su sitio si falla.
 *
 * Requisitos: 8.2 a 8.5, 9.
 */
import { wallService } from '@/services/wall'
import type { WallJobCard, WallPortfolioCard } from '@/services/wall'
import { applyFailure, applyPage, emptyPagedList, retryKind, startRequest } from '@/utils/pagedList'
import type { PagedListState } from '@/utils/pagedList'
import type { BoardTab } from '@/utils/wallBoard'

export const SAVED_ACTION_FAILED_MESSAGE = 'La acción no se completó'

export type SavedCard = WallJobCard | WallPortfolioCard

export const useSavedBoardStore = defineStore('savedBoard', () => {
  const lists = ref<Record<BoardTab, PagedListState<SavedCard>>>({
    jobs: emptyPagedList<SavedCard>(),
    portfolios: emptyPagedList<SavedCard>(),
  })
  const activeTab = ref<BoardTab>('jobs')
  const actionError = ref<string | null>(null)

  const tokens: Record<BoardTab, number> = { jobs: 0, portfolios: 0 }
  let removing = new Set<string>()

  async function run(tab: BoardTab, kind: 'first' | 'more'): Promise<void> {
    const request = startRequest(lists.value[tab], kind)

    if (!request.started)
      return

    const token = ++tokens[tab]

    lists.value[tab] = request.state
    try {
      const result = tab === 'jobs'
        ? await wallService.savedJobs(request.cursor)
        : await wallService.savedPortfolios(request.cursor)

      if (token !== tokens[tab])
        return
      lists.value[tab] = applyPage(lists.value[tab], { items: result.items as SavedCard[], next_cursor: result.next_cursor })
    }
    catch {
      if (token !== tokens[tab])
        return
      lists.value[tab] = applyFailure(lists.value[tab])
    }
  }

  function loadFirst(tab: BoardTab = activeTab.value): Promise<void> {
    return run(tab, 'first')
  }

  function loadMore(tab: BoardTab = activeTab.value): Promise<void> {
    return run(tab, 'more')
  }

  function retry(tab: BoardTab = activeTab.value): Promise<void> {
    return run(tab, retryKind(lists.value[tab]))
  }

  function setTab(tab: BoardTab) {
    activeTab.value = tab
  }

  /** Quita el guardado: la tarjeta se retira tras la confirmación del servidor; si falla, se conserva. */
  async function unsave(tab: BoardTab, id: number): Promise<void> {
    const key = `${tab}:${id}`

    if (removing.has(key))
      return

    const pending = removing

    pending.add(key)
    try {
      if (tab === 'jobs')
        await wallService.unsaveJob(id)
      else
        await wallService.unsavePortfolio(id)

      const list = lists.value[tab]

      lists.value[tab] = { ...list, items: list.items.filter(i => i.id !== id) }
    }
    catch {
      actionError.value = SAVED_ACTION_FAILED_MESSAGE
    }
    finally {
      pending.delete(key)
    }
  }

  function isRemoving(tab: BoardTab, id: number): boolean {
    return removing.has(`${tab}:${id}`)
  }

  function clearActionError() {
    actionError.value = null
  }

  function reset() {
    tokens.jobs++
    tokens.portfolios++
    lists.value = { jobs: emptyPagedList<SavedCard>(), portfolios: emptyPagedList<SavedCard>() }
    activeTab.value = 'jobs'
    actionError.value = null
    removing = new Set<string>()
  }

  return { lists, activeTab, actionError, loadFirst, loadMore, retry, setTab, unsave, isRemoving, clearActionError, reset }
})

export default useSavedBoardStore
