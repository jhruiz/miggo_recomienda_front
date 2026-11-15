export const routes = [
  { path: '/', redirect: '/dashboard' },
  {
    path: '/',
    component: () => import('@/layouts/default.vue'),
    children: [
      {
        path: 'dashboard',
        component: () => import('@/pages/dashboard.vue'),
      },
      {
        path: 'account-settings',
        component: () => import('@/pages/account-settings.vue'),
      },
      {
        path: 'typography',
        component: () => import('@/pages/typography.vue'),
      },
      {
        path: 'icons',
        component: () => import('@/pages/icons.vue'),
      },
      {
        path: 'cards',
        component: () => import('@/pages/cards.vue'),
      },
      {
        path: 'tables',
        component: () => import('@/pages/tables.vue'),
      },
      {
        path: 'form-layouts',
        component: () => import('@/pages/form-layouts.vue'),
      },
      {
        // /vista se eliminó (acceso unificado): redirige al dashboard.
        path: 'vista',
        redirect: '/dashboard',
      },
      {
        // Listado y búsqueda pública de prestadores con filtros y paginación
        // (Requisitos 13.1, 13.2, 13.6).
        path: 'providers',
        component: () => import('@/pages/providers/index.vue'),
      },
      {
        // Perfil público (solo lectura) de un prestador por id de
        // provider_profile (Requisito 3.1).
        path: 'providers/:id',
        component: () => import('@/pages/providers/[id].vue'),
      },
      {
        // Edición del perfil de prestador y gestión del portafolio del
        // prestador autenticado (Requisito 3.4).
        path: 'provider-profile',
        component: () => import('@/pages/provider-profile.vue'),
      },
      {
        // Listado y filtrado público de solicitudes de cotización, útil para
        // que los prestadores naveguen y postulen (Requisitos 4.3, 4.4).
        path: 'quote-requests',
        component: () => import('@/pages/quote-requests/index.vue'),
      },
      {
        // Creación de una solicitud por el Cliente (Requisitos 4.1, 4.2).
        // DEBE declararse antes de la ruta con parámetro :id para no ser
        // capturada como un id.
        path: 'quote-requests/new',
        component: () => import('@/pages/quote-requests/new.vue'),
      },
      {
        // Postulaciones de una solicitud y selección de ganador por el Cliente
        // dueño (Requisitos 4.4, 4.5). Antes de :id por el mismo motivo.
        path: 'quote-requests/:id/applications',
        component: () => import('@/pages/quote-requests/[id]/applications.vue'),
      },
      {
        // Postulaciones del Prestador autenticado. Antes de :id.
        path: 'quote-requests/my-applications',
        component: () => import('@/pages/quote-requests/my-applications.vue'),
      },
      {
        // Detalle de una solicitud con acciones contextuales (postular, editar,
        // cerrar) según el rol/propiedad (Requisitos 4.2, 4.4, 4.7).
        path: 'quote-requests/:id',
        component: () => import('@/pages/quote-requests/[id].vue'),
      },
      {
        // Listado de los Trabajos del usuario autenticado (como Cliente o
        // Prestador), con su estado (Requisito 7.2).
        path: 'jobs',
        component: () => import('@/pages/jobs/index.vue'),
      },
      {
        // Detalle de un Trabajo con acciones contextuales: completar, confirmar,
        // rechazar finalización y cancelar por mutuo acuerdo (Requisitos 7.3,
        // 7.4, 7.6, 7.7).
        path: 'jobs/:id',
        component: () => import('@/pages/jobs/[id].vue'),
      },
      {
        // Creación de una cotización por el Prestador para una solicitud, con
        // ítems dinámicos y adjuntos (Requisito 5.1). La solicitud destino se
        // recibe por query string (?quote_request_id=123).
        path: 'quotes/new',
        component: () => import('@/pages/quotes/new.vue'),
      },
      {
        // Cotizaciones enviadas por el Prestador.
        path: 'quotes/sent',
        component: () => import('@/pages/quotes/sent.vue'),
      },
      {
        // Cotizaciones recibidas por el Cliente.
        path: 'quotes/received',
        component: () => import('@/pages/quotes/received.vue'),
      },
      {
        // Vista comparativa lado a lado de las cotizaciones de una solicitud,
        // con aceptar/rechazar para el Cliente dueño (Requisitos 5.6, 5.7, 5.8).
        path: 'quotes/request/:quoteRequestId',
        component: () => import('@/pages/quotes/request/[quoteRequestId].vue'),
      },
      {
        // Detalle de cotización para sus partes. Restringida a dígitos para no
        // capturar new, sent ni received.
        path: 'quotes/:id(\\d+)',
        component: () => import('@/pages/quotes/[id].vue'),
      },
      {
        // Mensajería en tiempo real: listado de canales y conversación
        // (tarea 13.6, Requisitos 11.4, 11.9). Un único componente de dos
        // paneles sirve tanto el índice como el canal abierto.
        path: 'chat',
        component: () => import('@/pages/chat/index.vue'),
      },
      {
        // Conversación de un canal concreto (enlace directo). Reutiliza el
        // componente de dos paneles, que abre el canal indicado por la ruta.
        path: 'chat/:channelId',
        component: () => import('@/pages/chat/index.vue'),
      },
      {
        // Centro de notificaciones: listado, contador de no leídas y marcado
        // de leídas, con recepción en tiempo real por `private-user.{userId}`
        // (tarea 14.4, Requisitos 12.3, 12.4, 12.5, 12.7).
        path: 'notifications',
        component: () => import('@/pages/notifications/index.vue'),
      },
    ],
  },
  {
    path: '/',
    component: () => import('@/layouts/blank.vue'),
    children: [
      {
        path: 'login',
        component: () => import('@/pages/login.vue'),
      },
      {
        path: 'register',
        component: () => import('@/pages/register.vue'),
      },
      {
        path: '/:pathMatch(.*)*',
        component: () => import('@/pages/[...error].vue'),
      },
    ],
  },
]
