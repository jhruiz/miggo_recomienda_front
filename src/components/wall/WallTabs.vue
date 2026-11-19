<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { BOARD_TABS, nextTabKey } from '@/utils/wallBoard'
import type { BoardTab } from '@/utils/wallBoard'

/**
 * Pestañas del Muro (Trabajos / Portafolios) con roles ARIA explícitos, sin VTabs.
 * Tabindex itinerante; flechas, Inicio y Fin cambian la pestaña y el foco la sigue.
 * Requisitos 1 y 13.
 */
const props = withDefaults(defineProps<{
  modelValue: BoardTab
  idPrefix?: string
}>(), { idPrefix: 'wall' })

const emit = defineEmits<{
  (e: 'update:modelValue', value: BoardTab): void
}>()

const LABELS: Record<BoardTab, string> = { jobs: 'Trabajos', portfolios: 'Portafolios' }
const ICONS: Record<BoardTab, string> = { jobs: 'ri-hammer-line', portfolios: 'ri-gallery-line' }

const tabRefs = ref<Record<string, HTMLElement | null>>({})

const tabId = (tab: BoardTab) => `${props.idPrefix}-tab-${tab}`
const panelId = (tab: BoardTab) => `${props.idPrefix}-panel-${tab}`

function select(tab: BoardTab) {
  if (tab !== props.modelValue)
    emit('update:modelValue', tab)
}

async function onKeydown(event: KeyboardEvent) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key))
    return

  event.preventDefault()
  const next = nextTabKey(props.modelValue, event.key)

  select(next)
  await nextTick()
  tabRefs.value[next]?.focus()
}
</script>

<template>
  <div class="wall-tabs">
    <div
      aria-label="Secciones del Muro"
      class="wall-tabs__list"
      data-testid="wall-tabs"
      role="tablist"
      @keydown="onKeydown"
    >
      <button
        v-for="tab in BOARD_TABS"
        :id="tabId(tab)"
        :key="tab"
        :ref="(el) => { tabRefs[tab] = el as HTMLElement | null }"
        :aria-controls="panelId(modelValue)"
        :aria-selected="modelValue === tab ? 'true' : 'false'"
        class="wall-tabs__tab"
        :class="{ 'wall-tabs__tab--active': modelValue === tab }"
        :data-testid="`wall-tab-${tab}`"
        role="tab"
        :tabindex="modelValue === tab ? 0 : -1"
        type="button"
        @click="select(tab)"
      >
        <VIcon
          aria-hidden="true"
          :icon="ICONS[tab]"
          size="20"
        />
        <span>{{ LABELS[tab] }}</span>
      </button>
    </div>

    <div
      :id="panelId(modelValue)"
      :aria-labelledby="tabId(modelValue)"
      class="wall-tabs__panel"
      data-testid="wall-tabpanel"
      role="tabpanel"
      tabindex="0"
    >
      <slot :tab="modelValue" />
    </div>
  </div>
</template>

<style scoped>
.wall-tabs__list {
  display: flex;
  gap: 4px;
  border-block-end: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.wall-tabs__tab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-block-size: 44px;
  padding: 8px 16px;
  border: 0;
  border-block-end: 2px solid transparent;
  background: transparent;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  cursor: pointer;
  font-size: 0.9375rem;
  font-weight: 500;
}

.wall-tabs__tab:hover {
  color: rgb(var(--v-theme-on-surface));
}

.wall-tabs__tab--active {
  border-block-end-color: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-primary));
}

.wall-tabs__tab:focus-visible,
.wall-tabs__panel:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

.wall-tabs__panel {
  padding-block-start: 16px;
}
</style>
