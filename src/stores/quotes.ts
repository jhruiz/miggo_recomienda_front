/**
 * Store Pinia de cotizaciones.
 *
 * Centraliza el estado de las vistas de frontend de la tarea 8.11:
 *
 *  - Creación de una cotización con ítems dinámicos y adjuntos por el Prestador
 *    (Requisito 5.1). El total se calcula en el servidor; aquí se expone un
 *    cálculo cliente para feedback inmediato.
 *  - Vista comparativa lado a lado de las cotizaciones de una solicitud, para
 *    el Cliente dueño (Requisito 5.6), con aceptar/rechazar (Requisitos 5.7,
 *    5.8).
 *
 * Las llamadas de red viven en `quotesService` (`src/services/quotes.ts`); aquí
 * solo se gestiona el estado reactivo y los flags de carga/error.
 *
 * `defineStore`, `ref` y `computed` están disponibles por auto-import.
 */
import axios from 'axios'
import { profileService, quotesService } from '@/services'
import type {
  CreateQuotePayload,
  Quote,
  QuoteSummary,
  RequestDirectQuotePayload,
  RespondDirectQuotePayload,
} from '@/services'

/** Estado de paginación de un listado. */
interface ListPagination {
  currentPage: number
  perPage: number
  total: number
  lastPage: number
}

function initialPagination(): ListPagination {
  return { currentPage: 1, perPage: 20, total: 0, lastPage: 1 }
}

function parsePagination(
  meta: Record<string, unknown>,
  page: number,
  perPage: number,
  count: number,
): ListPagination {
  return {
    currentPage: Number(meta.current_page ?? page),
    perPage: Number(meta.per_page ?? perPage),
    total: Number(meta.total ?? count),
    lastPage: Number(meta.last_page ?? 1),
  }
}

/** Normaliza un error de Axios a un mensaje legible para la UI. */
function extractErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { message?: string; errors?: Record<string, string[]> }
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

export const useQuotesStore = defineStore('quotes', () => {
  // ---- Estado: usuario autenticado (para distinguir cliente/prestador) ----
  const currentUserId = ref<number | null>(null)

  // ---- Estado: detalle ----
  const current = ref<Quote | null>(null)
  const currentLoading = ref(false)
  const currentError = ref<string | null>(null)

  // ---- Estado: creación ----
  const saving = ref(false)
  const saveError = ref<string | null>(null)

  // ---- Estado: solicitud de cotización directa ----
  const requestingDirect = ref(false)
  const requestDirectError = ref<string | null>(null)

  /** Error del servidor para `service_category_id` (422), mostrado junto al selector. */
  const requestDirectCategoryError = ref<string | null>(null)

  // ---- Estado: vista comparativa ----
  const comparative = ref<Quote[]>([])
  const comparativeLoading = ref(false)
  const comparativeError = ref<string | null>(null)

  // ---- Estado: aceptar/rechazar ----
  const actionLoading = ref(false)
  const actionError = ref<string | null>(null)

  /** Id de la cotización cuya acción está en curso (para loading por tarjeta). */
  const actingQuoteId = ref<number | null>(null)

  // ---- Estado: listados (enviadas / recibidas) ----
  const sent = ref<QuoteSummary[]>([])
  const sentPagination = ref<ListPagination>(initialPagination())
  const sentStatus = ref<string | null>(null)
  const sentLoading = ref(false)
  const sentError = ref<string | null>(null)

  const received = ref<QuoteSummary[]>([])
  const receivedPagination = ref<ListPagination>(initialPagination())
  const receivedStatus = ref<string | null>(null)
  const receivedLoading = ref(false)
  const receivedError = ref<string | null>(null)

  // ---- Estado: solicitudes en espera (cotizaciones directas pendientes) ----
  const awaiting = ref<QuoteSummary[]>([])
  const awaitingPagination = ref<ListPagination>(initialPagination())
  const awaitingStatus = ref<string | null>(null)
  const awaitingLoading = ref(false)
  const awaitingError = ref<string | null>(null)

  // ---- Getters ----
  const isEmptyAwaiting = computed(() => !awaitingLoading.value && awaiting.value.length === 0)
  const isEmptySent = computed(() => !sentLoading.value && sent.value.length === 0)
  const isEmptyReceived = computed(() => !receivedLoading.value && received.value.length === 0)

  const isEmptyComparative = computed(
    () => !comparativeLoading.value && comparative.value.length === 0,
  )

  // ---- Acciones: usuario autenticado ----

  /**
   * Resuelve (y memoiza) el id del usuario autenticado vía `GET /user`. Permite
   * a las vistas decidir si deben mostrar acciones de Cliente (p. ej. "Solicitar
   * cotización" en el perfil de otro Prestador, nunca en el propio).
   */
  async function ensureCurrentUser() {
    if (currentUserId.value != null)
      return currentUserId.value

    try {
      const user = await profileService.me()

      currentUserId.value = user.id

      return user.id
    }
    catch {
      return null
    }
  }

  // ---- Acciones: creación ----

  /** Crea una cotización con sus ítems y adjuntos (Requisito 5.1). */
  async function create(payload: CreateQuotePayload) {
    saving.value = true
    saveError.value = null
    try {
      const created = await quotesService.create(payload)

      current.value = created

      return created
    }
    catch (err) {
      saveError.value = extractErrorMessage(err, 'No se pudo enviar la cotización.')
      throw err
    }
    finally {
      saving.value = false
    }
  }

  // ---- Acciones: cotización directa ----

  /**
   * El Cliente solicita una Cotización directa a un Prestador (Requisito 10.1).
   * Traduce los errores de negocio del backend: 422 (Prestador no disponible,
   * Requisito 10.5) y 409 (límite de 5 solicitudes activas, Requisito 10.6).
   */
  async function requestDirect(payload: RequestDirectQuotePayload) {
    requestingDirect.value = true
    requestDirectError.value = null
    requestDirectCategoryError.value = null
    try {
      const quote = await quotesService.requestDirect(payload)

      current.value = quote

      return quote
    }
    catch (err) {
      if (axios.isAxiosError(err)) {
        const fieldErrors = (err.response?.data as { errors?: Record<string, string[]> } | undefined)?.errors

        requestDirectCategoryError.value = fieldErrors?.service_category_id?.[0] ?? null
      }

      requestDirectError.value = extractErrorMessage(
        err,
        'No se pudo enviar la solicitud de cotización.',
      )
      throw err
    }
    finally {
      requestingDirect.value = false
    }
  }

  /**
   * El Prestador objetivo responde a una solicitud de Cotización directa con una
   * Cotización estandarizada (Requisitos 10.2, 10.4). Reutiliza los flags de
   * creación (`saving`/`saveError`) por tratarse del mismo formulario.
   */
  async function respondDirect(id: number, payload: RespondDirectQuotePayload) {
    saving.value = true
    saveError.value = null
    try {
      const quote = await quotesService.respondDirect(id, payload)

      current.value = quote

      return quote
    }
    catch (err) {
      saveError.value = extractErrorMessage(err, 'No se pudo enviar la cotización.')
      throw err
    }
    finally {
      saving.value = false
    }
  }

  // ---- Acciones: detalle ----

  async function fetchById(id: number) {
    currentLoading.value = true
    currentError.value = null
    current.value = null
    try {
      current.value = await quotesService.getById(id)

      return current.value
    }
    catch (err) {
      currentError.value = extractErrorMessage(err, 'No se pudo cargar la cotización.')
      throw err
    }
    finally {
      currentLoading.value = false
    }
  }

  // ---- Acciones: listados ----

  /** Carga una página de "Mis cotizaciones" (Prestador). */
  async function fetchSent(page = 1, status: string | null = sentStatus.value) {
    sentLoading.value = true
    sentError.value = null
    sentStatus.value = status
    try {
      const result = await quotesService.listSent({
        page,
        per_page: sentPagination.value.perPage,
        status,
      })

      sent.value = result.items
      sentPagination.value = parsePagination(result.meta, page, sentPagination.value.perPage, result.items.length)

      return result
    }
    catch (err) {
      sentError.value = extractErrorMessage(err, 'No se pudieron cargar tus cotizaciones.')
      sent.value = []
      throw err
    }
    finally {
      sentLoading.value = false
    }
  }

  /** Carga una página de "Cotizaciones recibidas" (Cliente). */
  async function fetchReceived(page = 1, status: string | null = receivedStatus.value) {
    receivedLoading.value = true
    receivedError.value = null
    receivedStatus.value = status
    try {
      const result = await quotesService.listReceived({
        page,
        per_page: receivedPagination.value.perPage,
        status,
      })

      received.value = result.items
      receivedPagination.value = parsePagination(result.meta, page, receivedPagination.value.perPage, result.items.length)

      return result
    }
    catch (err) {
      receivedError.value = extractErrorMessage(err, 'No se pudieron cargar las cotizaciones recibidas.')
      received.value = []
      throw err
    }
    finally {
      receivedLoading.value = false
    }
  }

  /** Carga una página de "Solicitudes en espera" (Cliente). */
  async function fetchAwaiting(page = 1, status: string | null = awaitingStatus.value) {
    awaitingLoading.value = true
    awaitingError.value = null
    awaitingStatus.value = status
    try {
      const result = await quotesService.listAwaiting({
        page,
        per_page: awaitingPagination.value.perPage,
        status,
      })

      awaiting.value = result.items
      awaitingPagination.value = parsePagination(result.meta, page, awaitingPagination.value.perPage, result.items.length)

      return result
    }
    catch (err) {
      awaitingError.value = extractErrorMessage(err, 'No se pudieron cargar las solicitudes en espera.')
      awaiting.value = []
      throw err
    }
    finally {
      awaitingLoading.value = false
    }
  }

  // ---- Acciones: vista comparativa ----

  /**
   * Carga las cotizaciones de una solicitud para compararlas lado a lado
   * (Requisito 5.6). El backend las devuelve ordenadas de la más reciente a la
   * más antigua.
   */
  async function fetchForRequest(quoteRequestId: number) {
    comparativeLoading.value = true
    comparativeError.value = null
    try {
      comparative.value = await quotesService.forRequest(quoteRequestId)

      return comparative.value
    }
    catch (err) {
      comparativeError.value = extractErrorMessage(err, 'No se pudieron cargar las cotizaciones.')
      comparative.value = []
      throw err
    }
    finally {
      comparativeLoading.value = false
    }
  }

  /** Reemplaza una cotización dentro de la lista comparativa (tras una acción). */
  function replaceInComparative(updated: Quote) {
    const index = comparative.value.findIndex(q => q.id === updated.id)
    if (index !== -1)
      comparative.value.splice(index, 1, updated)
  }

  // ---- Acciones: aceptar/rechazar ----

  /**
   * Acepta una cotización (Requisito 5.7). Al aceptar, el backend crea el
   * Trabajo y pone las demás cotizaciones de la solicitud en "no seleccionada";
   * se recarga la lista comparativa para reflejarlo.
   */
  async function accept(id: number) {
    actionLoading.value = true
    actingQuoteId.value = id
    actionError.value = null
    try {
      const result = await quotesService.accept(id)

      replaceInComparative(result.quote)
      if (current.value?.id === id)
        current.value = result.quote

      return result
    }
    catch (err) {
      actionError.value = extractErrorMessage(err, 'No se pudo aceptar la cotización.')
      throw err
    }
    finally {
      actionLoading.value = false
      actingQuoteId.value = null
    }
  }

  /** Rechaza una cotización (Requisito 5.8). */
  async function reject(id: number) {
    actionLoading.value = true
    actingQuoteId.value = id
    actionError.value = null
    try {
      const updated = await quotesService.reject(id)

      replaceInComparative(updated)
      if (current.value?.id === id)
        current.value = updated

      return updated
    }
    catch (err) {
      actionError.value = extractErrorMessage(err, 'No se pudo rechazar la cotización.')
      throw err
    }
    finally {
      actionLoading.value = false
      actingQuoteId.value = null
    }
  }

  return {
    // estado: usuario
    currentUserId,

    // estado: detalle
    current,
    currentLoading,
    currentError,

    // estado: creación
    saving,
    saveError,

    // estado: solicitud directa
    requestingDirect,
    requestDirectError,
    requestDirectCategoryError,

    // estado: comparativa
    comparative,
    comparativeLoading,
    comparativeError,

    // estado: acciones
    actionLoading,
    actionError,
    actingQuoteId,

    // estado: listados
    sent,
    sentPagination,
    sentStatus,
    sentLoading,
    sentError,
    received,
    receivedPagination,
    receivedStatus,
    receivedLoading,
    receivedError,
    awaiting,
    awaitingPagination,
    awaitingStatus,
    awaitingLoading,
    awaitingError,

    // getters
    isEmptyAwaiting,
    isEmptySent,
    isEmptyReceived,
    isEmptyComparative,

    // acciones
    fetchSent,
    fetchReceived,
    fetchAwaiting,
    ensureCurrentUser,
    create,
    requestDirect,
    respondDirect,
    fetchById,
    fetchForRequest,
    accept,
    reject,
  }
})

export default useQuotesStore
