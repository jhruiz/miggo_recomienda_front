<script lang="ts" setup>
/**
 * Menú de navegación lateral de la plataforma (Requisitos 14.1, 14.2).
 *
 * Reemplaza los enlaces de ejemplo de la plantilla Materio por las secciones
 * propias del dominio. La visibilidad depende solo de los roles que el Usuario
 * posee (store `activeRole`, sin "modo" activo): "Cotizaciones recibidas" con
 * rol Cliente, la Sección Prestador con rol Prestador y "Ofrecer mis servicios"
 * para quien es Cliente y aún no es Prestador.
 */
import VerticalNavSectionTitle from '@/@layouts/components/VerticalNavSectionTitle.vue'
import { useNotifier } from '@/composables/useNotifier'
import { useActiveRoleStore } from '@/stores/activeRole'
import VerticalNavLink from '@layouts/components/VerticalNavLink.vue'

const router = useRouter()
const activeRoleStore = useActiveRoleStore()
const { roles, loading, hasProviderRole, hasClientRole } = storeToRefs(activeRoleStore)
const { state, notifyError } = useNotifier()

// Roles ya cargados: evita mostrar "Ofrecer mis servicios" a un Prestador antes de GET /user.
const showOfferServices = computed(() =>
  roles.value.length > 0 && hasClientRole.value && !hasProviderRole.value,
)

async function onOfferServices() {
  if (loading.value)
    return
  try {
    await activeRoleStore.activateProvider()
    await router.push('/provider-profile')
  }
  catch {
    notifyError('No se pudo activar el rol de prestador. Intenta de nuevo.')
  }
}

onMounted(() => {
  if (activeRoleStore.roles.length === 0)
    activeRoleStore.loadRoles().catch(() => {})
})
</script>

<template>
  <!-- 👉 Principal -->
  <VerticalNavLink
    :item="{
      title: 'Muro',
      icon: 'ri-gallery-line',
      to: '/wall',
    }"
  />
  <VerticalNavLink
    :item="{
      title: 'Mi panel',
      icon: 'ri-home-5-line',
      to: '/dashboard',
    }"
  />
  <VerticalNavLink
    :item="{
      title: 'Buscar prestadores',
      icon: 'ri-search-line',
      to: '/providers',
    }"
  />
  <VerticalNavLink
    :item="{
      title: 'Solicitudes de cotización',
      icon: 'ri-file-list-3-line',
      to: '/quote-requests',
    }"
  />
  <VerticalNavLink
    :item="{
      title: 'Mis trabajos',
      icon: 'ri-tools-line',
      to: '/jobs',
    }"
  />
  <VerticalNavLink
    :item="{
      title: 'Mensajes',
      icon: 'ri-chat-3-line',
      to: '/chat',
    }"
  />
  <VerticalNavLink
    :item="{
      title: 'Notificaciones',
      icon: 'ri-notification-3-line',
      to: '/notifications',
    }"
  />
  <VerticalNavLink
    :item="{
      title: 'Guardados',
      icon: 'ri-bookmark-line',
      to: '/wall/saved',
    }"
  />
  <VerticalNavLink
    :item="{
      title: 'Privacidad del Muro',
      icon: 'ri-shield-user-line',
      to: '/wall/privacy',
    }"
  />

  <!-- 👉 Cotizaciones recibidas (rol Cliente) -->
  <VerticalNavLink
    v-if="hasClientRole"
    :item="{
      title: 'Cotizaciones recibidas',
      icon: 'ri-inbox-line',
      to: '/quotes/received',
    }"
  />

  <!-- 👉 Sección Prestador (rol Prestador) -->
  <template v-if="hasProviderRole">
    <VerticalNavSectionTitle
      :item="{
        heading: 'Prestador',
      }"
    />
    <VerticalNavLink
      :item="{
        title: 'Mis postulaciones',
        icon: 'ri-send-plane-line',
        to: '/quote-requests/my-applications',
      }"
    />
    <VerticalNavLink
      :item="{
        title: 'Mis cotizaciones',
        icon: 'ri-file-list-3-line',
        to: '/quotes/sent',
      }"
    />
    <VerticalNavLink
      :item="{
        title: 'Mi perfil de prestador',
        icon: 'ri-briefcase-line',
        to: '/provider-profile',
      }"
    />
  </template>

  <!-- 👉 Ofrecer servicios (Cliente que aún no es Prestador) -->
  <VerticalNavLink
    v-if="showOfferServices"
    :item="{
      title: 'Ofrecer mis servicios',
      icon: 'ri-store-2-line',
      disable: loading,
    }"
    @click="onOfferServices"
  />

  <VSnackbar
    v-model="state.visible"
    :color="state.color"
  >
    {{ state.text }}
  </VSnackbar>
</template>
