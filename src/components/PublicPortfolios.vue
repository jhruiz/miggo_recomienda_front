<script setup lang="ts">
/**
 * Vista pública de los Portafolios de un Prestador, con estilo de red social.
 *
 * - Destacados: un círculo por portafolio (con su portada) más "Todos".
 *   Al elegir uno se filtra la cuadrícula.
 * - Cuadrícula (`PortfolioGrid`) y Visor (`PhotoViewer`, sin wrap-around).
 */
import { computed, ref, watch } from 'vue'
import PhotoViewer from '@/components/portfolio/PhotoViewer.vue'
import PortfolioGrid from '@/components/portfolio/PortfolioGrid.vue'
import type { PublicPortfolio, PublicPortfolioItem } from '@/services/portfolios'

const props = defineProps<{
  portfolios: PublicPortfolio[]
}>()

interface Photo extends PublicPortfolioItem {
  portfolio_name: string
  category_name: string | null
}

/** Portafolio seleccionado en los destacados; null = "Todos". */
const selectedId = ref<number | null>(null)

const selected = computed(() =>
  props.portfolios.find(portfolio => portfolio.id === selectedId.value) ?? null,
)

const photos = computed<Photo[]>(() => {
  const source = selected.value ? [selected.value] : props.portfolios

  return source.flatMap(portfolio =>
    portfolio.items.map(item => ({
      ...item,
      portfolio_name: portfolio.name,
      category_name: portfolio.category?.name ?? null,
    })),
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

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`
}

// ---- Visor ----
const viewerOpen = ref(false)
const viewerIndex = ref(0)

function openViewer(index: number) {
  viewerIndex.value = index
  viewerOpen.value = true
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

        <div
          v-if="selected?.category"
          class="mb-2"
        >
          <VChip
            size="small"
            color="primary"
            variant="tonal"
            data-testid="public-portfolio-category"
          >
            {{ selected.category.name }}
          </VChip>
        </div>

        <p
          v-if="selected?.description"
          class="text-body-2 text-medium-emphasis mb-4"
        >
          {{ selected.description }}
        </p>

        <!-- Cuadrícula de fotos -->
        <PortfolioGrid
          :photos="photos"
          :eager-count="8"
          @open="openViewer"
        />
      </template>
    </VCardText>

    <!-- Visor de fotos -->
    <PhotoViewer
      v-model="viewerOpen"
      v-model:index="viewerIndex"
      :photos="photos"
    />
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

</style>