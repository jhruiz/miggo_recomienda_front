<script lang="ts" setup>
import NavItems from '@/layouts/components/NavItems.vue'
import logo from '@images/logo-miggo-blanco.png'
import VerticalNavLayout from '@layouts/components/VerticalNavLayout.vue'

// Components
import Footer from '@/layouts/components/Footer.vue'
import NavbarThemeSwitcher from '@/layouts/components/NavbarThemeSwitcher.vue'
import UserProfile from '@/layouts/components/UserProfile.vue'
import { useNotificationsStore } from '@/stores/notifications'

const notificationsStore = useNotificationsStore()
const { unreadDisplay, hasUnread } = storeToRefs(notificationsStore)

onMounted(() => {
  // Contador inicial + suscripción en tiempo real al canal del usuario.
  notificationsStore.fetchUnreadCount().catch(() => {})
  notificationsStore.subscribe().catch(() => {})
})
</script>

<template>
  <VerticalNavLayout>
    <!-- 👉 navbar -->
    <template #navbar="{ toggleVerticalOverlayNavActive }">
      <div class="d-flex h-100 align-center">
        <!-- 👉 Vertical nav toggle in overlay mode -->
        <IconBtn
          class="ms-n3 d-lg-none"
          @click="toggleVerticalOverlayNavActive(true)"
        >
          <VIcon icon="ri-menu-line" />
        </IconBtn>

        <VSpacer />

        <!-- 👉 Acceso al centro de notificaciones con contador (Requisito 14.5) -->
        <IconBtn
          to="/notifications"
          class="me-1"
        >
          <VBadge
            :model-value="hasUnread"
            :content="unreadDisplay"
            color="error"
          >
            <VIcon icon="ri-notification-line" />
          </VBadge>
        </IconBtn>

        <NavbarThemeSwitcher class="me-2" />

        <UserProfile />
      </div>
    </template>

    <template #vertical-nav-header="{ toggleIsOverlayNavActive }">
      <RouterLink
        to="/"
        class="app-logo app-title-wrapper"
      >
        <div class="app-logo-box">
          <img
            :src="logo"
            alt="Miggo"
            class="app-logo-img"
          >
        </div>
      </RouterLink>

      <IconBtn
        class="d-block d-lg-none"
        @click="toggleIsOverlayNavActive(false)"
      >
        <VIcon icon="ri-close-line" />
      </IconBtn>
    </template>

    <template #vertical-nav-content>
      <NavItems />
    </template>

    <!-- 👉 Pages -->
    <slot />

    <!-- 👉 Footer -->
    <template #footer>
      <Footer />
    </template>
  </VerticalNavLayout>
</template>

<style lang="scss" scoped>
.meta-key {
  border: thin solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 6px;
  block-size: 1.5625rem;
  line-height: 1.3125rem;
  padding-block: 0.125rem;
  padding-inline: 0.25rem;
}

.app-logo {
  display: flex;
  align-items: center;
  column-gap: 0.75rem;

  .app-logo-box {
    display: flex;
    align-items: center;
    padding: 0.5rem 0.75rem;
    background-color: #4e73df;
    border-radius: 0.5rem;
  }

  .app-logo-img {
    block-size: 1.75rem;
    inline-size: auto;
  }

  .app-logo-title {
    font-size: 1.25rem;
    font-weight: 500;
    line-height: 1.75rem;
    text-transform: uppercase;
  }
}
</style>
