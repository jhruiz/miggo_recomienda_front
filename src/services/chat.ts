/**
 * Servicio de chat.
 *
 * Envuelve las llamadas Axios a los endpoints de mensajería del backend
 * (`/api/v1/chat`), reutilizando el cliente HTTP base (`src/services/http.ts`),
 * que ya inyecta el token Bearer y maneja los 401 (tarea 13.6, Requisito 11.4).
 *
 * Endpoints consumidos (todos requieren auth:sanctum y ser participante):
 *  - `GET  /chat/channels`                     — canales del usuario (Requisito 11.6)
 *  - `GET  /chat/channels/{id}/messages`       — historial por cursor (50, Requisito 11.6)
 *  - `POST /chat/channels/{id}/messages`       — enviar mensaje (Requisitos 11.4, 11.5)
 *
 * Las respuestas siguen el envelope `{ data, message, errors?, meta? }`:
 *  - El listado de canales se presenta bajo `data.channels[]`.
 *  - El historial bajo `data.messages[]` con `meta.next_cursor` / `meta.has_more`.
 *  - El mensaje enviado bajo `data.message`.
 */
import http from './http'
import type { ApiEnvelope } from './http'

/** Estados posibles de un canal de Chat. */
export type ChatChannelStatus = 'activo' | 'pre_aceptacion' | 'cerrado' | string

/** Resumen de la Solicitud de origen de un canal. */
export interface ChatChannelQuoteRequest {
  id: number
  title: string
  status: string
  category_name: string | null
  city_name: string | null
}

/** Representación de un canal de Chat tal como la expone la API. */
export interface ChatChannel {
  id: number
  job_id: number | null
  quote_request_application_id: number | null
  client_user_id: number
  provider_user_id: number
  /** Nombres de las partes, para identificar a la contraparte. */
  client_name?: string | null
  provider_name?: string | null
  client_avatar_thumb_url?: string | null
  provider_avatar_thumb_url?: string | null
  /** Origen de la conversación: postulación a una Solicitud o Trabajo. */
  context?: 'postulacion' | 'trabajo'
  /** Solicitud de origen; null en Trabajos de cotización directa. */
  quote_request?: ChatChannelQuoteRequest | null
  job_status?: string | null
  quote_id?: number | null
  status: ChatChannelStatus
  created_at: string | null
  updated_at: string | null
}

/** Representación de un mensaje de Chat tal como la expone la API. */
export interface ChatMessage {
  id: number
  channel_id: number
  sender_user_id: number
  content: string
  sent_at_utc: string | null
  created_at: string | null
}

/** Resultado del historial paginado por cursor de un canal. */
export interface ChatMessagesResult {
  messages: ChatMessage[]
  nextCursor: string | null
  prevCursor: string | null
  hasMore: boolean
}

export const chatService = {
  /**
   * Lista los canales de Chat en los que participa el usuario autenticado,
   * ordenados por actividad más reciente. Responde `{ data: { channels } }`.
   */
  channels(): Promise<ChatChannel[]> {
    return http
      .get<ApiEnvelope<{ channels: ChatChannel[] }>>('/chat/channels')
      .then(res => res.data.data.channels ?? [])
  },

  /**
   * Historial de mensajes de un canal, ordenado cronológicamente (más antiguo
   * a más reciente) y paginado por cursor en páginas de hasta 50 (Requisito
   * 11.6). Un `cursor` opcional carga la página siguiente.
   */
  messages(channelId: number, cursor?: string | null): Promise<ChatMessagesResult> {
    return http
      .get<ApiEnvelope<{ messages: ChatMessage[] }>>(
        `/chat/channels/${channelId}/messages`,
        { params: cursor ? { cursor } : {} },
      )
      .then(res => ({
        messages: res.data.data.messages ?? [],
        nextCursor: (res.data.meta?.next_cursor as string | null) ?? null,
        prevCursor: (res.data.meta?.prev_cursor as string | null) ?? null,
        hasMore: Boolean(res.data.meta?.has_more),
      }))
  },

  /**
   * Envía un mensaje al canal. El contenido (1-2000 caracteres) se valida en el
   * backend (422 sin persistir, Requisito 11.8); un canal "cerrado" produce 409
   * (Requisito 11.7). Al persistir, el backend transmite el evento por Reverb
   * (Requisito 11.4) y notifica al receptor (Requisito 11.9). Responde
   * `{ data: { message } }` con el mensaje creado por el servidor.
   */
  send(channelId: number, content: string): Promise<ChatMessage> {
    return http
      .post<ApiEnvelope<{ message: ChatMessage }>>(
        `/chat/channels/${channelId}/messages`,
        { content },
      )
      .then(res => res.data.data.message)
  },
}

export default chatService
