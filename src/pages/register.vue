<script setup lang="ts">
import { useTheme } from 'vuetify'
import AuthProvider from '@/views/pages/authentication/AuthProvider.vue'
import { useAuthStore } from '@/stores/auth'

import logo from '@images/logo-miggo-blanco.png'
import authV1MaskDark from '@images/pages/auth-v1-mask-dark.png'
import authV1MaskLight from '@images/pages/auth-v1-mask-light.png'
import authV1Tree2 from '@images/pages/auth-v1-tree-2.png'
import authV1Tree from '@images/pages/auth-v1-tree.png'

const form = ref({
  name: '',
  email: '',
  password: '',
  password_confirmation: '',
  privacyPolicies: false,
})

const vuetifyTheme = useTheme()

const authThemeMask = computed(() => {
  return vuetifyTheme.global.name.value === 'light'
    ? authV1MaskLight
    : authV1MaskDark
})

const isPasswordVisible = ref(false)

const router = useRouter()
const authStore = useAuthStore()

const { loading, error } = storeToRefs(authStore)

// Mensaje de éxito mostrado tras registrarse (pedir verificación de correo).
const successMessage = ref<string | null>(null)

async function handleRegister() {
  authStore.clearError()
  successMessage.value = null
  try {
    await authStore.register({
      name: form.value.name,
      email: form.value.email,
      password: form.value.password,
      password_confirmation: form.value.password_confirmation,
    })

    // Registro exitoso: la cuenta queda pendiente de verificación.
    successMessage.value = 'Cuenta creada. Revisa tu correo para verificar tu cuenta antes de iniciar sesión.'

    // Redirige a login tras un breve lapso para que el usuario lea el mensaje.
    setTimeout(() => router.push('/login'), 2500)
  }
  catch {
    // El mensaje legible (p. ej. correo ya en uso) queda en `authStore.error`.
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
          La aventura comienza aquí 🚀
        </h4>
        <p class="mb-0">
          ¡Haz que la gestión de tu aplicación sea fácil y divertida!
        </p>
      </VCardText>

      <VCardText>
        <VForm @submit.prevent="handleRegister">
          <VRow>
            <!-- success message -->
            <VCol
              v-if="successMessage"
              cols="12"
            >
              <VAlert
                type="success"
                variant="tonal"
                density="compact"
              >
                {{ successMessage }}
              </VAlert>
            </VCol>

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

            <!-- Full name -->
            <VCol cols="12">
              <VTextField
                v-model="form.name"
                label="Nombre completo"
                placeholder="Juan Pérez"
              />
            </VCol>
            <!-- email -->
            <VCol cols="12">
              <VTextField
                v-model="form.email"
                label="Correo electrónico"
                placeholder="juanperez@correo.com"
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
            </VCol>

            <!-- confirm password -->
            <VCol cols="12">
              <VTextField
                v-model="form.password_confirmation"
                label="Confirmar contraseña"
                placeholder="············"
                :type="isPasswordVisible ? 'text' : 'password'"
                autocomplete="password"
              />
              <div class="d-flex align-center my-6">
                <VCheckbox
                  id="privacy-policy"
                  v-model="form.privacyPolicies"
                  inline
                />
                <VLabel
                  for="privacy-policy"
                  style="opacity: 1;"
                >
                  <span class="me-1">Acepto la</span>
                  <a
                    href="javascript:void(0)"
                    class="text-primary"
                  >política de privacidad y los términos</a>
                </VLabel>
              </div>

              <VBtn
                block
                type="submit"
                :loading="loading"
                :disabled="loading"
              >
                Crear cuenta
              </VBtn>
            </VCol>

            <!-- login instead -->
            <VCol
              cols="12"
              class="text-center text-base"
            >
              <span>¿Ya tienes una cuenta?</span>
              <RouterLink
                class="text-primary ms-2"
                to="login"
              >
                Inicia sesión
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
