<script setup lang="ts">
/**
 * Mensajería en tiempo real (tarea 13.6, Requisitos 11.4, 11.9).
 *
 * Vista de dos paneles:
 *  - Izquierda: listado de canales del usuario (`GET /chat/channels`).
 *  - Derecha: conversación del canal abierto, con historial cronológico,
 *    "cargar más antiguos" por cursor (Requisito 11.6) y un compositor para
 *    enviar mensajes.
 *
 * El envío es OPTIMISTA (el mensaje aparece al instante y se reconcilia con la
 * respuesta HTTP) y la recepción es en tiempo real vía Laravel Echo
 * (suscripción a `private-chat.{channelId}`, evento `chat.message`). Un canal
 * "cerrado" deshabilita el compositor (Requisito 11.7).
 *
 * El canal abierto se refleja en la ruta (`/chat/:channelId`) para enlaces
 * directos. El estado vive en el store Pinia `chat`.
 *
 * `useRoute`, `useRouter`, `storeToRefs`, `computed`, `ref`, `nextTick`,
 * `watch`, `onMounted` y `onBeforeUnmount` están disponibles por auto-import.
 */
import { useChatStore } from '@/stores/chat'
import UserAvatar from '@/components/UserAvatar.vue'
import type { ChatChannel } from '@/services'
import type { ChatMessageView } from '@/stores/chat'

const route = useRoute()
const router = useRouter()
const store = useChatStore()

const {
  channels,
  channelsLoading,
  channelsError,
  isChannelsEmpty,
  currentChannelId,
  currentChannel,
  messages,
  messagesLoading,
  messagesError,
  hasMore,
  loadingMore,
  sending,
  sendError,
  isCurrentChannelClosed,
  currentUserId,
} = storeToRefs(store)

const draft = ref('')
const messagesContainer = ref<HTMLElement | null>(null)

const routeChannelId = computed<number | null>(() => {
  const raw = route.params.channelId
  const value = Array.isArray(raw) ? raw[0] : raw
  const parsed = Number(value)

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
})

const statusColor: Record<string, string> = {
  activo: 'success',
  pre_aceptacion: 'info',
  cerrado: 'secondary',
}

/**
 * Título de la conversación: la Solicitud de origen. Sin Solicitud (Trabajo de
 * cotización directa) se identifica por el Trabajo.
 */
function channelTitle(channel: ChatChannel): string {
  if (channel.quote_request?.title)
    return channel.quote_request.title
  if (channel.job_id)
    return `Trabajo #${channel.job_id} (cotización directa)`
  if (channel.quote_request_application_id)
    return `Postulación #${channel.quote_request_application_id}`

  return `Canal #${channel.id}`
}

/** El usuario autenticado es el Cliente del canal. */
function isClientOf(channel: ChatChannel): boolean {
  return currentUserId.value === channel.client_user_id
}

/** Contraparte: con quién habla el usuario, por nombre y rol. */
function counterpartName(channel: ChatChannel): string | null {
  return (isClientOf(channel) ? channel.provider_name : channel.client_name) ?? null
}

function counterpartUserId(channel: ChatChannel): number {
  return isClientOf(channel) ? channel.provider_user_id : channel.client_user_id
}

function counterpartAvatar(channel: ChatChannel): string | null {
  return (isClientOf(channel)
    ? channel.provider_avatar_thumb_url
    : channel.client_avatar_thumb_url) ?? null
}

function counterpartLabel(channel: ChatChannel): string {
  if (isClientOf(channel))
    return `Prestador: ${channel.provider_name ?? `#${channel.provider_user_id}`}`

  return `Cliente: ${channel.client_name ?? `#${channel.client_user_id}`}`
}

/** Origen de la conversación. */
function contextLabel(channel: ChatChannel): string {
  return channel.context === 'trabajo' || channel.job_id ? 'Trabajo' : 'Postulación'
}

/** Detalle de la Solicitud: categoría y ciudad, si existen. */
function requestDetails(channel: ChatChannel): string {
  const parts = [channel.quote_request?.category_name, channel.quote_request?.city_name]

  return parts.filter(Boolean).join(' · ')
}

function statusLabel(status: string): string {
  return status.replace('_', ' ')
}

function isOwn(message: ChatMessageView): boolean {
  return store.isOwnMessage(message)
}

function messageTime(message: ChatMessageView): string {
  const value = message.sent_at_utc ?? message.created_at
  if (!value)
    return ''

  return new Date(value).toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function messageKey(message: ChatMessageView): string {
  return message.tempId ?? `srv-${message.id}`
}

async function scrollToBottom() {
  await nextTick()
  const el = messagesContainer.value
  if (el)
    el.scrollTop = el.scrollHeight
}

async function selectChannel(channelId: number) {
  if (channelId === currentChannelId.value)
    return

  await router.push(`/chat/${channelId}`)
}

async function openCurrent(channelId: number) {
  await store.openChannel(channelId)
  await scrollToBottom()
}

async function submit() {
  const content = draft.value
  if (!content.trim() || sending.value || isCurrentChannelClosed.value)
    return

  draft.value = ''
  const ok = await store.sendMessage(content)
  await scrollToBottom()

  // Si falló, restaura el borrador para no perder el texto del usuario.
  if (!ok)
    draft.value = content
}

async function retry(message: ChatMessageView) {
  if (!message.tempId)
    return

  await store.retryMessage(message.tempId)
  await scrollToBottom()
}

// Sincroniza la ruta con el canal abierto (enlaces directos y navegación).
watch(routeChannelId, async channelId => {
  if (channelId != null)
    await openCurrent(channelId)
  else
    store.closeChannel()
})

// Mensajes nuevos que llegan en tiempo real (de la otra parte): baja al final
// para que se vean sin desplazarse a mano. Solo cuando crece la lista, para no
// saltar al cargar mensajes más antiguos.
watch(() => messages.value.length, async (length, previous) => {
  if (length > (previous ?? 0) && !loadingMore.value)
    await scrollToBottom()
})
onMounted(async () => {
  await store.fetchChannels().catch(() => {})

  if (routeChannelId.value != null)
    await openCurrent(routeChannelId.value)
})

onBeforeUnmount(() => {
  store.closeChannel()
})
</script>

<template>
  <div>
    <div class="mb-6">
      <h4 class="text-h4 mb-1">
        Mensajes
      </h4>
      <span class="text-body-1 text-medium-emphasis">
        Conversa con la otra parte en tiempo real.
      </span>
    </div>

    <VRow>
      <!-- Panel izquierdo: canales -->
      <VCol
        cols="12"
        md="4"
      >
        <VCard>
          <VCardItem>
            <VCardTitle>Conversaciones</VCardTitle>
          </VCardItem>

          <VAlert
            v-if="channelsError"
            type="error"
            variant="tonal"
            class="mx-4 mb-4"
          >
            {{ channelsError }}
          </VAlert>

          <VCardText
            v-if="channelsLoading"
            class="d-flex justify-center py-8"
          >
            <VProgressCircular
              indeterminate
              color="primary"
            />
          </VCardText>

          <VCardText
            v-else-if="isChannelsEmpty"
            class="text-center py-8 text-medium-emphasis"
          >
            <VIcon
              icon="ri-chat-off-line"
              size="40"
              class="mb-2"
            />
            <p class="mb-0">
              Aún no tienes conversaciones.
            </p>
          </VCardText>

          <VList
            v-else
            lines="two"
            density="comfortable"
          >
            <VListItem
              v-for="channel in channels"
              :key="channel.id"
              :active="channel.id === currentChannelId"
              @click="selectChannel(channel.id)"
            >
              <template #prepend>
                <UserAvatar
                  class="me-3"
                  :name="counterpartName(channel)"
                  :user-id="counterpartUserId(channel)"
                  :src="counterpartAvatar(channel)"
                />
              </template>

              <VListItemTitle :title="channelTitle(channel)">
                {{ channelTitle(channel) }}
              </VListItemTitle>
              <VListItemSubtitle>
                {{ counterpartLabel(channel) }} · {{ contextLabel(channel) }}
              </VListItemSubtitle>

              <template #append>
                <VChip
                  size="x-small"
                  :color="statusColor[channel.status] ?? 'secondary'"
                  variant="tonal"
                  class="text-capitalize"
                >
                  {{ statusLabel(channel.status) }}
                </VChip>
              </template>
            </VListItem>
          </VList>
        </VCard>
      </VCol>

      <!-- Panel derecho: conversación -->
      <VCol
        cols="12"
        md="8"
      >
        <VCard class="d-flex flex-column" style="block-size: 70vh;">
          <!-- Sin canal seleccionado -->
          <VCardText
            v-if="currentChannelId == null"
            class="d-flex flex-column align-center justify-center flex-grow-1 text-medium-emphasis"
          >
            <VIcon
              icon="ri-chat-smile-3-line"
              size="48"
              class="mb-2"
            />
            <p class="mb-0">
              Selecciona una conversación para empezar.
            </p>
          </VCardText>

          <template v-else>
            <!-- Encabezado del canal -->
            <VCardItem class="flex-grow-0 border-b">
              <template v-if="currentChannel">
                <VCardTitle class="text-wrap">
                  {{ channelTitle(currentChannel) }}
                </VCardTitle>
                <VCardSubtitle class="d-flex flex-wrap align-center gap-x-3 gap-y-1">
                  <span>
                    <VIcon icon="ri-user-line" size="16" />
                    {{ counterpartLabel(currentChannel) }}
                  </span>
                  <span>
                    <VIcon
                      :icon="currentChannel.job_id ? 'ri-briefcase-line' : 'ri-send-plane-line'"
                      size="16"
                    />
                    {{ contextLabel(currentChannel) }}
                  </span>
                  <span v-if="requestDetails(currentChannel)">
                    <VIcon icon="ri-price-tag-3-line" size="16" />
                    {{ requestDetails(currentChannel) }}
                  </span>
                  <span v-if="currentChannel.quote_request" class="text-capitalize">
                    Solicitud {{ statusLabel(currentChannel.quote_request.status) }}
                  </span>
                </VCardSubtitle>
                <div class="d-flex flex-wrap gap-2 mt-2">
                  <VBtn
                    v-if="currentChannel.quote_request"
                    size="small"
                    variant="tonal"
                    color="primary"
                    prepend-icon="ri-file-list-3-line"
                    :to="`/quote-requests/${currentChannel.quote_request.id}`"
                  >
                    Ver solicitud
                  </VBtn>
                  <VBtn
                    v-if="currentChannel.job_id"
                    size="small"
                    variant="tonal"
                    color="primary"
                    prepend-icon="ri-briefcase-line"
                    :to="`/jobs/${currentChannel.job_id}`"
                  >
                    Ver trabajo
                  </VBtn>
                </div>
              </template>
              <template #append>
                <VChip
                  v-if="currentChannel"
                  size="small"
                  :color="statusColor[currentChannel.status] ?? 'secondary'"
                  variant="tonal"
                  class="text-capitalize"
                >
                  {{ statusLabel(currentChannel.status) }}
                </VChip>
              </template>
            </VCardItem>

            <!-- Historial -->
            <div
              ref="messagesContainer"
              class="flex-grow-1 overflow-y-auto pa-4"
            >
              <div
                v-if="hasMore"
                class="text-center mb-4"
              >
                <VBtn
                  size="small"
                  variant="text"
                  :loading="loadingMore"
                  @click="store.loadMore()"
                >
                  Cargar mensajes anteriores
                </VBtn>
              </div>

              <VProgressCircular
                v-if="messagesLoading"
                indeterminate
                color="primary"
                class="d-block mx-auto my-8"
              />

              <VAlert
                v-else-if="messagesError"
                type="error"
                variant="tonal"
              >
                {{ messagesError }}
              </VAlert>

              <template v-else>
                <div
                  v-for="message in messages"
                  :key="messageKey(message)"
                  class="d-flex mb-3"
                  :class="isOwn(message) ? 'justify-end' : 'justify-start'"
                >
                  <div
                    class="pa-3 rounded"
                    style="max-inline-size: 75%;"
                    :class="isOwn(message)
                      ? 'bg-primary text-white'
                      : 'bg-surface border'"
                  >
                    <div class="text-body-2" style="white-space: pre-wrap; word-break: break-word;">
                      {{ message.content }}
                    </div>
                    <div
                      class="d-flex align-center gap-1 mt-1 text-caption"
                      :class="isOwn(message) ? 'text-white' : 'text-medium-emphasis'"
                      style="opacity: 0.8;"
                    >
                      <span>{{ messageTime(message) }}</span>
                      <VIcon
                        v-if="message.deliveryStatus === 'sending'"
                        icon="ri-time-line"
                        size="12"
                      />
                      <template v-else-if="message.deliveryStatus === 'failed'">
                        <VIcon
                          icon="ri-error-warning-line"
                          size="12"
                          color="error"
                        />
                        <VBtn
                          size="x-small"
                          variant="text"
                          color="error"
                          class="pa-0"
                          @click="retry(message)"
                        >
                          Reintentar
                        </VBtn>
                      </template>
                    </div>
                  </div>
                </div>
              </template>
            </div>

            <!-- Compositor -->
            <VDivider />
            <div class="pa-3 flex-grow-0">
              <VAlert
                v-if="sendError"
                type="error"
                variant="tonal"
                density="compact"
                class="mb-2"
              >
                {{ sendError }}
              </VAlert>

              <VAlert
                v-if="isCurrentChannelClosed"
                type="info"
                variant="tonal"
                density="compact"
                class="mb-0"
              >
                Este canal está cerrado. No puedes enviar nuevos mensajes.
              </VAlert>

              <VForm
                v-else
                class="d-flex align-end gap-2"
                @submit.prevent="submit"
              >
                <VTextarea
                  v-model="draft"
                  placeholder="Escribe un mensaje…"
                  rows="1"
                  auto-grow
                  max-rows="5"
                  hide-details
                  density="comfortable"
                  :counter="2000"
                  :maxlength="2000"
                  @keydown.enter.exact.prevent="submit"
                />
                <VBtn
                  type="submit"
                  color="primary"
                  icon="ri-send-plane-2-line"
                  :loading="sending"
                  :disabled="!draft.trim()"
                />
              </VForm>
            </div>
          </template>
        </VCard>
      </VCol>
    </VRow>
  </div>
</template>
