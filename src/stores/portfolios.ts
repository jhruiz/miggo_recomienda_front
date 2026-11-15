/**
 * Store Pinia de portafolios múltiples del Prestador.
 *
 * Mantiene el estado local de los portafolios propios y lo actualiza tras cada
 * operación sin recargar. Los errores se relanzan como `ApiError` normalizado
 * para que la vista notifique. Ante un 409 por límite se vuelve a ejecutar
 * `load()` para resincronizar contadores y fotos.
 */
import { portfoliosService } from '@/services/portfolios'
import type {
  CreatePortfolioPayload,
  OwnerPortfolio,
  OwnerPortfolioItem,
  PortfolioLimits,
  UpdatePortfolioPayload,
} from '@/services/portfolios'
import { extractApiError } from '@/utils/portfolio'
import type { ApiError } from '@/utils/portfolio'

function initialLimits(): PortfolioLimits {
  return { count: 0, max_portfolios: 20, max_photos_per_portfolio: 10 }
}

function isConflict(error: unknown): boolean {
  return (error as { response?: { status?: number } } | null | undefined)?.response?.status === 409
}

export const usePortfoliosStore = defineStore('portfolios', () => {
  const portfolios = ref<OwnerPortfolio[]>([])
  const loading = ref(false)
  const limits = ref<PortfolioLimits>(initialLimits())
  const savingPortfolioId = ref<number | null>(null)
  const uploadingPortfolioId = ref<number | null>(null)
  const deletingItemId = ref<number | null>(null)
  const deletingPortfolioId = ref<number | null>(null)

  function syncCount() {
    limits.value = { ...limits.value, count: portfolios.value.length }
  }

  function patchPortfolio(id: number, patch: (p: OwnerPortfolio) => OwnerPortfolio) {
    portfolios.value = portfolios.value.map(p => (p.id === id ? patch(p) : p))
  }

  /** Recalcula `photos_count` y la portada a partir de las fotos. */
  function withDerived(p: OwnerPortfolio, items: OwnerPortfolioItem[]): OwnerPortfolio {
    return {
      ...p,
      items,
      photos_count: items.length,
      cover_thumb_url: items[0]?.thumb_url ?? null,
    }
  }

  async function load(): Promise<void> {
    loading.value = true
    try {
      const result = await portfoliosService.list()

      portfolios.value = result.portfolios
      limits.value = result.meta ?? { ...limits.value, count: result.portfolios.length }
    }
    catch (err) {
      const apiError: ApiError = extractApiError(err)

      throw apiError
    }
    finally {
      loading.value = false
    }
  }

  /** Ante un 409 resincroniza (sin ocultar el error original) y relanza. */
  async function failWithResync(err: unknown): Promise<never> {
    const apiError = extractApiError(err)

    if (isConflict(err)) {
      try {
        await load()
      }
      catch {
        // se conserva el error original
      }
    }
    throw apiError
  }

  async function create(payload: CreatePortfolioPayload): Promise<OwnerPortfolio> {
    savingPortfolioId.value = 0
    try {
      const created = await portfoliosService.create(payload)
      const portfolio: OwnerPortfolio = { ...created, items: created.items ?? [] }

      portfolios.value = [...portfolios.value, portfolio]
      syncCount()

      return portfolio
    }
    catch (err) {
      return await failWithResync(err)
    }
    finally {
      savingPortfolioId.value = null
    }
  }

  async function update(id: number, payload: UpdatePortfolioPayload): Promise<OwnerPortfolio> {
    savingPortfolioId.value = id
    try {
      const updated = await portfoliosService.update(id, payload)

      patchPortfolio(id, p => ({
        ...p,
        name: updated.name,
        description: updated.description,
      }))

      return portfolios.value.find(p => p.id === id) ?? updated
    }
    catch (err) {
      return await failWithResync(err)
    }
    finally {
      savingPortfolioId.value = null
    }
  }

  async function remove(id: number): Promise<{ deleted_items_count: number }> {
    deletingPortfolioId.value = id
    try {
      const result = await portfoliosService.remove(id)

      portfolios.value = portfolios.value.filter(p => p.id !== id)
      syncCount()

      return result
    }
    catch (err) {
      return await failWithResync(err)
    }
    finally {
      deletingPortfolioId.value = null
    }
  }

  async function uploadItem(
    portfolioId: number,
    image: File,
    description?: string | null,
  ): Promise<OwnerPortfolioItem> {
    uploadingPortfolioId.value = portfolioId
    try {
      const item = await portfoliosService.addItem(portfolioId, image, description)

      patchPortfolio(portfolioId, p => withDerived(p, [...p.items, item]))

      return item
    }
    catch (err) {
      return await failWithResync(err)
    }
    finally {
      uploadingPortfolioId.value = null
    }
  }

  async function updateItem(
    portfolioId: number,
    itemId: number,
    description: string | null,
  ): Promise<OwnerPortfolioItem> {
    savingPortfolioId.value = portfolioId
    try {
      const item = await portfoliosService.updateItem(portfolioId, itemId, description)

      patchPortfolio(portfolioId, p => ({
        ...p,
        items: p.items.map(i => (i.id === itemId ? { ...i, description: item.description } : i)),
      }))

      return item
    }
    catch (err) {
      return await failWithResync(err)
    }
    finally {
      savingPortfolioId.value = null
    }
  }

  async function removeItem(portfolioId: number, itemId: number): Promise<void> {
    deletingItemId.value = itemId
    try {
      await portfoliosService.removeItem(portfolioId, itemId)

      patchPortfolio(portfolioId, p => withDerived(p, p.items.filter(i => i.id !== itemId)))
    }
    catch (err) {
      await failWithResync(err)
    }
    finally {
      deletingItemId.value = null
    }
  }

  return {
    portfolios,
    loading,
    limits,
    savingPortfolioId,
    uploadingPortfolioId,
    deletingItemId,
    deletingPortfolioId,
    load,
    create,
    update,
    remove,
    uploadItem,
    updateItem,
    removeItem,
  }
})

export default usePortfoliosStore
