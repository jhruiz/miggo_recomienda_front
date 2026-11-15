/**
 * Menú lateral (NavItems) con roles aditivos: la visibilidad depende solo de
 * los roles que el usuario posee, sin "modo" activo.
 *
 * **Validates: Requirements 2.2, 2.3, 3.1, 3.2, 4.1, 4.7, 9.1, 9.2, 11.1**
 */
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { useActiveRoleStore } from '@/stores/activeRole'

vi.mock('@/services', async importOriginal => {
  const original = await importOriginal<typeof import('@/services')>()

  return {
    ...original,
    // Evita la petición real a GET /user cuando no hay roles cargados.
    profileService: { ...original.profileService, me: vi.fn().mockRejectedValue(new Error('offline')) },
  }
})
vi.mock('@layouts/components/VerticalNavLink.vue', () => ({
  default: defineComponent({
    props: { item: { type: Object, required: true } },
    setup: props => () => h('div', { class: 'nav-link' }, (props.item as { title: string }).title),
  }),
}))
vi.mock('@/@layouts/components/VerticalNavSectionTitle.vue', () => ({
  default: defineComponent({
    props: { item: { type: Object, required: true } },
    setup: () => () => h('div', { class: 'nav-heading' }),
  }),
}))

import NavItems from '../NavItems.vue'

type Role = 'cliente' | 'prestador'

function mountWith(roles: Role[]) {
  const pinia = createPinia()
  setActivePinia(pinia)
  useActiveRoleStore().roles = roles

  const wrapper = mount(NavItems, { global: { plugins: [pinia], stubs: { VSnackbar: true } } })

  return { text: wrapper.text(), hasSection: wrapper.find('.nav-heading').exists() }
}

describe('NavItems (roles aditivos)', () => {
  beforeEach(() => localStorage.clear())

  it('Cliente ve "Cotizaciones recibidas" y "Ofrecer mis servicios", sin Sección Prestador', () => {
    const { text, hasSection } = mountWith(['cliente'])

    expect(text).toContain('Cotizaciones recibidas')
    expect(text).toContain('Ofrecer mis servicios')
    expect(text).not.toContain('Mis postulaciones')
    expect(hasSection).toBe(false)
  })

  it('Cliente+Prestador ve ambos grupos a la vez y no ve "Ofrecer mis servicios"', () => {
    const { text, hasSection } = mountWith(['cliente', 'prestador'])

    expect(text).toContain('Cotizaciones recibidas')
    expect(text).toContain('Mis postulaciones')
    expect(text).toContain('Mis cotizaciones')
    expect(text).toContain('Mi perfil de prestador')
    expect(text).not.toContain('Ofrecer mis servicios')
    expect(hasSection).toBe(true)
  })

  it('solo Prestador ve la Sección Prestador, sin "Cotizaciones recibidas" ni "Ofrecer mis servicios"', () => {
    const { text, hasSection } = mountWith(['prestador'])

    expect(hasSection).toBe(true)
    expect(text).toContain('Mis postulaciones')
    expect(text).not.toContain('Cotizaciones recibidas')
    expect(text).not.toContain('Ofrecer mis servicios')
  })

  it('sin roles solo muestra los enlaces comunes', () => {
    const { text, hasSection } = mountWith([])

    expect(text).toContain('Inicio')
    expect(text).toContain('Mensajes')
    expect(text).not.toContain('Cotizaciones recibidas')
    expect(text).not.toContain('Mis postulaciones')
    expect(text).not.toContain('Ofrecer mis servicios')
    expect(hasSection).toBe(false)
  })
})
