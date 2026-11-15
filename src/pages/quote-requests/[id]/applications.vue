<script setup lang="ts">
/**
 * Postulaciones de una solicitud de cotización (Cliente dueño).
 *
 * Lista las postulaciones de prestadores a la solicitud (Requisito 4.4) y, si
 * la solicitud sigue "abierta", permite seleccionar al prestador ganador
 * (Requisito 4.5), lo que mueve la solicitud a "en proceso". Solo el Cliente
 * dueño puede consultar las postulaciones: si el backend responde 403, se
 * muestra el mensaje de error.
 *
 * El estado proviene del store Pinia `quoteRequests`
 * (`GET /quote-requests/{id}/applications`,
 * `POST /quote-requests/{id}/select/{providerId}`).
 *
 * `useRoute`, `useRouter`, `storeToRefs`, `ref`, `computed` y `onMounted` están
 * disponibles por auto-import.
 */
import UserAvatar from '@/components/UserAvatar.vue'
import { useQuoteRequestsStore } from '@/stores/quoteRequests'

const route = useRoute()
const router = useRouter()
const store = useQuoteRequestsStore()

const {
  current,
  applications,
  applicationsLoading,
  applicationsError,
  isEmptyApplications,
  actionLoading,
  actionError,
} = storeToRefs(store)

const requestId = computed(() => Number(route.params.id))

/** Id del prestador cuya selección está en curso (para el loading por fila). */
const selectingProviderId = ref<number | null>(null)

const isOpen = computed(() => current.value?.status === 'abierta')

const selectedProviderName = computed(() => {
  if (current.value?.status !== 'en_proceso')
    return null

  // Una vez en proceso ya no sabemos el provider seleccionado desde este
  // endpoint; mostramos un aviso genérico de estado.
  return current.value?.status
})

function appliedAt(value: string | null): string {
  if (!value)
    return '—'

  return new Date(value).toLocaleString('es-CO')
}

async function selectWinner(providerUserId: number) {
  selectingProviderId.value = providerUserId
  try {
    await store.selectProvider(requestId.value, providerUserId)
  }
  catch {
    // El mensaje queda en `actionError`.
  }
  finally {
    selectingProviderId.value = null
  }
}

onMounted(() => {
  // El detalle nos da el estado de la solicitud para condicionar la selección.
  store.fetchById(requestId.value).catch(() => {})
  store.fetchApplications(requestId.value).catch(() => {})
})
</script>

<template>
  <div>
    <VBtn
      variant="text"
      color="secondary"
      prepend-icon="ri-arrow-left-line"
      class="mb-4"
      :to="`/quote-requests/${requestId}`"
    >
      Volver a la solicitud
    </VBtn>

    <div class="mb-6">
      <h4 class="text-h4 mb-1">
        Postulaciones
      </h4>
      <span class="text-body-1 text-medium-emphasis">
        {{ current?.title ?? 'Solicitud de cotización' }}
      </span>
    </div>

    <VAlert
      v-if="selectedProviderName"
      type="info"
      variant="tonal"
      border="start"
      class="mb-6"
    >
      Ya seleccionaste un prestador. La solicitud está en proceso.
    </VAlert>

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

    <!-- Error de carga (p. ej. 403 si no eres el dueño) -->
    <VAlert
      v-if="applicationsError"
      type="error"
      variant="tonal"
      border="start"
      class="mb-6"
    >
      {{ applicationsError }}
    </VAlert>

    <!-- Cargando -->
    <VCard v-if="applicationsLoading">
      <VCardText class="d-flex justify-center py-12">
        <VProgressCircular
          indeterminate
          color="primary"
          size="48"
        />
      </VCardText>
    </VCard>

    <!-- Sin postulaciones -->
    <VCard v-else-if="isEmptyApplications">
      <VCardText class="text-center py-12">
        <VIcon
          icon="ri-team-line"
          size="48"
          color="disabled"
          class="mb-3"
        />
        <p class="text-body-1 mb-0">
          Aún no hay postulaciones para esta solicitud.
        </p>
      </VCardText>
    </VCard>

    <!-- Listado de postulaciones -->
    <VCard v-else>
      <VList lines="two">
        <template
          v-for="(application, index) in applications"
          :key="application.id"
        >
          <VListItem>
            <template #prepend>
              <UserAvatar
                :name="application.provider_name"
                :user-id="application.provider_user_id"
                :src="application.provider_avatar_thumb_url ?? null"
                :size="40"
              />
            </template>

            <VListItemTitle>
              {{ application.provider_name ?? `Prestador #${application.provider_user_id}` }}
            </VListItemTitle>
            <VListItemSubtitle>
              Postuló el {{ appliedAt(application.applied_at ?? application.created_at) }}
            </VListItemSubtitle>

            <template #append>
              <VBtn
                v-if="isOpen"
                color="success"
                variant="tonal"
                size="small"
                prepend-icon="ri-trophy-line"
                :loading="actionLoading && selectingProviderId === application.provider_user_id"
                @click="selectWinner(application.provider_user_id)"
              >
                Seleccionar
              </VBtn>
            </template>
          </VListItem>

          <VDivider v-if="index < applications.length - 1" />
        </template>
      </VList>
    </VCard>
  </div>
</template>
