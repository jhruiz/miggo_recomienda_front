/**
 * Exploración C4/C7/C8: rutas ausentes. DEBE FALLAR sobre el código sin corregir.
 *
 * **Validates: Requirements 1.6, 1.9, 1.10, 1.11**
 */
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { routes } from '../routes'

const router = createRouter({ history: createMemoryHistory(), routes })

/** Ruta final coincidente; la captura universal `pathMatch` cuenta como "no existe". */
function matchedPath(path: string): string | undefined {
  const last = router.resolve(path).matched.at(-1)

  return last && !last.path.includes('pathMatch') ? last.path : undefined
}

describe('rutas del flujo de cotizaciones (exploración)', () => {
  it('/quotes/61 resuelve a la página de detalle', () => {
    expect(matchedPath('/quotes/61')).toMatch(/quotes\/:id/)
  })

  it('/quotes/sent resuelve a su página', () => {
    expect(matchedPath('/quotes/sent')).toBe('/quotes/sent')
  })

  it('/quotes/received resuelve a su página', () => {
    expect(matchedPath('/quotes/received')).toBe('/quotes/received')
  })

  it('/quote-requests/my-applications no es capturada por quote-requests/:id', () => {
    expect(matchedPath('/quote-requests/my-applications')).toBe('/quote-requests/my-applications')
  })

  it('/quotes/new no es capturada por quotes/:id(\\d+) y /quotes/61 sí resuelve', () => {
    expect(matchedPath('/quotes/new')).toBe('/quotes/new')
    expect(matchedPath('/quotes/61')).toMatch(/quotes\/:id/)
  })
})
