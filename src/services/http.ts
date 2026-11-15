import axios from 'axios'
import type {
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios'

/**
 * Envelope estándar de la API de "Miggo te lo recomienda".
 * Todas las respuestas del backend siguen la forma `{ data, message, errors?, meta? }`.
 */
export interface ApiMeta {
  total?: number
  last_page?: number
  current_page?: number
  per_page?: number
  [key: string]: unknown
}

export interface ApiEnvelope<T = unknown> {
  data: T
  message?: string
  errors?: Record<string, string[]>
  meta?: ApiMeta
}

/**
 * Clave bajo la cual se persiste el token Bearer en localStorage.
 * El plugin de Echo (`src/plugins/echo.ts`) usa la misma clave.
 */
export const AUTH_TOKEN_KEY = 'token'

/**
 * Base URL de la API. Se toma de `VITE_API_BASE_URL` y se asegura el
 * sufijo de versión `/api/v1`. Si la variable no está definida, se usa un
 * valor por defecto relativo para desarrollo.
 */
function resolveBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim()

  return configured && configured.length > 0 ? configured : '/api/v1'
}

/**
 * Recupera el token Bearer. En esta fase de infraestructura se lee desde
 * localStorage; cuando exista el store Pinia `auth`, este seguirá siendo la
 * fuente persistida que el store sincroniza.
 */
export function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY)
}

const http: AxiosInstance = axios.create({
  baseURL: resolveBaseUrl(),
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
})

// Request interceptor: inyecta el token Bearer si está disponible.
http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAuthToken()

  if (token)
    config.headers.set('Authorization', `Bearer ${token}`)

  return config
})

// Response interceptor: maneja 401 limpiando el token y redirigiendo a /login.
http.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      localStorage.removeItem(AUTH_TOKEN_KEY)

      // Evita bucles de redirección si ya estamos en la página de login.
      if (window.location.pathname !== '/login')
        window.location.assign('/login')
    }

    return Promise.reject(error)
  },
)

/**
 * Desenvuelve el envelope de la API y devuelve únicamente la carga `data`.
 * Útil para servicios que no necesitan `meta`/`message`.
 */
export function unwrap<T>(response: AxiosResponse<ApiEnvelope<T>>): T {
  return response.data.data
}

export default http
