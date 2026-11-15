<script setup lang="ts">
import { computed, ref } from 'vue'
import type { OwnerPortfolio } from '@/services/portfolios'
import { usePortfoliosStore } from '@/stores/portfolios'
import { getUploadState, validateImageFile } from '@/utils/portfolio'
import type { ApiError } from '@/utils/portfolio'

const DESCRIPTION_MAX = 500

const props = withDefaults(defineProps<{
  /** Portafolio destino de la foto. */
  portfolio: Pick<OwnerPortfolio, 'id' | 'photos_count'> | null
  /** Si el Prestador tiene al menos un portafolio. */
  hasPortfolios?: boolean
}>(), {
  hasPortfolios: true,
})

/**
 * El componente no monta el VSnackbar: la página lo hace con `useNotifier`.
 * Por eso emite los mensajes para que quien lo use notifique (Req. 5.4, 5.5, 5.6).
 */
const emit = defineEmits<{
  (e: 'success', message: string): void
  (e: 'error', message: string): void
}>()

const store = usePortfoliosStore()

// VFileInput sin `multiple` entrega un único File (no File[]); ver design.md.
const file = ref<File | null>(null)
const description = ref('')
const serverErrors = ref<Record<string, string>>({})

const inputId = computed(() => `portfolio-upload-${props.portfolio?.id ?? 'none'}`)
const uploading = computed(
  () => props.portfolio !== null && store.uploadingPortfolioId === props.portfolio.id,
)

const uploadState = computed(() => getUploadState({
  hasPortfolios: props.hasPortfolios,
  portfolio: props.portfolio,
  file: file.value,
  uploading: uploading.value,
}))

const fileModel = computed<File | null>({
  get: () => file.value,
  set: value => {
    // Se normaliza por si el selector emite un arreglo o undefined al limpiar.
    const next = Array.isArray(value) ? (value[0] ?? null) : (value ?? null)

    file.value = next
    serverErrors.value = {}
  },
})

const fileErrors = computed(() => {
  const errors: string[] = []
  const invalid = validateImageFile(file.value)

  if (invalid)
    errors.push(invalid)
  else if (serverErrors.value.image)
    errors.push(serverErrors.value.image)

  return errors
})

const descriptionErrors = computed(() => (serverErrors.value.description ? [serverErrors.value.description] : []))

// Motivo visible bajo el botón cuando está deshabilitado, salvo los casos ya mostrados junto al selector.
const hint = computed(() => {
  if (uploadState.value.canUpload || uploading.value)
    return null
  if (file.value && validateImageFile(file.value))
    return null

  return uploadState.value.reason
})

async function onUpload () {
  if (!uploadState.value.canUpload || !file.value || !props.portfolio)
    return

  serverErrors.value = {}
  const trimmed = description.value.trim()

  try {
    await store.uploadItem(props.portfolio.id, file.value, trimmed === '' ? null : trimmed)

    // Solo se limpia tras un 2xx.
    file.value = null
    description.value = ''
    emit('success', 'Foto subida correctamente.')
  }
  catch (err) {
    const apiError = err as ApiError

    // Se conservan el archivo y la descripción.
    serverErrors.value = apiError.fieldErrors ?? {}
    emit('error', apiError.message)
  }
}
</script>

<template>
  <VForm
    class="portfolio-upload-form"
    :aria-busy="uploading"
    @submit.prevent="onUpload"
  >
    <VRow dense>
      <VCol
        cols="12"
        md="5"
      >
        <VFileInput
          :id="inputId"
          v-model="fileModel"
          label="Imagen"
          accept="image/jpeg,image/png,image/webp"
          prepend-icon=""
          prepend-inner-icon="ri-image-add-line"
          show-size
          clearable
          :disabled="uploading || !hasPortfolios"
          :error-messages="fileErrors"
          hint="JPG, PNG o WebP, máximo 10 MB"
          persistent-hint
        />
      </VCol>

      <VCol
        cols="12"
        md="5"
      >
        <VTextField
          v-model="description"
          label="Descripción (opcional)"
          :maxlength="DESCRIPTION_MAX"
          counter
          :disabled="uploading || !hasPortfolios"
          :error-messages="descriptionErrors"
        />
      </VCol>

      <VCol
        cols="12"
        md="2"
        class="d-flex align-start"
      >
        <VBtn
          type="submit"
          color="primary"
          block
          :loading="uploading"
          :disabled="!uploadState.canUpload"
          :aria-describedby="hint ? `${inputId}-hint` : undefined"
        >
          Subir
        </VBtn>
      </VCol>
    </VRow>

    <p
      v-if="hint"
      :id="`${inputId}-hint`"
      class="text-caption text-medium-emphasis mb-0"
    >
      {{ hint }}
    </p>
  </VForm>
</template>
