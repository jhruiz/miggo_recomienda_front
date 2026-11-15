/**
 * Store Pinia de notificaciones (tarea 14.4, Requisitos 12.3, 12.4, 12.5, 12.7).
 *
 * Centraliza el estado del centro de notificaciones:
 *
 *  - Listado de notificaciones del usuario autenticado (`GET /notifications`),
 *    ordenado por fecha descendente y acotado a 200 por el backend (Requisito 12.3).
 *  - Contador de no leídas (`GET /notifications/unread-count`), con su número real
 *    y la representación "99+" para la UI cuando supera 100 (Requisito 12.4).
 *  - Marcado de una notificación como leída (`PUT /{id}/read`, Requisito 12.5) y
 *    de todas (`PUT /read-all`, Requisito 12.7), ambos con actualización optimista
 *    del contador local.
 *  - Suscripción en tiempo real al canal privado `private-user.{userId}` vía
 *    Laravel Echo, escuchando el evento `notification.new` (NewNotification):
 *    antepone la notificación entrante al listado y aumenta el contador de no
 *    leídas en el acto.
 *
 * El id del usuario autenticado se resuelve vía `profileService.me()`, igual que
 * los stores de `chat` y `jobs`.
 *
 * Las llamadas de red viven en `notificationsService` (`src/services/notifications.ts`);
 * aquí solo se gestiona el estado reactivo y la suscripción Echo.
 *
 * `defineStore`, `ref` y `computed` están disponibles por auto-import.
 */
import axios from 'axios'
import { echo } from '@/plugins/echo'
import { notificationsService, profileService } from '@/services'
import type { NewNotificationPayload, Notification } from '@/services'

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

/** Deriva la representación "99+" (capada a >100) del contador para la UI. */
function toDisplay(count: number): string {
  return count > 100 ? '99+' : String(count)
}

export const useNotificationsStore = defineStore('notifications', () => {
  // ---- Estado: usuario autenticado (para el canal privado) ----
  const currentUserId = ref<number | null>(null)

  // ---- Estado: listado ----
  const notifications = ref<Notification[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // ---- Estado: contador de no leídas ----
  const unreadCount = ref(0)
  const unreadDisplay = ref('0')

  // Suscripción Echo activa (para desuscribir al desmontar).
  let subscribedUserId: number | null = null

  // ---- Getters ----
  const isEmpty = computed(
    () => !loading.value && notifications.value.length === 0,
  )

  const hasUnread = computed(() => unreadCount.value > 0)

  // ---- Helpers internos ----

  /**
   * Garantiza conocer el id del usuario autenticado. Idempotente: una vez
   * resuelto, no vuelve a llamar al backend.
   */
  async function ensureCurrentUser(): Promise<number | null> {
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

  /** Fija el contador y recalcula su representación para la UI. */
  function setUnread(count: number, display?: string) {
    unreadCount.value = Math.max(0, count)
    unreadDisplay.value = display ?? toDisplay(unreadCount.value)
  }

  // ---- Acciones: carga ----

  /** Carga el listado de notificaciones del usuario autenticado (Requisito 12.3). */
  async function fetchList() {
    loading.value = true
    error.value = null
    try {
      notifications.value = await notificationsService.list()

      return notifications.value
    }
    catch (err) {
      error.value = extractErrorMessage(err, 'No se pudieron cargar las notificaciones.')
      notifications.value = []
      throw err
    }
    finally {
      loading.value = false
    }
  }

  /** Carga el contador de notificaciones no leídas (Requisito 12.4). */
  async function fetchUnreadCount() {
    try {
      const result = await notificationsService.unreadCount()

      setUnread(result.count, result.display)

      return result
    }
    catch {
      // El contador es informativo; un fallo no debe romper la vista.
      return null
    }
  }

  // ---- Acciones: marcado de leídas ----

  /**
   * Marca una notificación como leída (Requisito 12.5). Actualiza de forma
   * optimista el estado local y el contador; si la notificación ya estaba
   * leída, no decrementa el contador.
   */
  async function markAsRead(id: number) {
    const target = notifications.value.find(n => n.id === id)
    if (target && target.is_read)
      return

    try {
      const updated = await notificationsService.markAsRead(id)

      const index = notifications.value.findIndex(n => n.id === id)
      if (index !== -1)
        notifications.value[index] = updated
      else
        notifications.value.unshift(updated)

      if (!target || !target.is_read)
        setUnread(unreadCount.value - 1)
    }
    catch (err) {
      error.value = extractErrorMessage(err, 'No se pudo marcar la notificación como leída.')
      throw err
    }
  }

  /**
   * Marca todas las notificaciones como leídas (Requisito 12.7). Actualiza de
   * forma optimista el listado y pone el contador a cero.
   */
  async function markAllAsRead() {
    try {
      await notificationsService.markAllAsRead()

      const now = new Date().toISOString()

      notifications.value = notifications.value.map(n =>
        n.is_read ? n : { ...n, is_read: true, read_at: n.read_at ?? now },
      )
      setUnread(0)
    }
    catch (err) {
      error.value = extractErrorMessage(err, 'No se pudieron marcar todas como leídas.')
      throw err
    }
  }

  // ---- Suscripción en tiempo real (Laravel Echo) ----

  /** Desuscribe del canal privado del usuario actualmente escuchado, si lo hay. */
  function unsubscribe() {
    if (subscribedUserId != null) {
      echo.leave(`user.${subscribedUserId}`)
      subscribedUserId = null
    }
  }

  /**
   * Suscribe al canal privado `private-user.{userId}` y escucha el evento
   * `notification.new` (NewNotification). Cada notificación entrante se antepone
   * al listado (manteniendo el orden por fecha descendente, Requisito 12.3) y el
   * contador de no leídas aumenta en tiempo real (Requisito 12.4).
   */
  async function subscribe() {
    const userId = await ensureCurrentUser()
    if (userId == null)
      return

    if (subscribedUserId === userId)
      return

    unsubscribe()

    echo.private(`user.${userId}`)
      .listen('.notification.new', (payload: NewNotificationPayload) => {
        // Evita duplicar si por alguna razón ya existe en el listado.
        if (notifications.value.some(n => n.id === payload.id))
          return

        const incoming: Notification = {
          id: payload.id,
          type: payload.type,
          data: payload.data,
          is_read: payload.is_read,
          read_at: null,
          created_at: payload.created_at,
        }

        notifications.value.unshift(incoming)

        if (!incoming.is_read)
          setUnread(unreadCount.value + 1)
      })

    subscribedUserId = userId
  }

  return {
    // estado
    currentUserId,
    notifications,
    loading,
    error,
    unreadCount,
    unreadDisplay,
    // getters
    isEmpty,
    hasUnread,
    // acciones
    ensureCurrentUser,
    fetchList,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
    subscribe,
    unsubscribe,
  }
})

export default useNotificationsStore
