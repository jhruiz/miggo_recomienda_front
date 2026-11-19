<script setup lang="ts">
/**
 * Paginación por cursor: "Ver más" solo con cursor siguiente, deshabilitado mientras carga,
 * y error con "Reintentar" que conserva lo ya cargado. Requisitos 8 y 13.
 */
withDefaults(defineProps<{
  loading?: boolean
  hasMore?: boolean
  error?: boolean | string | null
}>(), { loading: false, hasMore: false, error: false })

const emit = defineEmits<{
  (e: 'load'): void
  (e: 'retry'): void
}>()
</script>

<template>
  <div
    class="wall-load-more d-flex flex-column align-center ga-2 py-4"
    data-testid="wall-load-more"
  >
    <div
      aria-live="polite"
      class="text-body-2 text-medium-emphasis"
      role="status"
    >
      <span
        v-if="loading"
        data-testid="wall-load-more-status"
      >Cargando más elementos…</span>
    </div>

    <template v-if="error && !loading">
      <p
        class="text-body-2 text-error mb-0"
        data-testid="wall-load-more-error"
        role="alert"
      >
        {{ typeof error === 'string' && error ? error : 'No se pudieron cargar más elementos.' }}
      </p>
      <VBtn
        color="primary"
        data-testid="wall-retry"
        prepend-icon="ri-refresh-line"
        variant="outlined"
        @click="emit('retry')"
      >
        Reintentar
      </VBtn>
    </template>

    <VBtn
      v-else-if="hasMore"
      color="primary"
      data-testid="wall-load-more-btn"
      :disabled="loading"
      :loading="loading"
      variant="tonal"
      @click="emit('load')"
    >
      Ver más
    </VBtn>
  </div>
</template>
