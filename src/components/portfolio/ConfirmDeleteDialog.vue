<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: boolean
  portfolioName?: string
  photosCount: number
  loading?: boolean
}>(), {
  portfolioName: '',
  loading: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'confirm'): void
}>()

/** "Se eliminarán n fotos" con concordancia de número (Req. 1.8, 6.3). */
const photosText = computed(() =>
  props.photosCount === 1
    ? 'Se eliminará 1 foto'
    : `Se eliminarán ${props.photosCount} fotos`,
)

function cancel () {
  if (!props.loading)
    emit('update:modelValue', false)
}
</script>

<template>
  <VDialog
    :model-value="modelValue"
    max-width="460"
    persistent
    @update:model-value="emit('update:modelValue', $event)"
    @keydown.esc="cancel"
  >
    <VCard
      role="alertdialog"
      aria-labelledby="confirm-delete-title"
      aria-describedby="confirm-delete-text"
    >
      <VCardTitle id="confirm-delete-title">
        Eliminar portafolio
      </VCardTitle>

      <VCardText id="confirm-delete-text">
        <p
          v-if="portfolioName"
          class="mb-2"
        >
          ¿Eliminar el portafolio «{{ portfolioName }}»?
        </p>
        <p
          class="mb-0 font-weight-medium"
          data-testid="photos-text"
        >
          {{ photosText }}. Esta acción no se puede deshacer.
        </p>
      </VCardText>

      <VCardActions class="justify-end px-6 pb-4">
        <VBtn
          variant="text"
          :disabled="loading"
          @click="cancel"
        >
          Cancelar
        </VBtn>
        <VBtn
          color="error"
          variant="elevated"
          :loading="loading"
          @click="emit('confirm')"
        >
          Eliminar
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
