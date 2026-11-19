<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import PrivacyNotice from '@/components/wall/PrivacyNotice.vue'
import WallCategoryChips from '@/components/wall/WallCategoryChips.vue'
import WallJobCardView from '@/components/wall/WallJobCard.vue'
import WallLoadMore from '@/components/wall/WallLoadMore.vue'
import WallPortfolioCardView from '@/components/wall/WallPortfolioCard.vue'
import WallTabs from '@/components/wall/WallTabs.vue'
import { useViewTracker } from '@/composables/useViewTracker'
import type { WallJobCard, WallPortfolioCard } from '@/services/wall'
import { useWallBoardStore } from '@/stores/wallBoard'
import { boardColumnsForWidth, buildBoardQuery, parseBoardQuery } from '@/utils/wallBoard'
import type { BoardTab } from '@/utils/wallBoard'

/**
 * Muro de Trabajos y Portafolios con pestañas. El estado (pestaña, categoría y ciudad) vive en
 * la dirección (`router.replace`) y en `useWallBoardStore`, que conserva listas, cursores y
 * scroll de cada pestaña para restaurarlos al volver. El scroll es el de `window`: el layout
 * por defecto no crea un contenedor interno con desplazamiento.
 * Requisitos 1, 2, 7, 8, 10.18, 12 y 13.
 */
const LOAD_FAILED_MESSAGE = 'No se pudo cargar el Muro.'

const route = useRoute()
const router = useRouter()
const board = useWallBoardStore()
const tracker = useViewTracker({ enabled: () => board.privacy.enabled })

const gridWrapper = ref<HTMLElement | null>(null)
const columns = ref<1 | 2 | 3>(1)

const activeTab = computed(() => board.activeTab)
const list = computed(() => board.tabs[activeTab.value].list)
const loadedOnce = computed(() => board.tabs[activeTab.value].loadedAt !== null)
const available = computed(() => board.tabs[activeTab.value].available)

const hasFilters = computed(() => board.filters.category !== null || !!board.filters.city)
const initialLoading = computed(() => list.value.loading && list.value.items.length === 0)
const showEmpty = computed(() => loadedOnce.value && !list.value.loading && !list.value.loadError && list.value.items.length === 0)
const showGrid = computed(() => list.value.items.length > 0)
const loadMoreError = computed(() => (list.value.loadError ? (list.value.items.length === 0 ? LOAD_FAILED_MESSAGE : true) : false))

const jobs = computed(() => board.tabs.jobs.list.items as WallJobCard[])
const portfolios = computed(() => board.tabs.portfolios.list.items as WallPortfolioCard[])

const categoryItems = computed(() => (available.value?.categories ?? []).map(c => ({
  id: c.id,
  name: c.name,
  count: 'items_count' in c ? c.items_count : c.portfolios_count,
})))
const selectItems = computed(() => categoryItems.value.map(c => ({ title: c.name, value: c.id })))
const cityItems = computed(() => (available.value?.cities ?? []).map(c => c.name))

const actionErrorVisible = computed({
  get: () => board.actionError !== null,
  set: (value: boolean) => {
    if (!value)
      board.clearActionError()
  },
})

function currentScroll(): number {
  return typeof window === 'undefined' ? 0 : window.scrollY
}

function scrollToY(y: number) {
  if (typeof window !== 'undefined' && typeof window.scrollTo === 'function')
    window.scrollTo(0, y)
}

function updateColumns() {
  columns.value = boardColumnsForWidth(window.innerWidth)
}

function syncQuery() {
  void router.replace({
    query: buildBoardQuery({ tab: board.activeTab, category: board.filters.category, city: board.filters.city }),
  })
}

function scanCards() {
  void nextTick(() => tracker.scan(gridWrapper.value))
}

async function afterLoad(tab: BoardTab, decision: 'restore' | 'load') {
  await nextTick()
  if (board.activeTab !== tab)
    return
  scrollToY(decision === 'restore' ? board.getScroll(tab) : 0)
  scanCards()
}

onMounted(async () => {
  document.title = 'Muro'
  updateColumns()
  window.addEventListener('resize', updateColumns)

  const state = parseBoardQuery(route.query as Record<string, unknown>)

  board.setTab(state.tab)
  void board.loadAvailableFilters(state.tab)

  let decision: 'restore' | 'load' = 'load'

  if (board.filters.category !== state.category || board.filters.city !== state.city)
    await board.setFilters({ category: state.category, city: state.city })
  else
    decision = await board.restoreOrLoad(state.tab)

  syncQuery()
  await afterLoad(state.tab, decision)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateColumns)
})

// Guarda el scroll de la pestaña activa antes de salir (el estado ya vive en el store).
onBeforeRouteLeave(() => {
  board.saveScroll(board.activeTab, currentScroll())

  return true
})

async function onTabChange(tab: BoardTab) {
  if (tab === board.activeTab)
    return
  board.saveScroll(board.activeTab, currentScroll())
  board.setTab(tab)
  syncQuery()
  void board.loadAvailableFilters(tab)

  const decision = await board.restoreOrLoad(tab)

  await afterLoad(tab, decision)
}

async function applyFilters(patch: { category?: number | null, city?: string | null }) {
  const pending = board.setFilters(patch)

  syncQuery()
  scrollToY(0)
  await pending
  scanCards()
}

function onCategory(value: number | null | undefined) {
  void applyFilters({ category: value ?? null })
}

function onCity(value: string | null | undefined) {
  void applyFilters({ city: value ? value : null })
}

function clearFilters() {
  void applyFilters({ category: null, city: null })
}

async function loadMore() {
  await board.loadMore()
  scanCards()
}

async function retry() {
  await board.retry()
  scanCards()
}

function isEager(index: number): boolean {
  return index < columns.value
}

/**
 * Abre el detalle. El scroll se guarda antes de navegar; si el detalle responde 404 debe
 * llamar a `useWallBoardStore().removeItem(tab, id)` (el store persiste entre páginas), y al
 * volver la tarjeta ya no estará en la lista restaurada.
 */
function openDetail(tab: BoardTab, id: number) {
  board.saveScroll(tab, currentScroll())
  tracker.recordOpenDetail(tab === 'jobs' ? 'job' : 'portfolio', id)
  void router.push(`/wall/${tab === 'jobs' ? 'jobs' : 'portfolios'}/${id}`)
}

function openProfile(tab: BoardTab, id: number) {
  tracker.recordProfileOpen(tab === 'jobs' ? 'job' : 'portfolio', id)
}
</script>

<template>
  <div class="wall-page">
    <h1 class="text-h5 px-4 pt-4">
      Muro
    </h1>

    <div class="px-4">
      <PrivacyNotice />
    </div>

    <section
      aria-label="Filtros del Muro"
      class="wall-page__filters px-4 py-2"
      data-testid="wall-filter-bar"
    >
      <div class="d-flex flex-wrap ga-3">
        <VSelect
          class="wall-page__field"
          clearable
          data-testid="wall-filter-category"
          density="comfortable"
          hide-details
          :items="selectItems"
          label="Categoría"
          :model-value="board.filters.category"
          no-data-text="Sin categorías"
          @update:model-value="onCategory"
        />
        <VAutocomplete
          class="wall-page__field"
          clearable
          data-testid="wall-filter-city"
          density="comfortable"
          hide-details
          :items="cityItems"
          label="Ciudad"
          :model-value="board.filters.city"
          no-data-text="Sin ciudades"
          @update:model-value="onCity"
        />
      </div>
      <WallCategoryChips
        class="mt-2"
        :categories="categoryItems"
        :model-value="board.filters.category"
        @update:model-value="onCategory"
      />
    </section>

    <div class="px-4">
      <WallTabs
        :model-value="activeTab"
        @update:model-value="onTabChange"
      >
        <div
          v-if="showEmpty"
          class="text-center pa-8"
          data-testid="wall-empty"
        >
          <p class="text-body-1 mb-4">
            {{ hasFilters
              ? 'No hay elementos que coincidan con los filtros.'
              : activeTab === 'jobs' ? 'Aún no hay trabajos en el Muro.' : 'Aún no hay portafolios en el Muro.' }}
          </p>
          <VBtn
            v-if="hasFilters"
            color="primary"
            data-testid="wall-clear-filters"
            variant="outlined"
            @click="clearFilters"
          >
            Quitar filtros
          </VBtn>
        </div>

        <div
          v-if="showGrid"
          ref="gridWrapper"
          data-testid="wall-grid"
        >
          <ul
            :aria-label="activeTab === 'jobs' ? 'Trabajos' : 'Portafolios'"
            class="wall-page__grid"
          >
            <template v-if="activeTab === 'jobs'">
              <li
                v-for="(job, index) in jobs"
                :key="`job-${job.id}`"
                class="wall-page__cell"
              >
                <WallJobCardView
                  :eager="isEager(index)"
                  :job="job"
                  @like="board.toggleLike('jobs', $event.id)"
                  @open-detail="openDetail('jobs', $event.id)"
                  @open-profile="openProfile('jobs', $event.id)"
                  @save="board.toggleSave('jobs', $event.id)"
                />
              </li>
            </template>
            <template v-else>
              <li
                v-for="(portfolio, index) in portfolios"
                :key="`portfolio-${portfolio.id}`"
                class="wall-page__cell"
              >
                <WallPortfolioCardView
                  :eager="isEager(index)"
                  :portfolio="portfolio"
                  @like="board.toggleLike('portfolios', $event.id)"
                  @open-detail="openDetail('portfolios', $event.id)"
                  @open-profile="openProfile('portfolios', $event.id)"
                  @save="board.toggleSave('portfolios', $event.id)"
                />
              </li>
            </template>
          </ul>
        </div>

        <div
          v-if="initialLoading"
          class="d-flex justify-center pa-6"
          data-testid="wall-loading"
        >
          <VProgressCircular
            aria-label="Cargando el Muro"
            indeterminate
          />
        </div>

        <WallLoadMore
          :error="loadMoreError"
          :has-more="list.nextCursor !== null"
          :loading="list.loading && list.items.length > 0"
          @load="loadMore"
          @retry="retry"
        />
      </WallTabs>
    </div>

    <VSnackbar
      v-model="actionErrorVisible"
      color="error"
      data-testid="wall-action-error"
    >
      {{ board.actionError }}
    </VSnackbar>
  </div>
</template>

<style scoped>
.wall-page__filters {
  position: sticky;
  z-index: 5;
  inset-block-start: var(--wall-sticky-offset, 64px);
  background: rgb(var(--v-theme-background));
  border-block-end: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.wall-page__field {
  min-inline-size: 200px;
  max-inline-size: 320px;
  flex: 1 1 200px;
}

.wall-page__grid {
  display: grid;
  gap: 16px;
  grid-template-columns: 1fr;
  list-style: none;
  margin: 0;
  padding: 0;
}

.wall-page__cell {
  min-inline-size: 0;
}

.wall-page__cell:focus-within {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
  border-radius: 8px;
}

@media (min-width: 600px) {
  .wall-page__grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 960px) {
  .wall-page__grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
