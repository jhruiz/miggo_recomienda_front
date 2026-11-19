<script lang="ts" setup>
  import { computed, nextTick, ref, watch } from 'vue'
  import { altText, canStep, pickImageUrl, stepIndex } from '@/utils/portfolioGrid'

  export interface ViewerPhoto {
    id: number | string
    description?: string | null
    image_url?: string | null
    thumb_url?: string | null
    medium_url?: string | null
    /** Datos propios de la foto (Muro). Tienen prioridad sobre las props de respaldo. */
    portfolio_name?: string | null
    category_name?: string | null
    provider?: { id: number | string, name: string } | null
  }

  const props = withDefaults(defineProps<{
    photos: ViewerPhoto[]
    modelValue: boolean
    index: number
    /** Respaldo del nombre del Portafolio (texto alternativo y, desde el Muro, cabecera). */
    portfolioName?: string
    /** Respaldo de la Categoría_Portafolio. */
    categoryName?: string | null
    /** Muestra enlace al Perfil_Prestador, Portafolio y Categoría (apertura desde el Muro). */
    fromWall?: boolean
  }>(), {
    portfolioName: '',
    categoryName: null,
    fromWall: false,
  })

  const emit = defineEmits<{
    'update:modelValue': [value: boolean]
    'update:index': [value: number]
    /** Se emite al abrir el visor y al mostrar otra foto con el visor abierto. */
    'opened': [payload: { index: number, photo: ViewerPhoto }]
  }>()

  const count = computed(() => props.photos.length)
  const current = computed<ViewerPhoto | null>(() => props.photos[props.index] ?? null)

  const wallPortfolioName = computed(() => current.value?.portfolio_name || props.portfolioName)
  const wallCategoryName = computed(() => current.value?.category_name || props.categoryName)
  const provider = computed(() => current.value?.provider ?? null)

  const alt = computed(() => altText(current.value?.description, wallPortfolioName.value))
  const description = computed(() => {
    const text = current.value?.description
    return typeof text === 'string' && text.trim() !== '' ? text : ''
  })
  const src = computed(() => current.value
    ? pickImageUrl({
      thumb_url: current.value.thumb_url,
      medium_url: current.value.medium_url,
      image_url: current.value.image_url ?? '',
    }, 'medium')
    : '')

  const failed = ref(false)
  const canPrev = computed(() => canStep(props.index, count.value, -1))
  const canNext = computed(() => canStep(props.index, count.value, 1))

  let opener: HTMLElement | null = null

  function notifyOpened () {
    if (current.value) {
      emit('opened', { index: props.index, photo: current.value })
    }
  }

  watch(() => props.modelValue, open => {
    if (open) {
      const active = document.activeElement
      opener = active instanceof HTMLElement && active !== document.body ? active : null
      failed.value = false
      notifyOpened()
    } else {
      const target = opener
      opener = null
      if (target) {
        nextTick(() => target.focus())
      }
    }
  })

  watch(() => props.index, () => {
    failed.value = false
    if (props.modelValue) {
      notifyOpened()
    }
  })

  function close () {
    emit('update:modelValue', false)
  }

  function step (delta: number) {
    if (!canStep(props.index, count.value, delta)) {
      return
    }
    emit('update:index', stepIndex(props.index, count.value, delta))
  }

  function onKeydown (event: KeyboardEvent) {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      step(-1)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      step(1)
    }
  }
</script>

<template>
  <VDialog
    fullscreen
    :model-value="modelValue"
    scrim="black"
    transition="fade-transition"
    @update:model-value="(v: boolean) => !v && close()"
  >
    <VCard
      aria-label="Visor de fotos"
      class="photo-viewer d-flex flex-column"
      color="black"
      data-testid="photo-viewer"
      role="dialog"
      @keydown="onKeydown"
    >
      <div class="d-flex align-center pa-2">
        <span v-if="count > 0" aria-live="polite" class="text-body-2 text-medium-emphasis">
          {{ index + 1 }} / {{ count }}
        </span>
        <VSpacer />
        <slot :index="index" name="actions" :photo="current" />
        <VBtn
          aria-label="Cerrar visor"
          autofocus
          data-testid="viewer-close"
          icon="ri-close-line"
          variant="text"
          @click="close"
        />
      </div>

      <div class="photo-viewer__stage flex-grow-1 d-flex align-center justify-center">
        <VBtn
          aria-label="Foto anterior"
          class="mx-1"
          data-testid="viewer-prev"
          :disabled="!canPrev"
          icon="ri-arrow-left-s-line"
          variant="text"
          @click="step(-1)"
        />

        <div class="photo-viewer__media d-flex align-center justify-center">
          <div
            v-if="failed"
            class="d-flex flex-column align-center text-medium-emphasis"
            data-testid="viewer-error"
            role="img"
            :aria-label="`No se pudo cargar la imagen: ${alt}`"
          >
            <VIcon icon="ri-image-line" size="64" />
            <span class="text-body-2 mt-2">No se pudo cargar la imagen</span>
          </div>
          <img
            v-else-if="src"
            :key="src"
            :alt="alt"
            class="photo-viewer__img"
            data-testid="viewer-image"
            :src="src"
            @error="failed = true"
          >
        </div>

        <VBtn
          aria-label="Foto siguiente"
          class="mx-1"
          data-testid="viewer-next"
          :disabled="!canNext"
          icon="ri-arrow-right-s-line"
          variant="text"
          @click="step(1)"
        />
      </div>

      <div class="pa-3 text-center" data-testid="viewer-info">
        <div v-if="fromWall" class="d-flex flex-wrap justify-center align-center ga-2 mb-1">
          <RouterLink
            v-if="provider"
            class="text-primary font-weight-medium"
            data-testid="viewer-provider"
            :to="`/providers/${provider.id}`"
            @click="close"
          >
            {{ provider.name }}
          </RouterLink>
          <span v-if="wallPortfolioName" data-testid="viewer-portfolio">{{ wallPortfolioName }}</span>
          <VChip v-if="wallCategoryName" data-testid="viewer-category" size="small">
            {{ wallCategoryName }}
          </VChip>
        </div>
        <p v-if="description" class="text-body-2 mb-0" data-testid="viewer-description">
          {{ description }}
        </p>
      </div>
    </VCard>
  </VDialog>
</template>

<style scoped>
.photo-viewer {
  height: 100%;
}

.photo-viewer__stage {
  min-height: 0;
}

.photo-viewer__media {
  flex: 1 1 auto;
  min-width: 0;
  height: 100%;
}

.photo-viewer__img {
  max-width: 100%;
  max-height: 100%;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
</style>
