<script setup lang="ts">
/**
 * Tarjeta de una Cotización directa sin responder (solicitada / sin_respuesta).
 * No muestra precio: la solicitud aún no tiene monto.
 */
import UserAvatar from '@/components/UserAvatar.vue'
import type { QuoteSummary } from '@/services/quotes'

const props = defineProps<{
  quote: QuoteSummary
}>()

const isRequested = computed(() => props.quote.status === 'solicitada')

const statusLabel = computed(() => isRequested.value ? 'Esperando respuesta' : 'Sin respuesta')
const statusColor = computed(() => isRequested.value ? 'info' : 'secondary')

function dateText(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleDateString('es-CO') : '—'
}
</script>

<template>
  <VCard class="h-100">
    <VCardText>
      <div class="d-flex align-center justify-space-between gap-2 mb-2">
        <h6 class="text-h6 mb-0">
          Cotización directa
        </h6>
        <VChip
          size="small"
          :color="statusColor"
          variant="tonal"
        >
          {{ statusLabel }}
        </VChip>
      </div>

      <div class="d-flex flex-wrap gap-3 text-caption text-medium-emphasis mb-2">
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
            icon="ri-calendar-line"
            size="14"
          />
          {{ dateText(quote.created_at) }}
        </span>
        <span v-if="isRequested">
          <VIcon
            icon="ri-time-line"
            size="14"
          />
          Responde hasta {{ dateText(quote.expires_at) }}
        </span>
      </div>

      <p
        v-if="quote.message_excerpt"
        class="text-body-2 mb-4"
      >
        {{ quote.message_excerpt }}
      </p>

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
</template>
