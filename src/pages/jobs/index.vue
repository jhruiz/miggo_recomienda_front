<script setup lang="ts">
/**
 * Listado de los Trabajos del usuario autenticado (Requisito 7.2).
 *
 * Muestra los Trabajos en los que el usuario participa como Cliente o como
 * Prestador, con un chip de estado. El sub-estado "esperando tu confirmación"
 * no es un `status` propio: se deriva de `en_progreso` + `actual_completion_date`
 * no nulo (el Prestador ya marcó completado y falta la confirmación del
 * Cliente). Desde cada tarjeta se accede al detalle, donde viven las acciones
 * contextuales.
 *
 * El estado proviene del store Pinia `jobs` (`GET /jobs`).
 *
 * `useRouter`, `storeToRefs`, `computed` y `onMounted` están disponibles por
 * auto-import.
 */
import { useJobsStore } from '@/stores/jobs'
import type { Job } from '@/services'
import UserAvatar from '@/components/UserAvatar.vue'

const router = useRouter()
const store = useJobsStore()

const {
  list,
  listLoading,
  listError,
  isEmptyList,
  currentUserId,
} = storeToRefs(store)

const statusColor: Record<string, string> = {
  en_progreso: 'warning',
  completado: 'success',
  cancelado: 'secondary',
}

/** Indica si el trabajo está a la espera de la confirmación del Cliente. */
function isAwaitingConfirmation(job: Job): boolean {
  return job.status === 'en_progreso' && job.actual_completion_date != null
}

function statusLabel(job: Job): string {
  if (isAwaitingConfirmation(job))
    return 'esperando confirmación'

  return (job.status ?? '').replace('_', ' ')
}

function statusChipColor(job: Job): string {
  if (isAwaitingConfirmation(job))
    return 'info'

  return statusColor[job.status] ?? 'secondary'
}

/** Rol del usuario autenticado en este trabajo (para contexto en la tarjeta). */
function roleLabel(job: Job): string {
  if (currentUserId.value === job.client_user_id)
    return 'Como cliente'
  if (currentUserId.value === job.provider_user_id)
    return 'Como prestador'

  return ''
}

function counterpartUserId(job: Job): number {
  return currentUserId.value === job.client_user_id ? job.provider_user_id : job.client_user_id
}

function counterpartAvatar(job: Job): string | null {
  return (currentUserId.value === job.client_user_id
    ? job.provider_avatar_thumb_url
    : job.client_avatar_thumb_url) ?? null
}

/** Nombre de la contraparte, según el rol del usuario. */
function counterpartName(job: Job): string {
  if (currentUserId.value === job.client_user_id)
    return job.provider_name ?? `Prestador #${job.provider_user_id}`

  return job.client_name ?? `Cliente #${job.client_user_id}`
}

function dateText(value: string | null): string {
  if (!value)
    return '—'

  return new Date(value).toLocaleDateString('es-CO')
}

function goToDetail(id: number) {
  router.push(`/jobs/${id}`)
}

onMounted(() => {
  store.fetchList().catch(() => {})
})
</script>

<template>
  <div>
    <div class="mb-6">
      <h4 class="text-h4 mb-1">
        Mis trabajos
      </h4>
      <span class="text-body-1 text-medium-emphasis">
        Los trabajos en curso y finalizados en los que participas.
      </span>
    </div>

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

    <!-- Lista vacía -->
    <VCard v-else-if="isEmptyList">
      <VCardText class="text-center py-12">
        <VIcon
          icon="ri-briefcase-line"
          size="48"
          color="disabled"
          class="mb-3"
        />
        <p class="text-body-1 mb-0">
          Aún no tienes trabajos. Se crean al aceptar una cotización.
        </p>
      </VCardText>
    </VCard>

    <!-- Resultados -->
    <VRow v-else>
      <VCol
        v-for="job in list"
        :key="job.id"
        cols="12"
        md="6"
      >
        <VCard class="h-100">
          <VCardText>
            <div class="d-flex align-center justify-space-between gap-2 mb-2">
              <h6 class="text-h6 mb-0">
                Trabajo #{{ job.id }}
              </h6>
              <VChip
                size="small"
                :color="statusChipColor(job)"
                variant="tonal"
                class="text-capitalize"
              >
                {{ statusLabel(job) }}
              </VChip>
            </div>

            <div class="d-flex flex-wrap gap-3 text-caption text-medium-emphasis mb-3">
              <span v-if="roleLabel(job)">
                <VIcon
                  icon="ri-user-3-line"
                  size="14"
                />
                {{ roleLabel(job) }}
              </span>
              <span class="d-inline-flex align-center gap-1">
                <UserAvatar
                  :name="counterpartName(job)"
                  :user-id="counterpartUserId(job)"
                  :src="counterpartAvatar(job)"
                  :size="24"
                />
                {{ counterpartName(job) }}
              </span>
            </div>

            <div class="d-flex flex-wrap gap-4 text-body-2 text-medium-emphasis mb-4">
              <span>
                <VIcon
                  icon="ri-calendar-line"
                  size="16"
                />
                Inicio: {{ dateText(job.start_date) }}
              </span>
              <span>
                <VIcon
                  icon="ri-calendar-check-line"
                  size="16"
                />
                Entrega estimada: {{ dateText(job.estimated_delivery_date) }}
              </span>
            </div>

            <VDivider class="mb-3" />

            <VBtn
              size="small"
              variant="tonal"
              color="primary"
              prepend-icon="ri-eye-line"
              @click="goToDetail(job.id)"
            >
              Ver detalle
            </VBtn>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>
  </div>
</template>
