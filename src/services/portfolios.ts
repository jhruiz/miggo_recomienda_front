/**
 * Servicio de portafolios múltiples del Prestador.
 *
 * Endpoints consumidos (auth + rol prestador):
 *  - `GET    /profile/provider/portfolios`
 *  - `POST   /profile/provider/portfolios`
 *  - `PUT    /profile/provider/portfolios/{id}`
 *  - `DELETE /profile/provider/portfolios/{id}`
 *  - `POST   /profile/provider/portfolios/{id}/items`
 *  - `PUT    /profile/provider/portfolios/{id}/items/{itemId}`
 *  - `DELETE /profile/provider/portfolios/{id}/items/{itemId}`
 */
import http from './http'
import type { ApiEnvelope } from './http'

/** Foto de un Portafolio tal como la ve su dueño. */
export interface OwnerPortfolioItem {
  id: number
  portfolio_id: number
  description: string | null
  image_url: string | null
  thumb_url: string | null
  medium_url: string | null
  created_at: string
}

/** Categoría de servicio de un Portafolio (`null` si no tiene). */
export interface PortfolioCategory {
  id: number
  name: string
  slug: string
}

/** Portafolio tal como lo ve su dueño (incluye los vacíos). */
export interface OwnerPortfolio {
  id: number
  name: string
  description: string | null
  category: PortfolioCategory | null
  photos_count: number
  cover_thumb_url: string | null
  created_at: string
  items: OwnerPortfolioItem[]
}

/** Foto de un Portafolio en el perfil público. */
export interface PublicPortfolioItem {
  id: number
  description: string | null
  image_url: string | null
  thumb_url: string | null
  medium_url: string | null
}

/** Portafolio en el perfil público (`GET /providers/{id}` → `portfolios`). */
export interface PublicPortfolio {
  id: number
  name: string
  description: string | null
  category: PortfolioCategory | null
  cover_thumb_url: string | null
  items: PublicPortfolioItem[]
}

/** Límites informados por el backend en `meta` del listado. */
export interface PortfolioLimits {
  count: number
  max_portfolios: number
  max_photos_per_portfolio: number
}

/** `meta` del listado: límites más Portafolios sin Categoría_Portafolio. */
export interface PortfolioListMeta extends PortfolioLimits {
  uncategorized_count: number
}

export interface PortfolioListResult {
  portfolios: OwnerPortfolio[]
  meta: PortfolioListMeta
}

export interface CreatePortfolioPayload {
  name: string
  description?: string | null
  /** Obligatoria al crear (Req. 2.9). */
  service_category_id: number
}

export interface UpdatePortfolioPayload {
  name?: string
  description?: string | null
  service_category_id?: number
}

const BASE = '/profile/provider/portfolios'

export const portfoliosService = {
  /** Lista los Portafolios del Prestador autenticado, con sus fotos y límites. */
  list(): Promise<PortfolioListResult> {
    return http
      .get<ApiEnvelope<{ portfolios: OwnerPortfolio[] }>>(BASE)
      .then(res => ({
        portfolios: res.data.data.portfolios ?? [],
        meta: res.data.meta as unknown as PortfolioListMeta,
      }))
  },

  /** Crea un Portafolio. Responde 201 con `{ data: { portfolio } }`. */
  create(payload: CreatePortfolioPayload): Promise<OwnerPortfolio> {
    return http
      .post<ApiEnvelope<{ portfolio: OwnerPortfolio }>>(BASE, payload)
      .then(res => res.data.data.portfolio)
  },

  /** Actualiza nombre, descripción y/o categoría de un Portafolio. */
  update(id: number, payload: UpdatePortfolioPayload): Promise<OwnerPortfolio> {
    return http
      .put<ApiEnvelope<{ portfolio: OwnerPortfolio }>>(`${BASE}/${id}`, payload)
      .then(res => res.data.data.portfolio)
  },

  /** Elimina un Portafolio y sus fotos. Devuelve cuántas fotos se borraron. */
  remove(id: number): Promise<{ deleted_items_count: number }> {
    return http
      .delete<ApiEnvelope<{ deleted_items_count: number }>>(`${BASE}/${id}`)
      .then(res => res.data.data)
  },

  /**
   * Agrega una foto a un Portafolio (multipart). Se fija `multipart/form-data`
   * y el navegador completa el boundary al enviar el `FormData`.
   */
  addItem(portfolioId: number, image: File, description?: string | null): Promise<OwnerPortfolioItem> {
    const formData = new FormData()

    formData.append('image', image)
    if (description !== null && description !== undefined && description !== '')
      formData.append('description', description)

    return http
      .post<ApiEnvelope<{ portfolio_item: OwnerPortfolioItem }>>(`${BASE}/${portfolioId}/items`, formData, {
        // La instancia usa JSON por defecto; sin esto axios serializa el
        // FormData como JSON y el archivo no llega al backend.
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then(res => res.data.data.portfolio_item)
  },

  /** Actualiza la descripción de una foto. */
  updateItem(portfolioId: number, itemId: number, description: string | null): Promise<OwnerPortfolioItem> {
    return http
      .put<ApiEnvelope<{ portfolio_item: OwnerPortfolioItem }>>(
        `${BASE}/${portfolioId}/items/${itemId}`,
        { description },
      )
      .then(res => res.data.data.portfolio_item)
  },

  /** Elimina una foto de un Portafolio. */
  removeItem(portfolioId: number, itemId: number): Promise<void> {
    return http.delete(`${BASE}/${portfolioId}/items/${itemId}`).then(() => undefined)
  },
}

export default portfoliosService
