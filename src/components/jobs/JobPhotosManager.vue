<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import PendingPhotoGrid from '@/components/portfolio/PendingPhotoGrid.vue'
import type { JobPhoto } from '@/services'
import { useJobsStore } from '@/stores/jobs'
import { extractApiError } from '@/utils/portfolio'
import { addPendingFiles, removePending } from '@/utils/portfolioGrid'
import type { PendingFile } from '@/utils/portfolioGrid'

/** Máximo de fotos por Trabajo (Requisito 5). */
const MAX_JOB_PHOTOS = 5

const props = withDefaults(defineProps<{
  jobId: number
  /** Fotos ya subidas (solo las ve el Prestador). */
  photos?: JobPhoto[]
  /**
   * Modo selección: no sube por su cuenta; solo reúne archivos y los emite con
   * `update:files` (se usa en el diálogo de cierre).
   */
  selectOnly?: boolean
  disabled?: boolean
}>(), {
  photos: () => [],
  selectOnly: false,
  disabled: false,
})

const emit = defineEmits<{
  (e: 'update:files', files: File[]): void
  (e: 'success', message: string): void
  (e: 'error', message: string): void
}>()

const store = useJobsStore()

const picker = ref<File[]>([])
const pending = ref<PendingFile[]>([])
const itemErrors = ref<Record<string, string>>({})
const pickerErrors = ref<string[]>([])
const uploadError = ref<string | null>(null)
const uploading = ref(false)

const removeTarget = ref<JobPhoto | null>(null)
const removeOpen = ref(false)
const removing = ref(false)

const uploadedCount = computed(() => (props.selectOnly ? 0 : props.photos.length))
const totalCount = computed(() => uploadedCount.value + pending.value.length)
const counterText = computed(() => `${totalCount.value} de ${MAX_JOB_PHOTOS} fotos`)
const busy = computed(() => uploading.value || removing.value || props.disabled)
const inputId = computed(() => `job-photos-${props.jobId}`)

const canUpload = computed(
  () => !props.selectOnly && pending.value.length > 0 && !busy.value,
)

watch(pending, value => emit('update:files', value.map(item => item.file)), { deep: true })

const pickerModel = computed<File[]>({
  get: () => picker.value,
  set: value => {
    const incoming = Array.isArray(value) ? value : (value ? [value as File] : [])

    picker.value = []
    if (!incoming.length)
      return

    const capacity = Math.max(0, MAX_JOB_PHOTOS - totalCount.value)
    const result = addPendingFiles(pending.value, incoming, capacity)
    const messages = result.rejected.map(r => `${r.file.name}: ${r.reason}`)

    if (result.overflow > 0)
      messages.push(`Solo caben ${MAX_JOB_PHOTOS} fotos por trabajo; se omitieron ${result.overflow}.`)

    pending.value = result.pending
    pickerErrors.value = messages
  },
})

function onRemovePending (id: string) {
  pending.value = removePending(pending.value, id)
  const { [id]: _removed, ...rest } = itemErrors.value

  itemErrors.value = rest
  pickerErrors.value = []
}

/** Vacía la lista de pendientes (p. ej. tras un cierre exitoso). */
function clear () {
  pending.value = []
  itemErrors.value = {}
  pickerErrors.value = []
  uploadError.value = null
}

async function onUpload () {
  if (!canUpload.value)
    return

  uploading.value = true
  uploadError.value = null

  const count = pending.value.length

  try {
    // Una sola petición con todas las fotos; ante un rechazo se conserva la lista.
    await store.addPhotos(props.jobId, pending.value.map(item => item.file))
    pending.value = []
    itemErrors.value = {}
    pickerErrors.value = []
    emit('success', count === 1 ? 'Foto subida correctamente.' : `${count} fotos subidas correctamente.`)
  }
  catch (err) {
    const { message } = extractApiError(err)

    uploadError.value = message
    emit('error', message)
  }
  finally {
    uploading.value = false
  }
}

function askRemove (photo: JobPhoto) {
  removeTarget.value = photo
  removeOpen.value = true
}

async function confirmRemove () {
  if (!removeTarget.value)
    return

  removing.value = true
  try {
    await store.removePhoto(props.jobId, removeTarget.value.id)
    removeOpen.value = false
    removeTarget.value = null
    emit('success', 'Foto quitada correctamente.')
  }
  catch (err) {
    const { message } = extractApiError(err)

    removeOpen.value = false
    emit('error', message)
  }
  finally {
    removing.value = false
  }
}

function photoSrc (photo: JobPhoto): string {
  return photo.thumb_url || photo.medium_url || photo.original_url
}

defineExpose({ clear, pending })
</script>

<template>
  <div
    class="job-photos-manager"
    :aria-busy="busy"
  >
    <div class="d-flex align-center justify-space-between mb-1">
      <div class="text-body-1 font-weight-medium">
        Fotos del trabajo (opcional)
      </div>
      <VChip
        size="small"
        variant="tonal"
        data-testid="photos-counter"
      >
        {{ counterText }}
      </VChip>
    </div>

    <p class="text-body-2 text-medium-emphasis mb-3">
      Las fotos son opcionales. El trabajo aparece en el Muro con o sin fotos.
    </p>

    <!-- Fotos ya subidas -->
    <ul
      v-if="!selectOnly && photos.length"
      class="job-photos-manager__uploaded mb-3"
      aria-label="Fotos subidas"
      data-testid="uploaded-photos"
    >
      <li
        v-for="photo in photos"
        :key="photo.id"
        class="job-photos-manager__tile"
      >
        <img
          :src="photoSrc(photo)"
          alt="Foto del trabajo"
          class="job-photos-manager__img"
        >
        <VBtn
          class="job-photos-manager__remove"
          icon="ri-delete-bin-line"
          size="x-small"
          color="error"
          variant="flat"
          :disabled="busy"
          aria-label="Quitar foto"
          data-testid="remove-uploaded"
          @click="askRemove(photo)"
        />
      </li>
    </ul>

    <VFileInput
      :id="inputId"
      v-model="pickerModel"
      label="Agregar fotos"
      accept="image/jpeg,image/png,image/webp"
      prepend-icon=""
      prepend-inner-icon="ri-image-add-line"
      multiple
      show-size
      :disabled="busy || totalCount >= MAX_JOB_PHOTOS"
      :error-messages="pickerErrors"
      hint="JPG, PNG o WebP, máximo 10 MB cada una"
      persistent-hint
    />

    <PendingPhotoGrid
      class="mt-3"
      :items="pending"
      :errors="itemErrors"
      :disabled="busy"
      @remove="onRemovePending"
    />

    <VAlert
      v-if="uploadError"
      type="error"
      variant="tonal"
      density="compact"
      class="mt-3"
      data-testid="upload-error"
    >
      {{ uploadError }}
    </VAlert>

    <div
      v-if="!selectOnly"
      class="d-flex justify-end mt-3"
    >
      <VBtn
        color="primary"
        prepend-icon="ri-upload-2-line"
        :loading="uploading"
        :disabled="!canUpload"
        data-testid="upload-photos"
        @click="onUpload"
      >
        Subir fotos
      </VBtn>
    </div>

    <!-- Confirmación al quitar una foto subida -->
    <VDialog
      v-model="removeOpen"
      max-width="420"
      persistent
    >
      <VCard>
        <VCardTitle>Quitar foto</VCardTitle>
        <VCardText>
          ¿Quitar esta foto del trabajo? Esta acción no se puede deshacer.
        </VCardText>
        <VCardActions class="justify-end px-6 pb-4">
          <VBtn
            variant="text"
            :disabled="removing"
            @click="removeOpen = false"
          >
            Cancelar
          </VBtn>
          <VBtn
            color="error"
            variant="elevated"
            :loading="removing"
            data-testid="confirm-remove"
            @click="confirmRemove"
          >
            Quitar
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </div>
</template>

<style scoped>
.job-photos-manager__uploaded {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  list-style: none;
  margin: 0;
  padding: 0;
}

.job-photos-manager__tile {
  aspect-ratio: 1 / 1;
  background: rgba(var(--v-theme-on-surface), 0.06);
  border-radius: 8px;
  overflow: hidden;
  position: relative;
}

.job-photos-manager__img {
  block-size: 100%;
  inline-size: 100%;
  object-fit: cover;
}

.job-photos-manager__remove {
  inset-block-start: 4px;
  inset-inline-end: 4px;
  position: absolute;
}
</style>
