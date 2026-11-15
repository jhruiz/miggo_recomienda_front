<script setup lang="ts">
/**
 * "Cotizaciones recibidas" (Cliente), con dos pestañas:
 * - Recibidas: listado paginado de cotizaciones públicas y directas ya
 *   respondidas. Enlaza a la vista comparativa de la solicitud o, en las
 *   directas, al detalle de la cotización.
 * - Esperando respuesta: Cotizaciones directas solicitadas que el Prestador
 *   aún no responde (solicitada) o dejó vencer (sin_respuesta).
 */
import AwaitingQuoteCard from '@/components/quotes/AwaitingQuoteCard.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import { useQuotesStore } from '@/stores/quotes'

const store = useQuotesStore()

const {
  received,
  receivedPagination,
  receivedStatus,
  receivedLoading,
  receivedError,
  isEmptyReceived,
  awaiting,
  awaitingPagination,
  awaitingStatus,
  awaitingLoading,
  awaitingError,
  isEmptyAwaiting,
} = storeToRefs(store)

const activeTab = ref<'received' | 'awaiting'>('received')

const awaitingStatusOptions = [
  { title: 'Esperando respuesta', value: 'solicitada' },
  { title: 'Sin respuesta', value: 'sin_respuesta' },
]

const statusOptions = [
  { title: 'Pendiente', value: 'pendiente' },
  { title: 'Aceptada', value: 'aceptada' },
  { title: 'Rechazada', value: 'rechazada' },
  { title: 'No seleccionada', value: 'no_seleccionada' },
  { title: 'Expirada', value: 'expirada' },
]

const statusColor: Record<string, string> = {
  pendiente: 'warning',
  aceptada: 'success',
  rechazada: 'error',
  no_seleccionada: 'secondary',
  expirada: 'secondary',
}

function statusLabel(status: string): string {
  return (status ?? '').replace(/_/g, ' ')
}

function money(value: number): string {
  return `$${Number(value).toLocaleString('es-CO')}`
}

function dateText(value: string | null): string {
  return value ? new Date(value).toLocaleDateString('es-CO') : '—'
}

/** Comparativa si pertenece a una solicitud; detalle si es directa. */
function linkFor(quote: { id: number; quote_request_id: number | null }): string {
  return quote.quote_request_id
    ? `/quotes/request/${quote.quote_request_id}`
    : `/quotes/${quote.id}`
}

const pageInfo = computed(() => {
  const { currentPage, lastPage, total } = receivedPagination.value

  return `Página ${currentPage} de ${lastPage} · ${total} cotización${total === 1 ? '' : 'es'}`
})

const awaitingPageInfo = computed(() => {
  const { currentPage, lastPage, total } = awaitingPagination.value

  return `Página ${currentPage} de ${lastPage} · ${total} cotización${total === 1 ? '' : 'es'}`
})

function onAwaitingStatusChange(value: string | null) {
  store.fetchAwaiting(1, value ?? null).catch(() => {})
}

/** Al cambiar de pestaña se carga la página 1 de esa vista conservando su filtro. */
function onTabChange(tab: unknown) {
  if (tab === 'awaiting')
    store.fetchAwaiting(1, awaitingStatus.value).catch(() => {})
  else
    store.fetchReceived(1, receivedStatus.value).catch(() => {})
}

function onStatusChange(value: string | null) {
  store.fetchReceived(1, value ?? null).catch(() => {})
}

onMounted(() => {
  store.fetchReceived(1, receivedStatus.value).catch(() => {})
})
</script>

<template>
  <div>
    <div class="mb-6">
      <h4 class="text-h4 mb-1">
        Cotizaciones recibidas
      </h4>
      <span class="text-body-1 text-medium-emphasis">
        Cotizaciones que los prestadores te enviaron.
      </span>
    </div>

    <VTabs
      v-model="activeTab"
      class="mb-6"
      @update:model-value="onTabChange"
    >
      <VTab value="received">
        Recibidas
      </VTab>
      <VTab value="awaiting">
        Esperando respuesta
      </VTab>
    </VTabs>

    <template v-if="activeTab === 'received'">
      <VCard class="mb-6">
        <VCardText>
          <VRow>
            <VCol
              cols="12"
              sm="6"
              md="4"
            >
              <VSelect
                :model-value="receivedStatus"
                label="Estado"
                placeholder="Todos los estados"
                :items="statusOptions"
                clearable
                @update:model-value="onStatusChange"
              />
            </VCol>
          </VRow>
        </VCardText>
      </VCard>

      <VAlert
        v-if="receivedError"
        type="error"
        variant="tonal"
        border="start"
        class="mb-6"
      >
        {{ receivedError }}
      </VAlert>

      <VCard v-if="receivedLoading">
        <VCardText class="d-flex justify-center py-12">
          <VProgressCircular
            indeterminate
            color="primary"
            size="48"
          />
        </VCardText>
      </VCard>

      <VCard v-else-if="isEmptyReceived && !receivedError">
        <VCardText class="text-center py-12">
          <VIcon
            icon="ri-inbox-line"
            size="48"
            color="disabled"
            class="mb-3"
          />
          <p class="text-body-1 mb-0">
            {{ receivedStatus ? 'No hay cotizaciones con ese estado.' : 'Aún no has recibido cotizaciones.' }}
          </p>
        </VCardText>
      </VCard>

      <template v-else-if="!receivedError">
        <VRow>
          <VCol
            v-for="quote in received"
            :key="quote.id"
            cols="12"
            md="6"
          >
            <VCard class="h-100">
              <VCardText>
                <div class="d-flex align-center justify-space-between gap-2 mb-2">
                  <h6 class="text-h6 mb-0">
                    {{ quote.quote_request_title ?? 'Cotización directa' }}
                  </h6>
                  <VChip
                    size="small"
                    :color="statusColor[quote.status] ?? 'secondary'"
                    variant="tonal"
                    class="text-capitalize"
                  >
                    {{ statusLabel(quote.status) }}
                  </VChip>
                </div>

                <div class="d-flex flex-wrap gap-3 text-caption text-medium-emphasis mb-4">
                  <span
                    v-if="quote.provider_name"
                    class="d-inline-flex align-center gap-1"
                  >
                    <UserAvatar
                      :name="quote.provider_name"
                      :user-id="quote.provider_user_id"
                      :src="quote.provider_avatar_thumb_url"
                      :size="24"
                    />
                    {{ quote.provider_name }}
                  </span>
                  <span>
                    <VIcon
                      icon="ri-money-dollar-circle-line"
                      size="14"
                    />
                    {{ money(quote.total_price) }}
                  </span>
                  <span>
                    <VIcon
                      icon="ri-calendar-line"
                      size="14"
                    />
                    {{ dateText(quote.created_at) }}
                  </span>
                </div>

                <div class="d-flex flex-wrap gap-2">
                  <VBtn
                    size="small"
                    variant="tonal"
                    color="primary"
                    :prepend-icon="quote.quote_request_id ? 'ri-scales-3-line' : 'ri-eye-line'"
                    :to="linkFor(quote)"
                  >
                    {{ quote.quote_request_id ? 'Ver comparativa' : 'Ver detalle' }}
                  </VBtn>
                  <VBtn
                    v-if="quote.quote_request_id"
                    size="small"
                    variant="text"
                    :to="`/quotes/${quote.id}`"
                  >
                    Detalle
                  </VBtn>
                </div>
              </VCardText>
            </VCard>
          </VCol>
        </VRow>

        <div class="d-flex align-center justify-space-between flex-wrap gap-3 mt-6">
          <span class="text-body-2 text-medium-emphasis">{{ pageInfo }}</span>
          <VPagination
            :model-value="receivedPagination.currentPage"
            :length="receivedPagination.lastPage"
            :total-visible="5"
            density="comfortable"
            @update:model-value="store.fetchReceived($event, receivedStatus).catch(() => {})"
          />
        </div>
      </template>
    </template>

    <template v-else>
      <VCard class="mb-6">
        <VCardText>
          <VRow>
            <VCol
              cols="12"
              sm="6"
              md="4"
            >
              <VSelect
                :model-value="awaitingStatus"
                label="Estado"
                placeholder="Todos los estados"
                :items="awaitingStatusOptions"
                clearable
                @update:model-value="onAwaitingStatusChange"
              />
            </VCol>
          </VRow>
        </VCardText>
      </VCard>

      <VAlert
        v-if="awaitingError"
        type="error"
        variant="tonal"
        border="start"
        class="mb-6"
      >
        {{ awaitingError }}
      </VAlert>

      <VCard v-if="awaitingLoading">
        <VCardText class="d-flex justify-center py-12">
          <VProgressCircular
            indeterminate
            color="primary"
            size="48"
          />
        </VCardText>
      </VCard>

      <VCard v-else-if="isEmptyAwaiting && !awaitingError">
        <VCardText class="text-center py-12">
          <VIcon
            icon="ri-inbox-line"
            size="48"
            color="disabled"
            class="mb-3"
          />
          <p class="text-body-1 mb-0">
            {{ awaitingStatus ? 'No hay solicitudes con ese estado.' : 'No tienes solicitudes en espera de respuesta.' }}
          </p>
        </VCardText>
      </VCard>

      <template v-else-if="!awaitingError">
        <VRow>
          <VCol
            v-for="quote in awaiting"
            :key="quote.id"
            cols="12"
            md="6"
          >
            <AwaitingQuoteCard :quote="quote" />
          </VCol>
        </VRow>

        <div class="d-flex align-center justify-space-between flex-wrap gap-3 mt-6">
          <span class="text-body-2 text-medium-emphasis">{{ awaitingPageInfo }}</span>
          <VPagination
            :model-value="awaitingPagination.currentPage"
            :length="awaitingPagination.lastPage"
            :total-visible="5"
            density="comfortable"
            @update:model-value="store.fetchAwaiting($event, awaitingStatus).catch(() => {})"
          />
        </div>
      </template>
    </template>
  </div>
</template>
