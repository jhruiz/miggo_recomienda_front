/**
 * Servicio de calificaciones.
 *
 * Envuelve las llamadas Axios a los endpoints de Calificaciones
 * (`/api/v1/ratings`), reutilizando el cliente HTTP base
 * (`src/services/http.ts`), que ya inyecta el token Bearer y maneja los 401.
 *
 * Endpoints consumidos (todos requieren auth:sanctum):
 *  - `POST /ratings`             — Emite la Calificación del usuario autenticado
 *    sobre su contraparte en un Trabajo (Requisito 8.2). La validación de
 *    `score` (entero 1-5) y `comment` (10-500) se hace en el backend (422 sin
 *    persistir, Requisito 8.3); además puede devolver 409 (no habilitadas /
 *    duplicada / ventana cerrada) o 403 (no es parte del Trabajo).
 *  - `GET  /ratings/job/{job}`   — Lista las Calificaciones emitidas de un
 *    Trabajo; solo las partes involucradas (403 en otro caso). La exposición
 *    pública (doble ciego revelado) vive en el perfil del Prestador (Requisito
 *    8.5).
 *
 * Todas las respuestas siguen el envelope `{ data, message, errors?, meta? }`.
 * La emisión responde bajo `data.rating` y el listado bajo `data.ratings[]`.
 */
import http from './http'
import type { ApiEnvelope } from './http'

/**
 * Representación de una Calificación tal como la expone la API.
 *
 * `is_visible` indica si la Calificación ya fue revelada (doble ciego): mientras
 * ambas partes no hayan calificado o siga abierta la ventana, puede no ser
 * visible públicamente. Para las partes del Trabajo el listado incluye las
 * calificaciones ya emitidas.
 */
export interface Rating {
  id: number
  job_id: number
  rater_user_id: number
  rated_user_id: number
  score: number
  comment: string
  is_visible: boolean
  rated_at: string | null
  window_closes_at: string | null
}

/** Payload para emitir una Calificación (POST /ratings). */
export interface SubmitRatingPayload {
  job_id: number
  /** Entero 1-5. */
  score: number
  /** Comentario de 10 a 500 caracteres. */
  comment: string
}

export const ratingsService = {
  /**
   * Emite la Calificación del usuario autenticado sobre su contraparte en el
   * Trabajo (Requisito 8.2). Responde `{ data: { rating } }`.
   */
  submit(payload: SubmitRatingPayload): Promise<Rating> {
    return http
      .post<ApiEnvelope<{ rating: Rating }>>('/ratings', payload)
      .then(res => res.data.data.rating)
  },

  /**
   * Lista las Calificaciones emitidas de un Trabajo (solo partes involucradas).
   * Responde `{ data: { ratings } }`.
   */
  forJob(jobId: number): Promise<Rating[]> {
    return http
      .get<ApiEnvelope<{ ratings: Rating[] }>>(`/ratings/job/${jobId}`)
      .then(res => res.data.data.ratings ?? [])
  },
}

export default ratingsService
