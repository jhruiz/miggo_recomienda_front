/**
 * Exploración C6/C12: el clic en una notificación no navega. DEBE FALLAR sin corregir.
 *
 * **Validates: Requirements 1.8, 1.12**
 */
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createVuetify } from 'vuetify'
import { useNotificationsStore } from '@/stores/notifications'

const push = vi.fn()

vi.mock('vue-router', async () => {
  const actual = await vi.importActual<typeof import('vue-router')>('vue-router')

  return { ...actual, useRouter: () => ({ push }), useRoute: () => ({ query: {} }) }
})

// WebSocket fuera del alcance de estas pruebas.
vi.mock('@/plugins/echo', () => {
  const channel = { listen: () => channel }

  return { echo: { private: () => channel, leave: () => {} } }
})

import Page from '../index.vue'

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as never

function setup(isRead: boolean) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useNotificationsStore()
  vi.spyOn(store, 'fetchList').mockResolvedValue(undefined as never)
  vi.spyOn(store, 'fetchUnreadCount').mockResolvedValue(undefined as never)
  vi.spyOn(store, 'subscribe').mockResolvedValue(undefined as never)
  const markAsRead = vi.spyOn(store, 'markAsRead').mockResolvedValue(undefined as never)
  store.notifications = [{
    id: 5,
    type: 'quote_request.edited',
    data: { quote_request_id: 10 },
    is_read: isRead,
    read_at: null,
    created_at: null,
  }]
  const wrapper = mount(Page, { global: { plugins: [pinia, createVuetify()] } })

  return { wrapper, markAsRead }
}

describe('clic en notificación (exploración)', () => {
  beforeEach(() => push.mockClear())

  it('no leída: marca como leída y navega al destino', async () => {
    const { wrapper, markAsRead } = setup(false)
    await wrapper.find('.v-list-item').trigger('click')
    expect(markAsRead).toHaveBeenCalledWith(5)
    expect(push).toHaveBeenCalledWith('/quote-requests/10')
  })

  it('ya leída: no vuelve a marcar y aun así navega', async () => {
    const { wrapper, markAsRead } = setup(true)
    await wrapper.find('.v-list-item').trigger('click')
    expect(markAsRead).not.toHaveBeenCalled()
    expect(push).toHaveBeenCalledWith('/quote-requests/10')
  })
})
