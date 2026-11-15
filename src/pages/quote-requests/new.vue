<script setup lang="ts">
/**
 * Creación de una solicitud de cotización por el Cliente (Requisitos 4.1, 4.2).
 *
 * Formulario con los campos que valida el backend: título (≤100), descripción
 * del servicio (≤2000), categoría de servicio (id), ubicación y presupuesto
 * estimado opcional. El estado inicial de la solicitud es "abierta" (lo asigna
 * el backend). Al crear con éxito se redirige al detalle de la solicitud.
 *
 * La escritura va a través del store Pinia `quoteRequests`
 * (`POST /quote-requests`). Los errores de validación 422 del backend se
 * muestran en la UI.
 *
 * `useRouter`, `storeToRefs`, `ref`, `computed` están disponibles por
 * auto-import.
 */
import { useLocationsStore } from '@/stores/locations'
import { useQuoteRequestsStore } from '@/stores/quoteRequests'
import { useServiceCategoriesStore } from '@/stores/serviceCategories'
import { validateReferenceImages } from '@/services/quoteRequests'

const router = useRouter()
const store = useQuoteRequestsStore()
const categoriesStore = useServiceCategoriesStore()
const locationsStore = useLocationsStore()

const { saving, saveError } = storeToRefs(store)
const { idOptions: categoryOptions, loading: categoriesLoading } = storeToRefs(categoriesStore)
const {
  countryOptions,
  departmentOptions,
  cityOptions,
  loading: locationsLoading,
} = storeToRefs(locationsStore)

onMounted(async () => {
  categoriesStore.ensureLoaded()

  const countries = await locationsStore.ensureCountries()

  // Con un único país en el catálogo (Colombia), se preselecciona para
  // agilizar el formulario, pero el selector de País se sigue mostrando.
  if (countries.length === 1) {
    form.value.country_id = countries[0].id
    await locationsStore.ensureDepartments(countries[0].id)
  }
})

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

const rules = {
  required: (v: unknown) => (v !== null && v !== undefined && String(v).trim() !== '') || 'Este campo es obligatorio.',
  maxTitle: (v: string) => (v?.length ?? 0) <= 100 || 'El título no puede exceder los 100 caracteres.',
  maxDescription: (v: string) => (v?.length ?? 0) <= 2000 || 'La descripción no puede exceder los 2000 caracteres.',
  positiveId: (v: number | null) => (v != null && v > 0) || 'La categoría es obligatoria.',
  requiredCity: (v: number | null) => (v != null && v > 0) || 'La ciudad es obligatoria.',
  maxReference: (v: string) => (v?.length ?? 0) <= 255 || 'La dirección no puede exceder los 255 caracteres.',
  nonNegative: (v: number | null) => v == null || v >= 0 || 'El presupuesto no puede ser negativo.',
}

const isValid = computed(() => {
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

// Imágenes de referencia (opcionales, máx 5).
const referenceImages = ref<File[]>([])
const imagesError = ref<string | null>(null)

function onImagesChange(selected: File[] | File | null) {
  const files = Array.isArray(selected) ? selected : selected ? [selected] : []

  imagesError.value = validateReferenceImages(files)
  referenceImages.value = imagesError.value ? [] : files
}

async function submit() {
  if (!isValid.value || imagesError.value)
    return

  try {
    const created = await store.create({
      title: form.value.title.trim(),
      description: form.value.description.trim(),
      service_category_id: form.value.service_category_id as number,
      city_id: form.value.city_id as number,
      department_id: form.value.department_id,
      location: form.value.location.trim() || null,
      estimated_budget: form.value.estimated_budget,
      reference_images: referenceImages.value,
    })

    router.push(`/quote-requests/${created.id}`)
  }
  catch {
    // El mensaje queda disponible en `saveError`.
  }
}

function cancel() {
  router.push('/quote-requests')
}
</script>

<template>
  <div>
    <div class="mb-6">
      <h4 class="text-h4 mb-1">
        Nueva solicitud de cotización
      </h4>
      <span class="text-body-1 text-medium-emphasis">
        Describe el servicio que necesitas para que los prestadores puedan postularse.
      </span>
    </div>

    <VRow>
      <VCol
        cols="12"
        md="8"
      >
        <VCard>
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

            <VForm @submit.prevent="submit">
              <VRow>
                <VCol cols="12">
                  <VTextField
                    v-model="form.title"
                    label="Título"
                    placeholder="Ej. Instalación de aire acondicionado"
                    counter="100"
                    maxlength="100"
                    :rules="[rules.required, rules.maxTitle]"
                  />
                </VCol>

                <VCol cols="12">
                  <VTextarea
                    v-model="form.description"
                    label="Descripción del servicio"
                    placeholder="Explica con detalle lo que necesitas"
                    rows="5"
                    counter="2000"
                    maxlength="2000"
                    :rules="[rules.required, rules.maxDescription]"
                  />
                </VCol>

                <VCol
                  cols="12"
                  md="6"
                >
                  <VSelect
                    v-model="form.service_category_id"
                    label="Categoría de servicio"
                    placeholder="Selecciona una categoría"
                    :items="categoryOptions"
                    :loading="categoriesLoading"
                    :rules="[rules.positiveId]"
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
                    :rules="[rules.requiredCity]"
                  />
                </VCol>

                <VCol cols="12">
                  <VTextField
                    v-model="form.location"
                    label="Dirección de referencia (opcional)"
                    placeholder="Ej. Barrio, calle, punto de referencia"
                    counter="255"
                    maxlength="255"
                    :rules="[rules.maxReference]"
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
                    :rules="[rules.nonNegative]"
                  />
                </VCol>

                <VCol cols="12">
                  <VFileInput
                    label="Imágenes de referencia (opcional, hasta 5 JPG/PNG/WEBP, ≤10 MB)"
                    accept="image/jpeg,image/png,image/webp"
                    prepend-icon="ri-image-add-line"
                    multiple
                    chips
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
                    :disabled="!isValid"
                  >
                    Crear solicitud
                  </VBtn>
                  <VBtn
                    variant="tonal"
                    color="secondary"
                    @click="cancel"
                  >
                    Cancelar
                  </VBtn>
                </VCol>
              </VRow>
            </VForm>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>
  </div>
</template>
