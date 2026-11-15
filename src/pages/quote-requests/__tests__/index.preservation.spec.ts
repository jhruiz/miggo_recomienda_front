/**
 * Pruebas de PRESERVACIÓN del listado `quote-requests/index.vue` y del detalle
 * `quote-requests/[id].vue` (Property 2).
 *
 * Observadas sobre el código SIN corregir; deben pasar antes y después del fix:
 *  - En solicitudes AJENAS (client_user_id ≠ auth.user.id) el botón "Postular"
 *    se muestra si y solo si la solicitud está "abierta" y el usuario tiene rol
 *    de Prestador.
 *  - El dueño en el detalle ve sus acciones (postulaciones, cotizaciones,
 *    editar, cerrar) y no la acción de postular.
 *
 * Las acciones de red de los stores se sustituyen por no-ops para aislar la
 * vista; el estado de los stores es real (Pinia).
 *
 * **Validates: Requirements 3.6, 3.8, 3.10**
 */
import { flushPromises, mount } from '@vue/test-utils'
import fc from 'fast-check'
import { createPinia, setActivePinia } from 'pinia'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createVuetify } from 'vuetify'
import DetailPage from '../[id].vue'
import ListPage from '../index.vue'
import type { QuoteRequest, QuoteRequestStatus } from '@/services'
import { useActiveRoleStore } from '@/stores/activeRole'
import { useAuthStore } from '@/stores/auth'
import { useLocationsStore } from '@/stores/locations'
import { useQuoteRequestsStore } from '@/stores/quoteRequests'
import { useServiceCategoriesStore } from '@/stores/serviceCategories'

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

const AUTH_USER_ID = 1

function makeRequest(id: number, clientId: number, status: QuoteRequestStatus): QuoteRequest {
  return {
    id,
    client_user_id: clientId,
    client_name: 'Cliente',
    service_category_id: 1,
    category: null,
    title: `Solicitud ${id}`,
    description: 'Descripción',
    city_id: null,
    city: null,
    location: null,
    estimated_budget: null,
    reference_images: [],
    status,
    created_at: null,
    updated_at: null,
  }
}

/** Prepara Pinia con stores reales y acciones de red neutralizadas. */
function setupStores(roles: Array<'cliente' | 'prestador'>) {
  const pinia = createPinia()

  setActivePinia(pinia)

  const auth = useAuthStore()
  const activeRole = useActiveRoleStore()
  const qr = useQuoteRequestsStore()
  const categories = useServiceCategoriesStore()
  const locations = useLocationsStore()

  auth.user = { id: AUTH_USER_ID, name: 'Ana' } as any
  activeRole.roles = roles
  ;(activeRole as any).loadRoles = async () => ({})
  ;(qr as any).fetchList = async () => qr.list
  ;(qr as any).fetchById = async () => qr.current
  ;(categories as any).ensureLoaded = async () => []
  ;(locations as any).ensureCountries = async () => []
  ;(locations as any).ensureDepartments = async () => []
  ;(locations as any).ensureCities = async () => []

  return { pinia, qr }
}

async function makeRouter(path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/quote-requests/:id', component: DetailPage },
      { path: '/:pathMatch(.*)*', component: { template: '<div />' } },
    ],
  })

  await router.push(path)
  await router.isReady()

  return router
}

function applyButtons(wrapper: ReturnType<typeof mount>) {
  return wrapper.findAll('button').filter(b => /Postular|Postulado/.test(b.text()))
}

const statusArb = fc.constantFrom<QuoteRequestStatus>('abierta', 'en_proceso', 'cerrada')

describe('quote-requests/index.vue - preservación (solicitudes ajenas)', () => {
  it('ejemplo: muestra "Postular" en una solicitud abierta ajena con rol Prestador', async () => {
    const { pinia, qr } = setupStores(['cliente', 'prestador'])
    const router = await makeRouter('/quote-requests')

    qr.list = [makeRequest(22, 99, 'abierta')]

    const wrapper = mount(ListPage, { global: { plugins: [pinia, createVuetify(), router] } })

    await flushPromises()

    expect(applyButtons(wrapper)).toHaveLength(1)
    wrapper.unmount()
  })

  it('propiedad: botón visible ⇔ estado "abierta" ∧ hasProviderRole (client_user_id ≠ auth.user.id)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            clientId: fc.integer({ min: 2, max: 1000 }),
            status: statusArb,
          }),
          { minLength: 1, maxLength: 6 },
        ),
        fc.boolean(),
        async (specs, hasProvider) => {
          const { pinia, qr } = setupStores(hasProvider ? ['cliente', 'prestador'] : ['cliente'])
          const router = await makeRouter('/quote-requests')

          qr.list = specs.map((s, i) => makeRequest(i + 100, s.clientId, s.status))

          const wrapper = mount(ListPage, { global: { plugins: [pinia, createVuetify(), router] } })

          await flushPromises()

          const expected = hasProvider ? specs.filter(s => s.status === 'abierta').length : 0

          expect(applyButtons(wrapper)).toHaveLength(expected)
          wrapper.unmount()
        },
      ),
      { numRuns: 100 },
    )
  })
})

describe('quote-requests/[id].vue - preservación (detalle del dueño)', () => {
  it('el dueño ve sus acciones y no la de postular', async () => {
    const { pinia, qr } = setupStores(['cliente', 'prestador'])
    const router = await makeRouter('/quote-requests/10')

    qr.current = makeRequest(10, AUTH_USER_ID, 'abierta')

    const wrapper = mount(DetailPage, { global: { plugins: [pinia, createVuetify(), router] } })

    await flushPromises()

    const text = wrapper.text()

    expect(text).toContain('Ver postulaciones')
    expect(text).toContain('Ver cotizaciones')
    expect(text).toContain('Editar solicitud')
    expect(text).toContain('Cerrar solicitud')
    expect(text).not.toContain('Postular a esta solicitud')
    wrapper.unmount()
  })

  it('un Prestador no dueño ve "Postular a esta solicitud" y no acciones de dueño', async () => {
    const { pinia, qr } = setupStores(['cliente', 'prestador'])
    const router = await makeRouter('/quote-requests/22')

    qr.current = makeRequest(22, 99, 'abierta')

    const wrapper = mount(DetailPage, { global: { plugins: [pinia, createVuetify(), router] } })

    await flushPromises()

    const text = wrapper.text()

    expect(text).toContain('Postular a esta solicitud')
    expect(text).not.toContain('Ver postulaciones')
    expect(text).not.toContain('Cerrar solicitud')
    wrapper.unmount()
  })
})
