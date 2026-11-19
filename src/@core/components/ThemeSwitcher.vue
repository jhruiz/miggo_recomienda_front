<script setup lang="ts">
import { useTheme } from 'vuetify'
import type { ThemeSwitcherTheme } from '@layouts/types'

const props = defineProps<{
  themes: ThemeSwitcherTheme[]
}>()

const { name: themeName, global: globalTheme } = useTheme()
const { state: currentThemeName, next: getNextThemeName, index: currentThemeIndex } = useCycleList(props.themes.map(t => t.name), { initialValue: themeName })

// Nombre visible del tema en el tooltip
const themeLabels: Record<string, string> = {
  light: 'Claro',
  dark: 'Oscuro',
  system: 'Sistema',
}

const changeTheme = () => {
  globalTheme.name.value = getNextThemeName()
}

// Update icon if theme is changed from other sources
watch(() => globalTheme.name.value, val => {
  currentThemeName.value = val
})
</script>

<template>
  <IconBtn @click="changeTheme">
    <VIcon :icon="props.themes[currentThemeIndex].icon" />
    <VTooltip
      activator="parent"
      open-delay="1000"
      scroll-strategy="close"
    >
      <span class="text-capitalize">{{ themeLabels[currentThemeName] ?? currentThemeName }}</span>
    </VTooltip>
  </IconBtn>
</template>
