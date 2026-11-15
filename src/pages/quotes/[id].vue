<script setup lang="ts">
/**
 * Detalle de una cotización (accesible para sus dos partes).
 *
 * Muestra estado, total, ítems, descripción, entrega, expiración, adjuntos,
 * contraparte y enlace a la solicitud. Las acciones se deciden por
 * participación (id del usuario frente a `client_user_id` / `provider_user_id`),
 * no por un rol seleccionado, porque el backend autoriza por parte:
 *
 *  - Cliente receptor con cotización `pendiente`: Aceptar / Rechazar.
 *  - Prestador objetivo con cotización directa `solicitada`: Responder.
 *  - Cotización `aceptada` con trabajo: Ver trabajo.
 *
 * Si la URL trae `?sent=1` (tras enviar una cotización) se muestra una
 * confirmación una sola vez y se limpia el query.
 */
import UserAvatar from '@/components/UserAvatar.vue'
import { useAuthStore } from '@/stores/auth'
import { useQuotesStore } from '@/stores/quotes'

const route = useRoute()
const router = useRouter()
const store = useQuotesStore()
const auth = useAuthStore()

const { current, currentLoading, currentError, actionLoading, actionError } = storeToRefs(store)

const quoteId = computed(() => Number(route.params.id))

/** Confirmación de envío (copiada del query para sobrevivir a su limpieza). */
const showSent = ref(route.query.sent === '1')

/** Trabajo creado al aceptar en esta pantalla. */
const createdJobId = ref<number | null>(null)

const statusColor: Record<string, string> = {
  solicitada: 'info',
  pendiente: 'warning',
  aceptada: 'success',
  rechazada: 'error',
  no_seleccionada: 'secondary',
  expirada: 'secondary',
  sin_respuesta: 'secondary',
}

const currencyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 2,
})

function money(value: number): string {
  return currencyFormatter.format(Number.isFinite(value) ? value : 0)
}

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ')
}

function dateText(value: string | null | undefined): string {
  if (!value)
    return '—'

  return new Date(value).toLocaleDateString('es-CO')
}

const userId = computed(() => auth.user?.id ?? null)
const isClientParty = computed(
  () => userId.value != null && current.value?.client_user_id === userId.value,
)
const isProviderParty = computed(
  () => userId.value != null && current.value?.provider_user_id === userId.value,
)

const canDecide = computed(
  () => isClientParty.value && current.value?.status === 'pendiente',
)
const canRespondDirect = computed(
  () =>
    isProviderParty.value
    && current.value?.type === 'directa'
    && current.value?.status === 'solicitada',
)

const jobId = computed(() => createdJobId.value ?? current.value?.job_id ?? null)
const canViewJob = computed(
  () => current.value?.status === 'aceptada' && jobId.value != null,
)

const counterpartLabel = computed(() => (isClientParty.value ? 'Prestador' : 'Cliente'))
const counterpartName = computed(() => {
  const q = current.value
  if (!q)
    return ''

  return isClientParty.value
    ? (q.provider_name ?? `Prestador #${q.provider_user_id}`)
    : (q.client_name ?? `Cliente #${q.client_user_id}`)
})

const counterpartUserId = computed(() => {
  const q = current.value
  if (!q)
    return null

  return isClientParty.value ? q.provider_user_id : q.client_user_id
})
const counterpartAvatar = computed(() => {
  const q = current.value
  if (!q)
    return null

  return (isClientParty.value ? q.provider_avatar_thumb_url : q.client_avatar_thumb_url) ?? null
})

/** Enlace a la solicitud según la parte (el Cliente va a la comparativa). */
const requestLink = computed(() => {
  const requestId = current.value?.quote_request_id
  if (!requestId)
    return null

  return isClientParty.value
    ? `/quotes/request/${requestId}`
    : `/quote-requests/${requestId}`
})

async function accept() {
  if (!current.value)
    return
  try {
    const result = await store.accept(current.value.id)

    createdJobId.value = result.job.id
  }
  catch {
    // El mensaje queda en `actionError`.
  }
}

async function reject() {
  if (!current.value)
    return
  await store.reject(current.value.id).catch(() => {})
}

async function load() {
  await Promise.all([
    store.fetchById(quoteId.value).catch(() => {}),
    auth.ensureUser(),
  ])
}

onMounted(async () => {
  if (showSent.value)
    router.replace({ query: {} })

  await load()
})
</script>

<template>
  <div>
    <VBtn
      variant="text"
      color="secondary"
      prepend-icon="ri-arrow-left-line"
      class="mb-4"
      @click="router.back()"
    >
      Volver
    </VBtn>

    <VAlert
      v-if="showSent"
      type="success"
      variant="tonal"
      border="start"
      closable
      class="mb-6"
    >
      Cotización enviada correctamente
    </VAlert>

    <VAlert
      v-if="createdJobId != null"
      type="success"
      variant="tonal"
      border="start"
      class="mb-6"
    >
      <div class="d-flex flex-wrap align-center justify-space-between gap-2">
        <span>Cotización aceptada. Se creó el trabajo asociado.</span>
        <VBtn
          size="small"
          color="success"
          variant="flat"
          :to="`/jobs/${createdJobId}`"
        >
          Ver trabajo
        </VBtn>
      </div>
    </VAlert>

    <VAlert
      v-if="actionError"
      type="warning"
      variant="tonal"
      border="start"
      closable
      class="mb-6"
    >
      {{ actionError }}
    </VAlert>

    <VAlert
      v-if="currentError"
      type="error"
      variant="tonal"
      border="start"
      class="mb-6"
    >
      {{ currentError }}
    </VAlert>

    <VCard v-if="currentLoading">
      <VCardText class="d-flex justify-center py-12">
        <VProgressCircular
          indeterminate
          color="primary"
          size="48"
        />
      </VCardText>
    </VCard>

    <VCard v-else-if="current">
      <VCardItem>
        <div class="d-flex align-center justify-space-between gap-2">
          <VCardTitle>Cotización #{{ current.id }}</VCardTitle>
          <VChip
            :color="statusColor[current.status] ?? 'secondary'"
            variant="tonal"
            size="small"
            class="text-capitalize"
          >
            {{ statusLabel(current.status) }}
          </VChip>
        </div>
        <VCardSubtitle v-if="current.quote_request?.title ?? current.quote_request_title">
          {{ current.quote_request?.title ?? current.quote_request_title }}
        </VCardSubtitle>
      </VCardItem>

      <VCardText>
        <div class="text-h4 mb-1">
          {{ money(current.total_price) }}
        </div>
        <div class="d-flex flex-wrap gap-3 text-body-2 text-medium-emphasis mb-4">
          <span class="d-inline-flex align-center gap-2">
            <UserAvatar
              :name="counterpartName"
              :user-id="counterpartUserId"
              :src="counterpartAvatar"
              :size="24"
            />
            {{ counterpartLabel }}: {{ counterpartName }}
          </span>
          <span>
            <VIcon icon="ri-truck-line" size="16" />
            {{ current.delivery_days }} días de entrega
          </span>
          <span>
            <VIcon icon="ri-time-line" size="16" />
            Expira: {{ dateText(current.expires_at) }}
          </span>
        </div>

        <p
          v-if="current.service_description"
          class="text-body-2 mb-4"
          style="white-space: pre-line;"
        >
          {{ current.service_description }}
        </p>

        <template v-if="current.items.length">
          <VDivider class="mb-3" />
          <VTable density="compact" class="text-body-2 mb-4">
            <thead>
              <tr>
                <th>Ítem</th>
                <th class="text-center">
                  Cant.
                </th>
                <th class="text-end">
                  Precio unitario
                </th>
                <th class="text-end">
                  Subtotal
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in current.items"
                :key="item.id"
              >
                <td>{{ item.description }}</td>
                <td class="text-center">
                  {{ item.quantity }}
                </td>
                <td class="text-end">
                  {{ money(item.unit_price) }}
                </td>
                <td class="text-end">
                  {{ money(item.subtotal) }}
                </td>
              </tr>
            </tbody>
          </VTable>
        </template>

        <div
          v-if="current.attachments.length"
          class="d-flex flex-wrap gap-2 mb-4"
        >
          <a
            v-for="attachment in current.attachments"
            :key="attachment.id"
            :href="attachment.url"
            target="_blank"
            rel="noopener"
          >
            <VImg
              :src="attachment.thumb_url ?? attachment.url"
              width="64"
              height="64"
              cover
              class="rounded"
            />
          </a>
        </div>

        <VBtn
          v-if="requestLink"
          variant="text"
          color="primary"
          prepend-icon="ri-file-list-3-line"
          :to="requestLink"
        >
          Ver solicitud
        </VBtn>
      </VCardText>

      <VCardActions
        v-if="canDecide || canRespondDirect || canViewJob"
        class="px-4 pb-4 gap-2"
      >
        <template v-if="canDecide">
          <VBtn
            color="success"
            variant="flat"
            prepend-icon="ri-check-line"
            :loading="actionLoading"
            :disabled="actionLoading"
            @click="accept"
          >
            Aceptar
          </VBtn>
          <VBtn
            color="error"
            variant="tonal"
            prepend-icon="ri-close-line"
            :disabled="actionLoading"
            @click="reject"
          >
            Rechazar
          </VBtn>
        </template>

        <VBtn
          v-if="canRespondDirect"
          color="primary"
          variant="flat"
          prepend-icon="ri-send-plane-line"
          :to="`/quotes/new?direct_quote_id=${current.id}`"
        >
          Responder
        </VBtn>

        <VBtn
          v-if="canViewJob"
          color="success"
          variant="tonal"
          prepend-icon="ri-briefcase-line"
          :to="`/jobs/${jobId}`"
        >
          Ver trabajo
        </VBtn>
      </VCardActions>
    </VCard>
  </div>
</template>
