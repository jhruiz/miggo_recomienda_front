/**
 * Rehidratación del usuario autenticado (`ensureUser`).
 *
 * El token se persiste en localStorage pero el usuario no. Sin `auth.user` las
 * vistas que deciden por propiedad ocultan las acciones del dueño (detalle de
 * la solicitud: "Ver postulaciones", "Ver cotizaciones", editar, cerrar).
 */
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AUTH_TOKEN_KEY, authService, profileService } from '@/services'
import { useAuthStore } from '../auth'

const ME = { id: 7, name: 'Ana', email: 'ana@example.com', email_verified: true, roles: ['cliente'] }

function freshStore() {
  setActivePinia(createPinia())

  return useAuthStore()
}

describe('auth store - ensureUser', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('sin token no consulta /user y devuelve null', async () => {
    const me = vi.spyOn(profileService, 'me')
    const auth = freshStore()

    expect(await auth.ensureUser()).toBeNull()
    expect(me).not.toHaveBeenCalled()
  })

  it('con token (p. ej. tras recargar) carga el usuario una sola vez', async () => {
    localStorage.setItem(AUTH_TOKEN_KEY, 'tok')
    const me = vi.spyOn(profileService, 'me').mockResolvedValue(ME as never)
    const auth = freshStore()

    const [a, b] = await Promise.all([auth.ensureUser(), auth.ensureUser()])
    await auth.ensureUser()

    expect(a).toEqual(ME)
    expect(b).toEqual(ME)
    expect(auth.user?.id).toBe(7)
    expect(me).toHaveBeenCalledTimes(1)
  })

  it('si /user falla no lanza y deja user en null', async () => {
    localStorage.setItem(AUTH_TOKEN_KEY, 'tok')
    vi.spyOn(profileService, 'me').mockRejectedValue(new Error('401'))
    const auth = freshStore()

    await expect(auth.ensureUser()).resolves.toBeNull()
    expect(auth.user).toBeNull()
  })

  it('login guarda el token y carga el usuario', async () => {
    vi.spyOn(authService, 'login').mockResolvedValue({ data: { token: 'tok', token_type: 'Bearer', expires_in: 3600 } } as never)
    vi.spyOn(profileService, 'me').mockResolvedValue(ME as never)
    const auth = freshStore()

    await auth.login({ email: 'ana@example.com', password: 'secret' })

    expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBe('tok')
    expect(auth.user?.id).toBe(7)
  })

  it('logout limpia el usuario', async () => {
    localStorage.setItem(AUTH_TOKEN_KEY, 'tok')
    vi.spyOn(profileService, 'me').mockResolvedValue(ME as never)
    vi.spyOn(authService, 'logout').mockResolvedValue(undefined as never)
    const auth = freshStore()

    await auth.ensureUser()
    await auth.logout()

    expect(auth.user).toBeNull()
    expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBeNull()
  })
})