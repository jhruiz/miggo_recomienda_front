<script setup lang="ts">
/**
 * Pantalla de inicio de la plataforma (Requisito 14.3).
 *
 * Reemplaza el dashboard de analíticas de ejemplo de Materio por un home del
 * dominio: accesos directos a las secciones principales y un pequeño resumen de
 * actividad (notificaciones no leídas, trabajos en progreso). Reutiliza los
 * stores/servicios existentes; no añade endpoints nuevos.
 */
import { useActiveRoleStore } from '@/stores/activeRole'
import { useNotificationsStore } from '@/stores/notifications'
import { jobsService, profileService } from '@/services'

const router = useRouter()
const activeRoleStore = useActiveRoleStore()
const notificationsStore = useNotificationsStore()

const { hasProviderRole } = storeToRefs(activeRoleStore)
const { unreadDisplay } = storeToRefs(notificationsStore)

const userName = ref<string>('')
const jobsInProgress = ref<number>(0)

interface QuickLink {
  title: string
  subtitle: string
  icon: string
  color: string
  to: string
  providerOnly?: boolean
}

const quickLinks = computed<QuickLink[]>(() => ([
  { title: 'Buscar prestadores', subtitle: 'Encuentra el servicio que necesitas', icon: 'ri-search-line', color: 'primary', to: '/providers' },
  { title: 'Solicitudes de cotización', subtitle: 'Publica y gestiona tus solicitudes', icon: 'ri-file-list-3-line', color: 'info', to: '/quote-requests' },
  { title: 'Cotizaciones recibidas', subtitle: 'Respuestas a tus solicitudes', icon: 'ri-inbox-line', color: 'primary', to: '/quotes/received' },
  { title: 'Mis trabajos', subtitle: 'Trabajos en curso y finalizados', icon: 'ri-tools-line', color: 'success', to: '/jobs' },
  { title: 'Mensajes', subtitle: 'Conversa con la otra parte', icon: 'ri-chat-3-line', color: 'warning', to: '/chat' },
  { title: 'Notificaciones', subtitle: 'Novedades de tu actividad', icon: 'ri-notification-3-line', color: 'error', to: '/notifications' },
  { title: 'Mis postulaciones', subtitle: 'Solicitudes a las que postulaste', icon: 'ri-send-plane-line', color: 'info', to: '/quote-requests/my-applications', providerOnly: true },
  { title: 'Mis cotizaciones', subtitle: 'Cotizaciones que enviaste', icon: 'ri-file-text-line', color: 'warning', to: '/quotes/sent', providerOnly: true },
  { title: 'Mi perfil de prestador', subtitle: 'Edita tu portafolio y servicios', icon: 'ri-briefcase-line', color: 'secondary', to: '/provider-profile', providerOnly: true },
]).filter(link => !link.providerOnly || hasProviderRole.value))

function go(to: string) {
  router.push(to)
}

onMounted(async () => {
  if (activeRoleStore.roles.length === 0)
    activeRoleStore.loadRoles().catch(() => {})

  notificationsStore.fetchUnreadCount().catch(() => {})

  try {
    const user = await profileService.me()

    userName.value = user.name
  }
  catch {
    // Nombre opcional; si falla, el saludo es genérico.
  }

  try {
    const jobs = await jobsService.list()

    jobsInProgress.value = jobs.filter(j => j.status === 'en_progreso').length
  }
  catch {
    jobsInProgress.value = 0
  }
})
</script>

<template>
  <div>
    <!-- Bienvenida -->
    <VCard class="mb-6">
      <VCardText class="d-flex flex-wrap align-center gap-4">
        <VAvatar
          color="primary"
          variant="tonal"
          size="56"
        >
          <VIcon
            icon="ri-store-2-line"
            size="30"
          />
        </VAvatar>
        <div>
          <h4 class="text-h4 mb-1">
            Hola{{ userName ? `, ${userName}` : '' }} 👋
          </h4>
          <span class="text-body-1 text-medium-emphasis">
            Bienvenido a Miggo te lo recomienda. ¿Qué quieres hacer hoy?
          </span>
        </div>
      </VCardText>
    </VCard>

    <!-- Resumen de actividad -->
    <VRow class="mb-2">
      <VCol
        cols="12"
        sm="6"
        md="4"
      >
        <VCard
          link
          @click="go('/jobs')"
        >
          <VCardText class="d-flex align-center gap-4">
            <VAvatar
              color="success"
              variant="tonal"
              size="48"
            >
              <VIcon icon="ri-tools-line" />
            </VAvatar>
            <div>
              <div class="text-h5">
                {{ jobsInProgress }}
              </div>
              <span class="text-body-2 text-medium-emphasis">Trabajos en progreso</span>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        sm="6"
        md="4"
      >
        <VCard
          link
          @click="go('/notifications')"
        >
          <VCardText class="d-flex align-center gap-4">
            <VAvatar
              color="error"
              variant="tonal"
              size="48"
            >
              <VIcon icon="ri-notification-3-line" />
            </VAvatar>
            <div>
              <div class="text-h5">
                {{ unreadDisplay }}
              </div>
              <span class="text-body-2 text-medium-emphasis">Notificaciones sin leer</span>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- Accesos directos -->
    <h5 class="text-h5 mb-3 mt-4">
      Accesos directos
    </h5>
    <VRow>
      <VCol
        v-for="link in quickLinks"
        :key="link.to"
        cols="12"
        sm="6"
        md="4"
      >
        <VCard
          class="h-100"
          link
          @click="go(link.to)"
        >
          <VCardText class="d-flex align-center gap-4">
            <VAvatar
              :color="link.color"
              variant="tonal"
              size="48"
            >
              <VIcon :icon="link.icon" />
            </VAvatar>
            <div>
              <h6 class="text-h6 mb-1">
                {{ link.title }}
              </h6>
              <span class="text-body-2 text-medium-emphasis">{{ link.subtitle }}</span>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>
  </div>
</template>
