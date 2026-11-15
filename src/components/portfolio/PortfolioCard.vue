<script setup lang="ts">
import { computed, ref } from 'vue'
import ConfirmDeleteDialog from './ConfirmDeleteDialog.vue'
import PortfolioFormDialog from './PortfolioFormDialog.vue'
import PortfolioUploadForm from './PortfolioUploadForm.vue'
import type { OwnerPortfolio, OwnerPortfolioItem } from '@/services/portfolios'
import { usePortfoliosStore } from '@/stores/portfolios'
import { MAX_PHOTOS_PER_PORTFOLIO, formatCounter } from '@/utils/portfolio'
import type { ApiError } from '@/utils/portfolio'

const ITEM_DESCRIPTION_MAX = 500

const props = defineProps<{
  portfolio: OwnerPortfolio
}>()

/**
 * `useNotifier` crea estado por llamada, así que la tarjeta no notifica sola:
 * reenvía hacia arriba los mensajes de éxito y error (Req. 5.10).
 */
const emit = defineEmits<{
  (e: 'success', message: string): void
  (e: 'error', message: string): void
}>()

const store = usePortfoliosStore()

const editOpen = ref(false)
const editFieldErrors = ref<Record<string, string>>({})
const deleteOpen = ref(false)

const itemEditOpen = ref(false)
const itemEditing = ref<OwnerPortfolioItem | null>(null)
const itemDescription = ref('')
const itemFieldErrors = ref<Record<string, string>>({})

const counter = computed(() => formatCounter(props.portfolio.photos_count, MAX_PHOTOS_PER_PORTFOLIO))
const saving = computed(() => store.savingPortfolioId === props.portfolio.id)
const deleting = computed(() => store.deletingPortfolioId === props.portfolio.id)

function openEdit () {
  editFieldErrors.value = {}
  editOpen.value = true
}

async function onEditSubmit (payload: { name: string, description: string | null }) {
  editFieldErrors.value = {}
  try {
    await store.update(props.portfolio.id, payload)
    editOpen.value = false
    emit('success', 'Portafolio actualizado.')
  }
  catch (err) {
    const apiError = err as ApiError

    editFieldErrors.value = apiError.fieldErrors ?? {}
    emit('error', apiError.message)
  }
}

async function onDeleteConfirm () {
  try {
    await store.remove(props.portfolio.id)
    deleteOpen.value = false
    emit('success', 'Portafolio eliminado.')
  }
  catch (err) {
    emit('error', (err as ApiError).message)
  }
}

function openItemEdit (item: OwnerPortfolioItem) {
  itemEditing.value = item
  itemDescription.value = item.description ?? ''
  itemFieldErrors.value = {}
  itemEditOpen.value = true
}

async function onItemSave () {
  if (!itemEditing.value)
    return

  const trimmed = itemDescription.value.trim()

  itemFieldErrors.value = {}
  try {
    await store.updateItem(props.portfolio.id, itemEditing.value.id, trimmed === '' ? null : trimmed)
    itemEditOpen.value = false
    emit('success', 'Descripción actualizada.')
  }
  catch (err) {
    const apiError = err as ApiError

    itemFieldErrors.value = apiError.fieldErrors ?? {}
    emit('error', apiError.message)
  }
}

async function onItemDelete (item: OwnerPortfolioItem) {
  try {
    await store.removeItem(props.portfolio.id, item.id)
    emit('success', 'Foto eliminada.')
  }
  catch (err) {
    emit('error', (err as ApiError).message)
  }
}
</script>

<template>
  <VCard
    variant="outlined"
    class="portfolio-card"
    :aria-label="`Portafolio ${portfolio.name}`"
  >
    <VCardItem>
      <VCardTitle class="text-wrap">
        {{ portfolio.name }}
      </VCardTitle>
      <VCardSubtitle
        v-if="portfolio.description"
        class="text-wrap"
      >
        {{ portfolio.description }}
      </VCardSubtitle>

      <template #append>
        <VChip
          size="small"
          class="me-2"
          data-testid="photos-counter"
        >
          {{ counter }}
        </VChip>
        <VBtn
          icon="ri-edit-line"
          variant="text"
          size="small"
          aria-label="Editar portafolio"
          :disabled="saving || deleting"
          @click="openEdit"
        />
        <VBtn
          icon="ri-delete-bin-line"
          variant="text"
          size="small"
          color="error"
          aria-label="Eliminar portafolio"
          :loading="deleting"
          :disabled="saving || deleting"
          @click="deleteOpen = true"
        />
      </template>
    </VCardItem>

    <VCardText>
      <PortfolioUploadForm
        :portfolio="portfolio"
        @success="emit('success', $event)"
        @error="emit('error', $event)"
      />

      <p
        v-if="portfolio.items.length === 0"
        class="text-body-2 text-medium-emphasis mt-4 mb-0"
      >
        Aún no hay fotos en este portafolio.
      </p>

      <VRow
        v-else
        class="mt-2"
      >
        <VCol
          v-for="item in portfolio.items"
          :key="item.id"
          cols="6"
          sm="4"
          md="3"
        >
          <VCard variant="tonal">
            <VImg
              :src="item.thumb_url ?? item.image_url ?? undefined"
              :alt="item.description || `Foto de ${portfolio.name}`"
              aspect-ratio="1"
              cover
            />
            <VCardText
              v-if="item.description"
              class="text-caption py-2"
            >
              {{ item.description }}
            </VCardText>
            <VCardActions class="justify-end">
              <VBtn
                icon="ri-edit-line"
                variant="text"
                size="small"
                aria-label="Editar descripción de la foto"
                :disabled="store.deletingItemId === item.id"
                @click="openItemEdit(item)"
              />
              <VBtn
                icon="ri-delete-bin-line"
                variant="text"
                size="small"
                color="error"
                aria-label="Eliminar foto"
                :loading="store.deletingItemId === item.id"
                :disabled="store.deletingItemId === item.id"
                @click="onItemDelete(item)"
              />
            </VCardActions>
          </VCard>
        </VCol>
      </VRow>
    </VCardText>

    <PortfolioFormDialog
      v-model="editOpen"
      :portfolio="portfolio"
      :loading="saving"
      :field-errors="editFieldErrors"
      @submit="onEditSubmit"
    />

    <ConfirmDeleteDialog
      v-model="deleteOpen"
      :portfolio-name="portfolio.name"
      :photos-count="portfolio.photos_count"
      :loading="deleting"
      @confirm="onDeleteConfirm"
    />

    <VDialog
      v-model="itemEditOpen"
      max-width="480"
    >
      <VCard>
        <VForm @submit.prevent="onItemSave">
          <VCardTitle>Editar descripción</VCardTitle>
          <VCardText>
            <VTextarea
              v-model="itemDescription"
              label="Descripción (opcional)"
              :maxlength="ITEM_DESCRIPTION_MAX"
              counter
              rows="3"
              auto-grow
              :error-messages="itemFieldErrors.description ? [itemFieldErrors.description] : []"
              :disabled="saving"
            />
          </VCardText>
          <VCardActions class="justify-end px-6 pb-4">
            <VBtn
              variant="text"
              :disabled="saving"
              @click="itemEditOpen = false"
            >
              Cancelar
            </VBtn>
            <VBtn
              type="submit"
              color="primary"
              variant="elevated"
              :loading="saving"
            >
              Guardar
            </VBtn>
          </VCardActions>
        </VForm>
      </VCard>
    </VDialog>
  </VCard>
</template>
