/**
 * Servicio de cotizaciones.
 *
 * Envuelve las llamadas Axios a los endpoints de Cotizaciones
 * (`/api/v1/quotes`), reutilizando el cliente HTTP base (`src/services/http.ts`),
 * que ya inyecta el token Bearer y maneja los 401.
 *
 * Endpoints consumidos:
 *  - `POST /quotes`                     (auth + rol prestador) — crear (multipart)
 *  - `GET  /quotes/{id}`                (partes involucradas) — detalle
 *  - `GET  /quotes/request/{id}`        (Cliente dueño) — vista comparativa
 *  - `POST /quotes/{id}/accept`         (Cliente receptor) — aceptar
 *  - `POST /quotes/{id}/reject`         (Cliente receptor) — rechazar
 *
 * Todas las respuestas siguen el envelope `{ data, message, errors?, meta? }`.
 * Una cotización se presenta bajo `data.quote` (o `data.quotes[]` en la vista
 * comparativa); al aceptar, el backend devuelve además `data.job`.
 */
import http from './http'
import type { ApiEnvelope, ApiMeta } from './http'

/** Estados posibles de una cotización. */
export type QuoteStatus =
  | 'pendiente'
  | 'aceptada'
  | 'rechazada'
  | 'no_seleccionada'
  | 'expirada'
  | string

/** Ítem de una cotización tal como lo expone la API. */
export interface QuoteItem {
  id: number
  description: string
  unit_price: number
  quantity: number
  subtotal: number
}

/** Adjunto (imagen) de una cotización gestionado por Media Library. */
export interface QuoteAttachment {
  id: number
  url: string
  thumb_url: string | null
}

/** Representación de una Cotización tal como la expone la API. */
export interface Quote {
  id: number
  provider_user_id: number
  provider_name: string | null
  client_user_id: number
  client_name: string | null
  provider_avatar_thumb_url?: string | null
  client_avatar_thumb_url?: string | null
  quote_request_id: number | null
  type: string | null
  service_description: string
  total_price: number
  delivery_days: number
  expires_at: string | null
  status: QuoteStatus
  items: QuoteItem[]
  attachments: QuoteAttachment[]
  created_at: string | null
  updated_at: string | null

  // Campos aditivos de `GET /quotes/{id}` (detalle).
  quote_request?: { id: number; title: string; status: string } | null
  quote_request_title?: string | null
  job_id?: number | null
  job_status?: string | null
}

/** Resumen de cotización de `GET /quotes/sent` y `GET /quotes/received`. */
export interface QuoteSummary {
  id: number
  type: string | null
  status: QuoteStatus
  total_price: number
  delivery_days: number
  expires_at: string | null
  created_at: string | null
  provider_user_id: number
  provider_name: string | null
  client_user_id: number
  client_name: string | null
  provider_avatar_thumb_url?: string | null
  client_avatar_thumb_url?: string | null
  quote_request_id: number | null
  quote_request_title: string | null
  job_id: number | null

  /** Extracto del mensaje del Cliente; solo presente en la vista `awaiting`. */
  message_excerpt?: string | null
}

/** Parámetros de los listados `sent` / `received`. */
export interface QuoteListParams {
  page?: number | null
  per_page?: number | null
  status?: string | null

  /** Vista del listado `received`: por defecto `received`; `awaiting` = directas en espera. */
  view?: 'received' | 'awaiting' | null
}

/** Resultado paginado de los listados de cotizaciones. */
export interface QuoteListResult {
  items: QuoteSummary[]
  meta: ApiMeta
  message?: string
}

/** Trabajo creado al aceptar una cotización (`data.job`). */
export interface QuoteJob {
  id: number
  quote_id: number
  client_user_id: number
  provider_user_id: number
  status: string
  start_date: string | null
  estimated_delivery_date: string | null
  created_at: string | null
}

/** Ítem de línea para crear una cotización (lado cliente). */
export interface QuoteItemInput {
  description: string
  unit_price: number
  quantity: number
}

/** Payload para crear una cotización (`POST /quotes`). */
export interface CreateQuotePayload {
  quote_request_id: number
  service_description: string
  items: QuoteItemInput[]
  delivery_days: number
  expiration_days: number
  attachments?: File[]
}

/**
 * Payload para solicitar una Cotización directa a un Prestador concreto
 * (`POST /quotes/direct`). El Cliente indica el Prestador objetivo y,
 * opcionalmente, un mensaje describiendo lo que necesita (Requisito 10.1).
 */
export interface RequestDirectQuotePayload {
  provider_user_id: number

  /** Categoría del servicio solicitado; obligatoria (Requisito 18.8). */
  service_category_id: number
  message?: string | null
}

/**
 * Payload para que el Prestador responda a una solicitud de Cotización directa
 * con una Cotización estandarizada (`POST /quotes/direct/{id}/respond`). Aplica
 * las mismas reglas de formato que crear una cotización (Requisito 10.4) pero
 * sin `quote_request_id`: la Cotización directa no nace de una Solicitud pública.
 */
export type RespondDirectQuotePayload = Omit<CreateQuotePayload, 'quote_request_id'>

/** Resultado de aceptar una cotización: la cotización y el trabajo creado. */
export interface AcceptQuoteResult {
  quote: Quote
  job: QuoteJob
}

/**
 * Construye el `FormData` para crear una cotización, serializando los ítems y
 * adjuntos como arrays (`items[0][description]`, `attachments[]`) tal como los
 * espera el backend (`StoreQuoteRequest`).
 */
function appendQuoteBody(formData: FormData, payload: RespondDirectQuotePayload): void {
  formData.append('service_description', payload.service_description)
  formData.append('delivery_days', String(payload.delivery_days))
  formData.append('expiration_days', String(payload.expiration_days))

  payload.items.forEach((item, index) => {
    formData.append(`items[${index}][description]`, item.description)
    formData.append(`items[${index}][unit_price]`, String(item.unit_price))
    formData.append(`items[${index}][quantity]`, String(item.quantity))
  })

  for (const file of payload.attachments ?? [])
    formData.append('attachments[]', file)
}

function buildCreateFormData(payload: CreateQuotePayload): FormData {
  const formData = new FormData()

  formData.append('quote_request_id', String(payload.quote_request_id))
  appendQuoteBody(formData, payload)

  return formData
}

/**
 * `FormData` para responder una Cotización directa: idéntico al de creación
 * pero sin `quote_request_id` (la Cotización directa no tiene Solicitud previa).
 */
function buildRespondDirectFormData(payload: RespondDirectQuotePayload): FormData {
  const formData = new FormData()

  appendQuoteBody(formData, payload)

  return formData
}

/** Omite parámetros nulos, indefinidos o vacíos. */
function cleanListParams(params: QuoteListParams): Record<string, string | number> {
  const out: Record<string, string | number> = {}

  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '')
      continue
    out[key] = value
  }

  return out
}

export const quotesService = {
  /**
   * Crea una Cotización pública para la solicitud indicada (Requisito 5.1).
   * Envía multipart/form-data con los ítems y hasta 5 adjuntos. El backend
   * calcula `total_price` y responde 201 con `{ data: { quote } }`.
   */
  create(payload: CreateQuotePayload): Promise<Quote> {
    return http
      .post<ApiEnvelope<{ quote: Quote }>>(
        '/quotes',
        buildCreateFormData(payload),
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      .then(res => res.data.data.quote)
  },

  /**
   * El Cliente solicita una Cotización directa a un Prestador concreto
   * (Requisito 10.1). El backend crea una Cotización `type=directa` en estado
   * "solicitada" y responde 201 con `{ data: { quote } }`. Puede responder 422
   * si el Prestador no está activo (Requisito 10.5) o 409 si el Cliente ya tiene
   * 5 o más solicitudes activas hacia ese Prestador (Requisito 10.6).
   */
  requestDirect(payload: RequestDirectQuotePayload): Promise<Quote> {
    return http
      .post<ApiEnvelope<{ quote: Quote }>>('/quotes/direct', {
        provider_user_id: payload.provider_user_id,
        service_category_id: payload.service_category_id,
        ...(payload.message != null && payload.message !== ''
          ? { message: payload.message }
          : {}),
      })
      .then(res => res.data.data.quote)
  },

  /**
   * El Prestador objetivo responde a una solicitud de Cotización directa con
   * una Cotización estandarizada (Requisito 10.2/10.4). Envía
   * multipart/form-data con los ítems y hasta 5 adjuntos; la solicitud pasa de
   * "solicitada" a "pendiente". Responde `{ data: { quote } }`.
   */
  respondDirect(id: number, payload: RespondDirectQuotePayload): Promise<Quote> {
    return http
      .post<ApiEnvelope<{ quote: Quote }>>(
        `/quotes/direct/${id}/respond`,
        buildRespondDirectFormData(payload),
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      .then(res => res.data.data.quote)
  },

  /** Cotizaciones enviadas por el Prestador autenticado (`GET /quotes/sent`). */
  listSent(params: QuoteListParams = {}): Promise<QuoteListResult> {
    return http
      .get<ApiEnvelope<QuoteSummary[]>>('/quotes/sent', { params: cleanListParams(params) })
      .then(res => ({
        items: res.data.data ?? [],
        meta: res.data.meta ?? {},
        message: res.data.message,
      }))
  },

  /** Cotizaciones recibidas por el Cliente autenticado (`GET /quotes/received`). */
  listReceived(params: QuoteListParams = {}): Promise<QuoteListResult> {
    return http
      .get<ApiEnvelope<QuoteSummary[]>>('/quotes/received', { params: cleanListParams(params) })
      .then(res => ({
        items: res.data.data ?? [],
        meta: res.data.meta ?? {},
        message: res.data.message,
      }))
  },

  /**
   * Solicitudes de Cotización directa en espera de respuesta del Cliente
   * autenticado (`GET /quotes/received?view=awaiting`).
   */
  listAwaiting(params: QuoteListParams = {}): Promise<QuoteListResult> {
    return quotesService.listReceived({ ...params, view: 'awaiting' })
  },

  /**
   * Detalle de una cotización, para las partes involucradas (Prestador que la
   * creó o Cliente receptor). Responde `{ data: { quote } }`.
   */
  getById(id: number): Promise<Quote> {
    return http
      .get<ApiEnvelope<{ quote: Quote }>>(`/quotes/${id}`)
      .then(res => res.data.data.quote)
  },

  /**
   * Vista comparativa de las cotizaciones recibidas para una solicitud,
   * ordenadas de la más reciente a la más antigua (Requisito 5.6). Solo el
   * Cliente dueño. Responde `{ data: { quotes } }`.
   */
  forRequest(quoteRequestId: number): Promise<Quote[]> {
    return http
      .get<ApiEnvelope<{ quotes: Quote[] }>>(`/quotes/request/${quoteRequestId}`)
      .then(res => res.data.data.quotes ?? [])
  },

  /**
   * El Cliente receptor acepta la cotización (Requisito 5.7): se crea el
   * Trabajo y las demás cotizaciones de la solicitud pasan a "no seleccionada".
   * Responde `{ data: { quote, job } }`.
   */
  accept(id: number): Promise<AcceptQuoteResult> {
    return http
      .post<ApiEnvelope<{ quote: Quote; job: QuoteJob }>>(`/quotes/${id}/accept`)
      .then(res => ({ quote: res.data.data.quote, job: res.data.data.job }))
  },

  /**
   * El Cliente receptor rechaza la cotización (Requisito 5.8): pasa a
   * "rechazada" y se notifica al Prestador. Responde `{ data: { quote } }`.
   */
  reject(id: number): Promise<Quote> {
    return http
      .post<ApiEnvelope<{ quote: Quote }>>(`/quotes/${id}/reject`)
      .then(res => res.data.data.quote)
  },
}

export default quotesService
