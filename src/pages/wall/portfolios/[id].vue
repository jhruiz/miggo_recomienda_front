<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PhotoViewer from '@/components/portfolio/PhotoViewer.vue'
import type { ViewerPhoto } from '@/components/portfolio/PhotoViewer.vue'
import PortfolioGrid from '@/components/portfolio/PortfolioGrid.vue'
import type { GridPhoto } from '@/components/portfolio/PortfolioGrid.vue'
import { useViewTracker } from '@/composables/useViewTracker'
import { wallService } from '@/services/wall'
import type { WallPortfolioDetail } from '@/services/wall'
import { useWallBoardStore } from '@/stores/wallBoard'
import { applyInteraction, rollbackInteraction, snapshotInteraction, truncateProviderName } from '@/utils/wall'
import type { InteractionAction } from '@/utils/wall'
import { buildBoardQuery, formatPhotoCount, imageAltText } from '@/utils/wallBoard'

/**
 * Detalle_Portafolio del Muro: nombre, descripción, categoría, Prestador, todas las fotos
 * listas en cuadrícula uniforme con visor (sin acciones por foto), Me gusta y Guardar del
 * Portafolio. Requisitos 2, 3, 4, 7, 9, 10 y 12.
 */
const NOT_AVAILABLE_MESSAGE = 'Este portafolio ya no está disponible'
const LOAD_FAILED_MESSAGE = 'No se pudo cargar el portafolio'
const ACTION_FAILED_MESSAGE = 'La acción no se completó'

const route = useRoute()
const router = useRouter()
const board = useWallBoardStore()
const tracker = useViewTracker({ enabled: () => board.privacy.enabled })

const portfolioId = computed(() => Number((route.params as { id: string }).id))
const portfolio = ref<WallPortfolioDetail | null>(null)
const loading = ref(true)
const notFound = ref(false)
const loadError = ref(false)
const actionError = ref<string | null>(null)
const actionErrorVisible = computed({
  get: () => actionError.value !== null,
  set: (value: boolean) => {
    if (!value)
      actionError.value = null
  },
})

const viewerOpen = ref(false)
const viewerIndex = ref(0)
const pending = new Set<string>()

const providerName = computed(() => truncateProviderName(portfolio.value?.provider.name ?? 'Prestador'))
const description = computed(() => {
  const text = portfolio.value?.description

  return typeof text === 'string' && text.trim() !== '' ? text : null
})

function altOf(alt: string | undefined): string {
  return imageAltText({
    description: alt,
    portfolioName: portfolio.value?.name,
    providerName: portfolio.value?.provider.name,
    categoryName: portfolio.value?.category?.name,
  })
}

const gridPhotos = computed<GridPhoto[]>(() => (portfolio.value?.photos ?? []).map(photo => ({
  id: photo.id,
  description: altOf(photo.alt),
  image_url: null,
  thumb_url: photo.thumb_url,
  medium_url: photo.medium_url,
})))

const viewerPhotos = computed<ViewerPhoto[]>(() => (portfolio.value?.photos ?? []).map(photo => ({
  id: photo.id,
  description: photo.alt && photo.alt.trim() !== '' ? photo.alt : undefined,
  thumb_url: photo.thumb_url,
  medium_url: photo.medium_url,
})))

async function ensurePrivacy() {
  if (board.privacy.answered)
    return
  try {
    const summary = await wallService.privacy()

    board.privacy = { answered: summary.status !== 'unanswered', enabled: summary.behavior_logging }
  }
  catch {
    // Sin estado de privacidad no se registra comportamiento.
  }
}

async function load() {
  loading.value = true
  notFound.value = false
  loadError.value = false
  try {
    portfolio.value = await wallService.portfolioDetail(portfolioId.value)
    document.title = portfolio.value.name
    await ensurePrivacy()
    tracker.recordOpenDetail('portfolio', portfolioId.value)
    tracker.recordView('portfolio', portfolioId.value)
  }
  catch (error) {
    const status = (error as { response?: { status?: number } })?.response?.status

    portfolio.value = null
    if (status === 404) {
      notFound.value = true
      // La tarjeta deja de mostrarse al volver al Muro.
      board.removeItem('portfolios', portfolioId.value)
    }
    else {
      loadError.value = true
    }
  }
  finally {
    loading.value = false
  }
}

/** Refleja el estado del Portafolio en la lista del Muro para que siga coherente al volver. */
function syncBoard(patch: Partial<Pick<WallPortfolioDetail, 'liked_by_me' | 'saved_by_me' | 'likes_count'>>) {
  const list = board.tabs.portfolios.list

  board.tabs.portfolios.list = { ...list, items: list.items.map(i => (i.id === portfolioId.value ? { ...i, ...patch } : i)) }
}

async function interact(kind: 'like' | 'save') {
  const current = portfolio.value

  if (!current)
    return
  const key = `${kind}:${current.id}`

  if (pending.has(key))
    return

  const action: InteractionAction = kind === 'like'
    ? (current.liked_by_me ? 'unlike' : 'like')
    : (current.saved_by_me ? 'unsave' : 'save')
  const snapshot = snapshotInteraction(current)
  const calls = {
    like: wallService.likePortfolio,
    unlike: wallService.unlikePortfolio,
    save: wallService.savePortfolio,
    unsave: wallService.unsavePortfolio,
  }

  pending.add(key)
  portfolio.value = applyInteraction(current, action)
  syncBoard(portfolio.value)
  try {
    const state = await calls[action](current.id)

    if (portfolio.value) {
      portfolio.value = { ...portfolio.value, liked_by_me: state.liked, saved_by_me: state.saved, likes_count: state.likes_count }
      syncBoard(portfolio.value)
    }
  }
  catch {
    if (portfolio.value) {
      const reverted = rollbackInteraction(portfolio.value, snapshot)
      const patch = kind === 'like'
        ? { liked_by_me: reverted.liked_by_me, likes_count: reverted.likes_count }
        : { saved_by_me: reverted.saved_by_me }

      portfolio.value = { ...portfolio.value, ...patch }
      syncBoard(patch)
    }
    actionError.value = ACTION_FAILED_MESSAGE
  }
  finally {
    pending.delete(key)
  }
}

function onOpenProfile() {
  tracker.recordProfileOpen('portfolio', portfolioId.value)
}

function openViewer(index: number) {
  viewerIndex.value = index
  viewerOpen.value = true
}

/** `router.back()` si se llegó desde el Muro (restaura pestaña, filtros y scroll); si no, `/wall?tab=`. */
function backToBoard() {
  const previous = (window.history.state as { back?: unknown } | null)?.back

  if (typeof previous === 'string' && /^\/wall(\/|\?|$)/.test(previous) && !/^\/wall\/(jobs|portfolios)\//.test(previous)) {
    router.back()

    return
  }
  void router.push({
    path: '/wall',
    query: buildBoardQuery({ tab: 'portfolios', category: board.filters.category, city: board.filters.city }),
  })
}

onMounted(load)
</script>

<template>
  <div class="wall-detail pa-4">
    <VBtn
      class="mb-4"
      data-testid="detail-back"
      prepend-icon="ri-arrow-left-line"
      variant="text"
      @click="backToBoard"
    >
      Volver al Muro
    </VBtn>

    <div
      v-if="loading"
      class="d-flex justify-center pa-6"
      data-testid="detail-loading"
    >
      <VProgressCircular
        aria-label="Cargando portafolio"
        indeterminate
      />
    </div>

    <div
      v-else-if="notFound"
      class="text-center pa-8"
      data-testid="detail-not-found"
    >
      <VIcon
        aria-hidden="true"
        icon="ri-error-warning-line"
        size="48"
      />
      <p
        class="text-h6 my-4"
        role="alert"
      >
        {{ NOT_AVAILABLE_MESSAGE }}
      </p>
      <VBtn
        color="primary"
        data-testid="detail-not-found-back"
        @click="backToBoard"
      >
        Volver al Muro
      </VBtn>
    </div>

    <div
      v-else-if="loadError"
      class="text-center pa-8"
      data-testid="detail-error"
    >
      <p
        class="text-error mb-3"
        role="alert"
      >
        {{ LOAD_FAILED_MESSAGE }}
      </p>
      <VBtn
        color="primary"
        data-testid="detail-retry"
        @click="load"
      >
        Reintentar
      </VBtn>
    </div>

    <article
      v-else-if="portfolio"
      data-testid="portfolio-detail"
    >
      <h1
        class="detail-title text-h5 mb-1"
        data-testid="detail-name"
      >
        {{ portfolio.name }}
      </h1>

      <p
        v-if="description"
        class="detail-description text-body-1 mb-2"
        data-testid="detail-description"
      >
        {{ description }}
      </p>

      <div class="d-flex flex-wrap align-center ga-2">
        <VChip
          v-if="portfolio.category"
          data-testid="detail-category"
          size="small"
        >
          {{ portfolio.category.name }}
        </VChip>
        <RouterLink
          class="text-primary font-weight-medium text-body-1"
          data-testid="detail-provider-link"
          :title="portfolio.provider.name"
          :to="`/providers/${portfolio.provider.id}`"
          @click="onOpenProfile"
        >
          {{ providerName }}
        </RouterLink>
        <span
          class="text-body-2 text-medium-emphasis"
          data-testid="detail-photo-count"
        >{{ formatPhotoCount(portfolio.photos_count) }}</span>
      </div>

      <PortfolioGrid
        v-if="gridPhotos.length > 0"
        class="mt-2"
        data-testid="detail-photos"
        :eager-count="4"
        :photos="gridPhotos"
        :portfolio-name="portfolio.name"
        @open="openViewer"
      />

      <div class="d-flex align-center mt-2">
        <VBtn
          :aria-label="portfolio.liked_by_me ? 'Quitar me gusta' : 'Me gusta'"
          :aria-pressed="portfolio.liked_by_me ? 'true' : 'false'"
          :color="portfolio.liked_by_me ? 'error' : undefined"
          data-testid="detail-like"
          :icon="portfolio.liked_by_me ? 'ri-heart-fill' : 'ri-heart-line'"
          variant="text"
          @click="interact('like')"
        />
        <span
          aria-live="polite"
          class="text-body-2"
          data-testid="detail-likes-count"
        >{{ portfolio.likes_count }}</span>
        <VBtn
          :aria-label="portfolio.saved_by_me ? 'Quitar de guardados' : 'Guardar'"
          :aria-pressed="portfolio.saved_by_me ? 'true' : 'false'"
          class="ml-2"
          :color="portfolio.saved_by_me ? 'primary' : undefined"
          data-testid="detail-save"
          :icon="portfolio.saved_by_me ? 'ri-bookmark-fill' : 'ri-bookmark-line'"
          variant="text"
          @click="interact('save')"
        />
      </div>

      <PhotoViewer
        v-model="viewerOpen"
        v-model:index="viewerIndex"
        :category-name="portfolio.category?.name ?? null"
        :photos="viewerPhotos"
        :portfolio-name="portfolio.name"
      />
    </article>

    <VSnackbar
      v-model="actionErrorVisible"
      color="error"
      data-testid="detail-action-error"
    >
      {{ actionError }}
    </VSnackbar>
  </div>
</template>

<style scoped>
.wall-detail {
  max-width: 1400px;
  margin: 0 auto;
}

.detail-title,
.detail-description {
  overflow-wrap: anywhere;
}

.detail-description {
  white-space: pre-line;
}
</style>
