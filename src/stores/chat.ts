/**
 * Store Pinia de chat (tarea 13.6, Requisitos 11.4, 11.9).
 *
 * Centraliza el estado de la mensajería en tiempo real:
 *
 *  - Listado de canales del usuario autenticado (`GET /chat/channels`).
 *  - Historial del canal abierto, cargado cronológicamente y paginado por
 *    cursor hacia atrás ("cargar más antiguos", Requisito 11.6).
 *  - Envío OPTIMISTA: el mensaje se añade de inmediato a la UI con un id
 *    temporal y, al confirmar la respuesta HTTP, se reconcilia con el mensaje
 *    del servidor; si falla, se marca como fallido para poder reintentarlo.
 *  - Suscripción en tiempo real al canal privado `private-chat.{channelId}`
 *    vía Laravel Echo, escuchando el evento `chat.message` (NewChatMessage,
 *    Requisito 11.4). Los mensajes entrantes del propio emisor no se duplican
 *    porque ya existen por la vía optimista/HTTP.
 *
 * Para distinguir mensajes propios de ajenos (alineación en la UI) se obtiene
 * el id del usuario autenticado vía `profileService.me()`, igual que `jobs`.
 *
 * Las llamadas de red viven en `chatService` (`src/services/chat.ts`); aquí solo
 * se gestiona el estado reactivo, el ciclo optimista y la suscripción Echo.
 *
 * `defineStore`, `ref` y `computed` están disponibles por auto-import.
 */
import axios from 'axios'
import { echo } from '@/plugins/echo'
import { chatService, profileService } from '@/services'
import type { ChatChannel, ChatMessage } from '@/services'

/**
 * Estado de entrega de un mensaje en la UI. Los mensajes confirmados por el
 * servidor no llevan estado (entregados); los optimistas pasan por `sending` y,
 * si la petición HTTP falla, por `failed` para poder reintentarlos.
 */
export type ChatMessageDeliveryStatus = 'sending' | 'failed'

/** Mensaje enriquecido para la vista: añade metadatos del ciclo optimista. */
export interface ChatMessageView extends ChatMessage {
  /** id temporal del mensaje optimista mientras no hay confirmación del servidor. */
  tempId?: string
  /** Estado de entrega; ausente cuando el mensaje está confirmado. */
  deliveryStatus?: ChatMessageDeliveryStatus
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

let tempCounter = 0

/** Genera un id temporal único para un mensaje optimista. */
function nextTempId(): string {
  tempCounter += 1

  return `temp-${Date.now()}-${tempCounter}`
}

export const useChatStore = defineStore('chat', () => {
  // ---- Estado: usuario autenticado (para alinear mensajes propios/ajenos) ----
  const currentUserId = ref<number | null>(null)

  // ---- Estado: canales ----
  const channels = ref<ChatChannel[]>([])
  const channelsLoading = ref(false)
  const channelsError = ref<string | null>(null)

  // ---- Estado: canal abierto e historial ----
  const currentChannelId = ref<number | null>(null)
  const messages = ref<ChatMessageView[]>([])
  const messagesLoading = ref(false)
  const messagesError = ref<string | null>(null)

  // Cursor para cargar mensajes más antiguos (paginación hacia atrás).
  const nextCursor = ref<string | null>(null)
  const hasMore = ref(false)
  const loadingMore = ref(false)

  // ---- Estado: envío ----
  const sending = ref(false)
  const sendError = ref<string | null>(null)

  // Suscripción Echo activa (para desuscribir al cambiar de canal).
  let subscribedChannelId: number | null = null

  // ---- Getters ----
  const currentChannel = computed<ChatChannel | null>(
    () => channels.value.find(c => c.id === currentChannelId.value) ?? null,
  )

  const isChannelsEmpty = computed(
    () => !channelsLoading.value && channels.value.length === 0,
  )

  /** El canal abierto está cerrado: no admite envío de mensajes (Requisito 11.7). */
  const isCurrentChannelClosed = computed(
    () => currentChannel.value?.status === 'cerrado',
  )

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

  /** Indica si un mensaje fue enviado por el usuario autenticado. */
  function isOwnMessage(message: ChatMessage): boolean {
    return currentUserId.value != null
      && message.sender_user_id === currentUserId.value
  }

  /** ¿Ya existe un mensaje con este id del servidor en la lista? */
  function hasServerMessage(id: number): boolean {
    return messages.value.some(m => m.id === id && !m.tempId)
  }

  /**
   * Inserta un mensaje confirmado por el servidor manteniendo el orden
   * cronológico por id, evitando duplicados. Se usa tanto para la respuesta
   * HTTP como para los eventos entrantes de Echo.
   */
  function appendServerMessage(message: ChatMessage) {
    if (hasServerMessage(message.id))
      return

    const view: ChatMessageView = { ...message }

    // Inserción ordenada por id (los ids crecen monotónicamente con el tiempo).
    const index = messages.value.findIndex(m => !m.tempId && m.id > message.id)
    if (index === -1)
      messages.value.push(view)
    else
      messages.value.splice(index, 0, view)
  }

  // ---- Suscripción en tiempo real (Laravel Echo) ----

  /** Desuscribe del canal privado actualmente escuchado, si lo hay. */
  function leaveRealtime() {
    if (subscribedChannelId != null) {
      echo.leave(`chat.${subscribedChannelId}`)
      subscribedChannelId = null
    }
  }

  /**
   * Suscribe al canal privado `private-chat.{channelId}` y escucha el evento
   * `chat.message` (NewChatMessage, Requisito 11.4). Los mensajes entrantes se
   * añaden en tiempo real; los del propio emisor se ignoran para no duplicar su
   * mensaje optimista/confirmado por HTTP.
   */
  function joinRealtime(channelId: number) {
    if (subscribedChannelId === channelId)
      return

    leaveRealtime()

    echo.private(`chat.${channelId}`)
      .listen('.chat.message', (payload: ChatMessage) => {
        // Solo mensajes del canal abierto y nunca los propios (ya presentes).
        if (payload.channel_id !== currentChannelId.value)
          return
        if (isOwnMessage(payload))
          return

        appendServerMessage(payload)
      })

    subscribedChannelId = channelId
  }

  // ---- Acciones: canales ----

  /** Carga los canales de Chat del usuario autenticado. */
  async function fetchChannels() {
    channelsLoading.value = true
    channelsError.value = null
    try {
      await ensureCurrentUser()
      channels.value = await chatService.channels()

      return channels.value
    }
    catch (err) {
      channelsError.value = extractErrorMessage(err, 'No se pudieron cargar los canales de chat.')
      channels.value = []
      throw err
    }
    finally {
      channelsLoading.value = false
    }
  }

  // ---- Acciones: abrir canal e historial ----

  /**
   * Abre un canal: carga la primera página del historial (cronológico) y se
   * suscribe a su canal privado para recibir mensajes en tiempo real.
   */
  async function openChannel(channelId: number) {
    if (currentChannelId.value === channelId && messages.value.length > 0)
      return

    currentChannelId.value = channelId
    messagesLoading.value = true
    messagesError.value = null
    messages.value = []
    nextCursor.value = null
    hasMore.value = false
    sendError.value = null

    try {
      await ensureCurrentUser()

      const result = await chatService.messages(channelId)

      messages.value = result.messages.map(m => ({ ...m }))
      nextCursor.value = result.nextCursor
      hasMore.value = result.hasMore

      joinRealtime(channelId)

      return messages.value
    }
    catch (err) {
      messagesError.value = extractErrorMessage(err, 'No se pudo cargar la conversación.')
      throw err
    }
    finally {
      messagesLoading.value = false
    }
  }

  /**
   * Carga la página siguiente del historial (mensajes más antiguos) usando el
   * cursor y los antepone conservando el orden cronológico.
   */
  async function loadMore() {
    if (!hasMore.value || loadingMore.value || currentChannelId.value == null || !nextCursor.value)
      return

    loadingMore.value = true
    try {
      const channelId = currentChannelId.value
      const result = await chatService.messages(channelId, nextCursor.value)

      // El cursor avanza hacia mensajes más recientes; se añaden evitando
      // duplicados mediante appendServerMessage (inserción ordenada por id).
      for (const m of result.messages)
        appendServerMessage(m)

      nextCursor.value = result.nextCursor
      hasMore.value = result.hasMore
    }
    catch (err) {
      messagesError.value = extractErrorMessage(err, 'No se pudieron cargar más mensajes.')
    }
    finally {
      loadingMore.value = false
    }
  }

  // ---- Acciones: envío optimista ----

  /**
   * Envía un mensaje al canal abierto con estrategia OPTIMISTA:
   *  1. Añade de inmediato un mensaje temporal (`deliveryStatus = 'sending'`).
   *  2. Lanza la petición HTTP.
   *  3. En éxito, sustituye el temporal por el mensaje confirmado del servidor.
   *  4. En error, marca el temporal como `failed` y expone el mensaje de error.
   *
   * Devuelve `true` si el envío fue confirmado por el servidor.
   */
  async function sendMessage(content: string): Promise<boolean> {
    const channelId = currentChannelId.value
    const trimmed = content.trim()

    if (channelId == null || trimmed.length === 0)
      return false

    await ensureCurrentUser()

    const tempId = nextTempId()
    const optimistic: ChatMessageView = {
      id: -1,
      tempId,
      channel_id: channelId,
      sender_user_id: currentUserId.value ?? -1,
      content: trimmed,
      sent_at_utc: new Date().toISOString(),
      created_at: new Date().toISOString(),
      deliveryStatus: 'sending',
    }

    messages.value.push(optimistic)
    sending.value = true
    sendError.value = null

    try {
      const serverMessage = await chatService.send(channelId, trimmed)

      // Reconciliación: reemplaza el temporal por el mensaje del servidor. Si un
      // evento Echo ya hubiera insertado el mismo id (poco probable para mensajes
      // propios, que se ignoran), se elimina el temporal sin duplicar.
      const index = messages.value.findIndex(m => m.tempId === tempId)
      if (index !== -1) {
        if (hasServerMessage(serverMessage.id))
          messages.value.splice(index, 1)
        else
          messages.value.splice(index, 1, { ...serverMessage })
      }
      else if (!hasServerMessage(serverMessage.id)) {
        appendServerMessage(serverMessage)
      }

      return true
    }
    catch (err) {
      // Marca el mensaje optimista como fallido para permitir reintento.
      const index = messages.value.findIndex(m => m.tempId === tempId)
      if (index !== -1)
        messages.value[index] = { ...messages.value[index], deliveryStatus: 'failed' }

      sendError.value = extractErrorMessage(err, 'No se pudo enviar el mensaje.')

      return false
    }
    finally {
      sending.value = false
    }
  }

  /** Reintenta un mensaje fallido: lo elimina y lo vuelve a enviar. */
  async function retryMessage(tempId: string): Promise<boolean> {
    const index = messages.value.findIndex(m => m.tempId === tempId)
    if (index === -1)
      return false

    const content = messages.value[index].content
    messages.value.splice(index, 1)

    return sendMessage(content)
  }

  /** Cierra el canal abierto y limpia la suscripción en tiempo real. */
  function closeChannel() {
    leaveRealtime()
    currentChannelId.value = null
    messages.value = []
    nextCursor.value = null
    hasMore.value = false
    messagesError.value = null
    sendError.value = null
  }

  return {
    // estado
    currentUserId,
    channels,
    channelsLoading,
    channelsError,
    currentChannelId,
    messages,
    messagesLoading,
    messagesError,
    hasMore,
    loadingMore,
    sending,
    sendError,
    // getters
    currentChannel,
    isChannelsEmpty,
    isCurrentChannelClosed,
    // acciones
    ensureCurrentUser,
    isOwnMessage,
    fetchChannels,
    openChannel,
    loadMore,
    sendMessage,
    retryMessage,
    closeChannel,
  }
})

export default useChatStore
