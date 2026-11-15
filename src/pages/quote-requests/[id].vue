<script setup lang="ts">
/**
 * Detalle de una solicitud de cotización.
 *
 * Pantalla pública de solo lectura que, además, ofrece acciones contextuales:
 *  - Para quien tiene rol de prestador: postular si la solicitud está "abierta"
 *    (Requisito 4.4).
 *  - Edición en línea de la solicitud mientras esté "abierta" (Requisito 4.2)
 *    y cierre manual (Requisito 4.7). Estas acciones de dueño las autoriza el
 *    backend (403 si no corresponde); aquí se exponen y se traduce el error.
 *  - Acceso a la vista de postulaciones del Cliente dueño (Requisito 4.4/4.5).
 *
 * Los datos provienen del store Pinia `quoteRequests`
 * (`GET /quote-requests/{id}`).
 *
 * `useRoute`, `useRouter`, `storeToRefs`, `ref`, `computed`, `watch` y
 * `onMounted` están disponibles por auto-import.
 */
import UserAvatar from '@/components/UserAvatar.vue'
import { useActiveRoleStore } from '@/stores/activeRole'
import { useAuthStore } from '@/stores/auth'
import { useLocationsStore } from '@/stores/locations'
import { useQuoteRequestsStore } from '@/stores/quoteRequests'
import { useServiceCategoriesStore } from '@/stores/serviceCategories'
import type { QuoteRequest } from '@/services'
import { validateReferenceImages } from '@/services/quoteRequests'

const route = useRoute()
const router = useRouter()
const store = useQuoteRequestsStore()
const activeRole = useActiveRoleStore()
const auth = useAuthStore()
const categoriesStore = useServiceCategoriesStore()
const locationsStore = useLocationsStore()
const { idOptions: categoryOptions, loading: categoriesLoading } = storeToRefs(categoriesStore)
const {
  countryOptions,
  departmentOptions,
  cityOptions,
  loading: locationsLoading,
} = storeToRefs(locationsStore)

const {
  current,
  currentLoading,
  currentError,
  saving,
  saveError,
  actionLoading,
  actionError,
} = storeToRefs(store)

const requestId = computed(() => Number(route.params.id))

const editing = ref(false)
const applied = ref(false)

const form = ref({
  title: '',
  description: '',
  service_category_id: null as number | null,
  country_id: null as number | null,
  department_id: null as number | null,
  city_id: null as number | null,
  location: '',
  estimated_budget: null as number | null,
})

// Opciones en cascada derivadas de la selección actual.
const departmentItems = computed(() =>
  form.value.country_id == null ? [] : departmentOptions.value(form.value.country_id),
)
const cityItems = computed(() =>
  form.value.department_id == null ? [] : cityOptions.value(form.value.department_id),
)

// País → reinicia departamento y ciudad, y carga los departamentos del país.
async function onCountryChange(countryId: number | null) {
  form.value.department_id = null
  form.value.city_id = null
  if (countryId != null)
    await locationsStore.ensureDepartments(countryId)
}

// Departamento → reinicia ciudad y carga las ciudades del departamento.
async function onDepartmentChange(departmentId: number | null) {
  form.value.city_id = null
  if (departmentId != null)
    await locationsStore.ensureCities(departmentId)
}

const statusColor: Record<string, string> = {
  abierta: 'success',
  en_proceso: 'warning',
  cerrada: 'secondary',
}

const isOpen = computed(() => current.value?.status === 'abierta')
const isOwner = computed(
  () => !!auth.user && current.value?.client_user_id === auth.user.id,
)
const canApply = computed(
  () => activeRole.hasProviderRole && isOpen.value && !isOwner.value,
)

function statusLabel(status?: string): string {
  return (status ?? '').replace('_', ' ')
}

function budgetText(value?: number | null): string {
  return value == null ? 'A convenir' : `$${value.toLocaleString('es-CO')}`
}

/**
 * Texto de ubicación para la vista de solo lectura: Ciudad, Departamento
 * (ubicación canónica) con la Dirección_Referencia opcional entre paréntesis.
 */
function locationText(request: QuoteRequest): string {
  const city = request.city
  const parts: string[] = []

  if (city) {
    parts.push(city.name)
    if (city.department)
      parts.push(city.department.name)
  }

  const canonical = parts.join(', ')

  if (request.location)
    return canonical ? `${canonical} (${request.location})` : request.location

  return canonical
}

const isEditValid = computed(() => {
  return (
    form.value.title.trim().length > 0
    && form.value.title.length <= 100
    && form.value.description.trim().length > 0
    && form.value.description.length <= 2000
    && form.value.service_category_id != null
    && form.value.service_category_id > 0
    && form.value.city_id != null
    && form.value.city_id > 0
    && form.value.location.length <= 255
    && (form.value.estimated_budget == null || form.value.estimated_budget >= 0)
  )
})

const requiredCityRule = (v: number | null) =>
  (v != null && v > 0) || 'La ciudad es obligatoria.'

/**
 * Rellena el formulario desde la solicitud actual. La ubicación canónica viene
 * anidada (`city.department.country`); de ella se derivan país, departamento y
 * ciudad, cargando las opciones necesarias. Filas heredadas sin `city` dejan
 * los selectores vacíos y conservan el texto de `location` si lo hubiera.
 */
async function syncForm() {
  if (!current.value)
    return

  const city = current.value.city
  const departmentId = city?.department_id ?? null
  const countryId = city?.department?.country_id ?? null

  form.value = {
    title: current.value.title,
    description: current.value.description,
    service_category_id: current.value.service_category_id,
    country_id: countryId,
    department_id: departmentId,
    city_id: current.value.city_id,
    location: current.value.location ?? '',
    estimated_budget: current.value.estimated_budget,
  }

  // Carga las opciones en cascada para que los selectores muestren el valor
  // preseleccionado (país → departamentos, departamento → ciudades).
  if (countryId != null)
    await locationsStore.ensureDepartments(countryId)
  if (departmentId != null)
    await locationsStore.ensureCities(departmentId)
}

// Imágenes de referencia nuevas (el tope de 5 cuenta las ya adjuntas).
const newImages = ref<File[]>([])
const imagesError = ref<string | null>(null)
const attachedCount = computed(() => current.value?.reference_images?.length ?? 0)

function onImagesChange(selected: File[] | File | null) {
  const files = Array.isArray(selected) ? selected : selected ? [selected] : []

  imagesError.value = validateReferenceImages(files, attachedCount.value)
  newImages.value = imagesError.value ? [] : files
}

// Galería de imágenes de referencia (Requisitos 4.15, 4.16).
const referenceImages = computed(() => current.value?.reference_images ?? [])
const canManageImages = computed(() => isOwner.value && isOpen.value)
const viewerOpen = ref(false)
const viewerUrl = ref<string | null>(null)
const galleryFiles = ref<File[]>([])
const galleryError = ref<string | null>(null)

function openViewer(url: string) {
  viewerUrl.value = url
  viewerOpen.value = true
}

function onGalleryFilesChange(selected: File[] | File | null) {
  const files = Array.isArray(selected) ? selected : selected ? [selected] : []

  galleryError.value = validateReferenceImages(files, attachedCount.value)
  galleryFiles.value = galleryError.value ? [] : files
}

async function addGalleryImages() {
  if (!galleryFiles.value.length || galleryError.value)
    return

  try {
    await store.addReferenceImages(requestId.value, galleryFiles.value)
    galleryFiles.value = []
  }
  catch {
    // El mensaje queda en `actionError` (403/409/422).
  }
}

async function removeGalleryImage(mediaId: number) {
  await store.removeReferenceImage(requestId.value, mediaId).catch(() => {})
}

function startEdit() {
  newImages.value = []
  imagesError.value = null
  syncForm()
  editing.value = true
}

function cancelEdit() {
  editing.value = false
}

async function saveEdit() {
  if (!isEditValid.value || imagesError.value)
    return

  try {
    await store.update(requestId.value, {
      title: form.value.title.trim(),
      description: form.value.description.trim(),
      service_category_id: form.value.service_category_id as number,
      city_id: form.value.city_id as number,
      department_id: form.value.department_id,
      location: form.value.location.trim() || null,
      estimated_budget: form.value.estimated_budget,
      reference_images: newImages.value,
    })
    editing.value = false
  }
  catch {
    // El mensaje queda en `saveError` (p. ej. 409 si ya no está abierta).
  }
}

async function closeRequest() {
  await store.close(requestId.value).catch(() => {})
}

async function applyToRequest() {
  try {
    await store.apply(requestId.value)
    applied.value = true
  }
  catch {
    // El mensaje queda en `actionError`.
  }
}

function goToApplications() {
  router.push(`/quote-requests/${requestId.value}/applications`)
}

function goToCreateQuote() {
  router.push({ path: '/quotes/new', query: { quote_request_id: requestId.value } })
}

function goToComparative() {
  router.push(`/quotes/request/${requestId.value}`)
}

onMounted(() => {
  store.fetchById(requestId.value).catch(() => {})
  activeRole.loadRoles().catch(() => {})
  categoriesStore.ensureLoaded()
  locationsStore.ensureCountries().catch(() => {})
})

watch(current, () => {
  syncForm().catch(() => {})
})
</script>

<template>
  <div>
    <VBtn
      variant="text"
      color="secondary"
      prepend-icon="ri-arrow-left-line"
      class="mb-4"
      to="/quote-requests"
    >
      Volver al listado
    </VBtn>

    <!-- Vista a tamaño completo de una imagen de referencia -->
    <VDialog
      v-model="viewerOpen"
      max-width="900"
    >
      <VCard>
        <VBtn
          icon="ri-close-line"
          variant="text"
          class="position-absolute"
          style="inset-block-start: 4px; inset-inline-end: 4px; z-index: 1;"
          aria-label="Cerrar"
          @click="viewerOpen = false"
        />
        <VImg
          v-if="viewerUrl"
          :src="viewerUrl"
          max-height="80vh"
          alt="Imagen de referencia a tamaño completo"
        />
      </VCard>
    </VDialog>

    <!-- Cargando -->
    <VCard v-if="currentLoading">
      <VCardText class="d-flex justify-center py-12">
        <VProgressCircular
          indeterminate
          color="primary"
          size="48"
        />
      </VCardText>
    </VCard>

    <!-- Error de carga -->
    <VAlert
      v-else-if="currentError"
      type="error"
      variant="tonal"
      border="start"
    >
      {{ currentError }}
    </VAlert>

    <template v-else-if="current">
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

      <VAlert
        v-if="applied"
        type="success"
        variant="tonal"
        border="start"
        closable
        class="mb-6"
      >
        Tu postulación se registró correctamente.
      </VAlert>

      <VRow>
        <VCol
          cols="12"
          md="8"
        >
          <!-- Vista de solo lectura -->
          <VCard v-if="!editing">
            <VCardText>
              <div class="d-flex align-center justify-space-between gap-2 mb-3">
                <h4 class="text-h4 mb-0">
                  {{ current.title }}
                </h4>
                <VChip
                  :color="statusColor[current.status] ?? 'secondary'"
                  variant="tonal"
                  class="text-capitalize"
                >
                  {{ statusLabel(current.status) }}
                </VChip>
              </div>

              <div class="d-flex flex-wrap gap-4 text-body-2 text-medium-emphasis mb-4">
                <span v-if="current.category">
                  <VIcon
                    icon="ri-price-tag-3-line"
                    size="16"
                  />
                  {{ current.category.name }}
                </span>
                <span v-if="current.city || current.location">
                  <VIcon
                    icon="ri-map-pin-line"
                    size="16"
                  />
                  {{ locationText(current) }}
                </span>
                <span>
                  <VIcon
                    icon="ri-money-dollar-circle-line"
                    size="16"
                  />
                  {{ budgetText(current.estimated_budget) }}
                </span>
                <span
                  v-if="current.client_name"
                  class="d-inline-flex align-center gap-2"
                >
                  <UserAvatar
                    :name="current.client_name"
                    :user-id="current.client_user_id"
                    :src="current.client_avatar_thumb_url ?? null"
                    :size="24"
                  />
                  {{ current.client_name }}
                </span>
              </div>

              <VDivider class="mb-4" />

              <p class="text-body-1" style="white-space: pre-line;">
                {{ current.description }}
              </p>

              <!-- Galería de imágenes de referencia -->
              <template v-if="referenceImages.length || canManageImages">
                <VDivider class="my-4" />
                <h6 class="text-h6 mb-3">
                  Imágenes de referencia ({{ referenceImages.length }}/5)
                </h6>

                <p
                  v-if="!referenceImages.length"
                  class="text-body-2 text-medium-emphasis"
                >
                  Aún no hay imágenes de referencia.
                </p>

                <VRow v-else dense>
                  <VCol
                    v-for="image in referenceImages"
                    :key="image.id"
                    cols="6"
                    sm="4"
                    md="3"
                  >
                    <div class="position-relative">
                      <VImg
                        :src="image.thumb_url ?? image.url"
                        aspect-ratio="1"
                        cover
                        class="rounded cursor-pointer"
                        alt="Imagen de referencia de la solicitud"
                        @click="openViewer(image.url)"
                      />
                      <VBtn
                        v-if="canManageImages"
                        icon="ri-delete-bin-line"
                        size="x-small"
                        color="error"
                        class="position-absolute"
                        style="inset-block-start: 4px; inset-inline-end: 4px;"
                        aria-label="Eliminar imagen"
                        :loading="actionLoading"
                        @click="removeGalleryImage(image.id)"
                      />
                    </div>
                  </VCol>
                </VRow>

                <!-- Dueño: agregar imágenes (solo si está abierta) -->
                <div
                  v-if="canManageImages && referenceImages.length < 5"
                  class="mt-4"
                >
                  <VFileInput
                    :key="referenceImages.length"
                    label="Agregar imágenes (JPG/PNG/WEBP, ≤10 MB)"
                    accept="image/jpeg,image/png,image/webp"
                    prepend-icon="ri-image-add-line"
                    multiple
                    chips
                    :hint="`Imágenes actuales: ${referenceImages.length} de 5`"
                    persistent-hint
                    :error-messages="galleryError ? [galleryError] : []"
                    @update:model-value="onGalleryFilesChange"
                  />
                  <VBtn
                    class="mt-3"
                    color="primary"
                    variant="tonal"
                    prepend-icon="ri-upload-2-line"
                    :loading="actionLoading"
                    :disabled="!galleryFiles.length || !!galleryError"
                    @click="addGalleryImages"
                  >
                    Subir imágenes
                  </VBtn>
                </div>
              </template>
            </VCardText>
          </VCard>

          <!-- Edición en línea (dueño; solo mientras esté "abierta") -->
          <VCard v-else>
            <VCardItem>
              <VCardTitle>Editar solicitud</VCardTitle>
            </VCardItem>
            <VCardText>
              <VAlert
                v-if="saveError"
                type="error"
                variant="tonal"
                border="start"
                class="mb-6"
              >
                {{ saveError }}
              </VAlert>

              <VForm @submit.prevent="saveEdit">
                <VRow>
                  <VCol cols="12">
                    <VTextField
                      v-model="form.title"
                      label="Título"
                      counter="100"
                      maxlength="100"
                    />
                  </VCol>
                  <VCol cols="12">
                    <VTextarea
                      v-model="form.description"
                      label="Descripción del servicio"
                      rows="5"
                      counter="2000"
                      maxlength="2000"
                    />
                  </VCol>
                  <VCol
                    cols="12"
                    md="6"
                  >
                    <VSelect
                      v-model="form.service_category_id"
                      label="Categoría de servicio"
                      :items="categoryOptions"
                      :loading="categoriesLoading"
                    />
                  </VCol>
                  <VCol
                    cols="12"
                    md="4"
                  >
                    <VSelect
                      v-model="form.country_id"
                      label="País"
                      placeholder="Selecciona un país"
                      :items="countryOptions"
                      :loading="locationsLoading"
                      @update:model-value="onCountryChange"
                    />
                  </VCol>
                  <VCol
                    cols="12"
                    md="4"
                  >
                    <VSelect
                      v-model="form.department_id"
                      label="Departamento"
                      placeholder="Selecciona un departamento"
                      :items="departmentItems"
                      :loading="locationsLoading"
                      :disabled="form.country_id == null"
                      @update:model-value="onDepartmentChange"
                    />
                  </VCol>
                  <VCol
                    cols="12"
                    md="4"
                  >
                    <VSelect
                      v-model="form.city_id"
                      label="Ciudad"
                      placeholder="Selecciona una ciudad"
                      :items="cityItems"
                      :loading="locationsLoading"
                      :disabled="form.department_id == null"
                      :rules="[requiredCityRule]"
                    />
                  </VCol>
                  <VCol cols="12">
                    <VTextField
                      v-model="form.location"
                      label="Dirección de referencia (opcional)"
                      placeholder="Ej. Barrio, calle, punto de referencia"
                      counter="255"
                      maxlength="255"
                    />
                  </VCol>
                  <VCol
                    cols="12"
                    md="6"
                  >
                    <VTextField
                      v-model.number="form.estimated_budget"
                      label="Presupuesto estimado (opcional)"
                      type="number"
                      min="0"
                      prefix="$"
                    />
                  </VCol>
                  <VCol cols="12">
                    <VFileInput
                      label="Agregar imágenes de referencia (JPG/PNG/WEBP, ≤10 MB)"
                      accept="image/jpeg,image/png,image/webp"
                      prepend-icon="ri-image-add-line"
                      multiple
                      chips
                      :hint="`Imágenes actuales: ${attachedCount} de 5`"
                      persistent-hint
                      :disabled="attachedCount >= 5"
                      :error-messages="imagesError ? [imagesError] : []"
                      @update:model-value="onImagesChange"
                    />
                  </VCol>
                  <VCol
                    cols="12"
                    class="d-flex flex-wrap gap-3"
                  >
                    <VBtn
                      type="submit"
                      color="primary"
                      prepend-icon="ri-save-line"
                      :loading="saving"
                      :disabled="!isEditValid"
                    >
                      Guardar cambios
                    </VBtn>
                    <VBtn
                      variant="tonal"
                      color="secondary"
                      @click="cancelEdit"
                    >
                      Cancelar
                    </VBtn>
                  </VCol>
                </VRow>
              </VForm>
            </VCardText>
          </VCard>
        </VCol>

        <!-- Panel de acciones -->
        <VCol
          cols="12"
          md="4"
        >
          <VCard>
            <VCardItem>
              <VCardTitle>Acciones</VCardTitle>
            </VCardItem>
            <VCardText class="d-flex flex-column gap-3">
              <!-- Prestador: postular -->
              <VBtn
                v-if="canApply"
                color="success"
                prepend-icon="ri-send-plane-line"
                :loading="actionLoading"
                :disabled="applied"
                block
                @click="applyToRequest"
              >
                {{ applied ? 'Ya postulaste' : 'Postular a esta solicitud' }}
              </VBtn>

              <!-- Prestador: enviar cotización -->
              <VBtn
                v-if="canApply"
                color="primary"
                variant="tonal"
                prepend-icon="ri-file-add-line"
                block
                @click="goToCreateQuote"
              >
                Enviar cotización
              </VBtn>

              <!-- Dueño: gestionar postulaciones -->
              <VBtn
                v-if="isOwner"
                color="primary"
                variant="tonal"
                prepend-icon="ri-team-line"
                block
                @click="goToApplications"
              >
                Ver postulaciones
              </VBtn>

              <!-- Dueño: ver cotizaciones recibidas (vista comparativa) -->
              <VBtn
                v-if="isOwner"
                color="primary"
                variant="tonal"
                prepend-icon="ri-file-list-3-line"
                block
                @click="goToComparative"
              >
                Ver cotizaciones
              </VBtn>

              <!-- Dueño: editar (solo si está abierta) -->
              <VBtn
                v-if="isOwner && isOpen && !editing"
                color="primary"
                variant="tonal"
                prepend-icon="ri-edit-line"
                block
                @click="startEdit"
              >
                Editar solicitud
              </VBtn>

              <!-- Dueño: cerrar (solo si está abierta) -->
              <VBtn
                v-if="isOwner && isOpen"
                color="error"
                variant="tonal"
                prepend-icon="ri-close-circle-line"
                :loading="actionLoading"
                block
                @click="closeRequest"
              >
                Cerrar solicitud
              </VBtn>

              <p
                v-if="!canApply && !isOwner"
                class="text-body-2 text-medium-emphasis mb-0"
              >
                No hay acciones disponibles para esta solicitud.
              </p>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>
    </template>
  </div>
</template>
