<script setup lang="ts">
import { altText, pickImageUrl } from '@/utils/portfolioGrid'

export interface GridPhoto {
  id: number | string
  description?: string | null
  image_url: string | null
  thumb_url?: string | null
  medium_url?: string | null
  /** Nombre del Portafolio de la foto (texto alternativo si no hay descripción). */
  portfolio_name?: string | null
}

const props = withDefaults(defineProps<{
  photos: GridPhoto[]
  /** Cantidad de primeras miniaturas que se cargan sin esperar al scroll. */
  eagerCount?: number
  /** Nombre del Portafolio usado si la foto no trae `portfolio_name`. */
  portfolioName?: string
}>(), {
  eagerCount: 0,
  portfolioName: '',
})

const emit = defineEmits<{
  (e: 'open', index: number): void
}>()

function srcOf (photo: GridPhoto): string {
  return pickImageUrl({
    thumb_url: photo.thumb_url,
    medium_url: photo.medium_url,
    image_url: photo.image_url ?? '',
  }, 'medium')
}

function altOf (photo: GridPhoto): string {
  return altText(photo.description, photo.portfolio_name ?? props.portfolioName)
}
</script>

<template>
  <ul class="portfolio-grid">
    <li
      v-for="(photo, index) in photos"
      :key="photo.id"
      class="portfolio-grid__cell"
      :data-photo-id="photo.id"
    >
      <button
        class="portfolio-grid__tile"
        type="button"
        :aria-label="altOf(photo)"
        @click="emit('open', index)"
      >
        <VImg
          class="portfolio-grid__img"
          :src="srcOf(photo)"
          :alt="altOf(photo)"
          :aspect-ratio="1"
          cover
          :eager="index < props.eagerCount"
          :options="{ rootMargin: '800px' }"
        />
      </button>
      <slot
        name="footer"
        :photo="photo"
        :index="index"
      />
    </li>
  </ul>
</template>

<style scoped>
.portfolio-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 320px));
  justify-content: center;
  gap: 12px;
  padding: 16px;
  margin: 0;
  list-style: none;
}

@media (min-width: 600px) {
  .portfolio-grid {
    grid-template-columns: repeat(3, minmax(0, 320px));
  }
}

@media (min-width: 960px) {
  .portfolio-grid {
    grid-template-columns: repeat(4, minmax(0, 320px));
  }
}

.portfolio-grid__cell {
  min-width: 0;
}

.portfolio-grid__tile {
  display: block;
  width: 100%;
  max-width: 320px;
  aspect-ratio: 1;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  overflow: hidden;
}

.portfolio-grid__img {
  width: 100%;
  height: 100%;
  max-width: 320px;
  aspect-ratio: 1;
}

.portfolio-grid__img :deep(.v-img__img) {
  object-fit: cover;
}
</style>
