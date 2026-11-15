/**
 * Servicio de notificaciones (tarea 14.4, Requisitos 12.3, 12.4, 12.5, 12.7).
 *
 * Envuelve las llamadas Axios a los endpoints del centro de notificaciones del
 * backend (`/api/v1/notifications`), reutilizando el cliente HTTP base
 * (`src/services/http.ts`), que ya inyecta el token Bearer y maneja los 401.
 *
 * Endpoints consumidos (todos requieren auth:sanctum):
 *  - `GET /notifications`               — listado (orden fecha desc, máx 200, Requisito 12.3)
 *  - `GET /notifications/unread-count`  — contador de no leídas ("99+" si >100, Requisito 12.4)
 *  - `PUT /notifications/{id}/read`     — marca una como leída (Requisito 12.5)
 *  - `PUT /notifications/read-all`      — marca todas como leídas (Requisito 12.7)
 *
 * Las respuestas siguen el envelope `{ data, message, errors?, meta? }`:
 *  - El listado se presenta bajo `data.notifications[]`.
 *  - El contador bajo `data.{ count, display }`.
 *  - La notificación marcada bajo `data.notification`.
 *  - El marcado masivo bajo `data.{ updated }`.
 */
import http from './http'
import type { ApiEnvelope } from './http'

/**
 * Representación de una notificación in-app tal como la expone la API. El campo
 * `data` es un objeto libre dependiente del `type` (postulación, cotización,
 * trabajo, calificación, chat, etc.), por eso se tipa como registro genérico.
 */
export interface Notification {
  id: number
  type: string
  data: Record<string, unknown>
  is_read: boolean
  read_at: string | null
  created_at: string | null
}

/**
 * Payload del evento `notification.new` transmitido en tiempo real por Reverb
 * en el canal privado `private-user.{userId}`. No incluye `read_at` porque una
 * notificación recién emitida nunca está leída.
 */
export interface NewNotificationPayload {
  id: number
  type: string
  data: Record<string, unknown>
  is_read: boolean
  created_at: string | null
}

/**
 * Contador de notificaciones no leídas. `count` es el número real; `display` es
 * la representación lista para la UI, que el backend recorta a "99+" cuando el
 * total supera 100 (Requisito 12.4).
 */
export interface UnreadCount {
  count: number
  display: string
}

export const notificationsService = {
  /**
   * Lista las notificaciones del usuario autenticado, ordenadas por fecha
   * descendente y acotadas a un máximo de 200 (Requisito 12.3). Responde
   * `{ data: { notifications } }`.
   */
  list(): Promise<Notification[]> {
    return http
      .get<ApiEnvelope<{ notifications: Notification[] }>>('/notifications')
      .then(res => res.data.data.notifications ?? [])
  },

  /**
   * Obtiene el contador de notificaciones no leídas junto a su representación
   * para la UI ("99+" si >100, Requisito 12.4). Responde
   * `{ data: { count, display } }`.
   */
  unreadCount(): Promise<UnreadCount> {
    return http
      .get<ApiEnvelope<UnreadCount>>('/notifications/unread-count')
      .then(res => res.data.data)
  },

  /**
   * Marca una notificación como leída (Requisito 12.5). Responde
   * `{ data: { notification } }` con la notificación actualizada.
   */
  markAsRead(id: number): Promise<Notification> {
    return http
      .put<ApiEnvelope<{ notification: Notification }>>(`/notifications/${id}/read`)
      .then(res => res.data.data.notification)
  },

  /**
   * Marca todas las notificaciones del usuario como leídas (Requisito 12.7).
   * Responde `{ data: { updated } }` con el número de notificaciones afectadas.
   */
  markAllAsRead(): Promise<number> {
    return http
      .put<ApiEnvelope<{ updated: number }>>('/notifications/read-all')
      .then(res => res.data.data.updated ?? 0)
  },
}

export default notificationsService
