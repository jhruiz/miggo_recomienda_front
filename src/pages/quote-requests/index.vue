<script setup lang="ts">
/**
 * Listado y filtrado público de solicitudes de cotización (Requisito 4.3).
 *
 * Pantalla con filtros (categoría por slug, ubicación y rango de presupuesto)
 * y paginación. Útil para que los prestadores naveguen las solicitudes
 * abiertas y postulen (Requisito 4.4) sin salir del listado. Los clientes
 * pueden crear una nueva solicitud desde el botón de la cabecera (Requisito
 * 4.1). Una lista vacía NO es un error: se muestra el mensaje informativo que
 * devuelve el backend.
 *
 * Los datos y la metadata de paginación provienen del store Pinia
 * `quoteRequests`, que consume `GET /quote-requests`.
 *
 * `useRouter`, `storeToRefs`, `ref`, `computed` y `onMounted` están disponibles
 * por auto-import.
 */
import { useActiveRoleStore } from '@/stores/activeRole'
import { useAuthStore } from '@/stores/auth'
import { useLocationsStore } from '@/stores/locations'
import { useQuoteRequestsStore } from '@/stores/quoteRequests'
import { useServiceCategoriesStore } from '@/stores/serviceCategories'

const router = useRouter()
const store = useQuoteRequestsStore()
const activeRole = useActiveRoleStore()
const auth = useAuthStore()
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
  actionLoading,
  actionError,
} = storeToRefs(store)

// Modelo local de los filtros del formulario. Se sincroniza con el store al
// aplicar la búsqueda para evitar recargas en cada tecleo. La ubicación se
// elige desde el Catálogo_Ubicación mediante selectores dependientes
// (Departamento → Ciudad), no como texto libre.
const form = ref({
  category: '',
  department_id: null as number | null,
  city_id: null as number | null,
  budget_min: null as number | null,
  budget_max: null as number | null,
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

/** Postulación aplicada con éxito (feedback efímero) y la que está en curso. */
const applyingId = ref<number | null>(null)
const appliedIds = ref<number[]>([])

const budgetError = computed(() => {
  const min = form.value.budget_min
  const max = form.value.budget_max
  if (min != null && min < 0)
    return 'El presupuesto mínimo no puede ser negativo.'
  if (max != null && max < 0)
    return 'El presupuesto máximo no puede ser negativo.'
  if (min != null && max != null && min > max)
    return 'El presupuesto mínimo no puede ser mayor que el máximo.'

  return null
})

const pageInfo = computed(() => {
  const { currentPage, lastPage, total } = pagination.value

  return `Página ${currentPage} de ${lastPage} · ${total} solicitud${total === 1 ? '' : 'es'}`
})

const statusColor: Record<string, string> = {
  abierta: 'success',
  en_proceso: 'warning',
  cerrada: 'secondary',
}

function statusLabel(status: string): string {
  return (status ?? '').replace('_', ' ')
}

function budgetText(value: number | null): string {
  return value == null ? 'A convenir' : `$${value.toLocaleString('es-CO')}`
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
  if (budgetError.value)
    return

  await store.applyFilters({
    category: form.value.category.trim() || null,
    department_id: form.value.department_id,
    city_id: form.value.city_id,
    budget_min: form.value.budget_min,
    budget_max: form.value.budget_max,
  }).catch(() => {})
}

async function clearFilters() {
  form.value = {
    category: '',
    department_id: null,
    city_id: null,
    budget_min: null,
    budget_max: null,
  }
  await store.resetFilters().catch(() => {})
}

/** La solicitud pertenece al usuario autenticado (no puede postular a ella). */
function isOwn(request: { client_user_id?: number | null }): boolean {
  return !!auth.user && request.client_user_id === auth.user.id
}

function goToDetail(id: number) {
  router.push(`/quote-requests/${id}`)
}

function goToCreate() {
  router.push('/quote-requests/new')
}

/** Postula el prestador a la solicitud (Requisito 4.4). */
async function applyTo(id: number) {
  applyingId.value = id
  try {
    await store.apply(id)
    if (!appliedIds.value.includes(id))
      appliedIds.value = [...appliedIds.value, id]
  }
  catch {
    // El mensaje de error queda en `actionError` (p. ej. postulación duplicada).
  }
  finally {
    applyingId.value = null
  }
}

onMounted(async () => {
  store.fetchList(1).catch(() => {})
  categoriesStore.ensureLoaded()
  // Para habilitar/condicionar el botón de postular según si el usuario tiene rol de prestador.
  activeRole.loadRoles().catch(() => {})

  // Resolver el país (único: Colombia) y precargar sus departamentos para que
  // el selector de Departamento esté listo.
  const countries = await locationsStore.ensureCountries().catch(() => [])
  if (countries.length > 0) {
    countryId.value = countries[0].id
    locationsStore.ensureDepartments(countryId.value).catch(() => {})
  }
})
</script>

<template>
  <div>
    <div class="d-flex flex-wrap align-center justify-space-between gap-3 mb-6">
      <div>
        <h4 class="text-h4 mb-1">
          Solicitudes de cotización
        </h4>
        <span class="text-body-1 text-medium-emphasis">
          Explora las solicitudes abiertas y postúlate a las que te interesen.
        </span>
      </div>
      <VBtn
        color="primary"
        prepend-icon="ri-add-line"
        @click="goToCreate"
      >
        Nueva solicitud
      </VBtn>
    </div>

    <!-- Filtros -->
    <VCard class="mb-6">
      <VCardText>
        <VForm @submit.prevent="applyFilters">
          <VRow>
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
              md="3"
            >
              <VTextField
                v-model.number="form.budget_min"
                label="Presupuesto mín."
                type="number"
                min="0"
                prefix="$"
              />
            </VCol>

            <VCol
              cols="6"
              md="3"
            >
              <VTextField
                v-model.number="form.budget_max"
                label="Presupuesto máx."
                type="number"
                min="0"
                prefix="$"
                :error-messages="budgetError ? [budgetError] : []"
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

    <!-- Error de postulación (p. ej. duplicada o solicitud no abierta) -->
    <VAlert
      v-if="actionError"
      type="warning"
      variant="tonal"
      border="start"
      closable
      class="mb-6"
    >
      {{ actionError }}
    </VAlert>

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

    <!-- Lista vacía con mensaje (no es error) -->
    <VCard v-else-if="isEmptyList">
      <VCardText class="text-center py-12">
        <VIcon
          icon="ri-file-list-3-line"
          size="48"
          color="disabled"
          class="mb-3"
        />
        <p class="text-body-1 mb-0">
          {{ listMessage ?? 'No se encontraron solicitudes que coincidan con los filtros.' }}
        </p>
      </VCardText>
    </VCard>

    <!-- Resultados -->
    <template v-else>
      <VRow>
        <VCol
          v-for="request in list"
          :key="request.id"
          cols="12"
          md="6"
        >
          <VCard class="h-100">
            <VCardText>
              <div class="d-flex align-center justify-space-between gap-2 mb-2">
                <h6 class="text-h6 mb-0">
                  {{ request.title }}
                </h6>
                <VChip
                  size="small"
                  :color="statusColor[request.status] ?? 'secondary'"
                  variant="tonal"
                  class="text-capitalize"
                >
                  {{ statusLabel(request.status) }}
                </VChip>
              </div>

              <div class="d-flex flex-wrap gap-3 text-caption text-medium-emphasis mb-3">
                <span v-if="request.category">
                  <VIcon
                    icon="ri-price-tag-3-line"
                    size="14"
                  />
                  {{ request.category.name }}
                </span>
                <span v-if="request.location">
                  <VIcon
                    icon="ri-map-pin-line"
                    size="14"
                  />
                  {{ request.location }}
                </span>
                <span>
                  <VIcon
                    icon="ri-money-dollar-circle-line"
                    size="14"
                  />
                  {{ budgetText(request.estimated_budget) }}
                </span>
              </div>

              <p class="text-body-2 text-medium-emphasis mb-4 line-clamp-2">
                {{ request.description }}
              </p>

              <VDivider class="mb-3" />

              <div class="d-flex flex-wrap align-center gap-2">
                <VBtn
                  size="small"
                  variant="tonal"
                  color="primary"
                  prepend-icon="ri-eye-line"
                  @click="goToDetail(request.id)"
                >
                  Ver detalle
                </VBtn>

                <VChip
                  v-if="isOwn(request)"
                  size="small"
                  color="info"
                  variant="tonal"
                >
                  Tu solicitud
                </VChip>

                <VBtn
                  v-if="activeRole.hasProviderRole && request.status === 'abierta' && !isOwn(request)"
                  size="small"
                  color="success"
                  prepend-icon="ri-send-plane-line"
                  :loading="actionLoading && applyingId === request.id"
                  :disabled="appliedIds.includes(request.id)"
                  @click="applyTo(request.id)"
                >
                  {{ appliedIds.includes(request.id) ? 'Postulado' : 'Postular' }}
                </VBtn>
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
          @update:model-value="store.goToPage($event)"
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
