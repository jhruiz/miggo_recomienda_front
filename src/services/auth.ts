/**
 * Servicio de autenticación.
 *
 * Envuelve las llamadas Axios a los endpoints `/api/v1/auth` reutilizando el
 * cliente HTTP base (`src/services/http.ts`), que ya inyecta el token Bearer y
 * maneja los 401. Este módulo solo define las funciones de red; la gestión de
 * estado (persistencia del token, usuario actual, etc.) vive en el store
 * Pinia `auth` (`src/stores/auth.ts`).
 */
import http from './http'
import type { ApiEnvelope } from './http'

/** Roles asignables a un usuario (ver diseño: Spatie Permission). */
export type UserRole = 'cliente' | 'prestador'

/** Representación del usuario que devuelve el backend. */
export interface AuthUser {
  id: number
  name: string
  email: string
  email_verified: boolean
  roles: UserRole[]
  /** URL de la foto de perfil original (null si no tiene). */
  avatar_url: string | null
  /** URL de la miniatura de la foto de perfil (null si no tiene). */
  avatar_thumb_url: string | null
}

/** Payload del formulario de registro. */
export interface RegisterPayload {
  name: string
  email: string
  password: string
  password_confirmation: string
}

/** Payload del formulario de login. */
export interface LoginPayload {
  email: string
  password: string
}

/** Respuesta de `POST /auth/register`. */
export interface RegisterResult {
  user: AuthUser
}

/** Respuesta de `POST /auth/login`. */
export interface LoginResult {
  token: string
  token_type: string
  expires_in: number
}

export const authService = {
  /**
   * Registra un nuevo usuario.
   * El backend responde 201 con `{ data: { user }, message }` y envía el
   * correo de verificación. Rechaza con 422 (`errors.email`) si el correo ya
   * está en uso.
   */
  register(payload: RegisterPayload) {
    return http
      .post<ApiEnvelope<RegisterResult>>('/auth/register', payload)
      .then(res => res.data)
  },

  /**
   * Inicia sesión. Responde 200 con `{ data: { token, token_type, expires_in } }`.
   * Credenciales inválidas → 401 (mensaje genérico). Tras superar el límite de
   * intentos por IP → 429 con header `Retry-After`.
   */
  login(payload: LoginPayload) {
    return http
      .post<ApiEnvelope<LoginResult>>('/auth/login', payload)
      .then(res => res.data)
  },

  /** Revoca el token activo (requiere auth:sanctum). */
  logout() {
    return http.post<ApiEnvelope<null>>('/auth/logout').then(res => res.data)
  },
}

export default authService
