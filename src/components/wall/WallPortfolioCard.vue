<script setup lang="ts">
import { computed } from 'vue'
import type { WallPortfolioCard } from '@/services/wall'
import { portfolioCardModel } from '@/utils/wallBoard'
import { truncateProviderName } from '@/utils/wall'

/**
 * Tarjeta_Portafolio del Muro: Portada o Collage de 3 a 4 miniaturas con proporción
 * uniforme. Presentacional; las acciones salen por eventos.
 * Requisitos 7.4, 7.5, 7.6, 7.9, 9.13, 12.4 a 12.7, 13.3 a 13.7.
 */
const props = withDefaults(defineProps<{
  portfolio: WallPortfolioCard
  /** Primera fila: las imágenes se cargan sin diferir. */
  eager?: boolean
}>(), { eager: false })

const emit = defineEmits<{
  (e: 'like', portfolio: WallPortfolioCard): void
  (e: 'save', portfolio: WallPortfolioCard): void
  (e: 'open-detail', portfolio: WallPortfolioCard): void
  (e: 'open-profile', portfolio: WallPortfolioCard): void
}>()

const model = computed(() => portfolioCardModel(props.portfolio))
const providerName = computed(() => truncateProviderName(props.portfolio.provider.name ?? 'Prestador'))
const likeLabel = computed(() => (props.portfolio.liked_by_me ? 'Quitar me gusta' : 'Me gusta'))
const saveLabel = computed(() => (props.portfolio.saved_by_me ? 'Quitar de guardados' : 'Guardar'))

function openDetail() {
  emit('open-detail', props.portfolio)
}

function onArticleClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null

  if (target?.closest('a, button, [data-no-open]'))
    return
  openDetail()
}
</script>

<template>
  <article
    class="wall-card wall-portfolio-card"
    data-testid="wall-portfolio-card"
    data-subject-type="portfolio"
    :data-subject-id="portfolio.id"
    @click="onArticleClick"
  >
    <button
      class="wall-card__main"
      type="button"
      data-testid="wall-card-main"
      :aria-label="`Ver portafolio ${portfolio.name}`"
      @click="openDetail"
      @keydown.enter.prevent="openDetail"
      @keydown.space.prevent="openDetail"
    >
      <div
        v-if="model.layout === 'collage'"
        class="wall-card__media wall-portfolio-card__collage"
        data-testid="wall-portfolio-collage"
      >
        <VImg
          v-for="(thumb, index) in model.thumbs"
          :key="`${thumb.url}-${index}`"
          class="wall-portfolio-card__thumb"
          data-testid="wall-portfolio-thumb"
          :src="thumb.url"
          :alt="thumb.alt"
          :aspect-ratio="1"
          cover
          :eager="eager"
          :options="{ rootMargin: '800px' }"
        />
      </div>
      <VImg
        v-else-if="model.thumbs.length > 0"
        class="wall-card__media"
        data-testid="wall-portfolio-cover"
        :src="model.thumbs[0].url"
        :alt="model.thumbs[0].alt"
        :aspect-ratio="1"
        cover
        :eager="eager"
        :options="{ rootMargin: '800px' }"
      />
      <div
        v-else
        class="wall-card__media wall-card__placeholder"
        data-testid="wall-portfolio-placeholder"
      >
        <VIcon
          aria-hidden="true"
          icon="ri-image-line"
          size="48"
        />
      </div>
    </button>

    <div class="wall-card__body pa-3">
      <div
        class="text-subtitle-1 font-weight-medium"
        data-testid="wall-portfolio-name"
      >
        {{ portfolio.name }}
      </div>
      <div
        v-if="portfolio.category"
        class="text-caption text-medium-emphasis"
        data-testid="wall-category"
      >
        {{ portfolio.category.name }}
      </div>

      <RouterLink
        class="wall-card__provider text-primary font-weight-medium"
        data-testid="wall-provider-link"
        :title="portfolio.provider.name"
        :to="`/providers/${portfolio.provider.id}`"
        @click="emit('open-profile', portfolio)"
      >
        {{ providerName }}
      </RouterLink>

      <div
        class="text-body-2 text-medium-emphasis mt-1"
        data-testid="wall-portfolio-photos"
      >
        {{ model.photoCountLabel }}
      </div>

      <div class="d-flex align-center mt-1">
        <VBtn
          :aria-label="likeLabel"
          :aria-pressed="portfolio.liked_by_me ? 'true' : 'false'"
          :color="portfolio.liked_by_me ? 'error' : undefined"
          data-testid="wall-like"
          :icon="portfolio.liked_by_me ? 'ri-heart-fill' : 'ri-heart-line'"
          size="small"
          variant="text"
          @click.stop="emit('like', portfolio)"
        />
        <span
          aria-live="polite"
          class="text-body-2"
          data-testid="wall-likes-count"
        >{{ portfolio.likes_count }}</span>
        <VSpacer />
        <VBtn
          :aria-label="saveLabel"
          :aria-pressed="portfolio.saved_by_me ? 'true' : 'false'"
          :color="portfolio.saved_by_me ? 'primary' : undefined"
          data-testid="wall-save"
          :icon="portfolio.saved_by_me ? 'ri-bookmark-fill' : 'ri-bookmark-line'"
          size="small"
          variant="text"
          @click.stop="emit('save', portfolio)"
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

.wall-portfolio-card__collage {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-auto-rows: 1fr;
  gap: 2px;
}

.wall-portfolio-card__thumb {
  min-width: 0;
  aspect-ratio: 1;
}

.wall-card__body {
  min-width: 0;
}

.wall-card__provider {
  display: block;
  overflow-wrap: anywhere;
}
</style>
