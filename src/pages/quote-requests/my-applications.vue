<script setup lang="ts">
/**
 * "Mis postulaciones" (Prestador): solicitudes a las que el usuario se postuló,
 * con estado, fecha, indicador de cotización enviada y enlaces a la solicitud
 * y al chat.
 */
import UserAvatar from '@/components/UserAvatar.vue'
import { useQuoteRequestsStore } from '@/stores/quoteRequests'

const store = useQuoteRequestsStore()
const {
  myApplications,
  myApplicationsPagination,
  myApplicationsLoading,
  myApplicationsError,
  isEmptyMyApplications,
} = storeToRefs(store)

const statusColor: Record<string, string> = {
  abierta: 'success',
  en_proceso: 'warning',
  cerrada: 'secondary',
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
  const { currentPage, lastPage, total } = myApplicationsPagination.value

  return `Página ${currentPage} de ${lastPage} · ${total} postulacion${total === 1 ? '' : 'es'}`
})

onMounted(() => {
  store.fetchMyApplications(1).catch(() => {})
})
</script>

<template>
  <div>
    <div class="mb-6">
      <h4 class="text-h4 mb-1">
        Mis postulaciones
      </h4>
      <span class="text-body-1 text-medium-emphasis">
        Solicitudes a las que te postulaste y el estado de tu cotización.
      </span>
    </div>

    <VAlert
      v-if="myApplicationsError"
      type="error"
      variant="tonal"
      border="start"
      class="mb-6"
    >
      {{ myApplicationsError }}
    </VAlert>

    <VCard v-if="myApplicationsLoading">
      <VCardText class="d-flex justify-center py-12">
        <VProgressCircular
          indeterminate
          color="primary"
          size="48"
        />
      </VCardText>
    </VCard>

    <VCard v-else-if="isEmptyMyApplications && !myApplicationsError">
      <VCardText class="text-center py-12">
        <VIcon
          icon="ri-send-plane-line"
          size="48"
          color="disabled"
          class="mb-3"
        />
        <p class="text-body-1 mb-0">
          Aún no te has postulado a ninguna solicitud.
        </p>
      </VCardText>
    </VCard>

    <template v-else-if="!myApplicationsError">
      <VRow>
        <VCol
          v-for="application in myApplications"
          :key="application.id"
          cols="12"
          md="6"
        >
          <VCard class="h-100">
            <VCardText>
              <div class="d-flex align-center justify-space-between gap-2 mb-2">
                <h6 class="text-h6 mb-0">
                  {{ application.quote_request.title }}
                </h6>
                <VChip
                  size="small"
                  :color="statusColor[application.quote_request.status] ?? 'secondary'"
                  variant="tonal"
                  class="text-capitalize"
                >
                  {{ statusLabel(application.quote_request.status) }}
                </VChip>
              </div>

              <div class="d-flex flex-wrap gap-3 text-caption text-medium-emphasis mb-3">
                <span v-if="application.quote_request.category_name">
                  <VIcon
                    icon="ri-price-tag-3-line"
                    size="14"
                  />
                  {{ application.quote_request.category_name }}
                </span>
                <span
                  v-if="application.quote_request.client_name"
                  class="d-inline-flex align-center gap-1"
                >
                  <UserAvatar
                    :name="application.quote_request.client_name"
                    :user-id="null"
                    :src="application.quote_request.client_avatar_thumb_url ?? null"
                    :size="20"
                  />
                  {{ application.quote_request.client_name }}
                </span>
                <span>
                  <VIcon
                    icon="ri-calendar-line"
                    size="14"
                  />
                  Postulado el {{ dateText(application.applied_at) }}
                </span>
              </div>

              <div class="mb-4">
                <VChip
                  v-if="application.my_quote"
                  size="small"
                  color="success"
                  variant="tonal"
                  prepend-icon="ri-file-list-3-line"
                >
                  Cotización enviada · {{ money(application.my_quote.total_price) }}
                  · <span class="text-capitalize">{{ statusLabel(application.my_quote.status) }}</span>
                </VChip>
                <VChip
                  v-else
                  size="small"
                  color="secondary"
                  variant="tonal"
                >
                  Sin cotización enviada
                </VChip>
              </div>

              <div class="d-flex flex-wrap gap-2">
                <VBtn
                  size="small"
                  variant="tonal"
                  color="primary"
                  prepend-icon="ri-eye-line"
                  :to="`/quote-requests/${application.quote_request.id}`"
                >
                  Ver solicitud
                </VBtn>
                <VBtn
                  v-if="application.my_quote"
                  size="small"
                  variant="text"
                  :to="`/quotes/${application.my_quote.id}`"
                >
                  Ver cotización
                </VBtn>
                <VBtn
                  v-if="application.chat_channel_id"
                  size="small"
                  variant="text"
                  prepend-icon="ri-chat-3-line"
                  :to="`/chat/${application.chat_channel_id}`"
                >
                  Chat
                </VBtn>
              </div>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>

      <div class="d-flex align-center justify-space-between flex-wrap gap-3 mt-6">
        <span class="text-body-2 text-medium-emphasis">{{ pageInfo }}</span>
        <VPagination
          :model-value="myApplicationsPagination.currentPage"
          :length="myApplicationsPagination.lastPage"
          :total-visible="5"
          density="comfortable"
          @update:model-value="store.fetchMyApplications($event).catch(() => {})"
        />
      </div>
    </template>
  </div>
</template>
