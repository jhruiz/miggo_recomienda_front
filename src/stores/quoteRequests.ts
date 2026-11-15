/**
 * Store Pinia de solicitudes de cotización.
 *
 * Centraliza el estado de las vistas de frontend de la tarea 7.6:
 *
 *  - Listado y filtrado público con paginación, útil para que los prestadores
 *    naveguen y postulen (Requisito 4.3).
 *  - Creación/edición de solicitudes por el Cliente (Requisitos 4.1, 4.2).
 *  - Vista de postulaciones de una solicitud y selección de ganador por el
 *    Cliente dueño (Requisitos 4.4, 4.5).
 *
 * Las llamadas de red viven en `quoteRequestsService`
 * (`src/services/quoteRequests.ts`); aquí solo se gestiona el estado reactivo
 * y los flags de carga/error.
 *
 * `defineStore`, `ref` y `computed` están disponibles por auto-import.
 */
import axios from 'axios'
import { quoteRequestsService } from '@/services'
import type {
  CreateQuoteRequestPayload,
  MyApplicationItem,
  QuoteRequest,
  QuoteRequestApplication,
  QuoteRequestFilters,
  UpdateQuoteRequestPayload,
} from '@/services'

/** Estado de paginación del listado. */
interface Pagination {
  currentPage: number
  perPage: number
  total: number
  lastPage: number
}

const DEFAULT_PER_PAGE = 20

function initialFilters(): QuoteRequestFilters {
  return {
    category: null,
    department_id: null,
    city_id: null,
    budget_min: null,
    budget_max: null,
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

    if (error.message)
      return error.message
  }

  return fallback
}

export const useQuoteRequestsStore = defineStore('quoteRequests', () => {
  // ---- Estado: listado/filtrado ----
  const list = ref<QuoteRequest[]>([])
  const filters = ref<QuoteRequestFilters>(initialFilters())
  const pagination = ref<Pagination>(initialPagination())
  const listMessage = ref<string | null>(null)
  const listLoading = ref(false)
  const listError = ref<string | null>(null)

  // ---- Estado: detalle ----
  const current = ref<QuoteRequest | null>(null)
  const currentLoading = ref(false)
  const currentError = ref<string | null>(null)

  // ---- Estado: creación/edición ----
  const saving = ref(false)
  const saveError = ref<string | null>(null)

  // ---- Estado: postulaciones ----
  const applications = ref<QuoteRequestApplication[]>([])
  const applicationsLoading = ref(false)
  const applicationsError = ref<string | null>(null)
  const actionLoading = ref(false)
  const actionError = ref<string | null>(null)

  // ---- Estado: mis postulaciones (Prestador) ----
  const myApplications = ref<MyApplicationItem[]>([])
  const myApplicationsPagination = ref<Pagination>(initialPagination())
  const myApplicationsLoading = ref(false)
  const myApplicationsError = ref<string | null>(null)

  // ---- Getters ----
  const isEmptyMyApplications = computed(
    () => !myApplicationsLoading.value && myApplications.value.length === 0,
  )
  const isEmptyList = computed(() => !listLoading.value && list.value.length === 0)
  const hasNextPage = computed(() => pagination.value.currentPage < pagination.value.lastPage)
  const hasPrevPage = computed(() => pagination.value.currentPage > 1)
  const isEmptyApplications = computed(
    () => !applicationsLoading.value && applications.value.length === 0,
  )

  // ---- Acciones: listado/filtrado ----

  /** Carga una página del listado público aplicando los filtros actuales. */
  async function fetchList(page = 1) {
    listLoading.value = true
    listError.value = null
    try {
      const result = await quoteRequestsService.list({
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
      listError.value = extractErrorMessage(err, 'No se pudo cargar el listado de solicitudes.')
      list.value = []
      throw err
    }
    finally {
      listLoading.value = false
    }
  }

  /** Aplica filtros nuevos y recarga desde la primera página. */
  async function applyFilters(next: QuoteRequestFilters) {
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

  // ---- Acciones: detalle ----

  async function fetchById(id: number) {
    currentLoading.value = true
    currentError.value = null
    current.value = null
    try {
      current.value = await quoteRequestsService.getById(id)

      return current.value
    }
    catch (err) {
      currentError.value = extractErrorMessage(err, 'No se pudo cargar la solicitud.')
      throw err
    }
    finally {
      currentLoading.value = false
    }
  }

  // ---- Acciones: creación/edición ----

  /** Crea una nueva solicitud (Requisitos 4.1, 4.2). */
  async function create(payload: CreateQuoteRequestPayload) {
    saving.value = true
    saveError.value = null
    try {
      const created = await quoteRequestsService.create(payload)

      current.value = created

      return created
    }
    catch (err) {
      saveError.value = extractErrorMessage(err, 'No se pudo crear la solicitud.')
      throw err
    }
    finally {
      saving.value = false
    }
  }

  /** Edita una solicitud "abierta" (Requisito 4.2). */
  async function update(id: number, payload: UpdateQuoteRequestPayload) {
    saving.value = true
    saveError.value = null
    try {
      const updated = await quoteRequestsService.update(id, payload)

      current.value = updated

      return updated
    }
    catch (err) {
      saveError.value = extractErrorMessage(err, 'No se pudieron guardar los cambios.')
      throw err
    }
    finally {
      saving.value = false
    }
  }

  /** Agrega imágenes de referencia a una solicitud "abierta" (Requisito 4.16). */
  async function addReferenceImages(id: number, files: File[]) {
    actionLoading.value = true
    actionError.value = null
    try {
      const updated = await quoteRequestsService.addReferenceImages(id, files)

      current.value = updated

      return updated
    }
    catch (err) {
      actionError.value = extractErrorMessage(err, 'No se pudieron agregar las imágenes.')
      throw err
    }
    finally {
      actionLoading.value = false
    }
  }

  /** Elimina una imagen de referencia de una solicitud "abierta" (Requisito 4.16). */
  async function removeReferenceImage(id: number, mediaId: number) {
    actionLoading.value = true
    actionError.value = null
    try {
      const updated = await quoteRequestsService.removeReferenceImage(id, mediaId)

      current.value = updated

      return updated
    }
    catch (err) {
      actionError.value = extractErrorMessage(err, 'No se pudo eliminar la imagen.')
      throw err
    }
    finally {
      actionLoading.value = false
    }
  }

  /** Cierra una solicitud "abierta" (Requisito 4.7). */
  async function close(id: number) {
    actionLoading.value = true
    actionError.value = null
    try {
      const updated = await quoteRequestsService.close(id)

      current.value = updated

      return updated
    }
    catch (err) {
      actionError.value = extractErrorMessage(err, 'No se pudo cerrar la solicitud.')
      throw err
    }
    finally {
      actionLoading.value = false
    }
  }

  // ---- Acciones: postulaciones ----

  /** Postula el prestador autenticado a la solicitud (Requisito 4.4). */
  async function apply(id: number) {
    actionLoading.value = true
    actionError.value = null
    try {
      return await quoteRequestsService.apply(id)
    }
    catch (err) {
      actionError.value = extractErrorMessage(err, 'No se pudo registrar la postulación.')
      throw err
    }
    finally {
      actionLoading.value = false
    }
  }

  /** Carga las postulaciones de una solicitud (Cliente dueño, Requisito 4.4). */
  async function fetchApplications(id: number) {
    applicationsLoading.value = true
    applicationsError.value = null
    try {
      applications.value = await quoteRequestsService.applications(id)

      return applications.value
    }
    catch (err) {
      applicationsError.value = extractErrorMessage(err, 'No se pudieron cargar las postulaciones.')
      applications.value = []
      throw err
    }
    finally {
      applicationsLoading.value = false
    }
  }

  /** Carga una página de "Mis postulaciones" del Prestador autenticado. */
  async function fetchMyApplications(page = 1) {
    myApplicationsLoading.value = true
    myApplicationsError.value = null
    try {
      const result = await quoteRequestsService.listMyApplications({
        page,
        per_page: myApplicationsPagination.value.perPage,
      })

      myApplications.value = result.items
      myApplicationsPagination.value = {
        currentPage: Number(result.meta.current_page ?? page),
        perPage: Number(result.meta.per_page ?? myApplicationsPagination.value.perPage),
        total: Number(result.meta.total ?? result.items.length),
        lastPage: Number(result.meta.last_page ?? 1),
      }

      return result
    }
    catch (err) {
      myApplicationsError.value = extractErrorMessage(err, 'No se pudieron cargar tus postulaciones.')
      myApplications.value = []
      throw err
    }
    finally {
      myApplicationsLoading.value = false
    }
  }

  /** Selecciona al prestador ganador de la solicitud (Requisito 4.5). */
  async function selectProvider(id: number, providerId: number) {
    actionLoading.value = true
    actionError.value = null
    try {
      const updated = await quoteRequestsService.selectProvider(id, providerId)

      current.value = updated

      return updated
    }
    catch (err) {
      actionError.value = extractErrorMessage(err, 'No se pudo seleccionar al prestador.')
      throw err
    }
    finally {
      actionLoading.value = false
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
    // estado: detalle
    current,
    currentLoading,
    currentError,
    // estado: guardado
    saving,
    saveError,
    // estado: postulaciones
    applications,
    applicationsLoading,
    applicationsError,
    actionLoading,
    actionError,
    // estado: mis postulaciones
    myApplications,
    myApplicationsPagination,
    myApplicationsLoading,
    myApplicationsError,
    isEmptyMyApplications,
    fetchMyApplications,
    // getters
    isEmptyList,
    hasNextPage,
    hasPrevPage,
    isEmptyApplications,
    // acciones
    fetchList,
    applyFilters,
    resetFilters,
    goToPage,
    fetchById,
    create,
    update,
    close,
    addReferenceImages,
    removeReferenceImage,
    apply,
    fetchApplications,
    selectProvider,
  }
})

export default useQuoteRequestsStore
