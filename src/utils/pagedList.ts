/**
 * Lista paginada por cursor con una sola solicitud en vuelo (funciones puras).
 * Requisitos: 8.2, 8.3, 8.4, 8.5, 16.13.
 */

export interface PagedListState<T extends { id: number }> {
  items: T[]
  nextCursor: string | null
  loading: boolean
  loadError: boolean
  /** Tipo de la solicitud en curso o de la última fallida (para reintentar igual). */
  requestKind: 'first' | 'more' | null
}

export type PageRequestKind = 'first' | 'more'

export interface PageRequest<T extends { id: number }> {
  state: PagedListState<T>
  /** `false` si no debe lanzarse la solicitud (ya hay una en vuelo o no hay más páginas). */
  started: boolean
  /** Cursor a enviar (`null` para la primera página). */
  cursor: string | null
}

export function emptyPagedList<T extends { id: number }>(): PagedListState<T> {
  return { items: [], nextCursor: null, loading: false, loadError: false, requestKind: null }
}

/** Añade una página al final, en orden de llegada y sin ids repetidos. */
export function mergeById<T extends { id: number }>(items: readonly T[], page: readonly T[]): T[] {
  const seen = new Set<number>()
  const result: T[] = []

  for (const item of [...items, ...page]) {
    if (seen.has(item.id))
      continue
    seen.add(item.id)
    result.push(item)
  }

  return result
}

/**
 * Pide una página. `first` reinicia la lista; `more` exige un cursor siguiente.
 * Con una solicitud en vuelo no inicia otra.
 */
export function startRequest<T extends { id: number }>(
  state: PagedListState<T>,
  kind: PageRequestKind,
): PageRequest<T> {
  if (state.loading)
    return { state, started: false, cursor: null }

  if (kind === 'first') {
    return {
      state: { items: [], nextCursor: null, loading: true, loadError: false, requestKind: 'first' },
      started: true,
      cursor: null,
    }
  }

  if (state.nextCursor === null)
    return { state, started: false, cursor: null }

  return {
    state: { ...state, loading: true, loadError: false, requestKind: 'more' },
    started: true,
    cursor: state.nextCursor,
  }
}

/** Aplica una página recibida. */
export function applyPage<T extends { id: number }>(
  state: PagedListState<T>,
  page: { items: readonly T[], next_cursor: string | null },
): PagedListState<T> {
  const base = state.requestKind === 'first' ? [] : state.items

  return {
    items: mergeById(base, page.items),
    nextCursor: page.next_cursor,
    loading: false,
    loadError: false,
    requestKind: null,
  }
}

/** Un fallo conserva tarjetas y cursor; el reintento repite la misma solicitud. */
export function applyFailure<T extends { id: number }>(state: PagedListState<T>): PagedListState<T> {
  return { ...state, loading: false, loadError: true }
}

/** Tipo de solicitud a repetir tras un fallo. */
export function retryKind<T extends { id: number }>(state: PagedListState<T>): PageRequestKind {
  return state.requestKind ?? (state.items.length === 0 && state.nextCursor === null ? 'first' : 'more')
}
