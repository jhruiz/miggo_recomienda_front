<script setup lang="ts">
/**
 * Vista pública de los Portafolios de un Prestador, con estilo de red social.
 *
 * - Destacados: un círculo por portafolio (con su portada) más "Todos".
 *   Al elegir uno se filtra la cuadrícula.
 * - Cuadrícula compacta de 3 columnas con miniaturas cuadradas.
 * - Visor amplio con carrusel para recorrer las fotos (flechas o teclado).
 */
import { computed, ref, watch } from 'vue'
import type { PublicPortfolio, PublicPortfolioItem } from '@/services/portfolios'

const props = defineProps<{
  portfolios: PublicPortfolio[]
}>()

interface Photo extends PublicPortfolioItem {
  portfolioName: string
}

/** Portafolio seleccionado en los destacados; null = "Todos". */
const selectedId = ref<number | null>(null)

const selected = computed(() =>
  props.portfolios.find(portfolio => portfolio.id === selectedId.value) ?? null,
)

const photos = computed<Photo[]>(() => {
  const source = selected.value ? [selected.value] : props.portfolios

  return source.flatMap(portfolio =>
    portfolio.items.map(item => ({ ...item, portfolioName: portfolio.name })),
  )
})

const totalPhotos = computed(() =>
  props.portfolios.reduce((sum, portfolio) => sum + portfolio.items.length, 0),
)

// Si el portafolio seleccionado deja de existir, se vuelve a "Todos".
watch(() => props.portfolios, list => {
  if (selectedId.value !== null && !list.some(portfolio => portfolio.id === selectedId.value))
    selectedId.value = null
})

function select(id: number | null) {
  selectedId.value = id
}

function coverOf(portfolio: PublicPortfolio): string | null {
  const first = portfolio.items[0]

  return portfolio.cover_thumb_url ?? first?.thumb_url ?? first?.image_url ?? null
}

function photoAlt(photo: Photo): string {
  return photo.description || `Foto del portafolio ${photo.portfolioName}`
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`
}

// ---- Visor ----
const viewerOpen = ref(false)
const viewerIndex = ref(0)
const current = computed(() => photos.value[viewerIndex.value] ?? null)

function openViewer(index: number) {
  viewerIndex.value = index
  viewerOpen.value = true
}

function step(delta: number) {
  const count = photos.value.length
  if (count > 0)
    viewerIndex.value = (viewerIndex.value + delta + count) % count
}
</script>

<template>
  <VCard class="mt-6">
    <VCardItem>
      <VCardTitle>Portafolio</VCardTitle>
      <VCardSubtitle v-if="portfolios.length">
        {{ plural(totalPhotos, 'foto', 'fotos') }} · {{ plural(portfolios.length, 'portafolio', 'portafolios') }}
      </VCardSubtitle>
    </VCardItem>

    <VCardText>
      <span
        v-if="!portfolios.length"
        class="text-body-2 text-medium-emphasis"
        data-testid="public-portfolios-empty"
      >
        Este prestador aún no ha publicado trabajos
      </span>

      <template v-else>
        <!-- Destacados: filtro por portafolio -->
        <div
          class="highlights mb-4"
          role="group"
          aria-label="Filtrar fotos por portafolio"
        >
          <button
            type="button"
            class="highlight"
            :class="{ 'highlight--active': selectedId === null }"
            :aria-pressed="selectedId === null"
            @click="select(null)"
          >
            <span class="highlight-ring">
              <VAvatar
                size="64"
                color="primary"
                variant="tonal"
              >
                <VIcon
                  icon="ri-apps-2-line"
                  size="28"
                />
              </VAvatar>
            </span>
            <span class="highlight-label">Todos</span>
          </button>

          <button
            v-for="portfolio in portfolios"
            :key="portfolio.id"
            type="button"
            class="highlight"
            :class="{ 'highlight--active': selectedId === portfolio.id }"
            :aria-pressed="selectedId === portfolio.id"
            :title="portfolio.name"
            data-testid="public-portfolio"
            @click="select(portfolio.id)"
          >
            <span class="highlight-ring">
              <VAvatar
                v-if="coverOf(portfolio)"
                size="64"
                :image="coverOf(portfolio) ?? undefined"
              />
              <VAvatar
                v-else
                size="64"
                color="secondary"
                variant="tonal"
              >
                <VIcon icon="ri-image-line" />
              </VAvatar>
            </span>
            <span class="highlight-label">{{ portfolio.name }}</span>
          </button>
        </div>

        <p
          v-if="selected?.description"
          class="text-body-2 text-medium-emphasis mb-4"
        >
          {{ selected.description }}
        </p>

        <!-- Cuadrícula de fotos -->
        <div class="photo-grid">
          <button
            v-for="(photo, index) in photos"
            :key="photo.id"
            type="button"
            class="photo-tile"
            :aria-label="`Ver foto: ${photoAlt(photo)}`"
            @click="openViewer(index)"
          >
            <VImg
              :src="photo.thumb_url ?? photo.image_url ?? ''"
              :alt="photoAlt(photo)"
              aspect-ratio="1"
              cover
              class="photo-img"
            >
              <template #error>
                <div class="d-flex align-center justify-center fill-height bg-surface">
                  <VIcon
                    icon="ri-image-line"
                    size="32"
                    color="disabled"
                  />
                </div>
              </template>
            </VImg>
            <span
              class="photo-overlay"
              aria-hidden="true"
            >
              <span class="photo-caption">{{ photo.description || photo.portfolioName }}</span>
            </span>
          </button>
        </div>
      </template>
    </VCardText>

    <!-- Visor de fotos -->
    <VDialog
      v-model="viewerOpen"
      max-width="960"
    >
      <VCard
        v-if="current"
        color="black"
        theme="dark"
        class="viewer"
        @keydown.left.prevent="step(-1)"
        @keydown.right.prevent="step(1)"
      >
        <VBtn
          icon="ri-close-line"
          variant="text"
          class="viewer-close"
          aria-label="Cerrar visor"
          @click="viewerOpen = false"
        />

        <VCarousel
          v-model="viewerIndex"
          height="70vh"
          hide-delimiters
          :show-arrows="photos.length > 1 ? 'hover' : false"
        >
          <VCarouselItem
            v-for="photo in photos"
            :key="photo.id"
          >
            <VImg
              :src="photo.image_url ?? photo.thumb_url ?? ''"
              :alt="photoAlt(photo)"
              height="100%"
            />
          </VCarouselItem>
        </VCarousel>

        <VCardText class="d-flex align-start gap-4">
          <div class="flex-grow-1">
            <div class="text-subtitle-1 font-weight-medium">
              {{ current.portfolioName }}
            </div>
            <p
              v-if="current.description"
              class="text-body-2 mb-0"
            >
              {{ current.description }}
            </p>
          </div>
          <span
            class="text-caption text-no-wrap"
            aria-live="polite"
          >
            {{ viewerIndex + 1 }} / {{ photos.length }}
          </span>
        </VCardText>
      </VCard>
    </VDialog>
  </VCard>
</template>

<style scoped>
/* ---- Destacados ---- */
.highlights {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  padding-block: 4px 8px;
  scrollbar-width: thin;
}

.highlight {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  align-items: center;
  border: 0;
  background: none;
  color: inherit;
  cursor: pointer;
  gap: 6px;
  inline-size: 76px;
  padding: 0;
}

.highlight:focus-visible {
  border-radius: 8px;
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

.highlight-ring {
  padding: 3px;
  border-radius: 50%;
  background: rgba(var(--v-theme-on-surface), 0.12);
}

.highlight-ring :deep(.v-avatar) {
  border: 2px solid rgb(var(--v-theme-surface));
}

.highlight--active .highlight-ring {
  background: linear-gradient(45deg, rgb(var(--v-theme-warning)), rgb(var(--v-theme-error)), rgb(var(--v-theme-primary)));
}

.highlight-label {
  overflow: hidden;
  font-size: 0.75rem;
  max-inline-size: 100%;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.highlight--active .highlight-label {
  font-weight: 600;
}

/* ---- Cuadrícula ---- */
.photo-grid {
  display: grid;
  gap: 4px;
  grid-template-columns: repeat(3, 1fr);
}

.photo-tile {
  position: relative;
  overflow: hidden;
  padding: 0;
  border: 0;
  aspect-ratio: 1;
  background: rgba(var(--v-theme-on-surface), 0.04);
  cursor: zoom-in;
}

.photo-tile:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

.photo-img {
  block-size: 100%;
  transition: transform 0.3s ease;
}

.photo-tile:hover .photo-img {
  transform: scale(1.05);
}

.photo-overlay {
  position: absolute;
  display: flex;
  align-items: flex-end;
  padding: 8px;
  background: linear-gradient(transparent 45%, rgba(0, 0, 0, 65%));
  color: #fff;
  font-size: 0.75rem;
  inset: 0;
  opacity: 0;
  text-align: start;
  transition: opacity 0.2s ease;
}

.photo-tile:hover .photo-overlay,
.photo-tile:focus-visible .photo-overlay {
  opacity: 1;
}

.photo-caption {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

/* En pantallas táctiles no hay hover: se oculta la capa. */
@media (hover: none) {
  .photo-overlay {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .photo-img,
  .photo-overlay {
    transition: none;
  }

  .photo-tile:hover .photo-img {
    transform: none;
  }
}

/* ---- Visor ---- */
.viewer {
  position: relative;
}

.viewer-close {
  position: absolute;
  z-index: 2;
  inset-block-start: 8px;
  inset-inline-end: 8px;
}
</style>