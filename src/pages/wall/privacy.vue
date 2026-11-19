<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useNotifier } from '@/composables/useNotifier'
import type { FeedEventHistoryItem, FeedEventType, PrivacyStatus, SubjectType } from '@/services/wall'
import { useWallPrivacyStore } from '@/stores/wallPrivacy'

/**
 * Privacidad del Muro (Req. 6.6 a 6.13 y 6.15): estado del registro de comportamiento,
 * interruptor, conteos por tipo, evento más antiguo, historial paginado y
 * "Restablecer mi muro" con confirmación.
 */
const store = useWallPrivacyStore()
const { state, notifySuccess, notifyError } = useNotifier()

const confirmOpen = ref(false)

const EVENT_TYPES: FeedEventType[] = ['view', 'like', 'unlike', 'save', 'unsave', 'open_provider_profile', 'open_detail']

const EVENT_LABELS: Record<FeedEventType, string> = {
  view: 'Vistas',
  like: 'Me gusta',
  unlike: 'Me gusta quitados',
  save: 'Guardados',
  unsave: 'Guardados quitados',
  open_provider_profile: 'Perfiles de prestador abiertos',
  open_detail: 'Apertura de detalle',
}

const EVENT_ROW_LABELS: Record<FeedEventType, string> = {
  view: 'Vista',
  like: 'Me gusta',
  unlike: 'Me gusta quitado',
  save: 'Guardado',
  unsave: 'Guardado quitado',
  open_provider_profile: 'Perfil de prestador abierto',
  open_detail: 'Apertura de detalle',
}

const SUBJECT_TYPES: SubjectType[] = ['portfolio', 'job']

const SUBJECT_LABELS: Record<SubjectType, string> = {
  portfolio: 'Portafolios',
  job: 'Trabajos',
}

const SUBJECT_ROW_LABELS: Record<SubjectType, string> = {
  portfolio: 'Portafolio',
  job: 'Trabajo',
}

const STATUS_LABELS: Record<PrivacyStatus, string> = {
  enabled: 'Activado',
  disabled: 'Desactivado',
  unanswered: 'Sin responder',
}

const summary = computed(() => store.summary)
const total = computed(() => summary.value?.events_total ?? 0)
const statusLabel = computed(() => summary.value ? STATUS_LABELS[summary.value.status] : '')
const enabled = computed(() => summary.value?.behavior_logging === true)

const countsByType = computed(() => EVENT_TYPES.map(type => ({
  type,
  label: EVENT_LABELS[type],
  count: summary.value?.events_by_type?.[type] ?? 0,
})))

const countsBySubject = computed(() => SUBJECT_TYPES.map(type => ({
  type,
  label: SUBJECT_LABELS[type],
  count: summary.value?.events_by_subject_type?.[type] ?? 0,
})))

function subjectTitle(event: FeedEventHistoryItem): string {
  const kind = event.subject_type ? SUBJECT_ROW_LABELS[event.subject_type] : null

  if (!event.subject)
    return kind ? `${kind} (elemento no disponible)` : 'Elemento no disponible'

  const name = event.subject.name?.trim()

  return name || kind || 'Elemento'
}

function formatDate(value: string | null): string {
  if (!value)
    return ''
  const date = new Date(value)

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })
}

const oldestText = computed(() => {
  const oldest = summary.value?.oldest_event_at

  return total.value === 0 || !oldest ? 'Sin fecha' : formatDate(oldest)
})

const confirmText = computed(() => total.value === 1
  ? 'Se eliminará 1 evento de tu historial.'
  : `Se eliminarán ${total.value} eventos de tu historial.`)

async function loadAll() {
  await Promise.all([store.loadSummary(), store.loadEvents()])
}

onMounted(loadAll)

async function onToggle(value: boolean | null) {
  const next = value === true

  try {
    await store.setEnabled(next)
    notifySuccess(next ? 'Registro de comportamiento activado' : 'Registro de comportamiento desactivado')
  }
  catch {
    notifyError('No se pudo cambiar el registro de comportamiento')
  }
}

function cancelReset() {
  if (!store.resetting)
    confirmOpen.value = false
}

async function confirmReset() {
  try {
    const deleted = await store.reset()

    confirmOpen.value = false
    notifySuccess(deleted === 1
      ? 'Tu muro se restableció: se eliminó 1 evento'
      : `Tu muro se restableció: se eliminaron ${deleted} eventos`)
  }
  catch {
    confirmOpen.value = false
    notifyError('No se pudo restablecer el muro')
  }
}
</script>

<template>
  <div data-testid="privacy-page">
    <h1 class="text-h5 mb-4">
      Privacidad del Muro
    </h1>

    <div
      v-if="store.loading && !summary"
      class="d-flex justify-center pa-8"
      data-testid="privacy-loading"
    >
      <VProgressCircular
        aria-label="Cargando privacidad"
        indeterminate
      />
    </div>

    <VAlert
      v-else-if="!summary"
      data-testid="privacy-error"
      type="error"
      variant="tonal"
    >
      {{ store.error ?? 'No se pudo cargar la privacidad' }}
      <template #append>
        <VBtn
          data-testid="privacy-retry"
          size="small"
          variant="outlined"
          @click="loadAll"
        >
          Reintentar
        </VBtn>
      </template>
    </VAlert>

    <template v-else>
      <VCard class="mb-4">
        <VCardTitle>Registro de comportamiento</VCardTitle>
        <VCardText>
          <p class="mb-2">
            Estado:
            <VChip
              class="ml-1"
              data-testid="privacy-status"
              :color="summary.status === 'enabled' ? 'success' : undefined"
              size="small"
            >
              {{ statusLabel }}
            </VChip>
          </p>
          <VSwitch
            color="primary"
            data-testid="privacy-switch"
            :disabled="store.saving"
            hide-details
            label="Registrar los trabajos y portafolios que veo, mis me gusta, guardados y aperturas de detalle y de perfil"
            :model-value="enabled"
            @update:model-value="onToggle"
          />
        </VCardText>
      </VCard>

      <VCard class="mb-4">
        <VCardTitle>Eventos almacenados</VCardTitle>
        <VCardText>
          <p
            class="mb-2"
            data-testid="privacy-total"
          >
            Total: <strong>{{ total }}</strong>
          </p>
          <ul
            class="mb-2 pl-4"
            data-testid="privacy-counts"
          >
            <li
              v-for="row in countsByType"
              :key="row.type"
              :data-testid="`privacy-count-${row.type}`"
            >
              {{ row.label }}: {{ row.count }}
            </li>
          </ul>
          <p class="mb-1 font-weight-medium">
            Por tipo de elemento
          </p>
          <ul
            class="mb-2 pl-4"
            data-testid="privacy-subject-counts"
          >
            <li
              v-for="row in countsBySubject"
              :key="row.type"
              :data-testid="`privacy-subject-${row.type}`"
            >
              {{ row.label }}: {{ row.count }}
            </li>
          </ul>
          <p
            class="mb-0"
            data-testid="privacy-oldest"
          >
            Evento más antiguo: {{ oldestText }}
          </p>
        </VCardText>
      </VCard>

      <VCard class="mb-4">
        <VCardTitle>Historial</VCardTitle>
        <VCardText>
          <p
            v-if="!store.loadingEvents && store.events.length === 0 && !store.error"
            class="mb-0 text-medium-emphasis"
            data-testid="privacy-history-empty"
          >
            No hay eventos en tu historial.
          </p>

          <VList
            v-else
            data-testid="privacy-history"
            lines="two"
          >
            <VListItem
              v-for="event in store.events"
              :key="event.id"
              :data-testid="`privacy-event-${event.id}`"
              :subtitle="formatDate(event.created_at)"
              :title="`${EVENT_ROW_LABELS[event.type]}: ${subjectTitle(event)}`"
            >
              <template #prepend>
                <VAvatar
                  class="mr-3"
                  rounded
                  size="48"
                >
                  <VImg
                    v-if="event.subject?.thumb_url"
                    :alt="subjectTitle(event)"
                    cover
                    :src="event.subject.thumb_url"
                  />
                  <VIcon
                    v-else
                    :data-testid="event.subject ? undefined : 'privacy-event-unavailable'"
                    :icon="event.subject ? 'ri-image-line' : 'ri-prohibited-line'"
                  />
                </VAvatar>
              </template>
            </VListItem>
          </VList>

          <div
            v-if="store.loadingEvents"
            class="d-flex justify-center pa-2"
            data-testid="privacy-history-loading"
          >
            <VProgressCircular
              aria-label="Cargando historial"
              indeterminate
              size="24"
            />
          </div>

          <VAlert
            v-if="store.error"
            class="mt-2"
            data-testid="privacy-history-error"
            type="error"
            variant="tonal"
          >
            {{ store.error }}
            <template #append>
              <VBtn
                size="small"
                variant="outlined"
                @click="store.nextCursor ? store.loadMoreEvents() : store.loadEvents()"
              >
                Reintentar
              </VBtn>
            </template>
          </VAlert>

          <VBtn
            v-if="store.nextCursor"
            class="mt-2"
            data-testid="privacy-load-more"
            :disabled="store.loadingEvents"
            variant="outlined"
            @click="store.loadMoreEvents()"
          >
            Cargar más
          </VBtn>
        </VCardText>
      </VCard>

      <VBtn
        color="error"
        data-testid="privacy-reset"
        :disabled="store.resetting"
        variant="outlined"
        @click="confirmOpen = true"
      >
        Restablecer mi muro
      </VBtn>
    </template>

    <VDialog
      v-model="confirmOpen"
      max-width="460"
      persistent
      @keydown.esc="cancelReset"
    >
      <VCard
        aria-describedby="privacy-reset-text"
        aria-labelledby="privacy-reset-title"
        data-testid="privacy-reset-dialog"
        role="alertdialog"
      >
        <VCardTitle id="privacy-reset-title">
          Restablecer mi muro
        </VCardTitle>
        <VCardText id="privacy-reset-text">
          <p
            class="mb-1 font-weight-medium"
            data-testid="privacy-reset-count"
          >
            {{ confirmText }}
          </p>
          <p class="mb-0">
            Tus me gusta y guardados se conservan. Esta acción no se puede deshacer.
          </p>
        </VCardText>
        <VCardActions class="justify-end px-6 pb-4">
          <VBtn
            data-testid="privacy-reset-cancel"
            :disabled="store.resetting"
            variant="text"
            @click="cancelReset"
          >
            Cancelar
          </VBtn>
          <VBtn
            color="error"
            data-testid="privacy-reset-confirm"
            :loading="store.resetting"
            variant="elevated"
            @click="confirmReset"
          >
            Restablecer
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <VSnackbar
      v-model="state.visible"
      :color="state.color"
    >
      {{ state.text }}
    </VSnackbar>
  </div>
</template>
