/**
 * Store Pinia de trabajos.
 *
 * Centraliza el estado de las vistas de frontend de la tarea 9.9:
 *
 *  - Listado de los Trabajos del usuario autenticado (como Cliente o como
 *    Prestador), con sus estados (Requisito 7.2).
 *  - Detalle de un Trabajo con acciones contextuales: completar (Prestador,
 *    Requisito 7.3), confirmar / rechazar finalización (Cliente, Requisitos
 *    7.4, 7.6) y solicitar / confirmar cancelación por mutuo acuerdo (ambas
 *    partes, Requisito 7.7).
 *
 * Para decidir qué botones mostrar, la vista necesita saber si el usuario es el
 * Cliente o el Prestador del Trabajo. Como el store `auth` solo materializa el
 * usuario tras el registro, aquí se obtiene el id del usuario autenticado desde
 * el backend vía `profileService.me()` (misma fuente que usa `activeRole`).
 *
 * Las llamadas de red viven en `jobsService` (`src/services/jobs.ts`); aquí solo
 * se gestiona el estado reactivo y los flags de carga/error.
 *
 * `defineStore`, `ref` y `computed` están disponibles por auto-import.
 */
import axios from 'axios'
import { jobsService, profileService } from '@/services'
import type { Job, JobPhoto, JobReasonPayload } from '@/services'

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

export const useJobsStore = defineStore('jobs', () => {
  // ---- Estado: usuario autenticado (para distinguir cliente/prestador) ----
  const currentUserId = ref<number | null>(null)

  // ---- Estado: listado ----
  const list = ref<Job[]>([])
  const listLoading = ref(false)
  const listError = ref<string | null>(null)

  // ---- Estado: detalle ----
  const current = ref<Job | null>(null)
  const currentLoading = ref(false)
  const currentError = ref<string | null>(null)

  // ---- Estado: acciones (completar/confirmar/rechazar/cancelar) ----
  const actionLoading = ref(false)
  const actionError = ref<string | null>(null)

  // ---- Getters ----
  const isEmptyList = computed(
    () => !listLoading.value && list.value.length === 0,
  )

  // ---- Helpers internos ----

  /** Sustituye un trabajo dentro del listado tras una acción. */
  function replaceInList(updated: Job) {
    const index = list.value.findIndex(job => job.id === updated.id)
    if (index !== -1)
      list.value.splice(index, 1, updated)
  }

  /** Aplica el trabajo actualizado al detalle y al listado. */
  function applyUpdate(updated: Job) {
    if (current.value?.id === updated.id)
      current.value = updated

    replaceInList(updated)
  }

  /**
   * Garantiza conocer el id del usuario autenticado. Idempotente: una vez
   * resuelto, no vuelve a llamar al backend.
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
      // Si falla, las vistas simplemente no mostrarán acciones específicas de
      // parte; el detalle sigue siendo visible.
      return null
    }
  }

  // ---- Acciones: listado ----

  /** Carga los Trabajos del usuario autenticado (Requisito 7.2). */
  async function fetchList() {
    listLoading.value = true
    listError.value = null
    try {
      await ensureCurrentUser()
      list.value = await jobsService.list()

      return list.value
    }
    catch (err) {
      listError.value = extractErrorMessage(err, 'No se pudieron cargar los trabajos.')
      list.value = []
      throw err
    }
    finally {
      listLoading.value = false
    }
  }

  // ---- Acciones: detalle ----

  async function fetchById(id: number) {
    currentLoading.value = true
    currentError.value = null
    current.value = null
    try {
      await ensureCurrentUser()
      current.value = await jobsService.getById(id)

      return current.value
    }
    catch (err) {
      currentError.value = extractErrorMessage(err, 'No se pudo cargar el trabajo.')
      throw err
    }
    finally {
      currentLoading.value = false
    }
  }

  // ---- Acciones: transiciones del Trabajo ----

  /**
   * Ejecuta una acción del servicio sobre el trabajo, gestionando el estado de
   * carga/error de forma uniforme y propagando la actualización.
   */
  async function runAction(
    operation: () => Promise<Job>,
    fallbackMessage: string,
  ) {
    actionLoading.value = true
    actionError.value = null
    try {
      const updated = await operation()

      applyUpdate(updated)

      return updated
    }
    catch (err) {
      actionError.value = extractErrorMessage(err, fallbackMessage)
      throw err
    }
    finally {
      actionLoading.value = false
    }
  }

  /** El Prestador marca el Trabajo como completado (Requisito 7.3). */
  function complete(id: number, files?: File[]) {
    return runAction(
      () => jobsService.complete(id, files),
      'No se pudo marcar el trabajo como completado.',
    )
  }

  /** Sustituye las fotos del detalle actual (si corresponde al Trabajo). */
  function setCurrentPhotos(id: number, photos: JobPhoto[]) {
    if (current.value?.id === id)
      current.value = { ...current.value, photos }
  }

  /** Agrega fotos en una sola petición; los errores los maneja el componente. */
  async function addPhotos(id: number, files: File[]) {
    const photos = await jobsService.addPhotos(id, files)

    setCurrentPhotos(id, photos)

    return photos
  }

  /** Quita una foto; actualiza el detalle con las restantes. */
  async function removePhoto(id: number, photoId: number) {
    const photos = await jobsService.removePhoto(id, photoId)

    setCurrentPhotos(id, photos)

    return photos
  }

  /** El Cliente confirma la finalización (Requisito 7.4). */
  function confirm(id: number) {
    return runAction(
      () => jobsService.confirm(id),
      'No se pudo confirmar la finalización.',
    )
  }

  /** El Cliente rechaza la finalización con un motivo (Requisito 7.6). */
  function rejectCompletion(id: number, payload: JobReasonPayload) {
    return runAction(
      () => jobsService.rejectCompletion(id, payload),
      'No se pudo rechazar la finalización.',
    )
  }

  /** Una parte solicita la cancelación por mutuo acuerdo (Requisito 7.7). */
  function requestCancel(id: number, payload: JobReasonPayload) {
    return runAction(
      () => jobsService.requestCancel(id, payload),
      'No se pudo solicitar la cancelación.',
    )
  }

  /** La otra parte confirma la cancelación (Requisito 7.7). */
  function confirmCancel(id: number, payload: JobReasonPayload) {
    return runAction(
      () => jobsService.confirmCancel(id, payload),
      'No se pudo confirmar la cancelación.',
    )
  }

  return {
    // estado
    currentUserId,
    list,
    listLoading,
    listError,
    current,
    currentLoading,
    currentError,
    actionLoading,
    actionError,
    // getters
    isEmptyList,
    // acciones
    ensureCurrentUser,
    fetchList,
    fetchById,
    complete,
    addPhotos,
    removePhoto,
    confirm,
    rejectCompletion,
    requestCancel,
    confirmCancel,
  }
})

export default useJobsStore
