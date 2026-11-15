/**
 * Servicio de prestadores.
 *
 * Envuelve las llamadas Axios a los endpoints de descubrimiento y gestión de
 * perfiles de Prestador, reutilizando el cliente HTTP base
 * (`src/services/http.ts`), que ya inyecta el token Bearer y maneja los 401.
 *
 * Endpoints consumidos:
 *  - `GET /providers`                              (público) — listado/búsqueda
 *  - `GET /providers/{id}`                         (público) — perfil público
 *  - `PUT /profile/provider`                       (auth + rol prestador)
 *
 * Los portafolios se gestionan en `services/portfolios.ts`.
 *
 * Todas las respuestas siguen el envelope `{ data, message, errors?, meta? }`.
 */
import http from './http'
import type { ApiEnvelope, ApiMeta } from './http'
import type { CityLocation } from './quoteRequests'
import type { PublicPortfolio } from './portfolios'

/** Categoría de servicio asociada a un prestador. */
export interface ProviderCategory {
  id: number
  name: string
  slug: string
}

/**
 * El backend devuelve `average_rating` como número cuando hay calificaciones,
 * o la etiqueta "Sin calificaciones" cuando no las hay. De forma análoga,
 * `compliance_index` es un entero o la etiqueta "Sin datos suficientes".
 */
export type AverageRating = number | string
export type ComplianceIndex = number | string

/** Reseña recibida por el prestador (orden por fecha descendente). */
export interface ProviderReview {
  id: number
  score: number
  comment: string | null
  rater_name: string | null
  rater_avatar_thumb_url?: string | null
  created_at: string | null
}

/** Elemento del listado público de prestadores (`GET /providers`). */
export interface ProviderListItem {
  id: number
  user_id: number
  name: string | null
  avatar_thumb_url?: string | null
  professional_description: string | null
  location: string | null
  categories: ProviderCategory[]
  average_rating: AverageRating
  compliance_index: ComplianceIndex
  completed_jobs_count: number
}

/** Perfil público completo (`GET /providers/{id}`). */
export interface ProviderPublicProfile {
  id: number
  user_id: number
  name: string | null
  avatar_url?: string | null
  avatar_thumb_url?: string | null
  professional_description: string | null
  location: string | null
  is_active?: boolean
  categories: ProviderCategory[]
  portfolios: PublicPortfolio[]
  average_rating: AverageRating
  compliance_index: ComplianceIndex
  completed_jobs_count: number
  reviews: ProviderReview[]
}

/**
 * Filtros admitidos por el listado público de prestadores (Requisito 13).
 *
 * La ubicación se filtra por identificadores del Catálogo_Ubicación
 * (`department_id`/`city_id`, Requisitos 13.2, 13.8, 13.9) en lugar de texto
 * libre. Si solo se envía `department_id`, se esperan los prestadores cuya
 * Ciudad pertenece a ese Departamento; al añadir `city_id` se acota a la Ciudad.
 */
export interface ProviderSearchFilters {
  category?: string | null
  department_id?: number | null
  city_id?: number | null
  rating_min?: number | null
  rating_max?: number | null
  search?: string | null
  page?: number | null
  per_page?: number | null
}

/** Resultado paginado del listado de prestadores. */
export interface ProviderListResult {
  items: ProviderListItem[]
  meta: ApiMeta
  message?: string
}

/** Datos editables del perfil de prestador (`PUT /profile/provider`). */
export interface UpdateProviderProfilePayload {
  professional_description?: string | null
  // Ubicación canónica: id de la Ciudad del catálogo (opcional en el perfil).
  city_id?: number | null
  // Departamento opcional: habilita la validación cruzada en el backend.
  department_id?: number | null
  // Dirección_Referencia opcional (texto libre, máx 255).
  location?: string | null
}

/** Perfil de prestador propio (lo devuelven activate/update). */
export interface OwnProviderProfile {
  id: number
  user_id: number
  professional_description: string | null
  // Ubicación canónica (Ciudad) con Departamento/País derivados.
  city_id: number | null
  city: CityLocation | null
  location: string | null
  is_active: boolean
}

/**
 * Elimina las claves con valor `null`/`undefined`/cadena vacía para no enviar
 * parámetros de consulta vacíos al backend.
 */
function cleanParams(filters: ProviderSearchFilters): Record<string, string | number> {
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

export const providersService = {
  /**
   * Listado y búsqueda pública paginada de prestadores con filtros
   * (Requisitos 13.1, 13.2, 13.6). Devuelve los elementos junto con la
   * metadata de paginación (`meta.total`, `meta.last_page`, etc.). Una lista
   * vacía NO es un error: el backend responde 200 con un mensaje informativo.
   */
  list(filters: ProviderSearchFilters = {}): Promise<ProviderListResult> {
    return http
      .get<ApiEnvelope<ProviderListItem[]>>('/providers', { params: cleanParams(filters) })
      .then(res => ({
        items: res.data.data ?? [],
        meta: res.data.meta ?? {},
        message: res.data.message,
      }))
  },

  /**
   * Perfil público de un prestador por id de `provider_profile`
   * (Requisito 3.1). Responde `{ data: { provider } }`.
   */
  getById(id: number): Promise<ProviderPublicProfile> {
    return http
      .get<ApiEnvelope<{ provider: ProviderPublicProfile }>>(`/providers/${id}`)
      .then(res => res.data.data.provider)
  },

  /**
   * Actualiza el perfil de prestador del usuario autenticado (descripción,
   * ubicación). Requiere rol `prestador` activo. Responde
   * `{ data: { provider_profile } }`.
   */
  updateProfile(payload: UpdateProviderProfilePayload): Promise<OwnProviderProfile> {
    return http
      .put<ApiEnvelope<{ provider_profile: OwnProviderProfile }>>('/profile/provider', payload)
      .then(res => res.data.data.provider_profile)
  },
}

export default providersService
