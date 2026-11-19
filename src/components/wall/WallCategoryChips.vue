<script setup lang="ts">
/**
 * Fila horizontal deslizable de chips de categoría: "Todas" y una por categoría con
 * elementos en la pestaña activa. Requisitos 8 y 13.
 */
export interface WallCategoryChip {
  id: number
  name: string
  count: number
}

defineProps<{
  categories: readonly WallCategoryChip[]
  modelValue: number | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: number | null): void
}>()
</script>

<template>
  <div
    aria-label="Filtrar por categoría"
    class="wall-chips"
    data-testid="wall-category-chips"
    role="group"
    tabindex="0"
  >
    <button
      :aria-pressed="modelValue === null ? 'true' : 'false'"
      class="wall-chips__chip"
      :class="{ 'wall-chips__chip--active': modelValue === null }"
      data-testid="wall-chip-all"
      type="button"
      @click="emit('update:modelValue', null)"
    >
      Todas
    </button>
    <button
      v-for="category in categories"
      :key="category.id"
      :aria-pressed="modelValue === category.id ? 'true' : 'false'"
      class="wall-chips__chip"
      :class="{ 'wall-chips__chip--active': modelValue === category.id }"
      :data-testid="`wall-chip-${category.id}`"
      type="button"
      @click="emit('update:modelValue', category.id)"
    >
      {{ category.name }}
      <span class="wall-chips__count">({{ category.count }})</span>
    </button>
  </div>
</template>

<style scoped>
.wall-chips {
  display: flex;
  flex-wrap: nowrap;
  gap: 8px;
  overflow-x: auto;
  padding-block: 4px;
  scroll-snap-type: x proximity;
  scrollbar-width: thin;
  -webkit-overflow-scrolling: touch;
}

.wall-chips:focus-visible,
.wall-chips__chip:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

.wall-chips__chip {
  flex: 0 0 auto;
  min-block-size: 36px;
  padding: 4px 14px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 999px;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  cursor: pointer;
  font-size: 0.875rem;
  scroll-snap-align: start;
  white-space: nowrap;
}

.wall-chips__chip--active {
  border-color: rgb(var(--v-theme-primary));
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
}

.wall-chips__count {
  opacity: 0.75;
}
</style>
