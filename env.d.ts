/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL de la API REST del backend, incluyendo el prefijo `/api/v1`. */
  readonly VITE_API_BASE_URL: string
  /** App key de Laravel Reverb (debe coincidir con `REVERB_APP_KEY` del backend). */
  readonly VITE_REVERB_APP_KEY: string
  /** Host del servidor WebSocket de Reverb. */
  readonly VITE_REVERB_HOST: string
  /** Puerto del servidor WebSocket de Reverb. */
  readonly VITE_REVERB_PORT: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

import 'vue-router'
declare module 'vue-router' {
  interface RouteMeta {
    action?: string
    subject?: string
    layoutWrapperClasses?: string
    navActiveLink?: RouteLocationRaw
    layout?: 'blank' | 'default'
    unauthenticatedOnly?: boolean
    public?: boolean
  }
}
