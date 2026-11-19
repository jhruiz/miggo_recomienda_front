<script setup lang="ts">
import { computed, ref } from 'vue'
import type { WallJobCard } from '@/services/wall'
import { jobCardModel } from '@/utils/wallBoard'
import { truncateProviderName } from '@/utils/wall'

/**
 * Tarjeta_Trabajo del Muro. Presentacional: Me gusta, Guardar, abrir detalle y abrir
 * perfil se delegan en el padre mediante eventos. Nunca muestra el nombre del Cliente.
 * Requisitos 2.13, 2.15, 2.16, 3.1 a 3.6, 4.2, 4.3, 9.13, 12.4 a 12.7, 13.3 a 13.7.
 */
const props = withDefaults(defineProps<{
  job: WallJobCard
  /** Primera fila: la imagen se carga sin diferir. */
  eager?: boolean
}>(), { eager: false })

const emit = defineEmits<{
  (e: 'like', job: WallJobCard): void
  (e: 'save', job: WallJobCard): void
  (e: 'open-detail', job: WallJobCard): void
  (e: 'open-profile', job: WallJobCard): void
}>()

const CATEGORY_ICONS: Record<string, string> = {
  'plomeria': 'ri-drop-line',
  'gasfiteria': 'ri-drop-line',
  'electricidad': 'ri-flashlight-line',
  'carpinteria': 'ri-hammer-line',
  'pintura': 'ri-paint-brush-line',
  'albanileria': 'ri-building-line',
  'jardineria': 'ri-plant-line',
  'limpieza-del-hogar': 'ri-brush-line',
  'cerrajeria': 'ri-key-2-line',
  'climatizacion-y-refrigeracion': 'ri-temp-cold-line',
  'mudanzas-y-fletes': 'ri-truck-line',
  'reparacion-de-electrodomesticos': 'ri-tools-line',
  'diseno-grafico': 'ri-palette-line',
  'desarrollo-web': 'ri-code-s-slash-line',
  'fotografia-y-video': 'ri-camera-line',
  'clases-particulares': 'ri-book-open-line',
  'belleza-y-estetica': 'ri-scissors-2-line',
  'mecanica-automotriz': 'ri-car-line',
}
const GENERIC_ICON = 'ri-briefcase-line'

const model = computed(() => jobCardModel(props.job))
const placeholderIcon = computed(() => CATEGORY_ICONS[model.value.placeholderCategorySlug ?? ''] ?? GENERIC_ICON)
const providerName = computed(() => truncateProviderName(props.job.provider.name ?? 'Prestador'))
const likeLabel = computed(() => (props.job.liked_by_me ? 'Quitar me gusta' : 'Me gusta'))
const saveLabel = computed(() => (props.job.saved_by_me ? 'Quitar de guardados' : 'Guardar'))
const expanded = ref(false)
const detailLabel = computed(() => `Ver detalle del trabajo${props.job.category ? ` de ${props.job.category.name}` : ''}`)

function openDetail() {
  emit('open-detail', props.job)
}

/** Clic en una zona de la tarjeta que no es un control propio. */
function onArticleClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null

  if (target?.closest('a, button, [data-no-open]'))
    return
  openDetail()
}
</script>

<template>
  <article
    class="wall-card wall-job-card"
    data-testid="wall-job-card"
    data-subject-type="job"
    :data-subject-id="job.id"
    @click="onArticleClick"
  >
    <button
      class="wall-card__main"
      type="button"
      data-testid="wall-card-main"
      :aria-label="detailLabel"
      @click="openDetail"
      @keydown.enter.prevent="openDetail"
      @keydown.space.prevent="openDetail"
    >
      <VImg
        v-if="model.mainPhoto"
        class="wall-card__media"
        data-testid="wall-job-photo"
        :src="model.mainPhoto.url"
        :alt="model.mainPhoto.alt"
        :aspect-ratio="1"
        cover
        :eager="eager"
        :options="{ rootMargin: '800px' }"
      />
      <div
        v-else
        class="wall-card__media wall-card__placeholder"
        data-testid="wall-job-placeholder"
        :role="model.placeholderDecorative ? undefined : 'img'"
        :aria-label="model.placeholderDecorative ? undefined : 'Trabajo sin foto'"
      >
        <VIcon
          :aria-hidden="model.placeholderDecorative ? 'true' : undefined"
          :icon="placeholderIcon"
          size="48"
        />
      </div>
    </button>

    <div class="wall-card__body pa-3">
      <div
        v-if="job.category"
        class="text-caption text-medium-emphasis"
        data-testid="wall-category"
      >
        {{ job.category.name }}
      </div>

      <component
        :is="job.provider.id ? 'RouterLink' : 'span'"
        class="wall-card__provider text-primary font-weight-medium"
        data-testid="wall-provider-link"
        :title="job.provider.name ?? undefined"
        v-bind="job.provider.id ? { to: `/providers/${job.provider.id}` } : {}"
        @click="job.provider.id && emit('open-profile', job)"
      >
        {{ providerName }}
      </component>

      <div class="d-flex align-center gap-2 mt-1">
        <template v-if="model.hasRating">
          <span
            role="img"
            class="d-inline-flex"
            data-testid="wall-job-stars"
            :aria-label="model.ratingLabel ?? undefined"
          >
            <VRating
              :model-value="model.filledStars"
              :length="5"
              readonly
              density="compact"
              size="small"
              aria-hidden="true"
            />
          </span>
          <span
            class="text-body-2"
            data-testid="wall-job-score"
          >{{ model.scoreText }}</span>
        </template>
        <span
          v-else
          class="text-body-2 text-medium-emphasis"
          data-testid="wall-job-unrated"
        >{{ model.unratedText }}</span>
      </div>

      <div
        v-if="model.comment"
        class="mt-1"
        data-no-open
      >
        <p
          class="wall-card__comment text-body-2 mb-0"
          :class="{ 'wall-card__comment--clamped': !expanded }"
          data-testid="wall-job-comment"
        >
          {{ model.comment }}
        </p>
        <button
          v-if="!expanded"
          class="text-primary text-body-2"
          type="button"
          data-testid="wall-job-more"
          @click.stop="expanded = true"
        >
          Ver más
        </button>
      </div>

      <div
        class="text-caption text-medium-emphasis mt-1"
        data-testid="wall-job-client"
      >
        {{ model.clientLabel }}
      </div>

      <div
        v-if="model.complianceText"
        class="text-body-2 mt-1"
        data-testid="wall-job-compliance"
      >
        {{ model.complianceText }}
      </div>
      <div
        v-if="model.complianceIndex !== null"
        class="text-caption text-medium-emphasis"
        data-testid="wall-job-compliance-index"
      >
        Cumplimiento: {{ model.complianceIndex }}%
      </div>

      <RouterLink
        v-if="model.showRateCall"
        class="d-inline-block mt-1 text-primary text-body-2"
        data-testid="wall-job-rate-call"
        :to="`/jobs/${job.id}#calificar`"
      >
        Calificar este trabajo
      </RouterLink>

      <div class="d-flex align-center mt-1">
        <VBtn
          :aria-label="likeLabel"
          :aria-pressed="job.liked_by_me ? 'true' : 'false'"
          :color="job.liked_by_me ? 'error' : undefined"
          data-testid="wall-like"
          :icon="job.liked_by_me ? 'ri-heart-fill' : 'ri-heart-line'"
          size="small"
          variant="text"
          @click.stop="emit('like', job)"
        />
        <span
          aria-live="polite"
          class="text-body-2"
          data-testid="wall-likes-count"
        >{{ job.likes_count }}</span>
        <VSpacer />
        <VBtn
          :aria-label="saveLabel"
          :aria-pressed="job.saved_by_me ? 'true' : 'false'"
          :color="job.saved_by_me ? 'primary' : undefined"
          data-testid="wall-save"
          :icon="job.saved_by_me ? 'ri-bookmark-fill' : 'ri-bookmark-line'"
          size="small"
          variant="text"
          @click.stop="emit('save', job)"
        />
      </div>
    </div>
  </article>
</template>

<style scoped>
.wall-card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 8px;
  background: rgb(var(--v-theme-surface));
  cursor: pointer;
}

.wall-card__main {
  display: block;
  width: 100%;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
}

.wall-card__media {
  width: 100%;
  aspect-ratio: 1;
}

.wall-card__placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(var(--v-theme-on-surface), 0.06);
  color: rgba(var(--v-theme-on-surface), 0.6);
}

.wall-card__body {
  min-width: 0;
}

.wall-card__provider {
  display: block;
  overflow-wrap: anywhere;
}

.wall-card__comment {
  overflow-wrap: anywhere;
}

.wall-card__comment--clamped {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  line-clamp: 3;
}
</style>
