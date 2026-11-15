<script setup lang="ts">
import { ref, watch } from 'vue'
import { avatarAlt, avatarColor, getInitials } from '@/utils/avatar'

interface Props {
  name?: string | null
  userId?: number | null
  src?: string | null
  size?: number | string
}

const props = withDefaults(defineProps<Props>(), {
  name: null,
  userId: null,
  src: null,
  size: 40,
})

const failed = ref(false)

watch(() => props.src, () => {
  failed.value = false
})
</script>

<template>
  <VAvatar
    v-if="src && !failed"
    :size="size"
  >
    <VImg
      :src="src"
      :alt="avatarAlt(name)"
      cover
      @error="failed = true"
    />
  </VAvatar>

  <VAvatar
    v-else
    :size="size"
    :color="avatarColor(userId)"
    variant="flat"
    role="img"
    :aria-label="avatarAlt(name)"
  >
    <span
      v-if="getInitials(name)"
      class="font-weight-medium"
    >{{ getInitials(name) }}</span>
    <VIcon
      v-else
      icon="ri-user-3-line"
    />
  </VAvatar>
</template>
