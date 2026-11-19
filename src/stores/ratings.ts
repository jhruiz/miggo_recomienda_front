/**
 * Store Pinia de calificaciones.
 *
 * Centraliza el estado de la vista de frontend de la tarea 12.7:
 *
 *  - Emisión de la Calificación del usuario autenticado sobre su contraparte en
 *    un Trabajo completado (estrellas 1-5 + comentario 10-500, Requisito 8.2).
 *  - Listado de las Calificaciones emitidas de un Trabajo para sus partes
 *    (GET /ratings/job/{id}). La visualización pública (doble ciego revelado)
 *    vive en el perfil del Prestador (Requisito 8.5).
 *
 * Los errores de negocio del backend se normalizan a un mensaje legible:
 *  - 409 → calificaciones no habilitadas, duplicada o ventana cerrada.
 *  - 422 → score/comentario inválidos.
 *  - 403 → el usuario no es parte del Trabajo.
 *
 * Las llamadas de red viven en `ratingsService` (`src/services/ratings.ts`);
 * aquí solo se gestiona el estado reactivo y los flags de carga/error.
 *
 * `defineStore`, `ref` y `computed` están disponibles por auto-import.
 */
import axios from 'axios'
import { ratingsService } from '@/services'
import type { Rating, SubmitRatingPayload } from '@/services'

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

export const useRatingsStore = defineStore('ratings', () => {
  // ---- Estado: listado de calificaciones del trabajo actual ----
  const list = ref<Rating[]>([])
  const listLoading = ref(false)
  const listError = ref<string | null>(null)

  // ---- Estado: emisión de calificación ----
  const submitLoading = ref(false)
  const submitError = ref<string | null>(null)

  // ---- Getters ----
  const hasRatings = computed(() => list.value.length > 0)

  /** Devuelve la Calificación emitida por un usuario concreto, si existe. */
  function ratingByRater(userId: number | null): Rating | undefined {
    if (userId == null)
      return undefined

    return list.value.find(rating => rating.rater_user_id === userId)
  }

  // ---- Acciones ----

  /** Carga las Calificaciones emitidas de un Trabajo (partes involucradas). */
  async function fetchForJob(jobId: number) {
    listLoading.value = true
    listError.value = null
    try {
      list.value = await ratingsService.forJob(jobId)

      return list.value
    }
    catch (err) {
      listError.value = extractErrorMessage(err, 'No se pudieron cargar las calificaciones.')
      list.value = []
      throw err
    }
    finally {
      listLoading.value = false
    }
  }

  /**
   * Emite la Calificación del usuario autenticado (Requisito 8.2). Tras un envío
   * exitoso recarga el listado del Trabajo para reflejar la nueva calificación.
   */
  async function submit(payload: SubmitRatingPayload) {
    submitLoading.value = true
    submitError.value = null
    try {
      const rating = await ratingsService.submit(payload)

      await fetchForJob(payload.job_id).catch(() => {})

      return rating
    }
    catch (err) {
      submitError.value = extractErrorMessage(
        err,
        'No se pudo registrar la calificación.',
      )
      throw err
    }
    finally {
      submitLoading.value = false
    }
  }

  /** Reinicia el estado (p. ej. al cambiar de Trabajo). */
  function reset() {
    list.value = []
    listError.value = null
    submitError.value = null
  }

  return {
    // estado
    list,
    listLoading,
    listError,
    submitLoading,
    submitError,
    // getters
    hasRatings,
    ratingByRater,
    // acciones
    fetchForJob,
    submit,
    reset,
  }
})

export default useRatingsStore
