<script setup lang="ts">
/**
 * Detalle de un Trabajo con acciones contextuales (Requisitos 7.3, 7.4, 7.6,
 * 7.7).
 *
 * Según quién sea el usuario (Cliente o Prestador del Trabajo) y el estado del
 * mismo, se muestran distintas acciones:
 *
 *  - Prestador, "en progreso" sin fecha real de finalización → "Marcar
 *    completado" (Requisito 7.3). Al completar, el Trabajo sigue "en progreso"
 *    pero queda a la espera de la confirmación del Cliente
 *    (`actual_completion_date` no nulo).
 *  - Cliente, cuando el Trabajo está esperando confirmación → "Confirmar"
 *    (Requisito 7.4) o "Rechazar finalización" con un motivo ≤500
 *    (Requisito 7.6, con diálogo).
 *  - Ambas partes, mientras el Trabajo no esté finalizado ni cancelado →
 *    "Solicitar cancelación" / "Confirmar cancelación" con un motivo ≤500
 *    según las banderas `client_requested_cancel` / `provider_requested_cancel`
 *    (Requisito 7.7, con diálogo). Con ambas solicitudes el Trabajo pasa a
 *    "cancelado".
 *
 * El estado proviene del store Pinia `jobs` (`GET /jobs/{id}` y los endpoints
 * de acción). El id del usuario autenticado lo resuelve el propio store para
 * poder distinguir Cliente de Prestador.
 *
 * `useRoute`, `storeToRefs`, `ref`, `computed` y `onMounted` están disponibles
 * por auto-import.
 */
import { useJobsStore } from '@/stores/jobs'
import { useRatingsStore } from '@/stores/ratings'
import UserAvatar from '@/components/UserAvatar.vue'

const route = useRoute()
const store = useJobsStore()
const ratingsStore = useRatingsStore()

const {
  current,
  currentLoading,
  currentError,
  actionLoading,
  actionError,
  currentUserId,
} = storeToRefs(store)

const {
  list: ratings,
  listLoading: ratingsLoading,
  submitLoading: ratingSubmitLoading,
  submitError: ratingSubmitError,
} = storeToRefs(ratingsStore)

const jobId = computed(() => Number(route.params.id))

// ---- Diálogo de motivo (rechazo de finalización / cancelación) ----
type ReasonAction = 'reject-completion' | 'request-cancel' | 'confirm-cancel'

const reasonDialog = ref(false)
const reasonAction = ref<ReasonAction | null>(null)
const reasonText = ref('')

const reasonDialogTitle = computed(() => {
  switch (reasonAction.value) {
    case 'reject-completion':
      return 'Rechazar finalización'
    case 'request-cancel':
      return 'Solicitar cancelación'
    case 'confirm-cancel':
      return 'Confirmar cancelación'
    default:
      return ''
  }
})

const reasonValid = computed(
  () => reasonText.value.trim().length > 0 && reasonText.value.length <= 500,
)

// ---- Derivación de rol y estado ----
const isClient = computed(
  () => current.value != null && currentUserId.value === current.value.client_user_id,
)
const isProvider = computed(
  () => current.value != null && currentUserId.value === current.value.provider_user_id,
)

const isInProgress = computed(() => current.value?.status === 'en_progreso')
const isCompleted = computed(() => current.value?.status === 'completado')
const isCancelled = computed(() => current.value?.status === 'cancelado')

/** El Prestador ya marcó completado y falta la confirmación del Cliente. */
const isAwaitingConfirmation = computed(
  () => isInProgress.value && current.value?.actual_completion_date != null,
)

// Prestador: puede marcar completado si está en progreso y aún no lo marcó.
const canProviderComplete = computed(
  () => isProvider.value && isInProgress.value && current.value?.actual_completion_date == null,
)

// Cliente: puede confirmar o rechazar cuando el trabajo espera confirmación.
const canClientRespond = computed(
  () => isClient.value && isAwaitingConfirmation.value,
)

// Cancelación por mutuo acuerdo: solo mientras el trabajo esté en progreso.
const canCancel = computed(() => (isClient.value || isProvider.value) && isInProgress.value)

/** Bandera de "cancelación solicitada" del propio usuario. */
const ownRequestedCancel = computed(() => {
  if (!current.value)
    return false

  return isClient.value
    ? current.value.client_requested_cancel
    : current.value.provider_requested_cancel
})

/** Bandera de "cancelación solicitada" de la contraparte. */
const counterpartRequestedCancel = computed(() => {
  if (!current.value)
    return false

  return isClient.value
    ? current.value.provider_requested_cancel
    : current.value.client_requested_cancel
})

const statusColor: Record<string, string> = {
  en_progreso: 'warning',
  completado: 'success',
  cancelado: 'secondary',
}

function statusLabel(): string {
  if (isAwaitingConfirmation.value)
    return 'esperando confirmación'

  return (current.value?.status ?? '').replace('_', ' ')
}

function statusChipColor(): string {
  if (isAwaitingConfirmation.value)
    return 'info'

  return statusColor[current.value?.status ?? ''] ?? 'secondary'
}

function counterpartUserId(): number | null {
  if (!current.value)
    return null

  return isClient.value ? current.value.provider_user_id : current.value.client_user_id
}

function counterpartAvatar(): string | null {
  if (!current.value)
    return null

  return (isClient.value
    ? current.value.provider_avatar_thumb_url
    : current.value.client_avatar_thumb_url) ?? null
}

function counterpartLabel(): string {
  if (!current.value)
    return ''

  return isClient.value
    ? current.value.provider_name ?? `Prestador #${current.value.provider_user_id}`
    : current.value.client_name ?? `Cliente #${current.value.client_user_id}`
}

function dateText(value: string | null | undefined): string {
  if (!value)
    return '—'

  return new Date(value).toLocaleDateString('es-CO')
}

// ---- Acciones directas (sin motivo) ----
async function completeJob() {
  await store.complete(jobId.value).catch(() => {})
}

async function confirmJob() {
  await store.confirm(jobId.value).catch(() => {})
}

// ---- Acciones con diálogo de motivo ----
function openReasonDialog(action: ReasonAction) {
  reasonAction.value = action
  reasonText.value = ''
  reasonDialog.value = true
}

function closeReasonDialog() {
  reasonDialog.value = false
  reasonAction.value = null
  reasonText.value = ''
}

async function submitReason() {
  if (!reasonValid.value || reasonAction.value == null)
    return

  const payload = { reason: reasonText.value.trim() }

  try {
    switch (reasonAction.value) {
      case 'reject-completion':
        await store.rejectCompletion(jobId.value, payload)
        break
      case 'request-cancel':
        await store.requestCancel(jobId.value, payload)
        break
      case 'confirm-cancel':
        await store.confirmCancel(jobId.value, payload)
        break
    }
    closeReasonDialog()
  }
  catch {
    // El mensaje queda en `actionError`; se mantiene el diálogo abierto.
  }
}

// ---- Calificaciones (Requisito 8.2) ----
// Las calificaciones se habilitan al completarse el Trabajo. Solo mostramos el
// formulario cuando el Trabajo está "completado" y el usuario es una de sus
// partes.
const canRate = computed(
  () => isCompleted.value && (isClient.value || isProvider.value),
)

/** Calificación ya emitida por el usuario autenticado para este Trabajo. */
const ownRating = computed(() => ratingsStore.ratingByRater(currentUserId.value))

/** Mientras no se emita la propia calificación, se muestra el formulario. */
const hasRated = computed(() => ownRating.value != null)

const ratingScore = ref<number>(0)
const ratingComment = ref('')

const commentLength = computed(() => ratingComment.value.trim().length)

const ratingScoreValid = computed(
  () => Number.isInteger(ratingScore.value) && ratingScore.value >= 1 && ratingScore.value <= 5,
)

const ratingCommentValid = computed(
  () => commentLength.value >= 10 && commentLength.value <= 500,
)

const ratingFormValid = computed(() => ratingScoreValid.value && ratingCommentValid.value)

const ratingCommentErrors = computed<string[]>(() => {
  if (ratingComment.value.length === 0)
    return []

  if (commentLength.value < 10)
    return ['El comentario debe tener al menos 10 caracteres.']

  if (commentLength.value > 500)
    return ['El comentario no puede superar los 500 caracteres.']

  return []
})

/** Nombre legible del calificador de una reseña del listado. */
function raterLabel(raterUserId: number): string {
  if (raterUserId === currentUserId.value)
    return 'Tú'

  if (!current.value)
    return `Usuario #${raterUserId}`

  if (raterUserId === current.value.client_user_id)
    return current.value.client_name ?? `Cliente #${raterUserId}`

  if (raterUserId === current.value.provider_user_id)
    return current.value.provider_name ?? `Prestador #${raterUserId}`

  return `Usuario #${raterUserId}`
}

async function submitRating() {
  if (!ratingFormValid.value)
    return

  try {
    await ratingsStore.submit({
      job_id: jobId.value,
      score: ratingScore.value,
      comment: ratingComment.value.trim(),
    })

    // Limpieza tras un envío exitoso; el listado se recarga en el store.
    ratingScore.value = 0
    ratingComment.value = ''
  }
  catch {
    // El mensaje queda en `ratingSubmitError` y se muestra en el formulario.
  }
}

/** Carga las calificaciones del Trabajo cuando éste ya está completado. */
function maybeLoadRatings() {
  if (canRate.value)
    ratingsStore.fetchForJob(jobId.value).catch(() => {})
}

watch(canRate, enabled => {
  if (enabled)
    maybeLoadRatings()
})

onMounted(() => {
  ratingsStore.reset()
  store
    .fetchById(jobId.value)
    .then(() => maybeLoadRatings())
    .catch(() => {})
})
</script>

<template>
  <div>
    <VBtn
      variant="text"
      color="secondary"
      prepend-icon="ri-arrow-left-line"
      class="mb-4"
      to="/jobs"
    >
      Volver a mis trabajos
    </VBtn>

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

    <!-- Error de carga (p. ej. 403 si no eres parte del trabajo) -->
    <VAlert
      v-else-if="currentError"
      type="error"
      variant="tonal"
      border="start"
    >
      {{ currentError }}
    </VAlert>

    <template v-else-if="current">
      <!-- Error de acción -->
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

      <VRow>
        <!-- Detalle -->
        <VCol
          cols="12"
          md="8"
        >
          <VCard>
            <VCardText>
              <div class="d-flex align-center justify-space-between gap-2 mb-3">
                <h4 class="text-h4 mb-0">
                  Trabajo #{{ current.id }}
                </h4>
                <VChip
                  :color="statusChipColor()"
                  variant="tonal"
                  class="text-capitalize"
                >
                  {{ statusLabel() }}
                </VChip>
              </div>

              <div class="d-flex flex-wrap gap-4 text-body-2 text-medium-emphasis mb-4">
                <span class="d-inline-flex align-center gap-2">
                  <UserAvatar
                    :name="counterpartLabel()"
                    :user-id="counterpartUserId()"
                    :src="counterpartAvatar()"
                    :size="28"
                  />
                  {{ counterpartLabel() }}
                </span>
                <span v-if="current.quote_id">
                  <VIcon
                    icon="ri-file-list-3-line"
                    size="16"
                  />
                  Cotización #{{ current.quote_id }}
                </span>
              </div>

              <VDivider class="mb-4" />

              <VList class="py-0">
                <VListItem class="px-0">
                  <template #prepend>
                    <VIcon
                      icon="ri-calendar-line"
                      class="me-2"
                    />
                  </template>
                  <VListItemTitle>Fecha de inicio</VListItemTitle>
                  <template #append>
                    {{ dateText(current.start_date) }}
                  </template>
                </VListItem>

                <VListItem class="px-0">
                  <template #prepend>
                    <VIcon
                      icon="ri-calendar-check-line"
                      class="me-2"
                    />
                  </template>
                  <VListItemTitle>Entrega estimada</VListItemTitle>
                  <template #append>
                    {{ dateText(current.estimated_delivery_date) }}
                  </template>
                </VListItem>

                <VListItem
                  v-if="current.actual_completion_date"
                  class="px-0"
                >
                  <template #prepend>
                    <VIcon
                      icon="ri-flag-line"
                      class="me-2"
                    />
                  </template>
                  <VListItemTitle>Finalización registrada</VListItemTitle>
                  <template #append>
                    {{ dateText(current.actual_completion_date) }}
                  </template>
                </VListItem>
              </VList>

              <!-- Motivo del último rechazo de finalización -->
              <VAlert
                v-if="current.rejection_reason"
                type="warning"
                variant="tonal"
                border="start"
                class="mt-4"
              >
                <div class="font-weight-medium mb-1">
                  Motivo del rechazo de finalización
                </div>
                {{ current.rejection_reason }}
              </VAlert>

              <!-- Motivo de cancelación -->
              <VAlert
                v-if="current.cancellation_reason"
                type="secondary"
                variant="tonal"
                border="start"
                class="mt-4"
              >
                <div class="font-weight-medium mb-1">
                  Motivo de cancelación
                </div>
                {{ current.cancellation_reason }}
              </VAlert>
            </VCardText>
          </VCard>

          <!-- Calificaciones (Requisitos 8.2, 8.5) -->
          <VCard
            v-if="canRate"
            class="mt-6"
          >
            <VCardItem>
              <VCardTitle>Calificaciones</VCardTitle>
              <VCardSubtitle>
                Comparte tu experiencia con la otra parte de este trabajo.
              </VCardSubtitle>
            </VCardItem>

            <VCardText>
              <!-- Formulario: solo si el usuario aún no ha calificado -->
              <VForm
                v-if="!hasRated"
                @submit.prevent="submitRating"
              >
                <VAlert
                  v-if="ratingSubmitError"
                  type="warning"
                  variant="tonal"
                  border="start"
                  closable
                  class="mb-4"
                >
                  {{ ratingSubmitError }}
                </VAlert>

                <div class="mb-4">
                  <div class="text-body-1 font-weight-medium mb-1">
                    Puntuación
                  </div>
                  <VRating
                    v-model="ratingScore"
                    :length="5"
                    size="32"
                    color="warning"
                    active-color="warning"
                    hover
                  />
                  <div class="text-caption text-medium-emphasis">
                    Selecciona de 1 a 5 estrellas.
                  </div>
                </div>

                <VTextarea
                  v-model="ratingComment"
                  label="Comentario"
                  placeholder="Describe tu experiencia (entre 10 y 500 caracteres)"
                  rows="4"
                  counter="500"
                  maxlength="500"
                  :error-messages="ratingCommentErrors"
                />

                <div class="d-flex justify-end mt-4">
                  <VBtn
                    type="submit"
                    color="primary"
                    prepend-icon="ri-star-line"
                    :loading="ratingSubmitLoading"
                    :disabled="!ratingFormValid"
                  >
                    Enviar calificación
                  </VBtn>
                </div>
              </VForm>

              <!-- Confirmación: el usuario ya calificó -->
              <VAlert
                v-else
                type="success"
                variant="tonal"
                border="start"
                class="mb-2"
              >
                Ya enviaste tu calificación para este trabajo.
              </VAlert>

              <!-- Listado de calificaciones emitidas del Trabajo -->
              <template v-if="ratingsLoading">
                <div class="d-flex justify-center py-4">
                  <VProgressCircular
                    indeterminate
                    color="primary"
                    size="28"
                  />
                </div>
              </template>

              <template v-else-if="ratings.length">
                <VDivider class="my-4" />
                <div class="text-body-1 font-weight-medium mb-3">
                  Reseñas de este trabajo
                </div>
                <VList class="py-0">
                  <VListItem
                    v-for="review in ratings"
                    :key="review.id"
                    class="px-0"
                  >
                    <div class="d-flex align-center gap-2 mb-1">
                      <span class="font-weight-medium">{{ raterLabel(review.rater_user_id) }}</span>
                      <VRating
                        :model-value="review.score"
                        :length="5"
                        size="18"
                        color="warning"
                        active-color="warning"
                        readonly
                        density="compact"
                      />
                      <span class="text-caption text-medium-emphasis">
                        {{ dateText(review.rated_at) }}
                      </span>
                    </div>
                    <p class="text-body-2 mb-0">
                      {{ review.comment }}
                    </p>
                  </VListItem>
                </VList>
              </template>

              <p
                v-else-if="hasRated"
                class="text-body-2 text-medium-emphasis mb-0"
              >
                Las calificaciones se revelarán cuando ambas partes hayan calificado
                o cuando cierre el período de calificación.
              </p>
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
              <!-- Avisos de contexto -->
              <VAlert
                v-if="isAwaitingConfirmation && isProvider"
                type="info"
                variant="tonal"
                density="compact"
              >
                A la espera de que el cliente confirme la finalización.
              </VAlert>

              <VAlert
                v-if="counterpartRequestedCancel && canCancel"
                type="info"
                variant="tonal"
                density="compact"
              >
                La otra parte solicitó cancelar. Confirma para cancelar el trabajo.
              </VAlert>

              <VAlert
                v-else-if="ownRequestedCancel && canCancel"
                type="info"
                variant="tonal"
                density="compact"
              >
                Solicitaste cancelar. Falta que la otra parte confirme.
              </VAlert>

              <!-- Prestador: marcar completado -->
              <VBtn
                v-if="canProviderComplete"
                color="success"
                prepend-icon="ri-check-double-line"
                :loading="actionLoading"
                block
                @click="completeJob"
              >
                Marcar completado
              </VBtn>

              <!-- Cliente: confirmar finalización -->
              <VBtn
                v-if="canClientRespond"
                color="success"
                prepend-icon="ri-check-line"
                :loading="actionLoading"
                block
                @click="confirmJob"
              >
                Confirmar
              </VBtn>

              <!-- Cliente: rechazar finalización (con motivo) -->
              <VBtn
                v-if="canClientRespond"
                color="warning"
                variant="tonal"
                prepend-icon="ri-close-circle-line"
                :disabled="actionLoading"
                block
                @click="openReasonDialog('reject-completion')"
              >
                Rechazar finalización
              </VBtn>

              <!-- Ambas partes: solicitar cancelación (con motivo) -->
              <VBtn
                v-if="canCancel && !ownRequestedCancel && !counterpartRequestedCancel"
                color="error"
                variant="tonal"
                prepend-icon="ri-close-circle-line"
                :disabled="actionLoading"
                block
                @click="openReasonDialog('request-cancel')"
              >
                Solicitar cancelación
              </VBtn>

              <!-- Ambas partes: confirmar cancelación (con motivo) -->
              <VBtn
                v-if="canCancel && counterpartRequestedCancel"
                color="error"
                prepend-icon="ri-close-circle-line"
                :loading="actionLoading"
                block
                @click="openReasonDialog('confirm-cancel')"
              >
                Confirmar cancelación
              </VBtn>

              <p
                v-if="isCompleted || isCancelled"
                class="text-body-2 text-medium-emphasis mb-0"
              >
                Este trabajo está {{ isCompleted ? 'finalizado' : 'cancelado' }}; no hay acciones disponibles.
              </p>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>
    </template>

    <!-- Diálogo de motivo (rechazo de finalización / cancelación) -->
    <VDialog
      v-model="reasonDialog"
      max-width="520"
      persistent
    >
      <VCard>
        <VCardItem>
          <VCardTitle>{{ reasonDialogTitle }}</VCardTitle>
        </VCardItem>
        <VCardText>
          <VForm @submit.prevent="submitReason">
            <VTextarea
              v-model="reasonText"
              label="Motivo"
              rows="4"
              counter="500"
              maxlength="500"
              autofocus
              :error-messages="
                reasonText.length > 0 && !reasonValid
                  ? ['Indica un motivo de hasta 500 caracteres.']
                  : []
              "
            />
          </VForm>
        </VCardText>
        <VCardActions class="px-6 pb-4">
          <VSpacer />
          <VBtn
            variant="tonal"
            color="secondary"
            :disabled="actionLoading"
            @click="closeReasonDialog"
          >
            Cancelar
          </VBtn>
          <VBtn
            color="primary"
            :loading="actionLoading"
            :disabled="!reasonValid"
            @click="submitReason"
          >
            Enviar
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </div>
</template>
