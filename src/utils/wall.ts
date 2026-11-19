/**
 * Funciones puras del Muro de Portafolios (sin dependencias de Vue).
 * Requisitos: 3.14, 3.15, 4.1, 5.5, 5.7, 7.1, 7.7.
 */

/** Campos mínimos del ítem que usan estas utilidades (compatible con `WallJobCard` y `WallPortfolioCard`). */
export interface WallInteractiveItem {
  likes_count: number
  liked_by_me: boolean
  saved_by_me: boolean
}

export type InteractionAction = 'like' | 'unlike' | 'save' | 'unsave'

export type InteractionSnapshot = Pick<WallInteractiveItem, 'likes_count' | 'liked_by_me' | 'saved_by_me'>

/** Captura el estado previo de un ítem para poder revertir. */
export function snapshotInteraction(item: WallInteractiveItem): InteractionSnapshot {
  return { likes_count: item.likes_count, liked_by_me: item.liked_by_me, saved_by_me: item.saved_by_me }
}

/**
 * Aplica de forma optimista una acción. Devuelve un ítem nuevo (no muta el original).
 * El contador cambia ±1 solo si cambia el estado de Me gusta y nunca baja de 0.
 */
export function applyInteraction<T extends WallInteractiveItem>(item: T, action: InteractionAction): T {
  const base = Math.max(0, item.likes_count)

  switch (action) {
    case 'like':
      return item.liked_by_me
        ? { ...item, likes_count: base }
        : { ...item, liked_by_me: true, likes_count: base + 1 }
    case 'unlike':
      return item.liked_by_me
        ? { ...item, liked_by_me: false, likes_count: Math.max(0, base - 1) }
        : { ...item, likes_count: base }
    case 'save':
      return { ...item, saved_by_me: true, likes_count: base }
    case 'unsave':
      return { ...item, saved_by_me: false, likes_count: base }
  }
}

/** Restaura el estado de interacción previo (aplicar y revertir es la identidad). */
export function rollbackInteraction<T extends WallInteractiveItem>(item: T, snapshot: InteractionSnapshot): T {
  return {
    ...item,
    likes_count: snapshot.likes_count,
    liked_by_me: snapshot.liked_by_me,
    saved_by_me: snapshot.saved_by_me,
  }
}

/** Añade una página al final conservando el orden de llegada y omitiendo ids repetidos. */
export function appendPage<T extends { id: number }>(items: readonly T[], page: readonly T[]): T[] {
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

export const DEFAULT_POST_LOGIN_TARGET = '/wall'

/**
 * Devuelve `redirect` si es una ruta interna segura (empieza por `/`, no por `//`,
 * sin esquema ni barra invertida); en otro caso `/wall`.
 */
export function resolvePostLoginTarget(redirect: unknown): string {
  const value = Array.isArray(redirect) ? redirect[0] : redirect

  if (typeof value !== 'string' || value.length === 0)
    return DEFAULT_POST_LOGIN_TARGET
  if (!value.startsWith('/') || value.startsWith('//'))
    return DEFAULT_POST_LOGIN_TARGET
  if (value.includes('\\'))
    return DEFAULT_POST_LOGIN_TARGET
  // Caracteres de control (incluye tabuladores y saltos que algunos navegadores eliminan).
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001F\u007F]/.test(value))
    return DEFAULT_POST_LOGIN_TARGET

  return value
}

export const PROVIDER_NAME_MAX_LENGTH = 100
export const TRUNCATION_MARK = '…'

/** Limita el nombre a 100 caracteres visibles; si se recorta, termina en `…`. */
export function truncateProviderName(name: string, max: number = PROVIDER_NAME_MAX_LENGTH): string {
  const chars = Array.from(name)

  if (chars.length <= max)
    return name

  return chars.slice(0, max - 1).join('') + TRUNCATION_MARK
}

/** Tipo de sujeto del Muro nuevo. */
export type SubjectType = 'portfolio' | 'job'

/** Clave de sujeto `"{tipo}:{id}"` usada por el `ViewBatcher`. */
export function subjectKey(type: SubjectType, id: number): string {
  return `${type}:${id}`
}

/** Inversa de `subjectKey`; devuelve `null` si la clave no tiene la forma esperada. */
export function parseSubjectKey(key: string): { type: SubjectType, id: number } | null {
  const match = /^(portfolio|job):(\d+)$/.exec(key)

  return match ? { type: match[1] as SubjectType, id: Number(match[2]) } : null
}

export interface ViewBatcherOptions<K extends string | number = number> {
  send: (ids: K[]) => Promise<void>
  now: () => number
  maxBatch?: number
  minIntervalMs?: number
}

/**
 * Agrupa claves de sujetos vistos en lotes (ids numéricos o claves `"{tipo}:{id}"`).
 * Sin claves repetidas en la sesión, máximo `maxBatch` por lote y al menos
 * `minIntervalMs` entre envíos. Un fallo de envío no se reintenta.
 */
export class ViewBatcher<K extends string | number = number> {
  private readonly send: (ids: K[]) => Promise<void>
  private readonly now: () => number
  private readonly maxBatch: number
  private readonly minIntervalMs: number
  private readonly known = new Set<K>()
  private queue: K[] = []
  private lastSentAt: number | null = null
  private inFlight = false

  constructor(opts: ViewBatcherOptions<K>) {
    this.send = opts.send
    this.now = opts.now
    this.maxBatch = opts.maxBatch ?? 50
    this.minIntervalMs = opts.minIntervalMs ?? 5000
  }

  /** Ids en cola pendientes de envío. */
  get pending(): number {
    return this.queue.length
  }

  /** Ignora ids ya enviados o ya en cola en esta sesión. */
  enqueue(itemId: K): void {
    if (this.known.has(itemId))
      return
    this.known.add(itemId)
    this.queue.push(itemId)
  }

  /** Envía como máximo `maxBatch` ids, respetando `minIntervalMs` desde el último envío. */
  async flush(): Promise<void> {
    if (this.inFlight || this.queue.length === 0)
      return

    const current = this.now()
    if (this.lastSentAt !== null && current - this.lastSentAt < this.minIntervalMs)
      return

    const batch = this.queue.slice(0, this.maxBatch)

    this.queue = this.queue.slice(batch.length)
    this.lastSentAt = current
    this.inFlight = true

    try {
      await this.send(batch)
    }
    catch {
      // Sin reintentos: los ids ya cuentan como enviados en la sesión.
    }
    finally {
      this.inFlight = false
    }
  }
}
