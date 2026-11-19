<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PhotoViewer from '@/components/portfolio/PhotoViewer.vue'
import type { ViewerPhoto } from '@/components/portfolio/PhotoViewer.vue'
import PortfolioGrid from '@/components/portfolio/PortfolioGrid.vue'
import type { GridPhoto } from '@/components/portfolio/PortfolioGrid.vue'
import { useViewTracker } from '@/composables/useViewTracker'
import { wallService } from '@/services/wall'
import type { WallJobDetail } from '@/services/wall'
import { useWallBoardStore } from '@/stores/wallBoard'
import { applyInteraction, rollbackInteraction, snapshotInteraction, truncateProviderName } from '@/utils/wall'
import type { InteractionAction } from '@/utils/wall'
import { buildBoardQuery, imageAltText, jobCardModel } from '@/utils/wallBoard'

/**
 * Detalle_Trabajo del Muro: categoría, Prestador, calificación y comentario completos,
 * Cliente verificado, cumplimiento, fotos con visor (sin acciones por foto), Me gusta y
 * Guardar del Trabajo y Llamado_Calificar. Requisitos 2, 3, 4, 7, 9, 10 y 12.
 */
const NOT_AVAILABLE_MESSAGE = 'Este trabajo ya no está disponible'
const LOAD_FAILED_MESSAGE = 'No se pudo cargar el trabajo'
const ACTION_FAILED_MESSAGE = 'La acción no se completó'

const route = useRoute()
const router = useRouter()
const board = useWallBoardStore()
const tracker = useViewTracker({ enabled: () => board.privacy.enabled })

const jobId = computed(() => Number((route.params as { id: string }).id))
const job = ref<WallJobDetail | null>(null)
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

const model = computed(() => (job.value ? jobCardModel(job.value) : null))
const providerName = computed(() => truncateProviderName(job.value?.provider.name ?? 'Prestador'))

function photoDescription(alt: string | undefined): string | undefined {
  return alt && alt.trim() !== '' ? alt : undefined
}

function fallbackAlt(alt: string | undefined): string {
  return imageAltText({
    description: alt,
    providerName: job.value?.provider.name,
    categoryName: job.value?.category?.name,
  })
}

const gridPhotos = computed<GridPhoto[]>(() => (job.value?.photos ?? []).map(photo => ({
  id: photo.id,
  description: fallbackAlt(photo.alt),
  image_url: null,
  thumb_url: photo.thumb_url,
  medium_url: photo.medium_url,
})))

const viewerPhotos = computed<ViewerPhoto[]>(() => (job.value?.photos ?? []).map(photo => ({
  id: photo.id,
  description: photoDescription(photo.alt),
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
    job.value = await wallService.jobDetail(jobId.value)
    document.title = 'Detalle del trabajo'
    await ensurePrivacy()
    tracker.recordOpenDetail('job', jobId.value)
    tracker.recordView('job', jobId.value)
  }
  catch (error) {
    const status = (error as { response?: { status?: number } })?.response?.status

    job.value = null
    if (status === 404) {
      notFound.value = true
      // La tarjeta deja de mostrarse al volver al Muro.
      board.removeItem('jobs', jobId.value)
    }
    else {
      loadError.value = true
    }
  }
  finally {
    loading.value = false
  }
}

/** Refleja el estado del Trabajo en la lista del Muro para que siga coherente al volver. */
function syncBoard(patch: Partial<Pick<WallJobDetail, 'liked_by_me' | 'saved_by_me' | 'likes_count'>>) {
  const list = board.tabs.jobs.list

  board.tabs.jobs.list = { ...list, items: list.items.map(i => (i.id === jobId.value ? { ...i, ...patch } : i)) }
}

async function interact(kind: 'like' | 'save') {
  const current = job.value

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
    like: wallService.likeJob,
    unlike: wallService.unlikeJob,
    save: wallService.saveJob,
    unsave: wallService.unsaveJob,
  }

  pending.add(key)
  job.value = applyInteraction(current, action)
  syncBoard(job.value)
  try {
    const state = await calls[action](current.id)

    if (job.value) {
      job.value = { ...job.value, liked_by_me: state.liked, saved_by_me: state.saved, likes_count: state.likes_count }
      syncBoard(job.value)
    }
  }
  catch {
    if (job.value) {
      const reverted = rollbackInteraction(job.value, snapshot)
      const patch = kind === 'like'
        ? { liked_by_me: reverted.liked_by_me, likes_count: reverted.likes_count }
        : { saved_by_me: reverted.saved_by_me }

      job.value = { ...job.value, ...patch }
      syncBoard(patch)
    }
    actionError.value = ACTION_FAILED_MESSAGE
  }
  finally {
    pending.delete(key)
  }
}

function onOpenProfile() {
  tracker.recordProfileOpen('job', jobId.value)
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
    query: buildBoardQuery({ tab: 'jobs', category: board.filters.category, city: board.filters.city }),
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
        aria-label="Cargando trabajo"
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
      v-else-if="job && model"
      data-testid="job-detail"
    >
      <h1 class="text-h5 mb-1">
        {{ job.category?.name ?? 'Trabajo' }}
      </h1>

      <component
        :is="job.provider.id ? 'RouterLink' : 'span'"
        class="text-primary font-weight-medium text-body-1"
        data-testid="detail-provider-link"
        :title="job.provider.name ?? undefined"
        v-bind="job.provider.id ? { to: `/providers/${job.provider.id}` } : {}"
        @click="job.provider.id && onOpenProfile()"
      >
        {{ providerName }}
      </component>

      <div class="d-flex align-center gap-2 mt-2">
        <template v-if="model.hasRating">
          <span
            class="d-inline-flex"
            data-testid="detail-stars"
            role="img"
            :aria-label="model.ratingLabel ?? undefined"
          >
            <VRating
              aria-hidden="true"
              density="compact"
              :length="5"
              :model-value="model.filledStars"
              readonly
              size="small"
            />
          </span>
          <span
            class="text-body-2"
            data-testid="detail-score"
          >{{ model.scoreText }}</span>
        </template>
        <span
          v-else
          class="text-body-2 text-medium-emphasis"
          data-testid="detail-unrated"
        >{{ model.unratedText }}</span>
      </div>

      <p
        v-if="model.comment"
        class="detail-comment text-body-1 mt-2"
        data-testid="detail-comment"
      >
        {{ model.comment }}
      </p>

      <div
        class="text-body-2 text-medium-emphasis mt-2"
        data-testid="detail-client"
      >
        {{ model.clientLabel }}
      </div>

      <div
        v-if="model.complianceText"
        class="text-body-1 mt-2"
        data-testid="detail-compliance"
      >
        {{ model.complianceText }}
      </div>
      <div
        v-if="model.complianceIndex !== null"
        class="text-body-2 text-medium-emphasis"
        data-testid="detail-compliance-index"
      >
        Cumplimiento: {{ model.complianceIndex }}%
      </div>

      <RouterLink
        v-if="model.showRateCall"
        class="d-inline-block mt-2 text-primary text-body-1"
        data-testid="detail-rate-call"
        :to="`/jobs/${job.id}#calificar`"
      >
        Calificar este trabajo
      </RouterLink>

      <PortfolioGrid
        v-if="gridPhotos.length > 0"
        class="mt-2"
        data-testid="detail-photos"
        :eager-count="4"
        :photos="gridPhotos"
        @open="openViewer"
      />
      <div
        v-else
        class="detail-placeholder d-flex align-center justify-center my-4"
        data-testid="detail-no-photo"
        role="img"
        aria-label="Trabajo sin foto"
      >
        <VIcon
          aria-hidden="true"
          icon="ri-image-line"
          size="48"
        />
        <span class="ml-2 text-body-2">Este trabajo no tiene fotos</span>
      </div>

      <div class="d-flex align-center mt-2">
        <VBtn
          :aria-label="job.liked_by_me ? 'Quitar me gusta' : 'Me gusta'"
          :aria-pressed="job.liked_by_me ? 'true' : 'false'"
          :color="job.liked_by_me ? 'error' : undefined"
          data-testid="detail-like"
          :icon="job.liked_by_me ? 'ri-heart-fill' : 'ri-heart-line'"
          variant="text"
          @click="interact('like')"
        />
        <span
          aria-live="polite"
          class="text-body-2"
          data-testid="detail-likes-count"
        >{{ job.likes_count }}</span>
        <VBtn
          :aria-label="job.saved_by_me ? 'Quitar de guardados' : 'Guardar'"
          :aria-pressed="job.saved_by_me ? 'true' : 'false'"
          class="ml-2"
          :color="job.saved_by_me ? 'primary' : undefined"
          data-testid="detail-save"
          :icon="job.saved_by_me ? 'ri-bookmark-fill' : 'ri-bookmark-line'"
          variant="text"
          @click="interact('save')"
        />
      </div>

      <PhotoViewer
        v-model="viewerOpen"
        v-model:index="viewerIndex"
        :category-name="job.category?.name ?? null"
        :photos="viewerPhotos"
        :portfolio-name="fallbackAlt(undefined)"
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
  max-width: 960px;
  margin: 0 auto;
}

.detail-comment {
  overflow-wrap: anywhere;
  white-space: pre-line;
}

.detail-placeholder {
  min-height: 160px;
  border-radius: 8px;
  background: rgba(var(--v-theme-on-surface), 0.06);
  color: rgba(var(--v-theme-on-surface), 0.6);
}
</style>
