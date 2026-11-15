/**
 * Exploración C2: botón "Postular" visible sobre la solicitud propia. DEBE FALLAR sin corregir.
 *
 * **Validates: Requirements 1.2**
 */
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { createVuetify } from 'vuetify'
import { useActiveRoleStore } from '@/stores/activeRole'
import { useAuthStore } from '@/stores/auth'
import { useLocationsStore } from '@/stores/locations'
import { useQuoteRequestsStore } from '@/stores/quoteRequests'
import { useServiceCategoriesStore } from '@/stores/serviceCategories'

vi.mock('vue-router', async () => {
  const actual = await vi.importActual<typeof import('vue-router')>('vue-router')

  return { ...actual, useRouter: () => ({ push: vi.fn() }), useRoute: () => ({ query: {} }) }
})

import Page from '../index.vue'

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as never

const base = {
  description: 'd',
  status: 'abierta',
  category: null,
  location: null,
  estimated_budget: null,
}

function mountPage() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useQuoteRequestsStore()
  vi.spyOn(store, 'fetchList').mockResolvedValue(undefined as never)
  store.list = [
    { ...base, id: 10, title: 'PROPIA', client_user_id: 1 },
    { ...base, id: 11, title: 'AJENA', client_user_id: 2 },
  ] as never
  const role = useActiveRoleStore()
  role.roles = ['prestador']
  vi.spyOn(role, 'loadRoles').mockResolvedValue(undefined as never)
  vi.spyOn(useServiceCategoriesStore(), 'ensureLoaded').mockResolvedValue(undefined as never)
  vi.spyOn(useLocationsStore(), 'ensureCountries').mockResolvedValue([] as never)
  useAuthStore().user = { id: 1 } as never

  return mount(Page, { global: { plugins: [pinia, createVuetify()] } })
}

describe('botón Postular en el listado (exploración)', () => {
  it('no aparece en la solicitud propia y sí en la ajena', () => {
    const cards = mountPage().findAll('.v-card.h-100')
    const own = cards.find(c => c.text().includes('PROPIA'))!
    const other = cards.find(c => c.text().includes('AJENA'))!
    expect(own.text()).not.toContain('Postular')
    expect(other.text()).toContain('Postular')
  })
})
