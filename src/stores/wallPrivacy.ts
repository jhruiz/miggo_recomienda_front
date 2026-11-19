/**
 * Store Pinia de privacidad del Muro: resumen, historial paginado,
 * activar/desactivar el registro y restablecer el muro.
 * Requisitos: 6.6 a 6.10.
 */
import { wallService } from '@/services/wall'
import type { FeedEventHistoryItem, PrivacySummary } from '@/services/wall'

export const useWallPrivacyStore = defineStore('wallPrivacy', () => {
  const summary = ref<PrivacySummary | null>(null)
  const events = ref<FeedEventHistoryItem[]>([])
  const nextCursor = ref<string | null>(null)
  const loading = ref(false)
  const loadingEvents = ref(false)
  const saving = ref(false)
  const resetting = ref(false)
  const error = ref<string | null>(null)

  async function loadSummary(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      summary.value = await wallService.privacy()
    }
    catch {
      error.value = 'No se pudo cargar la privacidad'
    }
    finally {
      loading.value = false
    }
  }

  async function loadEvents(): Promise<void> {
    events.value = []
    nextCursor.value = null
    await fetchEvents(null)
  }

  async function loadMoreEvents(): Promise<void> {
    if (loadingEvents.value || !nextCursor.value)
      return
    await fetchEvents(nextCursor.value)
  }

  async function fetchEvents(cursor: string | null): Promise<void> {
    loadingEvents.value = true
    error.value = null
    try {
      const page = await wallService.privacyEvents(cursor)
      const known = new Set(events.value.map(e => e.id))

      events.value = [...events.value, ...page.events.filter(e => !known.has(e.id))]
      nextCursor.value = page.next_cursor
    }
    catch {
      error.value = 'No se pudo cargar el historial'
    }
    finally {
      loadingEvents.value = false
    }
  }

  /** Activa o desactiva el registro. Relanza el error para que la vista notifique. */
  async function setEnabled(enabled: boolean): Promise<void> {
    saving.value = true
    try {
      summary.value = await wallService.setPrivacy(enabled)
    }
    finally {
      saving.value = false
    }
  }

  /**
   * Restablece el muro. Si falla, recarga el resumen para mostrar el historial intacto
   * (Req. 6.15) y relanza el error.
   */
  async function reset(): Promise<number> {
    resetting.value = true
    try {
      const { deleted_count } = await wallService.resetEvents()

      events.value = []
      nextCursor.value = null
      await loadSummary()

      return deleted_count
    }
    catch (err) {
      await loadSummary()
      throw err
    }
    finally {
      resetting.value = false
    }
  }

  return {
    summary,
    events,
    nextCursor,
    loading,
    loadingEvents,
    saving,
    resetting,
    error,
    loadSummary,
    loadEvents,
    loadMoreEvents,
    setEnabled,
    reset,
  }
})

export default useWallPrivacyStore
