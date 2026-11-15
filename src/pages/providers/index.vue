<script setup lang="ts">
/**
 * Listado y búsqueda pública de prestadores (Requisitos 13.1, 13.2, 13.6).
 *
 * Pantalla con filtros (categoría por slug, ubicación, rango de calificación y
 * término de búsqueda por nombre/descripción) y paginación. Los resultados y
 * la metadata de paginación provienen del store Pinia `providers`, que consume
 * `GET /providers`. Una lista vacía NO es un error: se muestra el mensaje
 * informativo que devuelve el backend (Requisito 13.6).
 *
 * `useRouter`, `storeToRefs`, `ref`, `computed` y `onMounted` están disponibles
 * por auto-import.
 */
import UserAvatar from '@/components/UserAvatar.vue'
import { useLocationsStore } from '@/stores/locations'
import { useProvidersStore } from '@/stores/providers'
import { useServiceCategoriesStore } from '@/stores/serviceCategories'

const router = useRouter()
const providersStore = useProvidersStore()
const categoriesStore = useServiceCategoriesStore()
const locationsStore = useLocationsStore()
const { slugOptions: categoryOptions, loading: categoriesLoading } = storeToRefs(categoriesStore)
const { loading: locationsLoading } = storeToRefs(locationsStore)

const {
  list,
  pagination,
  listMessage,
  listLoading,
  listError,
  isEmptyList,
} = storeToRefs(providersStore)

// Modelo local de los filtros del formulario. Se sincroniza con el store al
// aplicar la búsqueda para evitar recargas en cada tecleo. La ubicación se
// elige desde el Catálogo_Ubicación mediante selectores dependientes
// (Departamento → Ciudad), no como texto libre (Requisitos 13.2, 13.8, 13.9).
const form = ref({
  search: '',
  category: '',
  department_id: null as number | null,
  city_id: null as number | null,
  rating_min: null as number | null,
  rating_max: null as number | null,
})

// País resuelto del catálogo. El catálogo tiene un único país (Colombia), así
// que no se muestra un selector de país en los filtros: se resuelve su id al
// montar y los departamentos se cargan a partir de él.
const countryId = ref<number | null>(null)

// Opciones de los selectores en cascada derivadas del store de ubicaciones.
const departmentOptions = computed(() =>
  countryId.value == null ? [] : locationsStore.departmentOptions(countryId.value),
)
const cityOptions = computed(() =>
  form.value.department_id == null ? [] : locationsStore.cityOptions(form.value.department_id),
)

const ratingOptions = [
  { title: 'Cualquiera', value: null },
  { title: '1.0+', value: 1 },
  { title: '2.0+', value: 2 },
  { title: '3.0+', value: 3 },
  { title: '4.0+', value: 4 },
  { title: '4.5+', value: 4.5 },
]

/** El término de búsqueda debe tener 2-100 caracteres (lo valida el backend). */
const searchError = computed(() => {
  const value = form.value.search.trim()
  if (value.length === 0)
    return null

  return value.length < 2 || value.length > 100
    ? 'El término de búsqueda debe tener entre 2 y 100 caracteres.'
    : null
})

const pageInfo = computed(() => {
  const { currentPage, lastPage, total } = pagination.value

  return `Página ${currentPage} de ${lastPage} · ${total} prestador${total === 1 ? '' : 'es'}`
})

function ratingText(value: number | string): string {
  return typeof value === 'number' ? value.toFixed(1) : value
}

function complianceText(value: number | string): string {
  return typeof value === 'number' ? `${value}%` : value
}

/**
 * Al cambiar el Departamento se reinicia la Ciudad y se cargan (perezosamente)
 * sus ciudades. La Ciudad queda deshabilitada hasta que haya un Departamento.
 */
function onDepartmentChange(departmentId: number | null) {
  form.value.city_id = null
  if (departmentId != null)
    locationsStore.ensureCities(departmentId).catch(() => {})
}

async function applyFilters() {
  if (searchError.value)
    return

  await providersStore.applyFilters({
    search: form.value.search.trim() || null,
    category: form.value.category.trim() || null,
    department_id: form.value.department_id,
    city_id: form.value.city_id,
    rating_min: form.value.rating_min,
    rating_max: form.value.rating_max,
  }).catch(() => {})
}

async function clearFilters() {
  form.value = {
    search: '',
    category: '',
    department_id: null,
    city_id: null,
    rating_min: null,
    rating_max: null,
  }
  await providersStore.resetFilters().catch(() => {})
}

function goToProfile(id: number) {
  router.push(`/providers/${id}`)
}

onMounted(async () => {
  providersStore.fetchList(1).catch(() => {})
  categoriesStore.ensureLoaded()

  // Resolver el país (único: Colombia) y precargar sus departamentos para que
  // el selector de Departamento esté listo (Requisito 13.8).
  const countries = await locationsStore.ensureCountries().catch(() => [])
  if (countries.length > 0) {
    countryId.value = countries[0].id
    locationsStore.ensureDepartments(countryId.value).catch(() => {})
  }
})
</script>

<template>
  <div>
    <div class="mb-6">
      <h4 class="text-h4 mb-1">
        Buscar prestadores
      </h4>
      <span class="text-body-1 text-medium-emphasis">
        Encuentra profesionales por categoría, ubicación y calificación.
      </span>
    </div>

    <!-- Filtros -->
    <VCard class="mb-6">
      <VCardText>
        <VForm @submit.prevent="applyFilters">
          <VRow>
            <VCol
              cols="12"
              md="4"
            >
              <VTextField
                v-model="form.search"
                label="Buscar"
                placeholder="Nombre o descripción"
                prepend-inner-icon="ri-search-line"
                clearable
                :error-messages="searchError ? [searchError] : []"
              />
            </VCol>

            <VCol
              cols="12"
              sm="6"
              md="3"
            >
              <VSelect
                v-model="form.category"
                label="Categoría"
                placeholder="Todas las categorías"
                :items="categoryOptions"
                :loading="categoriesLoading"
                clearable
              />
            </VCol>

            <VCol
              cols="12"
              sm="6"
              md="3"
            >
              <VSelect
                v-model="form.department_id"
                label="Departamento"
                placeholder="Todos los departamentos"
                :items="departmentOptions"
                :loading="locationsLoading"
                clearable
                @update:model-value="onDepartmentChange"
              />
            </VCol>

            <VCol
              cols="12"
              sm="6"
              md="3"
            >
              <VSelect
                v-model="form.city_id"
                label="Ciudad"
                :placeholder="form.department_id == null ? 'Elige un departamento primero' : 'Todas las ciudades'"
                :items="cityOptions"
                :loading="locationsLoading"
                :disabled="form.department_id == null"
                clearable
              />
            </VCol>

            <VCol
              cols="6"
              md="2"
            >
              <VSelect
                v-model="form.rating_min"
                label="Calificación mín."
                :items="ratingOptions"
              />
            </VCol>

            <VCol
              cols="12"
              class="d-flex flex-wrap gap-3"
            >
              <VBtn
                type="submit"
                color="primary"
                prepend-icon="ri-filter-3-line"
                :loading="listLoading"
              >
                Aplicar filtros
              </VBtn>
              <VBtn
                variant="tonal"
                color="secondary"
                prepend-icon="ri-close-line"
                @click="clearFilters"
              >
                Limpiar
              </VBtn>
            </VCol>
          </VRow>
        </VForm>
      </VCardText>
    </VCard>

    <!-- Error de carga -->
    <VAlert
      v-if="listError"
      type="error"
      variant="tonal"
      border="start"
      class="mb-6"
    >
      {{ listError }}
    </VAlert>

    <!-- Cargando -->
    <VCard v-if="listLoading">
      <VCardText class="d-flex justify-center py-12">
        <VProgressCircular
          indeterminate
          color="primary"
          size="48"
        />
      </VCardText>
    </VCard>

    <!-- Lista vacía con mensaje (no es error, Requisito 13.6) -->
    <VCard v-else-if="isEmptyList">
      <VCardText class="text-center py-12">
        <VIcon
          icon="ri-search-eye-line"
          size="48"
          color="disabled"
          class="mb-3"
        />
        <p class="text-body-1 mb-0">
          {{ listMessage ?? 'No se encontraron prestadores que coincidan con los criterios de búsqueda.' }}
        </p>
      </VCardText>
    </VCard>

    <!-- Resultados -->
    <template v-else>
      <VRow>
        <VCol
          v-for="provider in list"
          :key="provider.id"
          cols="12"
          sm="6"
          lg="4"
        >
          <VCard
            class="h-100"
            link
            @click="goToProfile(provider.id)"
          >
            <VCardText>
              <div class="d-flex align-center gap-3 mb-3">
                <UserAvatar
                  :name="provider.name"
                  :user-id="provider.user_id"
                  :src="provider.avatar_thumb_url"
                  :size="48"
                />
                <div class="flex-grow-1">
                  <h6 class="text-h6 mb-0">
                    {{ provider.name ?? 'Prestador' }}
                  </h6>
                  <span
                    v-if="provider.location"
                    class="text-caption text-medium-emphasis"
                  >
                    <VIcon
                      icon="ri-map-pin-line"
                      size="14"
                    />
                    {{ provider.location }}
                  </span>
                </div>
              </div>

              <p
                v-if="provider.professional_description"
                class="text-body-2 text-medium-emphasis mb-3 line-clamp-2"
              >
                {{ provider.professional_description }}
              </p>

              <div class="d-flex flex-wrap gap-1 mb-3">
                <VChip
                  v-for="category in provider.categories.slice(0, 3)"
                  :key="category.id"
                  size="x-small"
                  color="primary"
                  variant="tonal"
                >
                  {{ category.name }}
                </VChip>
              </div>

              <VDivider class="mb-3" />

              <div class="d-flex align-center justify-space-between text-body-2">
                <span class="d-flex align-center gap-1">
                  <VIcon
                    icon="ri-star-fill"
                    size="16"
                    color="warning"
                  />
                  {{ ratingText(provider.average_rating) }}
                </span>
                <span class="text-medium-emphasis">
                  Cumplimiento: {{ complianceText(provider.compliance_index) }}
                </span>
              </div>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>

      <!-- Paginación -->
      <div class="d-flex align-center justify-space-between flex-wrap gap-3 mt-6">
        <span class="text-body-2 text-medium-emphasis">{{ pageInfo }}</span>
        <VPagination
          :model-value="pagination.currentPage"
          :length="pagination.lastPage"
          :total-visible="5"
          density="comfortable"
          @update:model-value="providersStore.goToPage($event)"
        />
      </div>
    </template>
  </div>
</template>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
