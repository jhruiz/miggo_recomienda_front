<script setup lang="ts">
/**
 * Centro de notificaciones (tarea 14.4, Requisitos 12.3, 12.4, 12.5, 12.7).
 *
 * Vista de un solo panel que muestra las notificaciones del usuario autenticado
 * ordenadas por fecha descendente (Requisito 12.3), distinguiendo visualmente
 * las no leídas de las leídas. Incluye:
 *
 *  - Un contador de no leídas con la representación "99+" (Requisito 12.4).
 *  - Un botón "Marcar todas como leídas" (Requisito 12.7).
 *  - Marcado individual: al hacer clic en una notificación no leída, se marca
 *    como leída (Requisito 12.5).
 *
 * La recepción es en tiempo real vía Laravel Echo (suscripción a
 * `private-user.{userId}`, evento `notification.new`): las notificaciones
 * entrantes aparecen al instante al principio del listado y el contador sube.
 *
 * El estado vive en el store Pinia `notifications`. La suscripción se abre al
 * montar y se cierra al desmontar.
 *
 * `storeToRefs`, `computed`, `onMounted` y `onBeforeUnmount` están disponibles
 * por auto-import.
 */
import { useNotificationsStore } from '@/stores/notifications'
import type { Notification } from '@/services'
import { describeNotification } from '@/utils/notifications'

const store = useNotificationsStore()

const {
  notifications,
  loading,
  error,
  unreadCount,
  unreadDisplay,
  isEmpty,
  hasUnread,
} = storeToRefs(store)

const markingAll = ref(false)

const router = useRouter()

function timeFor(notification: Notification): string {
  if (!notification.created_at)
    return ''

  return new Date(notification.created_at).toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function onClickNotification(notification: Notification) {
  if (!notification.is_read)
    await store.markAsRead(notification.id).catch(() => {})

  const target = describeNotification(notification).to
  if (target)
    await router.push(target)
}

async function onMarkAll() {
  if (!hasUnread.value || markingAll.value)
    return

  markingAll.value = true
  await store.markAllAsRead().catch(() => {})
  markingAll.value = false
}

onMounted(async () => {
  await Promise.all([
    store.fetchList().catch(() => {}),
    store.fetchUnreadCount().catch(() => {}),
  ])
  await store.subscribe()
})

onBeforeUnmount(() => {
  store.unsubscribe()
})
</script>

<template>
  <div>
    <div class="d-flex flex-wrap align-center justify-space-between gap-4 mb-6">
      <div>
        <div class="d-flex align-center gap-2 mb-1">
          <h4 class="text-h4 mb-0">
            Notificaciones
          </h4>
          <VChip
            v-if="hasUnread"
            color="primary"
            size="small"
            variant="elevated"
          >
            {{ unreadDisplay }}
          </VChip>
        </div>
        <span class="text-body-1 text-medium-emphasis">
          {{ unreadCount > 0
            ? `Tienes ${unreadDisplay} notificaciones sin leer.`
            : 'Estás al día con tus notificaciones.' }}
        </span>
      </div>

      <VBtn
        prepend-icon="ri-check-double-line"
        :disabled="!hasUnread"
        :loading="markingAll"
        @click="onMarkAll"
      >
        Marcar todas como leídas
      </VBtn>
    </div>

    <VCard>
      <VAlert
        v-if="error"
        type="error"
        variant="tonal"
        class="mx-4 mt-4"
      >
        {{ error }}
      </VAlert>

      <VCardText
        v-if="loading"
        class="d-flex justify-center py-10"
      >
        <VProgressCircular
          indeterminate
          color="primary"
        />
      </VCardText>

      <VCardText
        v-else-if="isEmpty"
        class="text-center py-10 text-medium-emphasis"
      >
        <VIcon
          icon="ri-notification-off-line"
          size="48"
          class="mb-2"
        />
        <p class="mb-0">
          No tienes notificaciones por ahora.
        </p>
      </VCardText>

      <VList
        v-else
        lines="two"
        density="comfortable"
      >
        <template
          v-for="(notification, index) in notifications"
          :key="notification.id"
        >
          <VListItem
            :class="{ 'bg-primary': false }"
            :style="notification.is_read ? undefined : 'background-color: rgba(var(--v-theme-primary), 0.06);'"
            @click="onClickNotification(notification)"
          >
            <template #prepend>
              <VAvatar
                :color="notification.is_read ? 'secondary' : 'primary'"
                variant="tonal"
              >
                <VIcon :icon="describeNotification(notification).icon" />
              </VAvatar>
            </template>

            <VListItemTitle :class="notification.is_read ? 'text-medium-emphasis' : 'font-weight-medium'">
              {{ describeNotification(notification).title }}
            </VListItemTitle>
            <VListItemSubtitle v-if="describeNotification(notification).body">
              {{ describeNotification(notification).body }}
            </VListItemSubtitle>

            <template #append>
              <div class="d-flex flex-column align-end gap-1">
                <span class="text-caption text-medium-emphasis">
                  {{ timeFor(notification) }}
                </span>
                <VBadge
                  v-if="!notification.is_read"
                  color="primary"
                  dot
                  inline
                />
              </div>
            </template>
          </VListItem>

          <VDivider v-if="index < notifications.length - 1" />
        </template>
      </VList>
    </VCard>
  </div>
</template>
