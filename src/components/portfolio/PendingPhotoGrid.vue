<script setup lang="ts">
import { onBeforeUnmount, reactive, watch } from 'vue'
import type { PendingFile } from '@/utils/portfolioGrid'

const props = defineProps<{
  items: PendingFile[]
  /** Mensaje de error de subida por id de pendiente. */
  errors?: Record<string, string>
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'remove', id: string): void
}>()

// URLs de vista previa por id; se crean al aparecer el archivo y se revocan al quitarlo o desmontar (Req. 10.7, 10.8).
const urls = reactive<Record<string, string>>({})
const previewFailed = reactive<Record<string, boolean>>({})

function revoke (id: string) {
  const url = urls[id]
  if (url) {
    URL.revokeObjectURL(url)
    delete urls[id]
  }
  delete previewFailed[id]
}

watch(
  () => props.items,
  items => {
    const ids = new Set(items.map(item => item.id))

    for (const id of Object.keys(urls)) {
      if (!ids.has(id))
        revoke(id)
    }

    for (const item of items) {
      if (urls[item.id] || previewFailed[item.id])
        continue
      try {
        urls[item.id] = URL.createObjectURL(item.file)
      }
      catch {
        previewFailed[item.id] = true
      }
    }
  },
  { immediate: true, deep: true },
)

onBeforeUnmount(() => {
  for (const id of Object.keys(urls))
    revoke(id)
})
</script>

<template>
  <ul
    v-if="items.length"
    class="pending-photo-grid"
    aria-label="Fotos por subir"
  >
    <li
      v-for="item in items"
      :key="item.id"
      class="pending-photo-grid__tile"
      :class="{ 'pending-photo-grid__tile--error': previewFailed[item.id] || errors?.[item.id] }"
    >
      <img
        v-if="urls[item.id] && !previewFailed[item.id]"
        :src="urls[item.id]"
        :alt="item.file.name"
        class="pending-photo-grid__img"
        @error="previewFailed[item.id] = true"
      >
      <div
        v-else
        class="pending-photo-grid__fallback"
        role="alert"
      >
        <VIcon
          icon="ri-image-line"
          size="28"
        />
        <span class="text-caption">No se pudo generar la vista previa</span>
      </div>

      <VBtn
        class="pending-photo-grid__remove"
        icon="ri-close-line"
        size="x-small"
        color="error"
        variant="flat"
        :disabled="disabled"
        :aria-label="`Quitar ${item.file.name}`"
        @click="emit('remove', item.id)"
      />

      <div
        v-if="errors?.[item.id]"
        class="pending-photo-grid__message text-caption"
        role="alert"
      >
        {{ errors[item.id] }}
      </div>
    </li>
  </ul>
</template>

<style scoped>
.pending-photo-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  list-style: none;
  margin: 0;
  padding: 0;
}

.pending-photo-grid__tile {
  aspect-ratio: 1 / 1;
  background: rgba(var(--v-theme-on-surface), 0.06);
  border-radius: 8px;
  overflow: hidden;
  position: relative;
}

.pending-photo-grid__tile--error {
  outline: 2px solid rgb(var(--v-theme-error));
}

.pending-photo-grid__img {
  block-size: 100%;
  inline-size: 100%;
  object-fit: cover;
}

.pending-photo-grid__fallback {
  align-items: center;
  block-size: 100%;
  display: flex;
  flex-direction: column;
  gap: 4px;
  justify-content: center;
  padding: 8px;
  text-align: center;
}

.pending-photo-grid__remove {
  inset-block-start: 4px;
  inset-inline-end: 4px;
  position: absolute;
}

.pending-photo-grid__message {
  background: rgba(var(--v-theme-error), 0.92);
  color: rgb(var(--v-theme-on-error));
  inset-block-end: 0;
  inset-inline: 0;
  padding: 4px 6px;
  position: absolute;
}
</style>
