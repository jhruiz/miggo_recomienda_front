<script setup lang="ts">
/**
 * Vista comparativa de cotizaciones de una solicitud (Cliente dueño).
 *
 * Muestra lado a lado las cotizaciones recibidas para una Solicitud_Cotización
 * (Requisito 5.6), ordenadas de la más reciente a la más antigua por el
 * backend. Para cada cotización "pendiente" el Cliente dueño puede aceptarla
 * (Requisito 5.7) o rechazarla (Requisito 5.8). Al aceptar una, el backend
 * crea el Trabajo y pone las demás en "no seleccionada"; se recarga la lista
 * para reflejar los nuevos estados.
 *
 * Solo el Cliente dueño puede ver estas cotizaciones: si el backend responde
 * 403, se muestra el mensaje de error.
 *
 * El estado proviene del store Pinia `quotes`
 * (`GET /quotes/request/{id}`, `POST /quotes/{id}/accept`,
 * `POST /quotes/{id}/reject`).
 *
 * `useRoute`, `useRouter`, `storeToRefs`, `ref`, `computed` y `onMounted` están
 * disponibles por auto-import.
 */
import UserAvatar from '@/components/UserAvatar.vue'
import { useQuotesStore } from '@/stores/quotes'
import type { Quote } from '@/services'

const route = useRoute()
const router = useRouter()
const store = useQuotesStore()

const {
  comparative,
  comparativeLoading,
  comparativeError,
  isEmptyComparative,
  actionLoading,
  actionError,
  actingQuoteId,
} = storeToRefs(store)

const quoteRequestId = computed(() => Number(route.params.quoteRequestId))

/** Aviso de éxito tras aceptar (incluye navegación al trabajo creado). */
const createdJobId = ref<number | null>(null)

const statusColor: Record<string, string> = {
  pendiente: 'warning',
  aceptada: 'success',
  rechazada: 'error',
  no_seleccionada: 'secondary',
  expirada: 'secondary',
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
  return status.replace('_', ' ')
}

function dateText(value: string | null): string {
  if (!value)
    return '—'

  return new Date(value).toLocaleDateString('es-CO')
}

/** Solo las cotizaciones "pendiente" admiten aceptar/rechazar (Requisito 6.4). */
function canAct(quote: Quote): boolean {
  return quote.status === 'pendiente'
}

async function accept(quote: Quote) {
  try {
    const result = await store.accept(quote.id)

    createdJobId.value = result.job.id
  }
  catch {
    // El mensaje queda en `actionError`.
  }
}

async function reject(quote: Quote) {
  await store.reject(quote.id).catch(() => {})
}

function goToJob() {
  if (createdJobId.value != null)
    router.push(`/jobs/${createdJobId.value}`)
}

onMounted(() => {
  store.fetchForRequest(quoteRequestId.value).catch(() => {})
})
</script>

<template>
  <div>
    <VBtn
      variant="text"
      color="secondary"
      prepend-icon="ri-arrow-left-line"
      class="mb-4"
      :to="`/quote-requests/${quoteRequestId}`"
    >
      Volver a la solicitud
    </VBtn>

    <div class="mb-6">
      <h4 class="text-h4 mb-1">
        Cotizaciones recibidas
      </h4>
      <span class="text-body-1 text-medium-emphasis">
        Compara las propuestas lado a lado y acepta la que prefieras.
      </span>
    </div>

    <!-- Éxito tras aceptar -->
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
          @click="goToJob"
        >
          Ver trabajo
        </VBtn>
      </div>
    </VAlert>

    <!-- Error de acción (p. ej. 409 cotización expirada) -->
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

    <!-- Error de carga (p. ej. 403 si no eres el dueño) -->
    <VAlert
      v-if="comparativeError"
      type="error"
      variant="tonal"
      border="start"
      class="mb-6"
    >
      {{ comparativeError }}
    </VAlert>

    <!-- Cargando -->
    <VCard v-if="comparativeLoading">
      <VCardText class="d-flex justify-center py-12">
        <VProgressCircular
          indeterminate
          color="primary"
          size="48"
        />
      </VCardText>
    </VCard>

    <!-- Sin cotizaciones -->
    <VCard v-else-if="isEmptyComparative">
      <VCardText class="text-center py-12">
        <VIcon
          icon="ri-file-list-3-line"
          size="48"
          color="disabled"
          class="mb-3"
        />
        <p class="text-body-1 mb-0">
          Aún no has recibido cotizaciones para esta solicitud.
        </p>
      </VCardText>
    </VCard>

    <!-- Comparativa lado a lado -->
    <VRow v-else>
      <VCol
        v-for="quote in comparative"
        :key="quote.id"
        cols="12"
        md="6"
        lg="4"
      >
        <VCard
          class="h-100 d-flex flex-column"
          :variant="quote.status === 'aceptada' ? 'outlined' : 'elevated'"
          :color="quote.status === 'aceptada' ? 'success' : undefined"
        >
          <VCardItem>
            <div class="d-flex align-center justify-space-between gap-2">
              <div class="d-flex align-center gap-2 overflow-hidden">
                <UserAvatar
                  :name="quote.provider_name"
                  :user-id="quote.provider_user_id"
                  :src="quote.provider_avatar_thumb_url"
                  :size="32"
                />
                <VCardTitle class="text-truncate pa-0">
                  {{ quote.provider_name ?? `Prestador #${quote.provider_user_id}` }}
                </VCardTitle>
              </div>
              <VChip
                :color="statusColor[quote.status] ?? 'secondary'"
                variant="tonal"
                size="small"
                class="text-capitalize"
              >
                {{ statusLabel(quote.status) }}
              </VChip>
            </div>
          </VCardItem>

          <VCardText class="flex-grow-1">
            <div class="text-h4 mb-1">
              {{ money(quote.total_price) }}
            </div>
            <div class="d-flex flex-wrap gap-3 text-body-2 text-medium-emphasis mb-4">
              <span>
                <VIcon icon="ri-truck-line" size="16" />
                {{ quote.delivery_days }} días de entrega
              </span>
              <span>
                <VIcon icon="ri-time-line" size="16" />
                Expira: {{ dateText(quote.expires_at) }}
              </span>
            </div>

            <p
              v-if="quote.service_description"
              class="text-body-2 mb-4"
              style="white-space: pre-line;"
            >
              {{ quote.service_description }}
            </p>

            <VDivider class="mb-3" />

            <!-- Ítems de la cotización -->
            <VTable density="compact" class="text-body-2 mb-4">
              <thead>
                <tr>
                  <th>Ítem</th>
                  <th class="text-center">
                    Cant.
                  </th>
                  <th class="text-end">
                    Subtotal
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="item in quote.items"
                  :key="item.id"
                >
                  <td>{{ item.description }}</td>
                  <td class="text-center">
                    {{ item.quantity }}
                  </td>
                  <td class="text-end">
                    {{ money(item.subtotal) }}
                  </td>
                </tr>
              </tbody>
            </VTable>

            <!-- Adjuntos -->
            <div
              v-if="quote.attachments.length"
              class="d-flex flex-wrap gap-2"
            >
              <a
                v-for="attachment in quote.attachments"
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
          </VCardText>

          <!-- Acciones (solo cotizaciones pendientes) -->
          <VCardActions
            v-if="canAct(quote)"
            class="px-4 pb-4 gap-2"
          >
            <VBtn
              color="success"
              variant="flat"
              prepend-icon="ri-check-line"
              :loading="actionLoading && actingQuoteId === quote.id"
              :disabled="actionLoading"
              @click="accept(quote)"
            >
              Aceptar
            </VBtn>
            <VBtn
              color="error"
              variant="tonal"
              prepend-icon="ri-close-line"
              :loading="actionLoading && actingQuoteId === quote.id"
              :disabled="actionLoading"
              @click="reject(quote)"
            >
              Rechazar
            </VBtn>
          </VCardActions>
        </VCard>
      </VCol>
    </VRow>
  </div>
</template>
