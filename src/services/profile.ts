/**
 * Servicio de perfiles y roles.
 *
 * Envuelve las llamadas Axios a los endpoints de identidad/roles del backend
 * (`/api/v1/user`, `/api/v1/profile/...`) reutilizando el cliente HTTP base
 * (`src/services/http.ts`), que ya inyecta el token Bearer y maneja los 401.
 *
 * Los roles (Cliente/Prestador) son aditivos: no existe un "rol activo". El
 * store Pinia `activeRole` (`src/stores/activeRole.ts`) solo guarda los roles
 * que posee el usuario. Este servicio
 * solo expone las operaciones de red necesarias para conocer los roles del
 * usuario y activar el rol de Prestador (Requisitos 2.2, 2.4).
 */
import http from './http'
import type { ApiEnvelope } from './http'
import type { AuthUser, UserRole } from './auth'
import type { CityLocation } from './quoteRequests'

/** Datos del perfil de prestador que devuelve el backend. */
export interface ProviderProfile {
  id: number
  user_id: number
  professional_description: string | null
  // Ubicación canónica (Ciudad) con Departamento/País derivados (Req. 15.10).
  city_id: number | null
  city: CityLocation | null
  location: string | null
  is_active: boolean
}

/** Respuesta de `POST /profile/provider/activate`. */
export interface ActivateProviderResult {
  provider_profile: ProviderProfile
  roles: UserRole[]
}

/** Respuesta de `POST` / `DELETE /profile/avatar`. */
export interface AvatarResult {
  avatar_url: string | null
  avatar_thumb_url: string | null
}

export const profileService = {
  /**
   * Sube la foto de perfil (multipart, campo `avatar`).
   * `POST /profile/avatar` responde `{ data: { avatar_url, avatar_thumb_url } }`.
   */
  uploadAvatar(file: File) {
    const formData = new FormData()

    formData.append('avatar', file)

    return http
      .post<ApiEnvelope<AvatarResult>>('/profile/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then(res => res.data.data)
  },

  /**
   * Elimina la foto de perfil. `DELETE /profile/avatar` responde
   * `{ data: { avatar_url: null, avatar_thumb_url: null } }`.
   */
  deleteAvatar() {
    return http
      .delete<ApiEnvelope<AvatarResult>>('/profile/avatar')
      .then(res => res.data.data)
  },

  /**
   * Obtiene el usuario autenticado junto con sus roles (`cliente`,
   * `prestador`). El frontend usa `roles` para decidir qué acciones habilitar
   * (por ejemplo, `hasProviderRole`).
   *
   * `GET /user` responde `{ data: { id, name, email, email_verified, roles } }`.
   */
  me() {
    return http.get<ApiEnvelope<AuthUser>>('/user').then(res => res.data.data)
  },

  /**
   * Activa el rol de Prestador del usuario autenticado. El backend crea el
   * `provider_profile` y asigna el rol `prestador` sin remover `cliente`,
   * dentro de una transacción (Requisitos 2.2, 2.3). Es idempotente.
   *
   * `POST /profile/provider/activate` responde
   * `{ data: { provider_profile, roles } }`.
   */
  activateProvider() {
    return http
      .post<ApiEnvelope<ActivateProviderResult>>('/profile/provider/activate')
      .then(res => res.data.data)
  },
}

export default profileService
