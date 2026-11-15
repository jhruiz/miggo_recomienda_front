/**
 * Exploración C3 (alineación) y C4 (redirección). DEBE FALLAR sobre el código sin corregir.
 *
 * **Validates: Requirements 1.4, 1.5, 1.6**
 */
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createVuetify } from 'vuetify'
import { useQuotesStore } from '@/stores/quotes'

const push = vi.fn()
let query: Record<string, string> = { quote_request_id: '10' }

vi.mock('vue-router', async () => {
  const actual = await vi.importActual<typeof import('vue-router')>('vue-router')

  return { ...actual, useRouter: () => ({ push }), useRoute: () => ({ query }) }
})

import Page from '../new.vue'

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as never

function mountPage() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useQuotesStore()
  vi.spyOn(store, 'create').mockResolvedValue({ id: 57 } as never)
  vi.spyOn(store, 'respondDirect').mockResolvedValue({ id: 61 } as never)

  return mount(Page, { global: { plugins: [pinia, createVuetify()] } })
}

async function fillAndSubmit(wrapper: ReturnType<typeof mountPage>) {
  const vm = wrapper.vm as any
  vm.serviceDescription = 'Servicio'
  vm.deliveryDays = 5
  vm.expirationDays = 7
  vm.items = [{ description: 'Ítem', unit_price: 100, quantity: 2 }]
  await wrapper.vm.$nextTick()
  await vm.submit()
}

describe('quotes/new.vue (exploración)', () => {
  beforeEach(() => {
    push.mockClear()
    query = { quote_request_id: '10' }
  })

  it('C3: la fila de ítems usa align-start y no align-center', () => {
    const row = mountPage().findAll('.v-row').find(
      r => r.text().includes('Precio unitario') && r.find('.v-row').exists() === false,
    )!
    expect(row.classes()).toContain('align-start')
    expect(row.classes()).not.toContain('align-center')
  })

  it('C4 público: navega a /quotes/{id}?sent=1 y no a /quotes/request/{id}', async () => {
    await fillAndSubmit(mountPage())
    expect(push).toHaveBeenCalledWith({ path: '/quotes/57', query: { sent: '1' } })
    expect(push).not.toHaveBeenCalledWith('/quotes/request/10')
  })

  it('C4 directo: navega a /quotes/{id}?sent=1', async () => {
    query = { direct_quote_id: '61' }
    await fillAndSubmit(mountPage())
    expect(push).toHaveBeenCalledWith({ path: '/quotes/61', query: { sent: '1' } })
  })
})
