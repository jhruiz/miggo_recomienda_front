/**
 * Store Pinia del catálogo de ubicaciones en cascada (tarea 19.5,
 * Requisitos 15.4, 15.5, 15.6).
 *
 * Cachea países, departamentos (por país) y ciudades (por departamento) para
 * que los selectores en cascada de las vistas (formularios y filtros) los
 * reutilicen sin repetir peticiones. Los loaders son idempotentes: cargan una
 * sola vez por clave y comparten la promesa en vuelo si varias vistas piden el
 * mismo recurso a la vez. Ante error resuelven a [] y no lanzan, para que la UI
 * degrade con elegancia (mismo estilo que el store de categorías de servicio).
 *
 * defineStore, ref y computed están disponibles por auto-import.
 */
import { locationsService } from '@/services'
import type { City, Country, Department } from '@/services'

export const useLocationsStore = defineStore('locations', () => {
  const countries = ref<Country[]>([])
  const departmentsByCountry = ref<Record<number, Department[]>>({})
  const citiesByDepartment = ref<Record<number, City[]>>({})
  const loading = ref(false)

  const countriesLoaded = ref(false)

  // Promesas en vuelo para compartir cargas concurrentes y evitar duplicados.
  let countriesInFlight: Promise<Country[]> | null = null
  const departmentsInFlight: Record<number, Promise<Department[]>> = {}
  const citiesInFlight: Record<number, Promise<City[]>> = {}

  // Opciones para un VSelect de países (value = id del país).
  const countryOptions = computed(() =>
    countries.value.map(c => ({ title: c.name, value: c.id })),
  )

  // Opciones de departamentos para un país dado (value = id del departamento).
  // Devuelve [] si aún no se han cargado los departamentos de ese país.
  const departmentOptions = computed(() => (countryId: number) =>
    (departmentsByCountry.value[countryId] ?? []).map(d => ({ title: d.name, value: d.id })),
  )

  // Opciones de ciudades para un departamento dado (value = id de la ciudad).
  // Devuelve [] si aún no se han cargado las ciudades de ese departamento.
  const cityOptions = computed(() => (departmentId: number) =>
    (citiesByDepartment.value[departmentId] ?? []).map(c => ({ title: c.name, value: c.id })),
  )

  /** Carga el catálogo de países una sola vez (idempotente). */
  async function ensureCountries() {
    if (countriesLoaded.value)
      return countries.value
    if (countriesInFlight)
      return countriesInFlight

    loading.value = true
    countriesInFlight = locationsService.countries()
      .then(list => {
        countries.value = list
        countriesLoaded.value = true

        return list
      })
      .catch(() => {
        return []
      })
      .finally(() => {
        loading.value = false
        countriesInFlight = null
      })

    return countriesInFlight
  }

  /** Carga y cachea los departamentos de un país una sola vez (idempotente). */
  async function ensureDepartments(countryId: number) {
    if (departmentsByCountry.value[countryId])
      return departmentsByCountry.value[countryId]
    if (departmentsInFlight[countryId])
      return departmentsInFlight[countryId]

    loading.value = true
    departmentsInFlight[countryId] = locationsService.departments(countryId)
      .then(list => {
        departmentsByCountry.value = { ...departmentsByCountry.value, [countryId]: list }

        return list
      })
      .catch(() => {
        return []
      })
      .finally(() => {
        loading.value = false
        delete departmentsInFlight[countryId]
      })

    return departmentsInFlight[countryId]
  }

  /** Carga y cachea las ciudades de un departamento una sola vez (idempotente). */
  async function ensureCities(departmentId: number) {
    if (citiesByDepartment.value[departmentId])
      return citiesByDepartment.value[departmentId]
    if (citiesInFlight[departmentId])
      return citiesInFlight[departmentId]

    loading.value = true
    citiesInFlight[departmentId] = locationsService.cities(departmentId)
      .then(list => {
        citiesByDepartment.value = { ...citiesByDepartment.value, [departmentId]: list }

        return list
      })
      .catch(() => {
        return []
      })
      .finally(() => {
        loading.value = false
        delete citiesInFlight[departmentId]
      })

    return citiesInFlight[departmentId]
  }

  return {
    countries,
    departmentsByCountry,
    citiesByDepartment,
    loading,
    countriesLoaded,
    countryOptions,
    departmentOptions,
    cityOptions,
    ensureCountries,
    ensureDepartments,
    ensureCities,
  }
})

export default useLocationsStore
