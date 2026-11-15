<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import UserAvatar from '@/components/UserAvatar.vue'
import { useAuthStore } from '@/stores/auth'
import profileService from '@/services/profile'
import { validateAvatarFile } from '@/utils/avatar'
import { extractApiError } from '@/utils/portfolio'

/**
 * Notificaciones: igual que los componentes de portafolio, el diálogo no monta
 * el VSnackbar (`useNotifier` crea estado por llamada). Emite `success` y
 * `error` con el mensaje y `UserProfile.vue` los muestra con su único snackbar.
 */
interface Props {
  modelValue: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'success', message: string): void
  (e: 'error', message: string): void
}>()

const authStore = useAuthStore()

const file = ref<File | null>(null)
const previewUrl = ref<string | null>(null)
const fileError = ref<string | null>(null)
const uploading = ref(false)
const deleting = ref(false)
const confirmDelete = ref(false)

const hasPhoto = computed(() => !!authStore.user?.avatar_thumb_url || !!authStore.user?.avatar_url)
const busy = computed(() => uploading.value || deleting.value)
const canSave = computed(() => !!file.value && !fileError.value && !busy.value)
const canDelete = computed(() => hasPhoto.value && !uploading.value)

// VFileInput (Vuetify 3.7) entrega File[]; se tolera File | null por compatibilidad.
const selected = computed<File[]>({
  get: () => (file.value ? [file.value] : []),
  set: value => onFileChange(value),
})

function revokePreview() {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = null
  }
}

function resetState() {
  revokePreview()
  file.value = null
  fileError.value = null
  confirmDelete.value = false
}

function onFileChange(value: File[] | File | null | undefined) {
  const picked = Array.isArray(value) ? (value[0] ?? null) : (value ?? null)

  revokePreview()
  file.value = null
  fileError.value = null

  if (!picked)
    return

  const { error, message } = validateAvatarFile(picked)
  if (error) {
    fileError.value = message

    return
  }

  file.value = picked
  previewUrl.value = URL.createObjectURL(picked)
}

function close() {
  if (busy.value)
    return
  resetState()
  emit('update:modelValue', false)
}

async function save() {
  if (!file.value || uploading.value)
    return

  uploading.value = true
  try {
    const result = await profileService.uploadAvatar(file.value)

    authStore.patchUser({
      avatar_url: result.avatar_url,
      avatar_thumb_url: result.avatar_thumb_url,
    })
    emit('success', 'Foto de perfil actualizada correctamente.')
    resetState()
    emit('update:modelValue', false)
  }
  catch (err) {
    // Diálogo abierto y archivo conservado para reintentar.
    emit('error', extractApiError(err).message)
  }
  finally {
    uploading.value = false
  }
}

async function removePhoto() {
  if (!canDelete.value || deleting.value)
    return

  deleting.value = true
  try {
    await profileService.deleteAvatar()
    authStore.patchUser({ avatar_url: null, avatar_thumb_url: null })
    emit('success', 'Foto de perfil eliminada correctamente.')
    resetState()
    emit('update:modelValue', false)
  }
  catch (err) {
    confirmDelete.value = false
    emit('error', extractApiError(err).message)
  }
  finally {
    deleting.value = false
  }
}

// Cerrar desde fuera (v-model) también descarta archivo y vista previa.
watch(() => props.modelValue, open => {
  if (!open)
    resetState()
})

onBeforeUnmount(revokePreview)
</script>

<template>
  <VDialog
    :model-value="modelValue"
    persistent
    max-width="440"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <VCard title="Foto de perfil">
      <VCardText>
        <div class="d-flex justify-center mb-4">
          <UserAvatar
            :name="authStore.user?.name"
            :user-id="authStore.user?.id"
            :src="previewUrl ?? authStore.user?.avatar_thumb_url"
            :size="120"
          />
        </div>

        <VFileInput
          v-model="selected"
          label="Selecciona una imagen"
          accept="image/jpeg,image/png,image/webp"
          prepend-icon=""
          prepend-inner-icon="ri-camera-line"
          show-size
          :disabled="busy"
          :error-messages="fileError ? [fileError] : []"
          hint="JPG, PNG o WebP. Máximo 5 MB."
          persistent-hint
        />
      </VCardText>

      <VCardActions class="px-6 pb-4">
        <VBtn
          v-if="canDelete"
          color="error"
          variant="text"
          :disabled="busy"
          @click="confirmDelete = true"
        >
          Eliminar foto
        </VBtn>
        <VSpacer />
        <VBtn
          variant="text"
          :disabled="busy"
          @click="close"
        >
          Cancelar
        </VBtn>
        <VBtn
          color="primary"
          :disabled="!canSave"
          :loading="uploading"
          @click="save"
        >
          Guardar
        </VBtn>
      </VCardActions>
    </VCard>

    <VDialog
      v-model="confirmDelete"
      persistent
      max-width="360"
    >
      <VCard title="Eliminar foto">
        <VCardText>¿Seguro que quieres eliminar tu foto de perfil?</VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn
            variant="text"
            :disabled="deleting"
            @click="confirmDelete = false"
          >
            Cancelar
          </VBtn>
          <VBtn
            color="error"
            :loading="deleting"
            @click="removePhoto"
          >
            Confirmar
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </VDialog>
</template>
