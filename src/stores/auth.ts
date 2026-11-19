/**
 * Store Pinia de autenticación.
 *
 * Centraliza el estado de sesión (usuario, token, flags de carga/error) y
 * expone las acciones `login`, `register` y `logout`. El token se persiste en
 * localStorage bajo la clave `token` (AUTH_TOKEN_KEY), que es la misma que
 * consumen el interceptor de Axios (`src/services/http.ts`) y el plugin de
 * Echo (`src/plugins/echo.ts`).
 *
 * `defineStore`, `ref` y `computed` están disponibles por auto-import; no es
 * necesario importarlos.
 */
import axios from 'axios'
import { AUTH_TOKEN_KEY, authService, profileService } from '@/services'
import type {
  AuthUser,
  LoginPayload,
  RegisterPayload,
} from '@/services'

/**
 * Normaliza un error de Axios a un mensaje legible para la UI, aplicando las
 * reglas de los criterios de aceptación del Requisito 1:
 * - 401: credenciales inválidas (mensaje genérico del backend).
 * - 422: errores de validación; se prioriza `errors.email` (correo en uso).
 * - 429: bloqueo por rate limit; se muestra el mensaje del backend que indica
 *   el tiempo restante.
 */
function extractErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status
    const data = error.response?.data as
      | { message?: string, errors?: Record<string, string[]> }
      | undefined

    // 422: errores de validación. Prioriza el primer error de `email`.
    if (status === 422 && data?.errors) {
      const emailError = data.errors.email?.[0]
      if (emailError)
        return emailError

      const firstField = Object.values(data.errors)[0]
      if (firstField?.[0])
        return firstField[0]
    }

    // El backend ya envía mensajes adecuados para 401 (genérico) y 429 (bloqueo).
    if (data?.message)
      return data.message
  }

  return fallback
}

export const useAuthStore = defineStore('auth', () => {
  // ---- Estado ----
  const user = ref<AuthUser | null>(null)
  const token = ref<string | null>(localStorage.getItem(AUTH_TOKEN_KEY))
  const loading = ref(false)
  const error = ref<string | null>(null)

  // ---- Getters ----
  const isAuthenticated = computed(() => !!token.value)

  // ---- Helpers internos ----
  function setToken(value: string | null) {
    token.value = value
    if (value)
      localStorage.setItem(AUTH_TOKEN_KEY, value)
    else
      localStorage.removeItem(AUTH_TOKEN_KEY)
  }

  function clearError() {
    error.value = null
  }

  /** Petición en curso de `GET /user`, para no duplicarla entre llamadas. */
  let userRequest: Promise<AuthUser | null> | null = null

  /**
   * Garantiza que `user` esté cargado cuando hay sesión. El token se persiste
   * en localStorage pero el usuario no, así que tras iniciar sesión o recargar
   * la página se recupera desde `GET /user`. Las vistas que deciden por
   * propiedad (dueño de una solicitud, partes de una cotización) dependen de
   * él. Nunca lanza: si falla, `user` queda en null.
   */
  async function ensureUser(): Promise<AuthUser | null> {
    if (user.value)
      return user.value
    if (!token.value)
      return null

    userRequest ??= profileService.me()
      .then(me => {
        // Si la sesión se cerró mientras tanto, no se restaura el usuario.
        if (token.value)
          user.value = me

        return user.value
      })
      .catch(() => null)
      .finally(() => {
        userRequest = null
      })

    return userRequest
  }

  /**
   * Fusiona campos en el usuario actual (p. ej. la foto tras subirla o
   * eliminarla). No hace nada si no hay usuario cargado.
   */
  function patchUser(patch: Partial<AuthUser>) {
    if (user.value)
      user.value = { ...user.value, ...patch }
  }

  // ---- Acciones ----

  /**
   * Inicia sesión. Guarda el token devuelto por el backend y lo persiste.
   * Lanza el error original para que la vista pueda reaccionar si lo necesita;
   * el mensaje legible queda disponible en `error`.
   */
  async function login(payload: LoginPayload) {
    loading.value = true
    error.value = null
    try {
      const { data } = await authService.login(payload)
      setToken(data.token)
      user.value = null
      await ensureUser()

      return data
    }
    catch (err) {
      error.value = extractErrorMessage(err, 'No se pudo iniciar sesión. Intenta de nuevo.')
      throw err
    }
    finally {
      loading.value = false
    }
  }

  /**
   * Registra un nuevo usuario. Guarda el usuario devuelto (estado "pendiente
   * de verificación") sin iniciar sesión: el flujo pide verificar el correo y
   * luego iniciar sesión.
   */
  async function register(payload: RegisterPayload) {
    loading.value = true
    error.value = null
    try {
      const { data } = await authService.register(payload)
      user.value = data.user

      return data
    }
    catch (err) {
      error.value = extractErrorMessage(err, 'No se pudo completar el registro. Intenta de nuevo.')
      throw err
    }
    finally {
      loading.value = false
    }
  }

  /**
   * Cierra sesión. Intenta revocar el token en el backend y, pase lo que pase,
   * limpia el estado local para no dejar sesiones colgadas.
   */
  async function logout() {
    loading.value = true
    try {
      if (token.value)
        await authService.logout()
    }
    catch {
      // La revocación remota puede fallar (token ya inválido, red caída);
      // igualmente limpiamos la sesión local.
    }
    finally {
      user.value = null
      setToken(null)
      loading.value = false
    }
  }

  return {
    // estado
    user,
    token,
    loading,
    error,
    // getters
    isAuthenticated,
    // acciones
    login,
    register,
    logout,
    clearError,
    ensureUser,
    patchUser,
  }
})

export default useAuthStore
