/**
 * Store base de ejemplo.
 *
 * Sirve como plantilla del patrón de store por dominio del proyecto. No
 * contiene lógica de negocio: los stores reales (`auth`, `profile`, `quotes`,
 * `jobs`, `chat`, `notifications`) se implementarán en tareas posteriores
 * siguiendo esta misma estructura (Setup Store con Composition API).
 *
 * `defineStore` está disponible por auto-import de Pinia (ver vite.config.ts),
 * por lo que no es necesario importarlo.
 */
export const useAppStore = defineStore('app', () => {
  // Estado base de la aplicación (placeholder).
  const isReady = ref(false)

  function markReady() {
    isReady.value = true
  }

  return {
    isReady,
    markReady,
  }
})
