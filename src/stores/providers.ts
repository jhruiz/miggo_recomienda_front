/**
 * Store Pinia de prestadores.
 *
 * Centraliza el estado de descubrimiento y gestión de perfiles de Prestador
 * para las vistas de frontend de la tarea 5.9:
 *
 *  - Listado y búsqueda pública con filtros y paginación (Requisitos 13.1,
 *    13.2, 13.6).
 *  - Perfil público de un prestador por id (Requisito 3.1).
 *  - Gestión del perfil propio y su portafolio por el prestador autenticado
 *    (Requisito 3.4).
 *
 * Las llamadas de red viven en `providersService` (`src/services/providers.ts`);
 * aquí solo se gestiona el estado reactivo y los flags de carga/error.
 *
 * `defineStore`, `ref` y `computed` están disponibles por auto-import.
 */
import axios from 'axios'
import { profileService, providersService } from '@/services'
import type {
  OwnProviderProfile,
  ProviderListItem,
  ProviderPublicProfile,
  ProviderSearchFilters,
  UpdateProviderProfilePayload,
} from '@/services'

/** Estado de paginación del listado. */
interface Pagination {
  currentPage: number
  perPage: number
  total: number
  lastPage: number
}

const DEFAULT_PER_PAGE = 20

function initialFilters(): ProviderSearchFilters {
  return {
    category: null,
    department_id: null,
    city_id: null,
    rating_min: null,
    rating_max: null,
    search: null,
  }
}

function initialPagination(): Pagination {
  return { currentPage: 1, perPage: DEFAULT_PER_PAGE, total: 0, lastPage: 1 }
}

/** Normaliza un error de Axios a un mensaje legible para la UI. */
function extractErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { message?: string, errors?: Record<string, string[]> }
      | undefined

    if (data?.errors) {
      const firstField = Object.values(data.errors)[0]
      if (firstField?.[0])
        return firstField[0]
    }

    if (data?.message)
      return data.message
  }

  return fallback
}

export const useProvidersStore = defineStore('providers', () => {
  // ---- Estado: listado/búsqueda ----
  const list = ref<ProviderListItem[]>([])
  const filters = ref<ProviderSearchFilters>(initialFilters())
  const pagination = ref<Pagination>(initialPagination())
  const listMessage = ref<string | null>(null)
  const listLoading = ref(false)
  const listError = ref<string | null>(null)

  // ---- Estado: perfil público ----
  const profile = ref<ProviderPublicProfile | null>(null)
  const profileLoading = ref(false)
  const profileError = ref<string | null>(null)

  // ---- Estado: perfil propio / portafolio ----
  const ownProfile = ref<OwnProviderProfile | null>(null)
  const ownLoading = ref(false)
  const ownSaving = ref(false)
  const ownError = ref<string | null>(null)

  // ---- Getters ----
  const isEmptyList = computed(() => !listLoading.value && list.value.length === 0)
  const hasNextPage = computed(() => pagination.value.currentPage < pagination.value.lastPage)
  const hasPrevPage = computed(() => pagination.value.currentPage > 1)

  // ---- Acciones: listado/búsqueda ----

  /**
   * Carga una página del listado público aplicando los filtros actuales.
   * El término de búsqueda vacío o fuera de rango lo valida el backend; aquí
   * solo se traduce el posible 422 a un mensaje de error.
   */
  async function fetchList(page = 1) {
    listLoading.value = true
    listError.value = null
    try {
      const result = await providersService.list({
        ...filters.value,
        page,
        per_page: pagination.value.perPage,
      })

      list.value = result.items
      listMessage.value = result.message ?? null
      pagination.value = {
        currentPage: Number(result.meta.current_page ?? page),
        perPage: Number(result.meta.per_page ?? pagination.value.perPage),
        total: Number(result.meta.total ?? result.items.length),
        lastPage: Number(result.meta.last_page ?? 1),
      }

      return result
    }
    catch (err) {
      listError.value = extractErrorMessage(err, 'No se pudo cargar el listado de prestadores.')
      list.value = []
      throw err
    }
    finally {
      listLoading.value = false
    }
  }

  /** Aplica filtros nuevos y recarga desde la primera página. */
  async function applyFilters(next: ProviderSearchFilters) {
    filters.value = { ...filters.value, ...next }

    return fetchList(1)
  }

  /** Restablece los filtros a su estado inicial y recarga. */
  async function resetFilters() {
    filters.value = initialFilters()

    return fetchList(1)
  }

  /** Navega a una página concreta (acotada al rango válido). */
  async function goToPage(page: number) {
    const target = Math.min(Math.max(1, page), pagination.value.lastPage)

    return fetchList(target)
  }

  // ---- Acciones: perfil público ----

  async function fetchProfile(id: number) {
    profileLoading.value = true
    profileError.value = null
    profile.value = null
    try {
      profile.value = await providersService.getById(id)

      return profile.value
    }
    catch (err) {
      profileError.value = extractErrorMessage(err, 'No se pudo cargar el perfil del prestador.')
      throw err
    }
    finally {
      profileLoading.value = false
    }
  }

  // ---- Acciones: perfil propio / portafolio ----

  /**
   * Carga el perfil de prestador propio y su portafolio para edición.
   *
   * No existe un endpoint dedicado de "mi perfil de prestador"; usamos
   * `activateProvider()` (idempotente) para obtener el `provider_profile`.
   * Los portafolios se cargan desde el store `portfolios`.
   */
  async function loadOwnProfile() {
    ownLoading.value = true
    ownError.value = null
    try {
      const { provider_profile } = await profileService.activateProvider()

      ownProfile.value = provider_profile

      return ownProfile.value
    }
    catch (err) {
      ownError.value = extractErrorMessage(err, 'No se pudo cargar tu perfil de prestador.')
      throw err
    }
    finally {
      ownLoading.value = false
    }
  }

  /** Guarda los datos editables del perfil propio (descripción, ubicación). */
  async function saveOwnProfile(payload: UpdateProviderProfilePayload) {
    ownSaving.value = true
    ownError.value = null
    try {
      ownProfile.value = await providersService.updateProfile(payload)

      return ownProfile.value
    }
    catch (err) {
      ownError.value = extractErrorMessage(err, 'No se pudieron guardar los cambios del perfil.')
      throw err
    }
    finally {
      ownSaving.value = false
    }
  }

  return {
    // estado: listado
    list,
    filters,
    pagination,
    listMessage,
    listLoading,
    listError,
    // estado: perfil público
    profile,
    profileLoading,
    profileError,
    // estado: perfil propio
    ownProfile,
    ownLoading,
    ownSaving,
    ownError,
    // getters
    isEmptyList,
    hasNextPage,
    hasPrevPage,
    // acciones
    fetchList,
    applyFilters,
    resetFilters,
    goToPage,
    fetchProfile,
    loadOwnProfile,
    saveOwnProfile,
  }
})

export default useProvidersStore
