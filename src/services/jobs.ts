/**
 * Servicio de trabajos.
 *
 * Envuelve las llamadas Axios a los endpoints de Trabajos (`/api/v1/jobs`),
 * reutilizando el cliente HTTP base (`src/services/http.ts`), que ya inyecta el
 * token Bearer y maneja los 401.
 *
 * Endpoints consumidos (todos requieren auth:sanctum):
 *  - `GET  /jobs`                      — trabajos donde el usuario es cliente o prestador
 *  - `GET  /jobs/{id}`                 — detalle (solo partes involucradas)
 *  - `POST /jobs/{id}/complete`        (Prestador) — marca completado (Requisito 7.3)
 *  - `POST /jobs/{id}/confirm`         (Cliente)   — estado → "completado" (Requisito 7.4)
 *  - `POST /jobs/{id}/reject-completion` (Cliente, { reason }) — mantiene "en progreso" (Requisito 7.6)
 *  - `POST /jobs/{id}/request-cancel`  (parte, { reason })     — solicita cancelación (Requisito 7.7)
 *  - `POST /jobs/{id}/confirm-cancel`  (parte, { reason })     — confirma cancelación (Requisito 7.7)
 *
 * Todas las respuestas siguen el envelope `{ data, message, errors?, meta? }`.
 * El listado se presenta bajo `data.jobs[]` y el detalle/acciones bajo `data.job`.
 */
import http from './http'
import type { ApiEnvelope } from './http'

/** Estados posibles de un Trabajo. */
export type JobStatus = 'en_progreso' | 'completado' | 'cancelado' | string

/**
 * Representación de un Trabajo tal como la expone la API.
 *
 * El sub-estado "esperando confirmación del cliente" NO es un `status`
 * independiente: corresponde a `status === 'en_progreso'` con
 * `actual_completion_date` no nulo (el Prestador ya marcó completado y el
 * Cliente aún no confirma ni rechaza).
 */
export interface JobPhoto {
  id: number
  original_url: string
  thumb_url: string | null
  medium_url: string | null
  conversions_ready: boolean
  created_at: string | null
}

export interface Job {
  id: number
  /** Momento de cierre por el Prestador (nulo mientras no ha cerrado). */
  completed_at?: string | null
  /** Fotos del Trabajo; el backend solo las expone al Prestador. */
  photos?: JobPhoto[]
  quote_id: number | null
  client_user_id: number
  client_name: string | null
  provider_user_id: number
  provider_name: string | null
  client_avatar_thumb_url?: string | null
  provider_avatar_thumb_url?: string | null
  status: JobStatus
  start_date: string | null
  estimated_delivery_date: string | null
  actual_completion_date: string | null
  rejection_reason: string | null
  client_requested_cancel: boolean
  provider_requested_cancel: boolean
  cancellation_reason: string | null
  created_at: string | null
  updated_at: string | null
}

/** Payload con motivo (≤500 chars) para rechazo de finalización y cancelación. */
export interface JobReasonPayload {
  reason: string
}

/** Trabajos completados que el usuario aún no ha calificado. */
export interface PendingRatingSummary {
  count: number
  job_ids: number[]
}

export const jobsService = {
  /** `GET /jobs/pending-rating` — responde `{ data: { count, job_ids } }`. */
  pendingRating(): Promise<PendingRatingSummary> {
    return http
      .get<ApiEnvelope<PendingRatingSummary>>('/jobs/pending-rating')
      .then(res => ({
        count: res.data.data.count ?? 0,
        job_ids: res.data.data.job_ids ?? [],
      }))
  },

  /**
   * Lista los Trabajos del usuario autenticado, ya sea como Cliente o como
   * Prestador. Responde `{ data: { jobs } }`.
   */
  list(): Promise<Job[]> {
    return http
      .get<ApiEnvelope<{ jobs: Job[] }>>('/jobs')
      .then(res => res.data.data.jobs ?? [])
  },

  /**
   * Detalle de un Trabajo. Solo las partes involucradas (403 en otro caso).
   * Responde `{ data: { job } }`.
   */
  getById(id: number): Promise<Job> {
    return http
      .get<ApiEnvelope<{ job: Job }>>(`/jobs/${id}`)
      .then(res => res.data.data.job)
  },

  /**
   * El Prestador marca el Trabajo como completado (Requisito 7.3): registra la
   * fecha real de finalización y queda a la espera de la confirmación del
   * Cliente (sigue en "en progreso"). Responde `{ data: { job } }`.
   */
  complete(id: number, files?: File[]): Promise<Job> {
    if (files && files.length > 0) {
      const formData = new FormData()

      for (const file of files)
        formData.append('photos[]', file)

      return http
        .post<ApiEnvelope<{ job: Job }>>(`/jobs/${id}/complete`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        .then(res => res.data.data.job)
    }

    return http
      .post<ApiEnvelope<{ job: Job }>>(`/jobs/${id}/complete`)
      .then(res => res.data.data.job)
  },

  /**
   * Agrega de 1 a 5 fotos al Trabajo en UNA sola petición multipart
   * (`photos[]`). Responde 201 con `{ data: { photos } }` (todas las fotos).
   */
  addPhotos(id: number, files: File[]): Promise<JobPhoto[]> {
    const formData = new FormData()

    for (const file of files)
      formData.append('photos[]', file)

    return http
      .post<ApiEnvelope<{ photos: JobPhoto[] }>>(`/jobs/${id}/photos`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then(res => res.data.data.photos ?? [])
  },

  /** Quita una foto del Trabajo. Responde `{ data: { photos } }` con las restantes. */
  removePhoto(id: number, photoId: number): Promise<JobPhoto[]> {
    return http
      .delete<ApiEnvelope<{ photos: JobPhoto[] }>>(`/jobs/${id}/photos/${photoId}`)
      .then(res => res.data.data.photos ?? [])
  },

  /**
   * El Cliente confirma la finalización (Requisito 7.4): el Trabajo pasa a
   * "completado". Responde `{ data: { job } }`.
   */
  confirm(id: number): Promise<Job> {
    return http
      .post<ApiEnvelope<{ job: Job }>>(`/jobs/${id}/confirm`)
      .then(res => res.data.data.job)
  },

  /**
   * El Cliente rechaza la finalización (Requisito 7.6): el Trabajo se mantiene
   * en "en progreso" y se guarda el motivo (≤500 chars). Responde
   * `{ data: { job } }`.
   */
  rejectCompletion(id: number, payload: JobReasonPayload): Promise<Job> {
    return http
      .post<ApiEnvelope<{ job: Job }>>(`/jobs/${id}/reject-completion`, payload)
      .then(res => res.data.data.job)
  },

  /**
   * Una de las partes solicita la cancelación por mutuo acuerdo (Requisito
   * 7.7): se guarda el motivo (≤500 chars) y se notifica a la otra parte; el
   * estado se mantiene. Responde `{ data: { job } }`.
   */
  requestCancel(id: number, payload: JobReasonPayload): Promise<Job> {
    return http
      .post<ApiEnvelope<{ job: Job }>>(`/jobs/${id}/request-cancel`, payload)
      .then(res => res.data.data.job)
  },

  /**
   * La otra parte confirma la cancelación (Requisito 7.7): con ambas
   * solicitudes el Trabajo pasa a "cancelado" conservando los motivos.
   * Responde `{ data: { job } }`.
   */
  confirmCancel(id: number, payload: JobReasonPayload): Promise<Job> {
    return http
      .post<ApiEnvelope<{ job: Job }>>(`/jobs/${id}/confirm-cancel`, payload)
      .then(res => res.data.data.job)
  },
}

export default jobsService
