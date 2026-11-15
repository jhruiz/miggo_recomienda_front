/**
 * Store Pinia de los roles del usuario (Cliente / Prestador).
 *
 * Los roles son aditivos: ya no existe un "modo" o rol activo. El frontend
 * decide qué mostrar únicamente con los roles que el usuario posee
 * (`hasClientRole`, `hasProviderRole`). Se conserva el id `activeRole` del
 * store para no alterar a sus consumidores.
 *
 * Los roles se cargan desde `GET /user` vía `profileService.me()` y se
 * actualizan al activar el rol de prestador. No hay persistencia: la clave
 * heredada `active_role` de localStorage solo se borra, nunca se lee.
 *
 * `defineStore`, `ref` y `computed` están disponibles por auto-import.
 */
import { profileService } from '@/services'
import type { UserRole } from '@/services'

/** Clave heredada de versiones con "modo". Solo se borra, nunca se lee. */
export const LEGACY_ACTIVE_ROLE_KEY = 'active_role'

export const useActiveRoleStore = defineStore('activeRole', () => {
  // ---- Estado ----
  /** Roles que el usuario posee realmente (según el backend). */
  const roles = ref<UserRole[]>([])

  const loading = ref(false)
  const error = ref<string | null>(null)

  // ---- Getters ----
  const hasClientRole = computed(() => roles.value.includes('cliente'))
  const hasProviderRole = computed(() => roles.value.includes('prestador'))

  // Elimina el valor que dejaron versiones anteriores (sin leerlo).
  localStorage.removeItem(LEGACY_ACTIVE_ROLE_KEY)

  // ---- Acciones ----

  /** Carga los roles del usuario autenticado desde el backend. */
  async function loadRoles() {
    loading.value = true
    error.value = null
    try {
      const user = await profileService.me()

      roles.value = user.roles ?? []

      return user
    }
    catch (err) {
      error.value = 'No se pudieron cargar los roles del usuario.'
      throw err
    }
    finally {
      loading.value = false
    }
  }

  /** Activa el rol de Prestador en el backend y actualiza los roles locales. */
  async function activateProvider() {
    loading.value = true
    error.value = null
    try {
      const result = await profileService.activateProvider()

      roles.value = result.roles ?? roles.value

      return result
    }
    catch (err) {
      error.value = 'No se pudo activar el rol de prestador. Intenta de nuevo.'
      throw err
    }
    finally {
      loading.value = false
    }
  }

  /** Limpia el estado (p. ej. al cerrar sesión). */
  function reset() {
    roles.value = []
    error.value = null
    localStorage.removeItem(LEGACY_ACTIVE_ROLE_KEY)
  }

  return {
    // estado
    roles,
    loading,
    error,
    // getters
    hasClientRole,
    hasProviderRole,
    // acciones
    loadRoles,
    activateProvider,
    reset,
  }
})

export default useActiveRoleStore
