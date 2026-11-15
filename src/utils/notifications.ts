/**
 * Presentación y destino de notificaciones (C5/C6). Función pura: usa solo
 * `type` y `data`, sin llamadas de red.
 */

export interface NotificationLike {
  type: string
  data?: Record<string, unknown> | null
}

export interface NotificationDescription {
  title: string
  body: string
  icon: string
  to: string | null
}

const FALLBACK_ICON = 'ri-notification-3-line'
const FALLBACK_TITLE = 'Tienes una nueva notificación'

/** Devuelve el entero positivo si `v` lo es (number o string numérico), si no null. */
function posInt(v: unknown): number | null {
  const n = typeof v === 'string' && /^\d+$/.test(v.trim()) ? Number(v) : v
  return typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : null
}

function text(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null
}

export function describeNotification(n: NotificationLike): NotificationDescription {
  const type = typeof n?.type === 'string' ? n.type : ''
  const raw = n?.data
  const d: Record<string, unknown> = raw && typeof raw === 'object' ? raw : {}

  const actor = text(d.actor_name) ?? 'Un prestador'
  const actorGeneric = text(d.actor_name) ?? 'Alguien'
  const rawTitle = text(d.quote_request_title) ?? text(d.title)
  const req = rawTitle ? `«${rawTitle}»` : 'tu solicitud'
  const reason = text(d.reason)

  const qrId = posInt(d.quote_request_id)
  const quoteId = posInt(d.quote_id)
  const jobId = posInt(d.job_id)
  const channelId = posInt(d.channel_id)

  const make = (title: string, body: string, icon: string, to: string | null): NotificationDescription =>
    ({ title, body, icon, to })

  switch (type) {
    case 'quote_request.application_received':
      return make('Nueva postulación', `${actor} se postuló a ${req}`, 'ri-user-add-line',
        qrId ? `/quote-requests/${qrId}/applications` : null)
    case 'quote_request.edited':
      return make('Solicitud editada', `${req} fue modificada`, 'ri-file-list-3-line',
        qrId ? `/quote-requests/${qrId}` : null)
    case 'quote_request.closed':
      return make('Solicitud cerrada', `${req} fue cerrada`, 'ri-close-circle-line',
        qrId ? `/quote-requests/${qrId}` : null)
    case 'quote_request.provider_selected':
      return make('Fuiste seleccionado', `Te eligieron para ${req}`, 'ri-briefcase-line',
        qrId ? `/quote-requests/${qrId}` : null)
    case 'quote.received':
      return make('Nueva cotización recibida', `${actor} te envió una cotización para ${req}`, 'ri-file-list-3-line',
        qrId ? `/quotes/request/${qrId}` : quoteId ? `/quotes/${quoteId}` : null)
    case 'quote.expired':
      return make('Cotización expirada', `La cotización de ${req} expiró`, 'ri-time-line',
        quoteId ? `/quotes/${quoteId}` : null)
    case 'quote.rejected':
      return make('Cotización rechazada', `${text(d.actor_name) ?? 'El cliente'} rechazó tu cotización`, 'ri-close-circle-line',
        quoteId ? `/quotes/${quoteId}` : null)
    case 'quote.direct_requested':
      return make('Solicitud directa', `${text(d.actor_name) ?? 'Un cliente'} te pidió una cotización`, 'ri-file-list-3-line',
        quoteId ? `/quotes/${quoteId}` : null)
    case 'quote.direct_no_response':
      return make('Solicitud sin respuesta', `${actor} no respondió tu solicitud directa`, 'ri-time-line',
        quoteId ? `/quotes/${quoteId}` : null)
    case 'job.completion_requested':
      return make('Confirmar finalización', `${actor} marcó el trabajo como terminado`, 'ri-briefcase-line',
        jobId ? `/jobs/${jobId}` : null)
    case 'job.completion_rejected':
      return make('Finalización rechazada', reason ? `Motivo: ${reason}` : 'El cliente rechazó la finalización del trabajo',
        'ri-close-circle-line', jobId ? `/jobs/${jobId}` : null)
    case 'job.cancellation_requested':
      return make('Cancelación solicitada', reason ? `Motivo: ${reason}` : 'Se solicitó cancelar el trabajo',
        'ri-briefcase-line', jobId ? `/jobs/${jobId}` : null)
    case 'job.cancelled':
      return make('Trabajo cancelado', 'El trabajo fue cancelado', 'ri-close-circle-line',
        jobId ? `/jobs/${jobId}` : null)
    case 'rating.received':
      return make('Nueva calificación', `${actorGeneric} te calificó`, 'ri-star-line',
        jobId ? `/jobs/${jobId}` : null)
    case 'chat.message_received': {
      const preview = text(d.preview)
      const sender = text(d.actor_name)
      const body = sender && preview ? `${sender}: ${preview}` : preview ?? sender ?? 'Tienes un mensaje nuevo'
      return make('Nuevo mensaje', body, 'ri-chat-3-line', channelId ? `/chat/${channelId}` : null)
    }
    default:
      return make(FALLBACK_TITLE, 'Revisa tu centro de notificaciones para más detalles', FALLBACK_ICON, null)
  }
}
