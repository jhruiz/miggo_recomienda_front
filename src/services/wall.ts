/**
 * Servicio del Muro de portafolios (spec muro-de-portafolios).
 *
 * Endpoints consumidos (todos con auth):
 *  - `GET    /wall/jobs` y `/wall/portfolios` (meta: per_page, behavior_logging, privacy_answered)
 *  - `GET    /wall/jobs/{id}` y `/wall/portfolios/{id}`
 *  - `GET    /wall/filters?tab=jobs|portfolios`
 *  - `GET    /wall/saved/jobs` y `/wall/saved/portfolios`
 *  - `PUT    /wall/{jobs|portfolios}/{id}/like|save` (`DELETE` idem)
 *  - `POST   /wall/events`               (202 `{ accepted }`)
 *  - `GET    /wall/privacy`              `PUT` idem
 *  - `GET    /wall/privacy/events`       `DELETE` idem
 */
import http from './http'
import type { ApiEnvelope } from './http'

export type PrivacyStatus = 'unanswered' | 'enabled' | 'disabled'

export type FeedEventType = 'view' | 'like' | 'unlike' | 'save' | 'unsave' | 'open_provider_profile' | 'open_detail'

/** Tipo de sujeto del Muro nuevo (Tipo_Sujeto). */
export type SubjectType = 'portfolio' | 'job'

/** Pestaña del Muro: Trabajos o Portafolios. */
export type WallTab = 'jobs' | 'portfolios'

/**
 * Estado resultante de una acción Me gusta / Guardar.
 */
export interface InteractionState {
  subject_type: SubjectType
  subject_id: number
  liked: boolean
  saved: boolean
  likes_count: number
}

/** Metadatos de `GET /wall` (DD10). */
export interface WallFeedMeta {
  per_page: number
  behavior_logging: boolean
  privacy_answered: boolean
}

/** Parámetros de los listados `GET /wall/jobs` y `/wall/portfolios`. */
export interface WallTabParams {
  cursor?: string | null
  category_id?: number | null
  city?: string | null
}

export interface WallCategoryFilter {
  id: number
  name: string
  slug: string
  items_count: number
}

export interface WallCityFilter {
  name: string
  items_count: number
}

/** Filtros de la pestaña Trabajos (`GET /wall/filters?tab=jobs`). */
export interface WallFilters {
  categories: WallCategoryFilter[]
  cities: WallCityFilter[]
}

/** Filtros de la pestaña Portafolios (`GET /wall/filters?tab=portfolios`). */
export interface WallPortfolioFilters {
  categories: { id: number, name: string, slug: string, portfolios_count: number }[]
  cities: { name: string, portfolios_count: number }[]
}

/** Filtros por pestaña. */
export interface WallFiltersByTab {
  jobs: WallFilters
  portfolios: WallPortfolioFilters
}

/** Tipos de evento que el cliente envía a `POST /wall/events` en el Muro nuevo. */
export type WallEventType = 'view' | 'open_provider_profile' | 'open_detail'

/** Evento de comportamiento por sujeto (máx. 50 por lote). */
export interface WallEventPayload {
  subject_type: SubjectType
  subject_id: number
  type: WallEventType
  occurred_at: string
}

/** Resumen de privacidad (`FeedPreferenceResource`). */
export interface PrivacySummary {
  status: PrivacyStatus
  behavior_logging: boolean
  consented_at: string | null
  events_total: number
  /** Puede incluir además `open_detail`. */
  events_by_type: Record<FeedEventType, number>
  events_by_subject_type: Record<SubjectType, number>
  oldest_event_at: string | null
}

export interface FeedEventHistoryItem {
  id: number
  type: FeedEventType
  /** Nulo en eventos antiguos de fotos. */
  subject_type: SubjectType | null
  subject: { id: number, name: string | null, thumb_url: string | null } | null
  created_at: string
}

// ---------------------------------------------------------------------------
// Muro de Trabajos y Portafolios (spec muro-trabajos-portafolios)
// ---------------------------------------------------------------------------

export interface WallCategoryRef {
  id: number
  name: string
  slug: string
}

/** Foto de un Trabajo o de un Portafolio. `alt` solo viene en fotos de Portafolio. */
export interface WallPhoto {
  id: number
  thumb_url: string
  thumb_width: number | null
  thumb_height: number | null
  medium_url: string
  medium_width: number | null
  medium_height: number | null
  alt?: string
}

export type ComplianceKind = 'early' | 'on_time' | 'late' | 'unknown'

export interface ComplianceSummary {
  kind: ComplianceKind
  days: number | null
  text: string
}

/** Calificación del Cliente ya revelada. */
export interface ClientRating {
  score: number
  comment?: string
}

export interface WallJobCard {
  id: number
  category: WallCategoryRef | null
  provider: {
    id: number | null
    name: string | null
    city: string | null
    compliance_index: number | null
  }
  compliance_summary: ComplianceSummary
  client_label: string
  rating: ClientRating | null
  photos: WallPhoto[]
  likes_count: number
  liked_by_me: boolean
  saved_by_me: boolean
  can_rate_by_me: boolean
  completed_at: string | null
}

export interface WallJobDetail extends WallJobCard {
  estimated_delivery_date: string | null
  actual_completion_date: string | null
}

export type WallPortfolioLayout = 'cover' | 'collage'

export interface WallPortfolioProvider {
  id: number
  name: string
  city: string | null
}

export interface WallPortfolioCard {
  id: number
  name: string
  category: WallCategoryRef | null
  provider: WallPortfolioProvider
  photos_count: number
  layout: WallPortfolioLayout
  covers: WallPhoto[]
  likes_count: number
  liked_by_me: boolean
  saved_by_me: boolean
  created_at: string | null
}

export interface WallPortfolioDetail {
  id: number
  name: string
  description: string | null
  category: WallCategoryRef | null
  provider: WallPortfolioProvider
  photos_count: number
  photos: WallPhoto[]
  likes_count: number
  liked_by_me: boolean
  saved_by_me: boolean
  created_at: string | null
}

/** Página de un listado de la pestaña. */
export interface WallTabPage<T> {
  items: T[]
  next_cursor: string | null
}

export interface WallTabResult<T> extends WallTabPage<T> {
  meta: WallFeedMeta
}

export interface WallSavedTabResult<T> extends WallTabPage<T> {
  meta: { per_page: number }
}

export interface FeedEventHistoryPage {
  events: FeedEventHistoryItem[]
  next_cursor: string | null
}

const BASE = '/wall'
const INTERACTION_TIMEOUT_MS = 10000

/** Quita parámetros vacíos para no enviar `''` ni `null` (el backend los rechaza). */
function cleanParams(params: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== null && v !== undefined && v !== ''),
  )
}

const SUBJECT_PATH: Record<SubjectType, string> = { job: 'jobs', portfolio: 'portfolios' }

function subjectInteraction(
  method: 'put' | 'delete',
  subject: SubjectType,
  id: number,
  action: 'like' | 'save',
): Promise<InteractionState> {
  return http
    .request<ApiEnvelope<InteractionState>>({
      method,
      url: `${BASE}/${SUBJECT_PATH[subject]}/${id}/${action}`,
      timeout: INTERACTION_TIMEOUT_MS,
    })
    .then(res => res.data.data)
}

function tabPage<T>(res: { data: ApiEnvelope<{ items: T[], next_cursor: string | null }> }): WallTabPage<T> {
  return {
    items: res.data.data.items ?? [],
    next_cursor: res.data.data.next_cursor ?? null,
  }
}

function fetchFilters<T extends WallTab>(tab: T): Promise<WallFiltersByTab[T]>
function fetchFilters(tab: WallTab): Promise<WallFilters | WallPortfolioFilters> {
  return http
    .get<ApiEnvelope<WallFilters | WallPortfolioFilters>>(`${BASE}/filters`, { params: cleanParams({ tab }) })
    .then(res => ({
      categories: res.data.data.categories ?? [],
      cities: res.data.data.cities ?? [],
    }) as WallFilters | WallPortfolioFilters)
}

export const wallService = {
  // ----- Muro nuevo: Trabajos y Portafolios -----

  /** Página de la pestaña Trabajos. */
  jobs(params: WallTabParams = {}): Promise<WallTabResult<WallJobCard>> {
    return http
      .get<ApiEnvelope<{ items: WallJobCard[], next_cursor: string | null }>>(`${BASE}/jobs`, { params: cleanParams({ ...params }) })
      .then(res => ({ ...tabPage(res), meta: res.data.meta as unknown as WallFeedMeta }))
  },

  /** Página de la pestaña Portafolios. */
  portfolios(params: WallTabParams = {}): Promise<WallTabResult<WallPortfolioCard>> {
    return http
      .get<ApiEnvelope<{ items: WallPortfolioCard[], next_cursor: string | null }>>(`${BASE}/portfolios`, { params: cleanParams({ ...params }) })
      .then(res => ({ ...tabPage(res), meta: res.data.meta as unknown as WallFeedMeta }))
  },

  jobDetail(id: number): Promise<WallJobDetail> {
    return http
      .get<ApiEnvelope<WallJobDetail>>(`${BASE}/jobs/${id}`)
      .then(res => res.data.data)
  },

  portfolioDetail(id: number): Promise<WallPortfolioDetail> {
    return http
      .get<ApiEnvelope<WallPortfolioDetail>>(`${BASE}/portfolios/${id}`)
      .then(res => res.data.data)
  },

  /** Trabajos guardados del usuario. */
  savedJobs(cursor?: string | null): Promise<WallSavedTabResult<WallJobCard>> {
    return http
      .get<ApiEnvelope<{ items: WallJobCard[], next_cursor: string | null }>>(`${BASE}/saved/jobs`, { params: cleanParams({ cursor }) })
      .then(res => ({ ...tabPage(res), meta: res.data.meta as unknown as { per_page: number } }))
  },

  /** Portafolios guardados del usuario. */
  savedPortfolios(cursor?: string | null): Promise<WallSavedTabResult<WallPortfolioCard>> {
    return http
      .get<ApiEnvelope<{ items: WallPortfolioCard[], next_cursor: string | null }>>(`${BASE}/saved/portfolios`, { params: cleanParams({ cursor }) })
      .then(res => ({ ...tabPage(res), meta: res.data.meta as unknown as { per_page: number } }))
  },

  likeJob(id: number): Promise<InteractionState> {
    return subjectInteraction('put', 'job', id, 'like')
  },

  unlikeJob(id: number): Promise<InteractionState> {
    return subjectInteraction('delete', 'job', id, 'like')
  },

  saveJob(id: number): Promise<InteractionState> {
    return subjectInteraction('put', 'job', id, 'save')
  },

  unsaveJob(id: number): Promise<InteractionState> {
    return subjectInteraction('delete', 'job', id, 'save')
  },

  likePortfolio(id: number): Promise<InteractionState> {
    return subjectInteraction('put', 'portfolio', id, 'like')
  },

  unlikePortfolio(id: number): Promise<InteractionState> {
    return subjectInteraction('delete', 'portfolio', id, 'like')
  },

  savePortfolio(id: number): Promise<InteractionState> {
    return subjectInteraction('put', 'portfolio', id, 'save')
  },

  unsavePortfolio(id: number): Promise<InteractionState> {
    return subjectInteraction('delete', 'portfolio', id, 'save')
  },

  /** Categorías y ciudades con conteo de la pestaña (`?tab=jobs|portfolios`). */
  filters: fetchFilters,

  /**
   * Envía un lote de eventos (202) con `subject_type` y `subject_id`.
   */
  sendEvents(events: WallEventPayload[]): Promise<{ accepted: number }> {
    return http
      .post<ApiEnvelope<{ accepted: number }>>(`${BASE}/events`, { events })
      .then(res => res.data.data)
  },

  /** Estado de privacidad y resumen del registro de comportamiento. */
  privacy(): Promise<PrivacySummary> {
    return http
      .get<ApiEnvelope<PrivacySummary>>(`${BASE}/privacy`)
      .then(res => res.data.data)
  },

  /** Activa o desactiva el registro de comportamiento. */
  setPrivacy(behaviorLogging: boolean): Promise<PrivacySummary> {
    return http
      .put<ApiEnvelope<PrivacySummary>>(`${BASE}/privacy`, { behavior_logging: behaviorLogging })
      .then(res => res.data.data)
  },

  /** Historial paginado de eventos del usuario. */
  privacyEvents(cursor?: string | null): Promise<FeedEventHistoryPage> {
    return http
      .get<ApiEnvelope<FeedEventHistoryPage>>(`${BASE}/privacy/events`, { params: cleanParams({ cursor }) })
      .then(res => ({
        events: res.data.data.events ?? [],
        next_cursor: res.data.data.next_cursor ?? null,
      }))
  },

  /** Restablece el muro: borra todos los eventos del usuario. */
  resetEvents(): Promise<{ deleted_count: number }> {
    return http
      .delete<ApiEnvelope<{ deleted_count: number }>>(`${BASE}/privacy/events`)
      .then(res => res.data.data)
  },
}

export default wallService
