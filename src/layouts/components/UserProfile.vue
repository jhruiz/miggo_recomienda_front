<script setup lang="ts">
/**
 * Menú de usuario del navbar (Requisito 14.4).
 *
 * Muestra el nombre y correo reales del usuario autenticado (tomados del
 * store `auth`, resuelto con `ensureUser()`), su foto de perfil y ofrece accesos a su perfil y el cierre de sesión. "Cerrar sesión"
 * invoca `authStore.logout()`, que revoca el token Sanctum en el backend, y
 * luego redirige a la pantalla de inicio de sesión.
 */
import { useActiveRoleStore } from '@/stores/activeRole'
import { useAuthStore } from '@/stores/auth'
import { useNotifier } from '@/composables/useNotifier'
import UserAvatar from '@/components/UserAvatar.vue'
import ProfilePhotoDialog from '@/layouts/components/ProfilePhotoDialog.vue'

const router = useRouter()
const authStore = useAuthStore()
const activeRoleStore = useActiveRoleStore()
const { hasProviderRole } = storeToRefs(activeRoleStore)
const { state, notifySuccess, notifyError } = useNotifier()

const name = computed(() => authStore.user?.name ?? '')
const email = computed(() => authStore.user?.email ?? '')
const userId = computed(() => authStore.user?.id ?? null)
const thumbUrl = computed(() => authStore.user?.avatar_thumb_url ?? null)

const photoDialogOpen = ref(false)

async function onLogout() {
  await authStore.logout()
  activeRoleStore.reset()
  router.push('/login')
}

onMounted(async () => {
  if (authStore.isAuthenticated)
    await authStore.ensureUser()
})
</script>

<template>
  <VBadge
    dot
    location="bottom right"
    offset-x="3"
    offset-y="3"
    color="success"
    bordered
  >
    <UserAvatar
      class="cursor-pointer"
      :name="name"
      :user-id="userId"
      :src="thumbUrl"
    />

      <!-- SECTION Menu -->
      <VMenu
        activator="parent"
        width="240"
        location="bottom end"
        offset="14px"
      >
        <VList>
          <!-- 👉 Nombre y correo reales -->
          <VListItem>
            <template #prepend>
              <VListItemAction start>
                <VBadge
                  dot
                  location="bottom right"
                  offset-x="3"
                  offset-y="3"
                  color="success"
                >
                  <UserAvatar
                    :name="name"
                    :user-id="userId"
                    :src="thumbUrl"
                  />
                </VBadge>
              </VListItemAction>
            </template>

            <VListItemTitle class="font-weight-semibold">
              {{ name || 'Usuario' }}
            </VListItemTitle>
            <VListItemSubtitle>{{ email }}</VListItemSubtitle>
          </VListItem>
          <VDivider class="my-2" />

          <!-- 👉 Mi perfil de prestador (solo con rol prestador activo) -->
          <VListItem
            v-if="hasProviderRole"
            to="/provider-profile"
          >
            <template #prepend>
              <VIcon
                class="me-2"
                icon="ri-briefcase-line"
                size="22"
              />
            </template>
            <VListItemTitle>Mi perfil de prestador</VListItemTitle>
          </VListItem>

          <!-- 👉 Cambiar foto de perfil (todos los roles) -->
          <VListItem @click="photoDialogOpen = true">
            <template #prepend>
              <VIcon
                class="me-2"
                icon="ri-camera-line"
                size="22"
              />
            </template>
            <VListItemTitle>Cambiar foto de perfil</VListItemTitle>
          </VListItem>

          <!-- 👉 Mis trabajos -->
          <VListItem to="/jobs">
            <template #prepend>
              <VIcon
                class="me-2"
                icon="ri-tools-line"
                size="22"
              />
            </template>
            <VListItemTitle>Mis trabajos</VListItemTitle>
          </VListItem>

          <VDivider class="my-2" />

          <!-- 👉 Cerrar sesión -->
          <VListItem @click="onLogout">
            <template #prepend>
              <VIcon
                class="me-2"
                icon="ri-logout-box-r-line"
                size="22"
              />
            </template>
            <VListItemTitle>Cerrar sesión</VListItemTitle>
          </VListItem>
        </VList>
      </VMenu>
      <!-- !SECTION -->
  </VBadge>

  <ProfilePhotoDialog
    v-model="photoDialogOpen"
    @success="notifySuccess"
    @error="notifyError"
  />

  <VSnackbar
    v-model="state.visible"
    :color="state.color"
  >
    {{ state.text }}
  </VSnackbar>
</template>

