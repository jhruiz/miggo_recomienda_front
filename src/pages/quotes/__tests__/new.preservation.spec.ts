/**
 * Pruebas de PRESERVACIÓN de `quotes/new.vue` (Property 2).
 *
 * Observadas sobre el código SIN corregir; deben pasar antes y después del fix.
 * Cubren cálculo de subtotales/total, límites (50 ítems, 5 adjuntos), mínimo de
 * una fila y eliminación de filas.
 *
 * **Validates: Requirements 3.9**
 */
import { mount } from '@vue/test-utils'
import fc from 'fast-check'
import { createPinia, setActivePinia } from 'pinia'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createVuetify } from 'vuetify'
import NewQuotePage from '../new.vue'

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

async function mountPage() {
  const pinia = createPinia()

  setActivePinia(pinia)

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
  })

  await router.push('/quotes/new?quote_request_id=10')
  await router.isReady()

  return mount(NewQuotePage, {
    global: { plugins: [pinia, createVuetify(), router] },
  })
}

interface Row { description: string; unit_price: number | null; quantity: number | null }

const rowArb: fc.Arbitrary<Row> = fc.record({
  description: fc.string({ maxLength: 20 }),
  unit_price: fc.option(fc.integer({ min: -1000, max: 10_000_000 }).map(c => c / 100), { nil: null }),
  quantity: fc.option(fc.integer({ min: -2, max: 9999 }), { nil: null }),
})

function expectedSubtotal(row: Row): number {
  const price = row.unit_price ?? 0
  const qty = row.quantity ?? 0

  return price > 0 && qty > 0 ? price * qty : 0
}

describe('quotes/new.vue - preservación', () => {
  it('empieza con exactamente una fila y total 0', async () => {
    const wrapper = await mountPage()
    const vm = wrapper.vm as any

    expect(vm.items).toHaveLength(1)
    expect(vm.runningTotal).toBe(0)
  })

  it('subtotal por fila = precio × cantidad (ejemplo)', async () => {
    const wrapper = await mountPage()
    const vm = wrapper.vm as any

    expect(vm.rowSubtotal({ description: 'x', unit_price: 12.5, quantity: 4 })).toBe(50)
    expect(vm.rowSubtotal({ description: 'x', unit_price: null, quantity: 4 })).toBe(0)
    expect(vm.rowSubtotal({ description: 'x', unit_price: 10, quantity: 0 })).toBe(0)
  })

  it('propiedad: runningTotal es la suma de subtotales de las filas', async () => {
    const wrapper = await mountPage()
    const vm = wrapper.vm as any

    await fc.assert(
      fc.asyncProperty(fc.array(rowArb, { minLength: 1, maxLength: 50 }), async rows => {
        vm.items = rows.map(r => ({ ...r }))
        await wrapper.vm.$nextTick()

        const expected = rows.reduce((sum, r) => sum + expectedSubtotal(r), 0)

        expect(vm.runningTotal).toBeCloseTo(expected, 6)
        for (const row of vm.items)
          expect(vm.rowSubtotal(row)).toBe(expectedSubtotal(row))
      }),
      { numRuns: 100 },
    )
  })

  it('propiedad: nunca más de 50 ítems al agregar', async () => {
    const wrapper = await mountPage()
    const vm = wrapper.vm as any

    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 80 }), async clicks => {
        vm.items = [{ description: '', unit_price: null, quantity: 1 }]
        for (let i = 0; i < clicks; i++)
          vm.addItem()

        expect(vm.items.length).toBe(Math.min(1 + clicks, 50))
      }),
      { numRuns: 100 },
    )
  })

  it('propiedad: nunca menos de una fila al eliminar; eliminar quita la fila indicada', async () => {
    const wrapper = await mountPage()
    const vm = wrapper.vm as any

    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),
        fc.array(fc.integer({ min: 0, max: 12 }), { maxLength: 30 }),
        async (size, removals) => {
          vm.items = Array.from({ length: size }, (_, i) => ({ description: `d${i}`, unit_price: 1, quantity: 1 }))

          for (const index of removals) {
            const before = vm.items.length
            const target = vm.items[index]

            vm.removeItem(index)

            expect(vm.items.length).toBeGreaterThanOrEqual(1)
            if (before > 1 && index < before)
              expect(vm.items).not.toContain(target)
            else
              expect(vm.items.length).toBe(before)
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  it('propiedad: máximo 5 adjuntos válidos; más de 5 se rechazan y se limpian', async () => {
    const wrapper = await mountPage()
    const vm = wrapper.vm as any

    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 9 }), async count => {
        const files = Array.from({ length: count }, (_, i) => new File(['x'], `f${i}.png`, { type: 'image/png' }))

        vm.onAttachmentsChange(files)

        if (count <= 5) {
          expect(vm.attachmentError).toBeNull()
          expect(vm.attachments).toHaveLength(count)
        }
        else {
          expect(vm.attachmentError).toContain('5')
          expect(vm.attachments).toHaveLength(0)
        }
      }),
      { numRuns: 100 },
    )
  })

  it('rechaza adjuntos con tipo no permitido', async () => {
    const wrapper = await mountPage()
    const vm = wrapper.vm as any

    vm.onAttachmentsChange([new File(['x'], 'a.pdf', { type: 'application/pdf' })])

    expect(vm.attachmentError).toContain('Tipo de archivo no permitido')
    expect(vm.attachments).toHaveLength(0)
  })

  it('el resumen muestra el conteo de ítems y se detiene en 50 / 50', async () => {
    const wrapper = await mountPage()
    const vm = wrapper.vm as any

    expect(wrapper.text()).toContain('1 / 50')

    for (let i = 0; i < 60; i++)
      vm.addItem()
    await wrapper.vm.$nextTick()

    expect(vm.items).toHaveLength(50)
    expect(wrapper.text()).toContain('50 / 50')
  })
})
