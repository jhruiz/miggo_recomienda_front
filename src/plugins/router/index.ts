import type { App } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import { routes } from './routes'
import { getAuthToken } from '@/services/http'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

/**
 * Guard de autenticación (Requisito 14.6).
 *
 * Las rutas públicas son únicamente el inicio de sesión y el registro. Si un
 * usuario sin token intenta acceder a cualquier otra ruta (todas las del layout
 * autenticado), se le redirige a `/login` sin exponer su contenido. A un usuario
 * ya autenticado que visita `/login` o `/register` se le envía al inicio.
 */
const PUBLIC_ROUTES = ['/login', '/register']

router.beforeEach(async to => {
  const isAuthenticated = !!getAuthToken()
  const isPublic = PUBLIC_ROUTES.includes(to.path)

  if (!isAuthenticated && !isPublic)
    return { path: '/login', query: to.fullPath !== '/' ? { redirect: to.fullPath } : undefined }

  if (isAuthenticated && isPublic)
    return { path: '/' }

  // El token sobrevive a la recarga, el usuario no: se recupera aquí una sola
  // vez para que las vistas que deciden por propiedad (dueño de la solicitud,
  // partes de la cotización) lo tengan disponible al montarse.
  if (isAuthenticated)
    await useAuthStore().ensureUser()

  return true
})

export default function (app: App) {
  app.use(router)
}

export { router }
