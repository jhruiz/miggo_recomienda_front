/**
 * Funciones puras del Muro de Trabajos y Portafolios (sin dependencias de Vue).
 * Requisitos: 1.2 a 1.5, 3.1 a 3.6, 4.2, 4.3, 7.4 a 7.6, 8.13, 8.14, 8.15, 13.2, 13.4, 13.6.
 */

export type BoardTab = 'jobs' | 'portfolios'

export const BOARD_TABS: readonly BoardTab[] = ['jobs', 'portfolios']
export const DEFAULT_BOARD_TAB: BoardTab = 'jobs'
export const CITY_MAX_LENGTH = 100
export const RESTORE_TTL_MS = 15 * 60 * 1000
export const CLIENT_LABEL = 'Cliente verificado'
export const UNRATED_TEXT = 'Aún sin calificar'
export const COMMENT_MAX_LINES = 3

// ---------------------------------------------------------------- Rejilla

/** 1 columna por debajo de 600 px, 2 de 600 a 959 px y 3 desde 960 px. */
export function boardColumnsForWidth(widthPx: number): 1 | 2 | 3 {
  if (widthPx >= 960)
    return 3
  if (widthPx >= 600)
    return 2

  return 1
}

// ------------------------------------------------------ Estado en la dirección

export interface BoardQueryState {
  tab: BoardTab
  category: number | null
  city: string | null
}

type QueryValue = unknown

function firstValue(value: QueryValue): unknown {
  return Array.isArray(value) ? value[0] : value
}

/** Lee el estado del Muro de la dirección. Valores inválidos: pestaña `jobs` y filtro descartado. */
export function parseBoardQuery(query: Record<string, QueryValue> | null | undefined): BoardQueryState {
  const source = query ?? {}
  const rawTab = firstValue(source.tab)
  const tab: BoardTab = rawTab === 'portfolios' ? 'portfolios' : 'jobs'

  const rawCategory = firstValue(source.category)
  let category: number | null = null

  if (typeof rawCategory === 'string' && /^[1-9]\d*$/.test(rawCategory)) {
    const parsed = Number(rawCategory)

    category = Number.isSafeInteger(parsed) ? parsed : null
  }
  else if (typeof rawCategory === 'number' && Number.isSafeInteger(rawCategory) && rawCategory > 0) {
    category = rawCategory
  }

  const rawCity = firstValue(source.city)
  const city = typeof rawCity === 'string' && rawCity.length > 0 && Array.from(rawCity).length <= CITY_MAX_LENGTH
    ? rawCity
    : null

  return { tab, category, city }
}

/** Serializa el estado a parámetros de dirección; omite los filtros ausentes. */
export function buildBoardQuery(state: BoardQueryState): Record<string, string> {
  const query: Record<string, string> = { tab: state.tab }

  if (state.category !== null && Number.isSafeInteger(state.category) && state.category > 0)
    query.category = String(state.category)
  if (state.city !== null && state.city.length > 0)
    query.city = state.city

  return query
}

// ------------------------------------------------------------ Pestañas

/** Teclado de las pestañas: flechas alternan, Inicio la primera, Fin la última; otra tecla no cambia. */
export function nextTabKey(current: BoardTab, key: string): BoardTab {
  const index = BOARD_TABS.indexOf(current)

  switch (key) {
    case 'ArrowLeft':
      return BOARD_TABS[(index - 1 + BOARD_TABS.length) % BOARD_TABS.length]
    case 'ArrowRight':
      return BOARD_TABS[(index + 1) % BOARD_TABS.length]
    case 'Home':
      return BOARD_TABS[0]
    case 'End':
      return BOARD_TABS[BOARD_TABS.length - 1]
    default:
      return current
  }
}

// ------------------------------------------------- Restauración del estado

export interface BoardFilters {
  category: number | null
  city: string | null
}

export interface BoardSnapshot {
  filtersKey: string
  loadedAt: number
}

/** `"{category}|{city}"` en minúsculas. */
export function boardFiltersKey(filters: BoardFilters): string {
  return `${filters.category ?? ''}|${filters.city ?? ''}`.toLowerCase()
}

/** `restore` si hay instantánea de la pestaña con los mismos filtros y dentro del TTL; si no, `load`. */
export function restoreDecision(
  snapshot: BoardSnapshot | null | undefined,
  _tab: BoardTab,
  filters: BoardFilters,
  now: number,
): 'restore' | 'load' {
  if (!snapshot)
    return 'load'
  if (snapshot.filtersKey !== boardFiltersKey(filters))
    return 'load'
  if (now - snapshot.loadedAt > RESTORE_TTL_MS)
    return 'load'

  return 'restore'
}

// ------------------------------------------------------------- Imágenes

export function formatPhotoCount(count: number): string {
  return count === 1 ? '1 foto' : `${count} fotos`
}

export interface AltTextInput {
  description?: string | null
  portfolioName?: string | null
  providerName?: string | null
  categoryName?: string | null
}

/**
 * Texto alternativo no vacío: la descripción; si no, el nombre del Portafolio; si no,
 * "Foto del trabajo de {Prestador} en {Categoría}".
 */
export function imageAltText(input: AltTextInput): string {
  const description = (input.description ?? '').trim()

  if (description !== '')
    return description

  const portfolioName = (input.portfolioName ?? '').trim()

  if (portfolioName !== '')
    return portfolioName

  const provider = (input.providerName ?? '').trim() || 'un prestador'
  const category = (input.categoryName ?? '').trim()

  return `Foto del trabajo de ${provider}${category !== '' ? ` en ${category}` : ''}`
}

// -------------------------------------------------------- Tarjeta_Trabajo

export interface BoardPhoto {
  id: number
  thumb_url: string
  thumb_width: number | null
  thumb_height: number | null
  alt?: string
}

export interface JobCardInput {
  id: number
  category: { id: number, name: string, slug: string } | null
  provider: { id: number | null, name: string | null, city: string | null, compliance_index?: number | null }
  compliance_summary?: { text: string } | null
  rating: { score: number, comment?: string | null } | null
  photos: readonly BoardPhoto[]
  can_rate_by_me: boolean
}

export interface CardImage {
  url: string
  width: number | null
  height: number | null
  alt: string
}

export interface JobCardModel {
  hasRating: boolean
  filledStars: number
  emptyStars: number
  scoreText: string | null
  ratingLabel: string | null
  unratedText: string | null
  comment: string | null
  commentMaxLines: number
  mainPhoto: CardImage | null
  showPlaceholder: boolean
  placeholderCategorySlug: string | null
  placeholderDecorative: boolean
  clientLabel: string
  complianceText: string | null
  complianceIndex: number | null
  showRateCall: boolean
}

/** Índice de cumplimiento como porcentaje entero (0 a 100) u omitido (`null`). */
export function complianceIndexPercent(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value))
    return null

  return Math.min(100, Math.max(0, Math.round(value)))
}

export function jobCardModel(job: JobCardInput): JobCardModel {
  const rating = job.rating
  const score = rating ? Math.min(5, Math.max(1, Math.round(rating.score))) : 0
  const comment = rating?.comment?.trim() ? rating.comment.trim() : null
  const first = job.photos.length > 0 ? job.photos[0] : null
  const categoryName = job.category?.name ?? null

  return {
    hasRating: rating !== null,
    filledStars: score,
    emptyStars: rating ? 5 - score : 0,
    scoreText: rating ? String(score) : null,
    ratingLabel: rating ? `Calificación ${score} de 5` : null,
    unratedText: rating ? null : UNRATED_TEXT,
    comment,
    commentMaxLines: COMMENT_MAX_LINES,
    mainPhoto: first
      ? {
          url: first.thumb_url,
          width: first.thumb_width,
          height: first.thumb_height,
          alt: imageAltText({
            description: first.alt,
            providerName: job.provider.name,
            categoryName,
          }),
        }
      : null,
    showPlaceholder: first === null,
    placeholderCategorySlug: job.category?.slug ?? null,
    placeholderDecorative: categoryName !== null,
    clientLabel: CLIENT_LABEL,
    complianceText: job.compliance_summary?.text ?? null,
    complianceIndex: complianceIndexPercent(job.provider.compliance_index),
    showRateCall: job.can_rate_by_me === true,
  }
}

// --------------------------------------------------- Tarjeta_Portafolio

export interface PortfolioCardInput {
  id: number
  name: string
  category: { id: number, name: string, slug: string } | null
  provider: { id: number | null, name: string | null, city: string | null }
  photos_count: number
  covers: readonly BoardPhoto[]
}

export interface PortfolioCardModel {
  layout: 'cover' | 'collage'
  thumbs: CardImage[]
  photoCountLabel: string
}

export const COLLAGE_MAX_THUMBS = 4

/** Portada con 1 o 2 fotos; Collage con 3 o más (`min(n, 4)` miniaturas). */
export function portfolioCardModel(portfolio: PortfolioCardInput): PortfolioCardModel {
  const count = Math.max(0, Math.floor(portfolio.photos_count))
  const layout = count >= 3 ? 'collage' : 'cover'
  const wanted = layout === 'collage' ? Math.min(count, COLLAGE_MAX_THUMBS) : Math.min(count, 1)

  const thumbs = portfolio.covers.slice(0, wanted).map(photo => ({
    url: photo.thumb_url,
    width: photo.thumb_width,
    height: photo.thumb_height,
    alt: imageAltText({
      description: photo.alt,
      portfolioName: portfolio.name,
      providerName: portfolio.provider.name,
      categoryName: portfolio.category?.name,
    }),
  }))

  return { layout, thumbs, photoCountLabel: formatPhotoCount(count) }
}
