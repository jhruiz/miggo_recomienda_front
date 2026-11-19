<script setup lang="ts">
import { computed, ref } from 'vue'
import PendingPhotoGrid from './PendingPhotoGrid.vue'
import type { OwnerPortfolio } from '@/services/portfolios'
import { usePortfoliosStore } from '@/stores/portfolios'
import { MAX_PHOTOS_PER_PORTFOLIO, getUploadState } from '@/utils/portfolio'
import type { ApiError } from '@/utils/portfolio'
import { addPendingFiles, removePending } from '@/utils/portfolioGrid'
import type { PendingFile } from '@/utils/portfolioGrid'

const DESCRIPTION_MAX = 500

const props = withDefaults(defineProps<{
  /** Portafolio destino de las fotos. */
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

// Selector múltiple: solo dispara la lectura; la lista real vive en `pending` (DD14).
const picker = ref<File[]>([])
const pending = ref<PendingFile[]>([])
const itemErrors = ref<Record<string, string>>({})
const pickerErrors = ref<string[]>([])
const description = ref('')
const descriptionError = ref<string | null>(null)
const submitting = ref(false)

const inputId = computed(() => `portfolio-upload-${props.portfolio?.id ?? 'none'}`)
const uploading = computed(
  () => submitting.value
    || (props.portfolio !== null && store.uploadingPortfolioId === props.portfolio.id),
)

const uploadState = computed(() => getUploadState({
  hasPortfolios: props.hasPortfolios,
  portfolio: props.portfolio,
  files: pending.value.map(item => item.file),
  uploading: uploading.value,
}))

const descriptionErrors = computed(() => (descriptionError.value ? [descriptionError.value] : []))

// Motivo visible bajo el botón cuando está deshabilitado.
const hint = computed(() => {
  if (uploadState.value.canUpload || uploading.value)
    return null

  return uploadState.value.reason
})

const pickerModel = computed<File[]>({
  get: () => picker.value,
  set: value => {
    const incoming = Array.isArray(value) ? value : (value ? [value as File] : [])

    picker.value = []
    if (!incoming.length)
      return

    const used = (props.portfolio?.photos_count ?? 0) + pending.value.length
    const capacity = Math.max(0, MAX_PHOTOS_PER_PORTFOLIO - used)
    const result = addPendingFiles(pending.value, incoming, capacity)
    const messages = result.rejected.map(r => `${r.file.name}: ${r.reason}`)

    if (result.overflow > 0)
      messages.push(`Solo caben ${MAX_PHOTOS_PER_PORTFOLIO} fotos por portafolio; se omitieron ${result.overflow}.`)

    pending.value = result.pending
    pickerErrors.value = messages
  },
})

function onRemove (id: string) {
  pending.value = removePending(pending.value, id)
  const { [id]: _removed, ...rest } = itemErrors.value

  itemErrors.value = rest
}

async function onUpload () {
  if (!uploadState.value.canUpload || !props.portfolio)
    return

  submitting.value = true
  itemErrors.value = {}
  descriptionError.value = null
  const trimmed = description.value.trim()
  const portfolioId = props.portfolio.id
  let okCount = 0
  let lastError: string | null = null

  try {
    // Una por una: cada foto triunfa o falla por separado (DD14).
    for (const item of [...pending.value]) {
      try {
        await store.uploadItem(portfolioId, item.file, trimmed === '' ? null : trimmed)
        pending.value = removePending(pending.value, item.id)
        okCount += 1
      }
      catch (err) {
        const apiError = err as ApiError

        itemErrors.value = { ...itemErrors.value, [item.id]: apiError.message }
        descriptionError.value ??= apiError.fieldErrors?.description ?? null
        lastError = apiError.message
      }
    }
  }
  finally {
    submitting.value = false
  }

  if (pending.value.length === 0)
    description.value = ''
  if (okCount > 0)
    emit('success', okCount === 1 ? 'Foto subida correctamente.' : `${okCount} fotos subidas correctamente.`)
  if (lastError)
    emit('error', lastError)
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
          v-model="pickerModel"
          label="Imágenes"
          accept="image/jpeg,image/png,image/webp"
          prepend-icon=""
          prepend-inner-icon="ri-image-add-line"
          multiple
          show-size
          clearable
          :disabled="uploading || !hasPortfolios"
          :error-messages="pickerErrors"
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

    <PendingPhotoGrid
      class="mt-3"
      :items="pending"
      :errors="itemErrors"
      :disabled="uploading"
      @remove="onRemove"
    />

    <p
      v-if="hint"
      :id="`${inputId}-hint`"
      class="text-caption text-medium-emphasis mb-0"
    >
      {{ hint }}
    </p>
  </VForm>
</template>


