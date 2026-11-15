<script setup lang="ts">
/**
 * "Mis cotizaciones" (Prestador): listado paginado de las cotizaciones que el
 * usuario envió, con filtro por estado. Incluye las directas "solicitada" que
 * aún debe responder.
 */
import UserAvatar from '@/components/UserAvatar.vue'
import { useQuotesStore } from '@/stores/quotes'

const store = useQuotesStore()
const {
  sent,
  sentPagination,
  sentStatus,
  sentLoading,
  sentError,
  isEmptySent,
} = storeToRefs(store)

const statusOptions = [
  { title: 'Solicitada', value: 'solicitada' },
  { title: 'Pendiente', value: 'pendiente' },
  { title: 'Aceptada', value: 'aceptada' },
  { title: 'Rechazada', value: 'rechazada' },
  { title: 'No seleccionada', value: 'no_seleccionada' },
  { title: 'Expirada', value: 'expirada' },
  { title: 'Sin respuesta', value: 'sin_respuesta' },
]

const statusColor: Record<string, string> = {
  solicitada: 'info',
  pendiente: 'warning',
  aceptada: 'success',
  rechazada: 'error',
  no_seleccionada: 'secondary',
  expirada: 'secondary',
  sin_respuesta: 'secondary',
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

const pageInfo = computed(() => {
  const { currentPage, lastPage, total } = sentPagination.value

  return `Página ${currentPage} de ${lastPage} · ${total} cotización${total === 1 ? '' : 'es'}`
})

function onStatusChange(value: string | null) {
  store.fetchSent(1, value ?? null).catch(() => {})
}

onMounted(() => {
  store.fetchSent(1, sentStatus.value).catch(() => {})
})
</script>

<template>
  <div>
    <div class="mb-6">
      <h4 class="text-h4 mb-1">
        Mis cotizaciones
      </h4>
      <span class="text-body-1 text-medium-emphasis">
        Cotizaciones que enviaste y su estado actual.
      </span>
    </div>

    <VCard class="mb-6">
      <VCardText>
        <VRow>
          <VCol
            cols="12"
            sm="6"
            md="4"
          >
            <VSelect
              :model-value="sentStatus"
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
      v-if="sentError"
      type="error"
      variant="tonal"
      border="start"
      class="mb-6"
    >
      {{ sentError }}
    </VAlert>

    <VCard v-if="sentLoading">
      <VCardText class="d-flex justify-center py-12">
        <VProgressCircular
          indeterminate
          color="primary"
          size="48"
        />
      </VCardText>
    </VCard>

    <VCard v-else-if="isEmptySent && !sentError">
      <VCardText class="text-center py-12">
        <VIcon
          icon="ri-file-list-3-line"
          size="48"
          color="disabled"
          class="mb-3"
        />
        <p class="text-body-1 mb-0">
          {{ sentStatus ? 'No tienes cotizaciones con ese estado.' : 'Aún no has enviado cotizaciones.' }}
        </p>
      </VCardText>
    </VCard>

    <template v-else-if="!sentError">
      <VRow>
        <VCol
          v-for="quote in sent"
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
                <span
                  v-if="quote.client_name"
                  class="d-inline-flex align-center gap-1"
                >
                  <UserAvatar
                    :name="quote.client_name"
                    :user-id="quote.client_user_id"
                    :src="quote.client_avatar_thumb_url"
                    :size="24"
                  />
                  {{ quote.client_name }}
                </span>
              </div>

              <VBtn
                size="small"
                variant="tonal"
                color="primary"
                prepend-icon="ri-eye-line"
                :to="`/quotes/${quote.id}`"
              >
                Ver detalle
              </VBtn>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>

      <div class="d-flex align-center justify-space-between flex-wrap gap-3 mt-6">
        <span class="text-body-2 text-medium-emphasis">{{ pageInfo }}</span>
        <VPagination
          :model-value="sentPagination.currentPage"
          :length="sentPagination.lastPage"
          :total-visible="5"
          density="comfortable"
          @update:model-value="store.fetchSent($event, sentStatus).catch(() => {})"
        />
      </div>
    </template>
  </div>
</template>
