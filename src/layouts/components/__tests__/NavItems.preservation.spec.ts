/**
 * Pruebas de PRESERVACIÓN del menú lateral `NavItems.vue` (Property 2).
 *
 * Con el acceso unificado no existe rol activo: el menú depende solo de los
 * roles del usuario.
 *  - Las entradas principales (Muro, Mi panel, las seis base, Guardados y
 *    Privacidad del Muro) se muestran siempre, con su destino.
 *  - La sección "Prestador" con "Mi perfil de prestador" aparece si y solo si
 *    el usuario tiene el rol de Prestador (hasProviderRole).
 *
 * Solo se comprueban las entradas existentes (las nuevas que añade el fix no
 * forman parte de este contrato).
 *
 * **Validates: Requirements 2.1, 3.1, 3.2, 11.1**
 */
import { flushPromises, mount } from '@vue/test-utils'
import fc from 'fast-check'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { RouterLink, createMemoryHistory, createRouter } from 'vue-router'
import { createVuetify } from 'vuetify'
import NavItems from '../NavItems.vue'
import { profileService } from '@/services'
import type { UserRole } from '@/services'
import { useActiveRoleStore } from '@/stores/activeRole'

vi.setConfig({ testTimeout: 180_000 })

const originalMe = profileService.me

afterEach(() => {
  ;(profileService as any).me = originalMe
  localStorage.clear()
})

const BASE_ENTRIES: Array<[string, string]> = [
  ['Muro', '/wall'],
  ['Mi panel', '/dashboard'],
  ['Buscar prestadores', '/providers'],
  ['Solicitudes de cotización', '/quote-requests'],
  ['Mis trabajos', '/jobs'],
  ['Mensajes', '/chat'],
  ['Notificaciones', '/notifications'],
  ['Guardados', '/wall/saved'],
  ['Privacidad del Muro', '/wall/privacy'],
]

async function mountNav(roles: UserRole[]) {
  const pinia = createPinia()

  setActivePinia(pinia)
  ;(profileService as any).me = async () => ({ id: 1, name: 'Ana', roles })

  const store = useActiveRoleStore()

  store.roles = roles

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
  })

  await router.push('/dashboard')
  await router.isReady()

  // Envoltorio <ul> (render function: el build de Vue no incluye el compilador).
  const wrapper = mount({ render: () => h('ul', [h(NavItems)]) }, {
    global: { plugins: [pinia, createVuetify(), router] },
  })

  await flushPromises()

  return wrapper
}

/**
 * Destino (`to`) del enlace con ese título, o undefined si no se renderiza.
 * Se lee de la prop `to` del RouterLink porque VerticalNavLink sobrescribe el
 * `href` del ancla con `item.href` (undefined).
 */
function linkFor(wrapper: Awaited<ReturnType<typeof mountNav>>, title: string): string | undefined {
  const link = wrapper
    .findAllComponents(RouterLink)
    .find(l => l.find('.nav-item-title').text() === title)

  return link ? String(link.props('to')) : undefined
}

const rolesArb = fc.subarray<UserRole>(['cliente', 'prestador'], { minLength: 1 })

describe('NavItems.vue - preservación', () => {
  it('ejemplo: usuario solo Cliente ve las entradas base y no la sección Prestador', async () => {
    const wrapper = await mountNav(['cliente'])

    for (const [title, to] of BASE_ENTRIES)
      expect(linkFor(wrapper, title)).toBe(to)

    expect(wrapper.text()).not.toContain('Mi perfil de prestador')
    wrapper.unmount()
  })

  it('propiedad: entradas base siempre presentes; sección Prestador ⇔ hasProviderRole', async () => {
    await fc.assert(
      fc.asyncProperty(rolesArb, async roles => {
        const wrapper = await mountNav(roles)

        for (const [title, to] of BASE_ENTRIES)
          expect(linkFor(wrapper, title)).toBe(to)

        const hasProvider = roles.includes('prestador')

        expect(linkFor(wrapper, 'Mi perfil de prestador')).toBe(hasProvider ? '/provider-profile' : undefined)
        expect(wrapper.find('.nav-section-title').exists()
          && wrapper.find('.nav-section-title').text().includes('Prestador')).toBe(hasProvider)
        wrapper.unmount()
      }),
      { numRuns: 100 },
    )
  })
})
