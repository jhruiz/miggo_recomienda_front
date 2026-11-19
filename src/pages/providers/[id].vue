<script setup lang="ts">
/**
 * Perfil público del Prestador (Requisito 3.1).
 *
 * Pantalla de solo lectura que muestra el Perfil_Prestador identificado por el
 * id de `provider_profile` en la ruta (`/providers/:id`). Presenta nombre,
 * descripción profesional, ubicación, categorías, portafolios (una sección
 * por portafolio con su galería), calificación promedio ("Sin calificaciones" si no hay),
 * Índice_Cumplimiento ("Sin datos suficientes" con <3 trabajos) y las reseñas
 * recibidas ordenadas por fecha descendente.
 *
 * Los datos se obtienen vía el store Pinia `providers`, que a su vez consume
 * `GET /providers/{id}` a través del servicio Axios.
 *
 * `useRoute`, `useRouter`, `storeToRefs`, `computed` y `onMounted` están
 * disponibles por auto-import.
 */
import UserAvatar from '@/components/UserAvatar.vue'
import { useAuthStore } from '@/stores/auth'
import { useProvidersStore } from '@/stores/providers'
import { useQuotesStore } from '@/stores/quotes'
import { useServiceCategoriesStore } from '@/stores/serviceCategories'

const route = useRoute()
const router = useRouter()
const providersStore = useProvidersStore()
const auth = useAuthStore()
const quotesStore = useQuotesStore()

const { profile, profileLoading, profileError } = storeToRefs(providersStore)
const categoriesStore = useServiceCategoriesStore()
const { requestingDirect, requestDirectError, requestDirectCategoryError, currentUserId } = storeToRefs(quotesStore)

const providerId = computed(() => Number(route.params.id))

/**
 * Solicitud de Cotización directa (Requisito 10.1): un Cliente autenticado puede
 * pedirle una cotización al Prestador desde su perfil, con un mensaje opcional.
 * No se ofrece cuando el usuario está viendo su propio perfil.
 */
const MAX_MESSAGE = 1000

const requestDialog = ref(false)
const requestMessage = ref('')
const requestSuccess = ref(false)

/** El usuario autenticado NO es el dueño del perfil que está viendo. */
const isOwnProfile = computed(
  () => currentUserId.value != null && profile.value?.user_id === currentUserId.value,
)

/** Solo clientes autenticados viendo el perfil de OTRO prestador. */
const canRequestQuote = computed(
  () => auth.isAuthenticated && profile.value != null && !isOwnProfile.value,
)

const messageTooLong = computed(() => requestMessage.value.length > MAX_MESSAGE)

/** Categoría obligatoria de la Cotización directa (Requisito 18.8). */
const requestCategoryId = ref<number | null>(null)

/**
 * Opciones del selector: las categorías del Prestador si el perfil las expone;
 * si no, cualquiera del catálogo.
 */
const categoryOptions = computed(() => {
  const own = profile.value?.categories ?? []
  if (own.length)
    return own.map(c => ({ title: c.name, value: c.id }))

  return categoriesStore.idOptions
})

const categoryErrors = computed(() =>
  requestDirectCategoryError.value ? [requestDirectCategoryError.value] : [],
)

const canSubmitRequest = computed(
  () => requestCategoryId.value != null && !messageTooLong.value,
)

function openRequestDialog() {
  requestMessage.value = ''
  requestSuccess.value = false
  requestDirectError.value = null
  requestDirectCategoryError.value = null
  categoriesStore.ensureLoaded()

  const options = categoryOptions.value
  requestCategoryId.value = options.length === 1 ? options[0].value : null
  requestDialog.value = true
}

async function submitRequest() {
  if (!profile.value || !canSubmitRequest.value || requestCategoryId.value == null)
    return

  try {
    await quotesStore.requestDirect({
      provider_user_id: profile.value.user_id,
      service_category_id: requestCategoryId.value,
      message: requestMessage.value.trim() || null,
    })

    requestSuccess.value = true
    requestDialog.value = false
  }
  catch {
    // El mensaje de error queda disponible en `requestDirectError`.
  }
}

/** La calificación promedio puede ser número o la etiqueta "Sin calificaciones". */
const ratingLabel = computed(() => {
  const value = profile.value?.average_rating
  if (typeof value === 'number')
    return value.toFixed(1)

  return value ?? 'Sin calificaciones'
})

const ratingIsNumeric = computed(() => typeof profile.value?.average_rating === 'number')

const complianceLabel = computed(() => {
  const value = profile.value?.compliance_index
  if (typeof value === 'number')
    return `${value}%`

  return value ?? 'Sin datos suficientes'
})

function formatDate(value: string | null): string {
  if (!value)
    return ''

  return new Date(value).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function load() {
  if (!Number.isNaN(providerId.value))
    providersStore.fetchProfile(providerId.value).catch(() => {})
}

onMounted(() => {
  load()
  // Resuelve el usuario actual para decidir cliente-vs-perfil-propio (Req 10.1).
  if (auth.isAuthenticated)
    quotesStore.ensureCurrentUser().catch(() => {})
})
watch(providerId, load)
</script>

<template>
  <div>
    <!-- Encabezado con navegación de regreso al listado -->
    <div class="d-flex align-center justify-space-between flex-wrap mb-6 gap-2">
      <VBtn
        variant="text"
        color="default"
        prepend-icon="ri-arrow-left-line"
        @click="router.push('/providers')"
      >
        Volver al listado
      </VBtn>

      <VBtn
        v-if="canRequestQuote"
        color="primary"
        prepend-icon="ri-file-list-3-line"
        @click="openRequestDialog"
      >
        Solicitar cotización
      </VBtn>
    </div>

    <!-- Confirmación de solicitud directa enviada (Requisito 10.1) -->
    <VAlert
      v-if="requestSuccess"
      type="success"
      variant="tonal"
      border="start"
      closable
      class="mb-6"
      @click:close="requestSuccess = false"
    >
      Tu solicitud de cotización fue enviada. El prestador tiene 7 días para
      responderte.
    </VAlert>

    <!-- Cargando -->
    <VRow v-if="profileLoading">
      <VCol cols="12">
        <VCard>
          <VCardText class="d-flex justify-center py-12">
            <VProgressCircular
              indeterminate
              color="primary"
              size="48"
            />
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- Error -->
    <VAlert
      v-else-if="profileError"
      type="error"
      variant="tonal"
      border="start"
    >
      {{ profileError }}
    </VAlert>

    <!-- Perfil -->
    <VRow v-else-if="profile">
      <!-- Columna izquierda: identidad y métricas -->
      <VCol
        cols="12"
        md="4"
      >
        <VCard>
          <VCardText class="text-center">
            <UserAvatar
              :name="profile.name"
              :user-id="profile.user_id"
              :src="profile.avatar_thumb_url"
              :size="88"
              class="mb-4"
            />

            <h5 class="text-h5 mb-1">
              {{ profile.name ?? 'Prestador' }}
            </h5>

            <div
              v-if="profile.location"
              class="text-body-2 text-medium-emphasis mb-4"
            >
              <VIcon
                icon="ri-map-pin-line"
                size="16"
                class="me-1"
              />
              {{ profile.location }}
            </div>

            <VDivider class="my-4" />

            <VRow class="text-center">
              <VCol cols="4">
                <div class="d-flex align-center justify-center">
                  <VIcon
                    v-if="ratingIsNumeric"
                    icon="ri-star-fill"
                    color="warning"
                    size="18"
                    class="me-1"
                  />
                  <span class="text-h6">{{ ratingIsNumeric ? ratingLabel : '—' }}</span>
                </div>
                <span class="text-caption text-medium-emphasis">
                  {{ ratingIsNumeric ? 'Calificación' : ratingLabel }}
                </span>
              </VCol>

              <VCol cols="4">
                <div class="text-h6">
                  {{ typeof profile.compliance_index === 'number' ? complianceLabel : '—' }}
                </div>
                <span class="text-caption text-medium-emphasis">
                  {{ typeof profile.compliance_index === 'number' ? 'Cumplimiento' : complianceLabel }}
                </span>
              </VCol>

              <VCol cols="4">
                <div class="text-h6">
                  {{ profile.completed_jobs_count }}
                </div>
                <span class="text-caption text-medium-emphasis">Trabajos</span>
              </VCol>
            </VRow>
          </VCardText>
        </VCard>

        <!-- Categorías -->
        <VCard
          v-if="profile.categories.length"
          class="mt-6"
        >
          <VCardItem>
            <VCardTitle>Categorías</VCardTitle>
          </VCardItem>
          <VCardText class="d-flex flex-wrap gap-2">
            <VChip
              v-for="category in profile.categories"
              :key="category.id"
              color="primary"
              variant="tonal"
              size="small"
            >
              {{ category.name }}
            </VChip>
          </VCardText>
        </VCard>
      </VCol>

      <!-- Columna derecha: descripción, portafolio y reseñas -->
      <VCol
        cols="12"
        md="8"
      >
        <!-- Descripción profesional -->
        <VCard>
          <VCardItem>
            <VCardTitle>Acerca de</VCardTitle>
          </VCardItem>
          <VCardText>
            <p
              v-if="profile.professional_description"
              class="text-body-1 mb-0"
            >
              {{ profile.professional_description }}
            </p>
            <span
              v-else
              class="text-body-2 text-medium-emphasis"
            >
              Este prestador aún no agregó una descripción.
            </span>
          </VCardText>
        </VCard>

        <!-- Portafolio -->
        <PublicPortfolios :portfolios="profile.portfolios" />

        <!-- Reseñas -->
        <VCard class="mt-6">
          <VCardItem>
            <VCardTitle>Reseñas</VCardTitle>
          </VCardItem>
          <VCardText>
            <template v-if="profile.reviews.length">
              <div
                v-for="(review, index) in profile.reviews"
                :key="review.id"
              >
                <div class="d-flex align-start gap-3 py-3">
                  <UserAvatar
                    :name="review.rater_name"
                    :user-id="null"
                    :src="review.rater_avatar_thumb_url"
                    :size="40"
                  />
                  <div class="flex-grow-1">
                    <div class="d-flex align-center justify-space-between flex-wrap">
                      <span class="font-weight-medium">{{ review.rater_name ?? 'Usuario' }}</span>
                      <span class="text-caption text-medium-emphasis">{{ formatDate(review.created_at) }}</span>
                    </div>
                    <VRating
                      :model-value="review.score"
                      readonly
                      density="compact"
                      size="18"
                      color="warning"
                      class="my-1"
                    />
                    <p
                      v-if="review.comment"
                      class="text-body-2 mb-0"
                    >
                      {{ review.comment }}
                    </p>
                  </div>
                </div>
                <VDivider v-if="index < profile.reviews.length - 1" />
              </div>
            </template>
            <span
              v-else
              class="text-body-2 text-medium-emphasis"
            >
              Este prestador aún no tiene reseñas.
            </span>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- Diálogo: solicitar cotización directa al prestador (Requisito 10.1) -->
    <VDialog
      v-model="requestDialog"
      max-width="520"
      persistent
    >
      <VCard>
        <VCardItem>
          <VCardTitle>Solicitar cotización</VCardTitle>
          <VCardSubtitle>
            A {{ profile?.name ?? 'este prestador' }}
          </VCardSubtitle>
        </VCardItem>

        <VCardText>
          <VAlert
            v-if="requestDirectError && !requestDirectCategoryError"
            type="error"
            variant="tonal"
            border="start"
            class="mb-4"
          >
            {{ requestDirectError }}
          </VAlert>

          <p class="text-body-2 text-medium-emphasis mb-4">
            Cuéntale al prestador qué necesitas. El mensaje es opcional; el
            prestador responderá con una cotización detallada.
          </p>

          <VSelect
            v-model="requestCategoryId"
            class="mb-4"
            label="Categoría del servicio *"
            placeholder="Selecciona una categoría"
            :items="categoryOptions"
            :loading="categoriesStore.loading"
            :error-messages="categoryErrors"
            append-inner-icon="ri-arrow-down-s-line"
            @update:model-value="requestDirectCategoryError = null"
          />

          <VTextarea
            v-model="requestMessage"
            label="Mensaje (opcional)"
            placeholder="Describe brevemente lo que necesitas"
            rows="4"
            counter="1000"
            maxlength="1000"
            :error-messages="messageTooLong ? ['El mensaje no puede exceder los 1000 caracteres.'] : []"
          />
        </VCardText>

        <VCardActions class="px-6 pb-4">
          <VSpacer />
          <VBtn
            variant="tonal"
            color="secondary"
            :disabled="requestingDirect"
            @click="requestDialog = false"
          >
            Cancelar
          </VBtn>
          <VBtn
            color="primary"
            prepend-icon="ri-send-plane-line"
            :loading="requestingDirect"
            :disabled="!canSubmitRequest"
            @click="submitRequest"
          >
            Enviar solicitud
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </div>
</template>
