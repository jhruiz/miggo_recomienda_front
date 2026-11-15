/**
 * Pruebas de PRESERVACIÓN del centro de notificaciones (Property 2).
 *
 * Observadas sobre el código SIN corregir; deben pasar antes y después del fix:
 *  - Contador de no leídas y representación "99+" (> 100).
 *  - Marcado individual (decrementa el contador una sola vez) y masivo (a 0).
 *  - Orden del listado tal como lo entrega el backend (fecha descendente).
 *  - Distinción visual de las no leídas (fondo, punto y avatar primario).
 *
 * Solo se sustituye la capa HTTP (`notificationsService`) y el WebSocket (Echo);
 * el store Pinia y la vista son reales.
 *
 * **Validates: Requirements 3.7**
 */
import { flushPromises, mount } from '@vue/test-utils'
import fc from 'fast-check'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createVuetify } from 'vuetify'
import NotificationsPage from '../index.vue'
import { notificationsService, profileService } from '@/services'
import type { Notification } from '@/services'
import { useNotificationsStore } from '@/stores/notifications'

// WebSocket fuera del alcance de estas pruebas.
vi.mock('@/plugins/echo', () => {
  const channel = { listen: () => channel }

  return { echo: { private: () => channel, leave: () => {} }, default: () => {} }
})

// Las propiedades montan el componente real; 100 ejecuciones superan los 5 s por defecto.
vi.setConfig({ testTimeout: 180_000 })

beforeAll(() => {
  const g = globalThis as any

  g.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      onchange: null,
      dispatchEvent: () => false,
    })) as any
  }
})

const original = { ...notificationsService }
const originalMe = profileService.me

/** Estado "servidor" en memoria detrás de la capa HTTP. */
let server: { list: Notification[], count: number, display?: string, markCalls: number[], markAllCalls: number }

function toDisplay(n: number) {
  return n > 100 ? '99+' : String(n)
}

beforeEach(() => {
  server = { list: [], count: 0, markCalls: [], markAllCalls: 0 }
  notificationsService.list = async () => server.list.map(n => ({ ...n }))
  notificationsService.unreadCount = async () => ({ count: server.count, display: server.display ?? toDisplay(server.count) })
  notificationsService.markAsRead = async (id: number) => {
    server.markCalls.push(id)
    const n = server.list.find(x => x.id === id)!

    return { ...n, is_read: true, read_at: '2026-01-01T00:00:00Z' }
  }
  notificationsService.markAllAsRead = async () => {
    server.markAllCalls++

    return server.list.length
  }
  ;(profileService as any).me = async () => ({ id: 1, name: 'Ana', roles: ['cliente'] })
})

afterEach(() => {
  Object.assign(notificationsService, original)
  ;(profileService as any).me = originalMe
})

function makeNotification(id: number, isRead: boolean, minutesAgo: number): Notification {
  return {
    id,
    type: 'quote.received',
    data: { quote_id: id, quote_request_id: 10 },
    is_read: isRead,
    read_at: isRead ? '2026-01-01T00:00:00Z' : null,
    created_at: new Date(Date.UTC(2026, 0, 2) - minutesAgo * 60_000).toISOString(),
  }
}

async function mountPage() {
  const pinia = createPinia()

  setActivePinia(pinia)

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
  })

  await router.push('/notifications')
  await router.isReady()

  const wrapper = mount(NotificationsPage, { global: { plugins: [pinia, createVuetify(), router] } })

  await flushPromises()

  return { wrapper, store: useNotificationsStore() }
}

/** Lista arbitraria de notificaciones con ids únicos y fechas descendentes. */
const notificationsArb = fc
  .array(fc.boolean(), { minLength: 1, maxLength: 8 })
  .map(flags => flags.map((isRead, i) => makeNotification(i + 1, isRead, i * 5)))

describe('notifications/index.vue - preservación', () => {
  it('muestra "99+" cuando hay más de 100 no leídas', async () => {
    server.list = [makeNotification(1, false, 0)]
    server.count = 150

    const { wrapper, store } = await mountPage()

    expect(store.unreadDisplay).toBe('99+')
    expect(wrapper.text()).toContain('99+')
    wrapper.unmount()
  })

  it('sin no leídas: botón de marcar todas deshabilitado y mensaje "al día"', async () => {
    server.list = [makeNotification(1, true, 0)]
    server.count = 0

    const { wrapper } = await mountPage()
    const btn = wrapper.findAll('button').find(b => b.text().includes('Marcar todas como leídas'))!

    expect(btn.attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('Estás al día con tus notificaciones.')
    wrapper.unmount()
  })

  it('propiedad: el listado conserva el orden descendente y distingue las no leídas', async () => {
    await fc.assert(
      fc.asyncProperty(notificationsArb, async list => {
        server.list = list
        server.count = list.filter(n => !n.is_read).length

        const { wrapper, store } = await mountPage()
        const items = wrapper.findAll('.v-list-item')

        expect(store.notifications.map(n => n.id)).toEqual(list.map(n => n.id))
        expect(items).toHaveLength(list.length)

        const times = store.notifications.map(n => Date.parse(n.created_at!))

        for (let i = 1; i < times.length; i++)
          expect(times[i - 1]).toBeGreaterThanOrEqual(times[i])

        list.forEach((n, i) => {
          const style = items[i].attributes('style') ?? ''

          expect(style.includes('background-color')).toBe(!n.is_read)
          expect(items[i].find('.v-badge').exists()).toBe(!n.is_read)
        })
        wrapper.unmount()
      }),
      { numRuns: 100 },
    )
  })

  it('propiedad: clic en no leída la marca y decrementa el contador; clic en leída no llama a markAsRead', async () => {
    await fc.assert(
      fc.asyncProperty(notificationsArb, fc.integer({ min: 0, max: 200 }), async (list, extra) => {
        server.markCalls = []
        server.list = list

        const unread = list.filter(n => !n.is_read).length

        server.count = unread + extra

        const { wrapper, store } = await mountPage()
        const items = wrapper.findAll('.v-list-item')

        for (let i = 0; i < list.length; i++) {
          await items[i].trigger('click')
          await flushPromises()
        }

        const expectedCount = extra

        expect(server.markCalls).toEqual(list.filter(n => !n.is_read).map(n => n.id))
        expect(store.unreadCount).toBe(expectedCount)
        expect(store.unreadDisplay).toBe(toDisplay(expectedCount))
        expect(store.notifications.every(n => n.is_read)).toBe(true)
        wrapper.unmount()
      }),
      { numRuns: 100 },
    )
  })

  it('propiedad: "Marcar todas como leídas" deja el contador en 0 y todas leídas', async () => {
    await fc.assert(
      fc.asyncProperty(notificationsArb, fc.integer({ min: 1, max: 300 }), async (list, count) => {
        server.markAllCalls = 0
        server.list = list
        server.count = count

        const { wrapper, store } = await mountPage()
        const btn = wrapper.findAll('button').find(b => b.text().includes('Marcar todas como leídas'))!

        await btn.trigger('click')
        await flushPromises()

        expect(server.markAllCalls).toBe(1)
        expect(store.unreadCount).toBe(0)
        expect(store.unreadDisplay).toBe('0')
        expect(store.notifications.every(n => n.is_read)).toBe(true)
        wrapper.unmount()
      }),
      { numRuns: 100 },
    )
  })
})
