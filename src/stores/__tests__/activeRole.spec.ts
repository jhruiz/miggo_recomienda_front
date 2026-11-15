/**
 * Store de roles (`activeRole`): los roles son aditivos y no existe modo activo.
 *
 * `profileService.me` y `profileService.activateProvider` están simulados.
 */
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { profileService } from '@/services'
import { LEGACY_ACTIVE_ROLE_KEY, useActiveRoleStore } from '../activeRole'

function freshStore() {
  setActivePinia(createPinia())

  return useActiveRoleStore()
}

describe('activeRole store', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('loadRoles rellena roles, hasClientRole y hasProviderRole', async () => {
    vi.spyOn(profileService, 'me').mockResolvedValue({ id: 1, roles: ['cliente', 'prestador'] } as never)
    const store = freshStore()

    await store.loadRoles()

    expect(store.roles).toEqual(['cliente', 'prestador'])
    expect(store.hasClientRole).toBe(true)
    expect(store.hasProviderRole).toBe(true)
    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
  })

  it('con solo rol cliente, hasProviderRole es false', async () => {
    vi.spyOn(profileService, 'me').mockResolvedValue({ id: 1, roles: ['cliente'] } as never)
    const store = freshStore()

    await store.loadRoles()

    expect(store.hasClientRole).toBe(true)
    expect(store.hasProviderRole).toBe(false)
  })

  it('loadRoles con error fija el mensaje y relanza', async () => {
    const failure = new Error('500')

    vi.spyOn(profileService, 'me').mockRejectedValue(failure)
    const store = freshStore()

    await expect(store.loadRoles()).rejects.toBe(failure)
    expect(store.error).toBe('No se pudieron cargar los roles del usuario.')
    expect(store.loading).toBe(false)
  })

  it('activateProvider reemplaza roles con los del backend', async () => {
    vi.spyOn(profileService, 'activateProvider').mockResolvedValue({ roles: ['cliente', 'prestador'] } as never)
    const store = freshStore()

    store.roles = ['cliente']
    await store.activateProvider()

    expect(store.roles).toEqual(['cliente', 'prestador'])
    expect(store.hasProviderRole).toBe(true)
    expect(store.error).toBeNull()
  })

  it('activateProvider con error fija el mensaje y relanza', async () => {
    const failure = new Error('500')

    vi.spyOn(profileService, 'activateProvider').mockRejectedValue(failure)
    const store = freshStore()

    store.roles = ['cliente']

    await expect(store.activateProvider()).rejects.toBe(failure)
    expect(store.error).toBe('No se pudo activar el rol de prestador. Intenta de nuevo.')
    expect(store.roles).toEqual(['cliente'])
  })

  it('reset vacía roles y error', async () => {
    vi.spyOn(profileService, 'me').mockRejectedValue(new Error('x'))
    const store = freshStore()

    store.roles = ['cliente']
    await store.loadRoles().catch(() => {})
    store.reset()

    expect(store.roles).toEqual([])
    expect(store.error).toBeNull()
  })

  it('crear el store borra la clave heredada active_role', () => {
    localStorage.setItem(LEGACY_ACTIVE_ROLE_KEY, 'prestador')

    freshStore()

    expect(localStorage.getItem('active_role')).toBeNull()
  })

  it('no expone la API de modo eliminada', () => {
    const store = freshStore() as unknown as Record<string, unknown>

    for (const name of ['activeRole', 'canSwitch', 'isProviderView', 'isClientView', 'setActiveRole', 'toggleRole'])
      expect(name in store).toBe(false)
  })
})
