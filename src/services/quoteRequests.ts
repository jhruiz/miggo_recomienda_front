/**
 * Servicio de solicitudes de cotización.
 *
 * Envuelve las llamadas Axios a los endpoints de Solicitudes_Cotización
 * (`/api/v1/quote-requests`), reutilizando el cliente HTTP base
 * (`src/services/http.ts`), que ya inyecta el token Bearer y maneja los 401.
 *
 * Endpoints consumidos:
 *  - `GET  /quote-requests`                           (público) — listado/filtrado paginado
 *  - `POST /quote-requests`                            (auth Cliente) — crear
 *  - `GET  /quote-requests/{id}`                       (público) — detalle
 *  - `PUT  /quote-requests/{id}`                       (dueño; solo "abierta") — editar
 *  - `POST /quote-requests/{id}/close`                 (dueño) — cerrar
 *  - `POST /quote-requests/{id}/apply`                 (auth + rol prestador) — postular
 *  - `GET  /quote-requests/{id}/applications`          (dueño) — listar postulaciones
 *  - `POST /quote-requests/{id}/select/{providerId}`   (dueño) — seleccionar ganador
 *
 * Todas las respuestas siguen el envelope `{ data, message, errors?, meta? }`.
 * Una solicitud se presenta bajo `data.quote_request`; las postulaciones bajo
 * `data.applications` y una postulación individual bajo `data.application`.
 */
import http from './http'
import type { ApiEnvelope, ApiMeta } from './http'

/** Estados posibles de una solicitud de cotización. */
export type QuoteRequestStatus = 'abierta' | 'en_proceso' | 'cerrada' | string

/** Categoría de servicio asociada a una solicitud. */
export interface QuoteRequestCategory {
  id: number
  name: string
  slug: string
}

/**
 * Ubicación canónica anidada (Ciudad → Departamento → País) que devuelve el
 * backend para derivar los selectores en cascada al editar (Requisito 15.10).
 */
export interface CityLocation {
  id: number
  name: string
  department_id: number
  department: {
    id: number
    name: string
    country_id: number
    country: {
      id: number
      name: string
    } | null
  } | null
}

/** Imagen de referencia adjunta a una solicitud. */
export interface ReferenceImage {
  id: number
  url: string
  thumb_url: string | null
}

/** Representación de una Solicitud_Cotización tal como la expone la API. */
export interface QuoteRequest {
  id: number
  client_user_id: number
  client_name: string | null
  /** Ausente en respuestas anónimas. */
  client_avatar_thumb_url?: string | null
  service_category_id: number
  category: QuoteRequestCategory | null
  title: string
  description: string
  // Ubicación canónica: la Ciudad del catálogo (Requisito 15.10).
  city_id: number | null
  city: CityLocation | null
  // Dirección_Referencia opcional (texto libre).
  location: string | null
  estimated_budget: number | null
  reference_images?: ReferenceImage[]
  status: QuoteRequestStatus
  created_at: string | null
  updated_at: string | null
}

/** Postulación de un Prestador a una solicitud (`data.applications[]`). */
export interface QuoteRequestApplication {
  id: number
  quote_request_id: number
  provider_user_id: number
  provider_name: string | null
  provider_avatar_thumb_url?: string | null
  applied_at: string | null
  created_at: string | null
}

/**
 * Filtros admitidos por el listado público de solicitudes (Requisito 4.3).
 *
 * La ubicación se filtra por identificadores del Catálogo_Ubicación
 * (`department_id`/`city_id`), de forma coherente con los selectores en
 * cascada del listado, en lugar del antiguo texto libre de ubicación.
 */
export interface QuoteRequestFilters {
  category?: string | null
  department_id?: number | null
  city_id?: number | null
  budget_min?: number | null
  budget_max?: number | null
  page?: number | null
  per_page?: number | null
}

/** Resultado paginado del listado de solicitudes. */
export interface QuoteRequestListResult {
  items: QuoteRequest[]
  meta: ApiMeta
  message?: string
}

/** Parámetros de `GET /quote-requests/my-applications`. */
export interface MyApplicationsParams {
  page?: number | null
  per_page?: number | null
}

/** Elemento de `GET /quote-requests/my-applications`. */
export interface MyApplicationItem {
  id: number
  applied_at: string | null
  quote_request: {
    id: number
    title: string
    status: QuoteRequestStatus
    client_name: string | null
    client_avatar_thumb_url?: string | null
    category_name: string | null
  }
  my_quote: { id: number, status: string, total_price: number } | null
  chat_channel_id: number | null
}

/** Resultado paginado de mis postulaciones. */
export interface MyApplicationsListResult {
  items: MyApplicationItem[]
  meta: ApiMeta
  message?: string
}

/** Payload para crear una solicitud (`POST /quote-requests`). */
export interface CreateQuoteRequestPayload {
  title: string
  description: string
  service_category_id: number
  // Ubicación canónica obligatoria: id de la Ciudad del catálogo.
  city_id: number
  // Departamento opcional: habilita la validación cruzada en el backend
  // (la ciudad debe pertenecer al departamento).
  department_id?: number | null
  // Dirección_Referencia opcional (texto libre, máx 255).
  location?: string | null
  estimated_budget?: number | null
  // Imágenes de referencia opcionales (máx 5, JPG/PNG/WEBP ≤10 MB). Si hay
  // alguna, la petición se envía como multipart con `reference_images[]`.
  reference_images?: File[]
}

/** Payload para editar una solicitud (`PUT /quote-requests/{id}`). */
export type UpdateQuoteRequestPayload = Partial<CreateQuoteRequestPayload>

export const REFERENCE_IMAGES_MAX = 5
export const REFERENCE_IMAGE_MAX_BYTES = 10 * 1024 * 1024
export const REFERENCE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

/**
 * Valida en cliente tipo/tamaño/cantidad de las imágenes de referencia
 * (Requisitos 4.13, 4.14). `alreadyAttached` descuenta las ya adjuntas.
 * Devuelve un mensaje de error o `null` si todo es válido.
 */
export function validateReferenceImages(files: File[], alreadyAttached = 0): string | null {
  if (files.length + alreadyAttached > REFERENCE_IMAGES_MAX)
    return `Una solicitud admite como máximo ${REFERENCE_IMAGES_MAX} imágenes de referencia.`

  for (const file of files) {
    if (!REFERENCE_IMAGE_TYPES.includes(file.type))
      return 'Tipo de archivo no permitido. Solo se aceptan imágenes JPG, PNG o WEBP.'
    if (file.size > REFERENCE_IMAGE_MAX_BYTES)
      return 'El tamaño de cada imagen no puede exceder los 10 MB.'
  }

  return null
}

/** Construye el `FormData` multipart (omite campos nulos/indefinidos). */
function buildFormData(payload: CreateQuoteRequestPayload | UpdateQuoteRequestPayload): FormData {
  const formData = new FormData()

  for (const [key, value] of Object.entries(payload)) {
    if (key === 'reference_images' || value === null || value === undefined)
      continue
    formData.append(key, String(value))
  }

  for (const file of payload.reference_images ?? [])
    formData.append('reference_images[]', file)

  return formData
}

/**
 * Elimina las claves con valor `null`/`undefined`/cadena vacía para no enviar
 * parámetros de consulta vacíos al backend.
 */
function cleanParams(filters: QuoteRequestFilters): Record<string, string | number> {
  const params: Record<string, string | number> = {}

  for (const [key, value] of Object.entries(filters)) {
    if (value === null || value === undefined)
      continue
    if (typeof value === 'string' && value.trim() === '')
      continue
    params[key] = typeof value === 'string' ? value.trim() : value
  }

  return params
}

export const quoteRequestsService = {
  /**
   * Listado y filtrado público paginado de solicitudes (Requisito 4.3). Útil
   * para que los prestadores naveguen y postulen. Una lista vacía NO es un
   * error: el backend responde 200 con un mensaje informativo.
   */
  list(filters: QuoteRequestFilters = {}): Promise<QuoteRequestListResult> {
    return http
      .get<ApiEnvelope<QuoteRequest[]>>('/quote-requests', { params: cleanParams(filters) })
      .then(res => ({
        items: res.data.data ?? [],
        meta: res.data.meta ?? {},
        message: res.data.message,
      }))
  },

  /** Postulaciones del Prestador autenticado (`GET /quote-requests/my-applications`). */
  listMyApplications(params: MyApplicationsParams = {}): Promise<MyApplicationsListResult> {
    const clean: Record<string, number> = {}

    if (params.page != null)
      clean.page = params.page
    if (params.per_page != null)
      clean.per_page = params.per_page

    return http
      .get<ApiEnvelope<MyApplicationItem[]>>('/quote-requests/my-applications', { params: clean })
      .then(res => ({
        items: res.data.data ?? [],
        meta: res.data.meta ?? {},
        message: res.data.message,
      }))
  },

  /** Detalle público de una solicitud. Responde `{ data: { quote_request } }`. */
  getById(id: number): Promise<QuoteRequest> {
    return http
      .get<ApiEnvelope<{ quote_request: QuoteRequest }>>(`/quote-requests/${id}`)
      .then(res => res.data.data.quote_request)
  },

  /**
   * Crea una nueva solicitud (Requisitos 4.1, 4.2). Requiere Cliente
   * autenticado. Responde 201 con `{ data: { quote_request } }`.
   */
  create(payload: CreateQuoteRequestPayload): Promise<QuoteRequest> {
    if (payload.reference_images?.length) {
      return http
        .post<ApiEnvelope<{ quote_request: QuoteRequest }>>(
          '/quote-requests',
          buildFormData(payload),
          { headers: { 'Content-Type': 'multipart/form-data' } },
        )
        .then(res => res.data.data.quote_request)
    }

    const { reference_images: _omit, ...json } = payload

    return http
      .post<ApiEnvelope<{ quote_request: QuoteRequest }>>('/quote-requests', json)
      .then(res => res.data.data.quote_request)
  },

  /**
   * Edita una solicitud "abierta" (Requisito 4.2/4.6). Solo el Cliente dueño.
   * El backend responde 409 si la solicitud ya no está "abierta".
   */
  update(id: number, payload: UpdateQuoteRequestPayload): Promise<QuoteRequest> {
    if (payload.reference_images?.length) {
      // PHP no parsea multipart en PUT: se usa POST con method spoofing.
      const formData = buildFormData(payload)

      formData.append('_method', 'PUT')

      return http
        .post<ApiEnvelope<{ quote_request: QuoteRequest }>>(
          `/quote-requests/${id}`,
          formData,
          { headers: { 'Content-Type': 'multipart/form-data' } },
        )
        .then(res => res.data.data.quote_request)
    }

    const { reference_images: _omit, ...json } = payload

    return http
      .put<ApiEnvelope<{ quote_request: QuoteRequest }>>(`/quote-requests/${id}`, json)
      .then(res => res.data.data.quote_request)
  },

  /**
   * Agrega imágenes de referencia a una solicitud "abierta" (Requisito 4.16).
   * 403 si no es el dueño; 409 si no está "abierta"; 422 si supera el tope.
   */
  addReferenceImages(id: number, files: File[]): Promise<QuoteRequest> {
    const formData = new FormData()

    for (const file of files)
      formData.append('reference_images[]', file)

    return http
      .post<ApiEnvelope<{ quote_request: QuoteRequest }>>(
        `/quote-requests/${id}/reference-images`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      .then(res => res.data.data.quote_request)
  },

  /** Elimina una imagen de referencia de una solicitud "abierta" (Requisito 4.16). */
  removeReferenceImage(id: number, mediaId: number): Promise<QuoteRequest> {
    return http
      .delete<ApiEnvelope<{ quote_request: QuoteRequest }>>(`/quote-requests/${id}/reference-images/${mediaId}`)
      .then(res => res.data.data.quote_request)
  },

  /** Cierra manualmente una solicitud "abierta" (Requisito 4.7). */
  close(id: number): Promise<QuoteRequest> {
    return http
      .post<ApiEnvelope<{ quote_request: QuoteRequest }>>(`/quote-requests/${id}/close`)
      .then(res => res.data.data.quote_request)
  },

  /**
   * Postula el Prestador autenticado a la solicitud (Requisito 4.4). Requiere
   * rol `prestador` activo. El backend responde 409 ante postulación duplicada
   * o si la solicitud no está "abierta".
   */
  apply(id: number): Promise<QuoteRequestApplication> {
    return http
      .post<ApiEnvelope<{ application: QuoteRequestApplication }>>(`/quote-requests/${id}/apply`)
      .then(res => res.data.data.application)
  },

  /**
   * Lista las postulaciones de una solicitud, para el Cliente dueño
   * (Requisito 4.4). 403 si el solicitante no es el dueño. Responde
   * `{ data: { applications } }`.
   */
  applications(id: number): Promise<QuoteRequestApplication[]> {
    return http
      .get<ApiEnvelope<{ applications: QuoteRequestApplication[] }>>(`/quote-requests/${id}/applications`)
      .then(res => res.data.data.applications ?? [])
  },

  /**
   * Selecciona al Prestador ganador (Requisito 4.5): cambia la solicitud a
   * "en proceso" y notifica al Prestador seleccionado. Solo el Cliente dueño.
   */
  selectProvider(id: number, providerId: number): Promise<QuoteRequest> {
    return http
      .post<ApiEnvelope<{ quote_request: QuoteRequest }>>(`/quote-requests/${id}/select/${providerId}`)
      .then(res => res.data.data.quote_request)
  },
}

export default quoteRequestsService
