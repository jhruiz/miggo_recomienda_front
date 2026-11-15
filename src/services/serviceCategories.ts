/**
 * Servicio del catálogo de categorías de servicio (tarea 18.2, Requisitos 4.9, 13.7).
 *
 * Envuelve la llamada Axios al endpoint público `GET /service-categories`,
 * reutilizando el cliente HTTP base (`src/services/http.ts`). El catálogo es de
 * solo lectura; lo consumen los selectores de categoría de las vistas.
 */
import http from './http'
import type { ApiEnvelope } from './http'

/** Categoría de servicio tal como la expone la API. */
export interface ServiceCategory {
  id: number
  name: string
  slug: string
}

export const serviceCategoriesService = {
  /**
   * Obtiene el catálogo completo de categorías de servicio (sin paginar),
   * ordenado por nombre. Responde `{ data: { categories } }`.
   */
  list(): Promise<ServiceCategory[]> {
    return http
      .get<ApiEnvelope<{ categories: ServiceCategory[] }>>('/service-categories')
      .then(res => res.data.data.categories ?? [])
  },
}

export default serviceCategoriesService
