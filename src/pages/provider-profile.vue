<script setup lang="ts">
/**
 * Edición del perfil de Prestador y gestión de portafolios (Requisito 3.4).
 *
 * Pantalla para que el Prestador autenticado edite su descripción profesional
 * y ubicación. La gestión de portafolios se delega en `PortfolioManager`, que
 * emite `success`/`error`; aquí se muestran en un único VSnackbar.
 *
 * El acceso efectivo lo controla el backend (auth + rol prestador); aquí se
 * ofrece activar el rol de prestador si el usuario aún no lo tiene (roles
 * aditivos, sin "rol activo"), mediante el store `activeRole`.
 *
 * `useRouter`, `storeToRefs`, `ref`, `computed`, `watch` y `onMounted` están
 * disponibles por auto-import.
 */
import { useProvidersStore } from '@/stores/providers'
import { useActiveRoleStore } from '@/stores/activeRole'
import { useLocationsStore } from '@/stores/locations'
import { useNotifier } from '@/composables/useNotifier'
import PortfolioManager from '@/components/portfolio/PortfolioManager.vue'
import type { OwnProviderProfile } from '@/services'

const { state, notifySuccess, notifyError } = useNotifier()

const router = useRouter()
const providersStore = useProvidersStore()
const activeRoleStore = useActiveRoleStore()
const locationsStore = useLocationsStore()

const {
  ownProfile,
  ownLoading,
  ownSaving,
  ownError,
} = storeToRefs(providersStore)

const { hasProviderRole, loading: rolesLoading } = storeToRefs(activeRoleStore)
const {
  countryOptions,
  departmentOptions,
  cityOptions,
  loading: locationsLoading,
} = storeToRefs(locationsStore)

// ---- Formulario de perfil ----
const profileForm = ref({
  professional_description: '',
  country_id: null as number | null,
  department_id: null as number | null,
  city_id: null as number | null,
  location: '',
})

const profileSaved = ref(false)

const descriptionCounter = computed(() => profileForm.value.professional_description.length)

// Opciones en cascada derivadas de la selección actual.
const departmentItems = computed(() =>
  profileForm.value.country_id == null ? [] : departmentOptions.value(profileForm.value.country_id),
)
const cityItems = computed(() =>
  profileForm.value.department_id == null ? [] : cityOptions.value(profileForm.value.department_id),
)

// País → reinicia departamento y ciudad, y carga los departamentos del país.
async function onCountryChange(countryId: number | null) {
  profileForm.value.department_id = null
  profileForm.value.city_id = null
  if (countryId != null)
    await locationsStore.ensureDepartments(countryId)
}

// Departamento → reinicia ciudad y carga las ciudades del departamento.
async function onDepartmentChange(departmentId: number | null) {
  profileForm.value.city_id = null
  if (departmentId != null)
    await locationsStore.ensureCities(departmentId)
}

/**
 * Rellena el formulario desde el perfil propio, derivando país/departamento/
 * ciudad de la ubicación canónica anidada y cargando las opciones necesarias.
 * Perfiles sin `city` dejan los selectores vacíos y conservan `location`.
 */
async function fillFromProfile(profile: OwnProviderProfile | null) {
  const city = profile?.city ?? null
  const departmentId = city?.department_id ?? null
  const countryId = city?.department?.country_id ?? null

  profileForm.value = {
    professional_description: profile?.professional_description ?? '',
    country_id: countryId,
    department_id: departmentId,
    city_id: profile?.city_id ?? null,
    location: profile?.location ?? '',
  }

  if (countryId != null)
    await locationsStore.ensureDepartments(countryId)
  if (departmentId != null)
    await locationsStore.ensureCities(departmentId)
}

async function ensureProviderRole() {
  if (activeRoleStore.roles.length === 0)
    await activeRoleStore.loadRoles().catch(() => {})
}

async function loadProfile() {
  try {
    await providersStore.loadOwnProfile()
    await fillFromProfile(ownProfile.value)
  }
  catch {
    // El mensaje queda en providersStore.ownError.
  }
}

async function activateProvider() {
  try {
    await activeRoleStore.activateProvider()
    await loadProfile()
  }
  catch {
    // Mensaje disponible en activeRoleStore.error.
  }
}

async function saveProfile() {
  profileSaved.value = false
  try {
    await providersStore.saveOwnProfile({
      professional_description: profileForm.value.professional_description.trim() || null,
      city_id: profileForm.value.city_id,
      department_id: profileForm.value.department_id,
      location: profileForm.value.location.trim() || null,
    })
    profileSaved.value = true
  }
  catch {
    // Mensaje disponible en ownError.
  }
}

onMounted(async () => {
  locationsStore.ensureCountries().catch(() => {})
  await ensureProviderRole()
  if (hasProviderRole.value || activeRoleStore.roles.length === 0)
    await loadProfile()
})

watch(ownProfile, profile => {
  if (profile)
    fillFromProfile(profile).catch(() => {})
})
</script>

<template>
  <div>
    <div class="d-flex align-center flex-wrap gap-3 mb-6">
      <div>
        <h4 class="text-h4 mb-1">
          Mi perfil de prestador
        </h4>
        <span class="text-body-1 text-medium-emphasis">
          Edita tu información profesional y gestiona tu portafolio.
        </span>
      </div>
      <VSpacer />
      <VBtn
        v-if="ownProfile"
        variant="tonal"
        color="info"
        prepend-icon="ri-eye-line"
        @click="router.push(`/providers/${ownProfile.id}`)"
      >
        Ver perfil público
      </VBtn>
    </div>

    <!-- Aviso: usuario sin rol prestador -->
    <VAlert
      v-if="!hasProviderRole && !rolesLoading && activeRoleStore.roles.length > 0"
      type="info"
      variant="tonal"
      border="start"
      class="mb-6"
    >
      <div class="d-flex flex-wrap align-center gap-4">
        <span>Activa el rol de Prestador para publicar tu portafolio y editar tu perfil.</span>
        <VSpacer />
        <VBtn
          color="success"
          variant="flat"
          prepend-icon="ri-briefcase-line"
          :loading="rolesLoading"
          @click="activateProvider"
        >
          Activar rol de Prestador
        </VBtn>
      </div>
    </VAlert>

    <!-- Error global -->
    <VAlert
      v-if="ownError"
      type="error"
      variant="tonal"
      border="start"
      class="mb-6"
    >
      {{ ownError }}
    </VAlert>

    <!-- Cargando -->
    <VCard v-if="ownLoading">
      <VCardText class="d-flex justify-center py-12">
        <VProgressCircular
          indeterminate
          color="primary"
          size="48"
        />
      </VCardText>
    </VCard>

    <VRow v-else-if="ownProfile">
      <!-- Datos del perfil -->
      <VCol cols="12">
        <VCard>
          <VCardItem>
            <VCardTitle>Información profesional</VCardTitle>
          </VCardItem>
          <VCardText>
            <VAlert
              v-if="profileSaved"
              type="success"
              variant="tonal"
              density="compact"
              class="mb-4"
            >
              Perfil actualizado correctamente.
            </VAlert>

            <VForm @submit.prevent="saveProfile">
              <VRow>
                <VCol cols="12">
                  <VTextarea
                    v-model="profileForm.professional_description"
                    label="Descripción profesional"
                    placeholder="Describe tu experiencia y servicios"
                    rows="4"
                    counter="2000"
                    :max-length="2000"
                    :hint="`${descriptionCounter} caracteres`"
                    persistent-hint
                  />
                </VCol>
                <VCol
                  cols="12"
                  md="4"
                >
                  <VSelect
                    v-model="profileForm.country_id"
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
                    v-model="profileForm.department_id"
                    label="Departamento"
                    placeholder="Selecciona un departamento"
                    :items="departmentItems"
                    :loading="locationsLoading"
                    :disabled="profileForm.country_id == null"
                    @update:model-value="onDepartmentChange"
                  />
                </VCol>
                <VCol
                  cols="12"
                  md="4"
                >
                  <VSelect
                    v-model="profileForm.city_id"
                    label="Ciudad"
                    placeholder="Selecciona una ciudad"
                    :items="cityItems"
                    :loading="locationsLoading"
                    :disabled="profileForm.department_id == null"
                    clearable
                  />
                </VCol>
                <VCol cols="12">
                  <VTextField
                    v-model="profileForm.location"
                    label="Dirección de referencia (opcional)"
                    placeholder="Ej. Barrio, calle, punto de referencia"
                    :max-length="255"
                  />
                </VCol>
                <VCol cols="12">
                  <VBtn
                    type="submit"
                    color="primary"
                    prepend-icon="ri-save-line"
                    :loading="ownSaving"
                  >
                    Guardar cambios
                  </VBtn>
                </VCol>
              </VRow>
            </VForm>
          </VCardText>
        </VCard>
      </VCol>

      <!-- Portafolios -->
      <VCol cols="12">
        <PortfolioManager
          @success="notifySuccess"
          @error="notifyError"
        />
      </VCol>
    </VRow>

    <VSnackbar
      v-model="state.visible"
      :color="state.color"
      :timeout="4000"
    >
      {{ state.text }}
    </VSnackbar>
  </div>
</template>

<style scoped>
.min-h-6 {
  min-block-size: 1.5rem;
}
</style>
