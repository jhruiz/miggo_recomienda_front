<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import WallJobCard from '@/components/wall/WallJobCard.vue'
import WallLoadMore from '@/components/wall/WallLoadMore.vue'
import WallPortfolioCard from '@/components/wall/WallPortfolioCard.vue'
import WallTabs from '@/components/wall/WallTabs.vue'
import { useNotifier } from '@/composables/useNotifier'
import type { WallJobCard as JobCardData, WallPortfolioCard as PortfolioCardData } from '@/services/wall'
import { useSavedBoardStore } from '@/stores/savedBoard'
import { parseBoardQuery } from '@/utils/wallBoard'
import type { BoardTab } from '@/utils/wallBoard'

/**
 * Guardados con dos pestañas (Trabajos y Portafolios), tarjetas en rejilla de 1, 2 o 3
 * columnas y "Ver más". Quitar un guardado retira la tarjeta cuando el servidor confirma.
 * Requisitos 9.14 a 9.17.
 */
const store = useSavedBoardStore()
const route = useRoute()
const router = useRouter()
const { state, notifyError } = useNotifier()

const tab = computed<BoardTab>(() => store.activeTab)
const list = computed(() => store.lists[tab.value])
const started = ref<Record<BoardTab, boolean>>({ jobs: false, portfolios: false })

const showInitialLoading = computed(() => list.value.loading && list.value.items.length === 0)
const showInitialError = computed(() => list.value.loadError && list.value.items.length === 0 && !list.value.loading)
const showEmpty = computed(() => started.value[tab.value] && !list.value.loading && !list.value.loadError && list.value.items.length === 0 && list.value.nextCursor === null)
const emptyText = computed(() => tab.value === 'jobs'
  ? 'Aún no hay trabajos guardados'
  : 'Aún no hay portafolios guardados')

function ensureLoaded(target: BoardTab) {
  if (started.value[target])
    return
  started.value[target] = true
  store.loadFirst(target)
}

function onTabChange(next: BoardTab) {
  store.setTab(next)
  router.replace({ query: { ...route.query, tab: next } })
  ensureLoaded(next)
}

watch(() => store.actionError, (message) => {
  if (!message)
    return
  notifyError(message)
  store.clearActionError()
})

onMounted(() => {
  store.setTab(parseBoardQuery(route.query as Record<string, string | string[] | null | undefined>).tab)
  ensureLoaded(store.activeTab)
})

function onUnsave(card: JobCardData | PortfolioCardData) {
  return store.unsave(tab.value, card.id)
}

function openDetail(card: JobCardData | PortfolioCardData) {
  router.push(`/wall/${tab.value}/${card.id}`)
}
</script>

<template>
  <div data-testid="saved-page">
    <h1 class="text-h5 mb-2">
      Guardados
    </h1>

    <WallTabs
      id-prefix="saved"
      :model-value="tab"
      @update:model-value="onTabChange"
    >
      <div
        v-if="showInitialLoading"
        class="d-flex justify-center pa-8"
        data-testid="saved-loading"
      >
        <VProgressCircular
          aria-label="Cargando guardados"
          indeterminate
        />
      </div>

      <VAlert
        v-else-if="showInitialError"
        data-testid="saved-error"
        type="error"
        variant="tonal"
      >
        No se pudieron cargar los guardados.
        <template #append>
          <VBtn
            data-testid="saved-retry"
            size="small"
            variant="outlined"
            @click="store.retry(tab)"
          >
            Reintentar
          </VBtn>
        </template>
      </VAlert>

      <div
        v-else-if="showEmpty"
        class="d-flex flex-column align-center text-center pa-8"
        data-testid="saved-empty"
      >
        <VIcon
          class="mb-2"
          icon="ri-bookmark-line"
          size="48"
        />
        <p class="text-body-1 mb-4">
          {{ emptyText }}
        </p>
        <VBtn
          color="primary"
          data-testid="saved-back-to-wall"
          to="/wall"
        >
          Volver al Muro
        </VBtn>
      </div>

      <template v-else>
        <div
          class="saved-grid"
          data-testid="saved-grid"
        >
          <template v-if="tab === 'jobs'">
            <WallJobCard
              v-for="(card, index) in list.items as JobCardData[]"
              :key="card.id"
              :eager="index < 3"
              :job="card"
              @like="() => {}"
              @open-detail="openDetail"
              @save="onUnsave"
            />
          </template>
          <template v-else>
            <WallPortfolioCard
              v-for="(card, index) in list.items as PortfolioCardData[]"
              :key="card.id"
              :eager="index < 3"
              :portfolio="card"
              @like="() => {}"
              @open-detail="openDetail"
              @save="onUnsave"
            />
          </template>
        </div>

        <WallLoadMore
          :error="list.loadError"
          :has-more="list.nextCursor !== null"
          :loading="list.loading"
          @load="store.loadMore(tab)"
          @retry="store.retry(tab)"
        />
      </template>
    </WallTabs>

    <VSnackbar
      v-model="state.visible"
      :color="state.color"
    >
      {{ state.text }}
    </VSnackbar>
  </div>
</template>

<style scoped>
.saved-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: 1fr;
}

@media (min-width: 600px) {
  .saved-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 960px) {
  .saved-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
