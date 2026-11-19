<script setup lang="ts">
import { useTheme } from 'vuetify'
import AuthProvider from '@/views/pages/authentication/AuthProvider.vue'
import { useAuthStore } from '@/stores/auth'
import { resolvePostLoginTarget } from '@/utils/wall'

import logo from '@images/logo-miggo-blanco.png'
import authV1MaskDark from '@images/pages/auth-v1-mask-dark.png'
import authV1MaskLight from '@images/pages/auth-v1-mask-light.png'
import authV1Tree2 from '@images/pages/auth-v1-tree-2.png'
import authV1Tree from '@images/pages/auth-v1-tree.png'

const form = ref({
  email: '',
  password: '',
  remember: false,
})

const vuetifyTheme = useTheme()

const authThemeMask = computed(() => {
  return vuetifyTheme.global.name.value === 'light'
    ? authV1MaskLight
    : authV1MaskDark
})

const isPasswordVisible = ref(false)

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

// `error` y `loading` del store se exponen reactivos en la UI.
const { loading, error } = storeToRefs(authStore)

async function handleLogin() {
  authStore.clearError()
  try {
    await authStore.login({
      email: form.value.email,
      password: form.value.password,
    })

    // Login exitoso: el token ya quedó persistido; redirigimos al destino
    // original (?redirect=) si es seguro, o al Muro.
    await router.push(resolvePostLoginTarget(route.query.redirect))
  }
  catch {
    // El mensaje legible ya está en `authStore.error` y se muestra en la UI.
  }
}
</script>

<template>
  <!-- eslint-disable vue/no-v-html -->

  <div class="auth-wrapper d-flex align-center justify-center pa-4">
    <VCard
      class="auth-card pa-4 pt-7"
      max-width="448"
    >
      <VCardItem class="justify-center">
        <RouterLink
          to="/"
          class="d-flex align-center gap-3"
        >
          <div
            class="d-flex align-center rounded-lg px-4 py-2"
            style="background-color: #4e73df;"
          >
            <img
              :src="logo"
              alt="Miggo"
              style="block-size: 2.5rem; inline-size: auto;"
            >
          </div>
        </RouterLink>
      </VCardItem>

      <VCardText class="pt-2">
        <h4 class="text-h4 mb-1">
          ¡Bienvenido a Miggo! 👋🏻
        </h4>
        <p class="mb-0">
          Inicia sesión en tu cuenta y comienza la aventura
        </p>
      </VCardText>

      <VCardText>
        <VForm @submit.prevent="handleLogin">
          <VRow>
            <!-- error message -->
            <VCol
              v-if="error"
              cols="12"
            >
              <VAlert
                type="error"
                variant="tonal"
                density="compact"
              >
                {{ error }}
              </VAlert>
            </VCol>

            <!-- email -->
            <VCol cols="12">
              <VTextField
                v-model="form.email"
                label="Correo electrónico"
                type="email"
              />
            </VCol>

            <!-- password -->
            <VCol cols="12">
              <VTextField
                v-model="form.password"
                label="Contraseña"
                placeholder="············"
                :type="isPasswordVisible ? 'text' : 'password'"
                autocomplete="password"
                :append-inner-icon="isPasswordVisible ? 'ri-eye-off-line' : 'ri-eye-line'"
                @click:append-inner="isPasswordVisible = !isPasswordVisible"
              />

              <!-- remember me checkbox -->
              <div class="d-flex align-center justify-space-between flex-wrap my-6">
                <VCheckbox
                  v-model="form.remember"
                  label="Recordarme"
                />

                <a
                  class="text-primary"
                  href="javascript:void(0)"
                >
                  ¿Olvidaste tu contraseña?
                </a>
              </div>

              <!-- login button -->
              <VBtn
                block
                type="submit"
                :loading="loading"
                :disabled="loading"
              >
                Iniciar sesión
              </VBtn>
            </VCol>

            <!-- create account -->
            <VCol
              cols="12"
              class="text-center text-base"
            >
              <span>¿Eres nuevo en la plataforma?</span>
              <RouterLink
                class="text-primary ms-2"
                to="/register"
              >
                Crea una cuenta
              </RouterLink>
            </VCol>

            <VCol
              cols="12"
              class="d-flex align-center"
            >
              <VDivider />
              <span class="mx-4">o</span>
              <VDivider />
            </VCol>

            <!-- auth providers -->
            <VCol
              cols="12"
              class="text-center"
            >
              <AuthProvider />
            </VCol>
          </VRow>
        </VForm>
      </VCardText>
    </VCard>

    <VImg
      class="auth-footer-start-tree d-none d-md-block"
      :src="authV1Tree"
      :width="250"
    />

    <VImg
      :src="authV1Tree2"
      class="auth-footer-end-tree d-none d-md-block"
      :width="350"
    />

    <!-- bg img -->
    <VImg
      class="auth-footer-mask d-none d-md-block"
      :src="authThemeMask"
    />
  </div>
</template>

<style lang="scss">
@use "@core/scss/template/pages/page-auth";
</style>
