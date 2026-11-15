import { fileURLToPath } from 'node:url'
import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

// Reutiliza vite.config.ts (alias `@`, auto-import, componentes y Vuetify)
// y añade solo la configuración de pruebas.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      include: ['src/**/*.{test,spec}.ts'],
      root: fileURLToPath(new URL('./', import.meta.url)),
      server: {
        deps: {
          // Vuetify publica ESM con imports de CSS; hay que procesarlo con Vite.
          inline: ['vuetify'],
        },
      },
    },
  }),
)
