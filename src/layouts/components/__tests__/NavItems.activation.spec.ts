/**
 * Activación del rol de Prestador desde el menú lateral (NavItems):
 *  - Éxito: se llama una vez a activateProvider, aparece "Mi perfil de
 *    prestador" sin recargar, desaparece "Ofrecer mis servicios" y la ruta
 *    queda en /provider-profile.
 *  - Fallo: no navega, el mensaje de error queda visible y la entrada sigue.
 *
 * **Validates: Requirements 3.3, 4.2, 4.3, 4.4, 4.6, 11.2**
 */
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createVuetify } from 'vuetify'
import NavItems from '../NavItems.vue'
import { profileService } from '@/services'
import { useActiveRoleStore } from '@/stores/activeRole'

vi.setConfig({ testTimeout: 180_000 })

const originalActivate = profileService.activateProvider
const originalMe = profileService.me

afterEach(() => {
  ;(profileService as any).activateProvider = originalActivate
  ;(profileService as any).me = originalMe
  localStorage.clear()
  document.body.innerHTML = ''
})

const OFFER = 'Ofrecer mis servicios'
const PROFILE = 'Mi perfil de prestador'
const ERROR_TEXT = 'No se pudo activar el rol de prestador. Intenta de nuevo.'

async function mountNav(activate: () => Promise<unknown>) {
  const pinia = createPinia()

  setActivePinia(pinia)
  ;(profileService as any).activateProvider = activate
  ;(profileService as any).me = async () => ({ id: 1, name: 'Ana', roles: ['cliente'] })
  useActiveRoleStore().roles = ['cliente']

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
  })

  await router.push('/dashboard')
  await router.isReady()

  // Envoltorio <ul> (render function: el build de Vue no incluye el compilador).
  const wrapper = mount({ render: () => h('ul', [h(NavItems)]) }, {
    attachTo: document.body,
    global: { plugins: [pinia, createVuetify(), router] },
  })

  await flushPromises()

  return { wrapper, router }
}

function offerEntry(wrapper: Awaited<ReturnType<typeof mountNav>>['wrapper']) {
  return wrapper.findAll('li.nav-link').find(li => li.text().includes(OFFER))
}

describe('NavItems.vue - activación de Prestador', () => {
  it('éxito: activa una vez, muestra el perfil de prestador, oculta la entrada y navega', async () => {
    const activate = vi.fn().mockResolvedValue({ roles: ['cliente', 'prestador'] })
    const { wrapper, router } = await mountNav(activate)

    expect(wrapper.text()).not.toContain(PROFILE)

    await offerEntry(wrapper)!.trigger('click')
    await flushPromises()

    expect(activate).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain(PROFILE)
    expect(offerEntry(wrapper)).toBeUndefined()
    expect(router.currentRoute.value.path).toBe('/provider-profile')
    wrapper.unmount()
  })

  it('fallo: no navega, muestra el error y la entrada sigue presente', async () => {
    const activate = vi.fn().mockRejectedValue(new Error('boom'))
    const { wrapper, router } = await mountNav(activate)

    await offerEntry(wrapper)!.trigger('click')
    await flushPromises()

    expect(activate).toHaveBeenCalledTimes(1)
    expect(router.currentRoute.value.path).toBe('/dashboard')
    expect(document.body.textContent).toContain(ERROR_TEXT)
    expect(offerEntry(wrapper)).toBeDefined()
    expect(wrapper.text()).not.toContain(PROFILE)
    wrapper.unmount()
  })
})
