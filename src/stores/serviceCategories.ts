/**
 * Store Pinia del catalogo de categorias de servicio (tarea 18.2).
 *
 * Cachea el catalogo para que las distintas vistas (creacion/edicion de
 * solicitudes y filtros de listados) lo reutilicen sin repetir la peticion.
 * ensureLoaded() es idempotente: carga una sola vez y comparte la promesa en
 * vuelo si varias vistas lo piden a la vez.
 *
 * defineStore, ref y computed estan disponibles por auto-import.
 */
import { serviceCategoriesService } from '@/services'
import type { ServiceCategory } from '@/services'

export const useServiceCategoriesStore = defineStore('serviceCategories', () => {
  const categories = ref<ServiceCategory[]>([])
  const loading = ref(false)
  const loaded = ref(false)

  let inFlight: Promise<ServiceCategory[]> | null = null

  // Opciones para un VSelect que envia el id (solicitudes).
  const idOptions = computed(() =>
    categories.value.map(c => ({ title: c.name, value: c.id })),
  )

  // Opciones para un VSelect que envia el slug (filtros).
  const slugOptions = computed(() =>
    categories.value.map(c => ({ title: c.name, value: c.slug })),
  )

  async function ensureLoaded() {
    if (loaded.value)
      return categories.value
    if (inFlight)
      return inFlight

    loading.value = true
    inFlight = serviceCategoriesService.list()
      .then(list => {
        categories.value = list
        loaded.value = true

        return list
      })
      .catch(() => {
        return []
      })
      .finally(() => {
        loading.value = false
        inFlight = null
      })

    return inFlight
  }

  return {
    categories,
    loading,
    loaded,
    idOptions,
    slugOptions,
    ensureLoaded,
  }
})

export default useServiceCategoriesStore
