import Echo from 'laravel-echo'
import Pusher from 'pusher-js'
import type { App } from 'vue'
import http from '@/services/http'

declare global {
  interface Window {
    Pusher: typeof Pusher
    Echo: Echo<'reverb'>
  }
}

/**
 * URL de autorización de canales privados en el BACKEND.
 *
 * Se deriva del origen de `VITE_API_BASE_URL` (p. ej. `http://localhost:8000`)
 * porque el frontend corre en otro origen (Vite): una ruta relativa iría al
 * servidor de Vite y la suscripción fallaría. El backend la expone en
 * `/api/broadcasting/auth` con `auth:sanctum` (bootstrap/app.php).
 */
function resolveBroadcastAuthUrl(): string {
  const base = import.meta.env.VITE_API_BASE_URL?.trim() || '/api/v1'
  const origin = new URL(base, window.location.origin).origin

  return `${origin}/api/broadcasting/auth`
}

const broadcastAuthUrl = resolveBroadcastAuthUrl()

/**
 * Instancia de Laravel Echo configurada con el driver `reverb`.
 *
 * Se conecta al servidor WebSocket de Laravel Reverb y se usa desde los
 * stores de `chat` y `notifications` para suscribirse a los canales privados
 * `private-chat.{channelId}` y `private-user.{userId}`.
 *
 * La autorización usa el cliente Axios de la app, que añade el token Bearer
 * VIGENTE en cada petición. Así funciona también tras iniciar sesión sin
 * recargar (antes el token se leía una sola vez al cargar el módulo).
 */
export const echo = new Echo<'reverb'>({
  broadcaster: 'reverb',
  // Cliente explícito: no depende de que `window.Pusher` exista al evaluar el módulo.
  Pusher,
  key: import.meta.env.VITE_REVERB_APP_KEY,
  wsHost: import.meta.env.VITE_REVERB_HOST,
  wsPort: Number(import.meta.env.VITE_REVERB_PORT),
  wssPort: Number(import.meta.env.VITE_REVERB_PORT),
  forceTLS: import.meta.env.VITE_REVERB_SCHEME === 'https',
  enabledTransports: ['ws', 'wss'],
  authorizer: (channel: { name: string }) => ({
    authorize: (socketId: string, callback: (error: Error | null, data: any) => void) => {
      http.post(broadcastAuthUrl, { socket_id: socketId, channel_name: channel.name })
        .then(response => callback(null, response.data))
        .catch(error => callback(error instanceof Error ? error : new Error(String(error)), null))
    },
  }),
})

export default function (app: App) {
  window.Pusher = Pusher
  window.Echo = echo
  app.provide('echo', echo)
}