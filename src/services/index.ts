/**
 * Punto de entrada de la capa de servicios API.
 *
 * Cada módulo del dominio (auth, profile, quotes, jobs, chat, notifications)
 * expondrá aquí su propio servicio que envuelve las llamadas Axios a los
 * endpoints `/api/v1`. Por ahora solo se exporta el cliente HTTP base y sus
 * tipos; los servicios por módulo se agregarán en tareas posteriores.
 *
 * Ejemplo de uso futuro:
 * ```ts
 * import http, { unwrap } from '@/services'
 *
 * export const authService = {
 *   login: (payload: LoginPayload) =>
 *     http.post('/auth/login', payload).then(unwrap),
 * }
 * ```
 */

export { default, default as http, unwrap, getAuthToken, AUTH_TOKEN_KEY } from './http'
export type { ApiEnvelope, ApiMeta } from './http'

export { authService } from './auth'
export type {
  AuthUser,
  UserRole,
  LoginPayload,
  LoginResult,
  RegisterPayload,
  RegisterResult,
} from './auth'

export { profileService } from './profile'
export type {
  ProviderProfile,
  ActivateProviderResult,
} from './profile'

export { providersService } from './providers'
export type {
  ProviderCategory,
  AverageRating,
  ComplianceIndex,
  ProviderReview,
  ProviderListItem,
  ProviderPublicProfile,
  ProviderSearchFilters,
  ProviderListResult,
  UpdateProviderProfilePayload,
  OwnProviderProfile,
} from './providers'

// Portafolios múltiples del Prestador (spec portafolios-multiples, tarea 7.3).
export { portfoliosService } from './portfolios'
export type {
  OwnerPortfolio,
  OwnerPortfolioItem,
  PortfolioCategory,
  PublicPortfolio,
  PublicPortfolioItem,
  PortfolioLimits,
  PortfolioListResult,
  CreatePortfolioPayload,
  UpdatePortfolioPayload,
} from './portfolios'

export { quoteRequestsService } from './quoteRequests'
export type {
  QuoteRequestStatus,
  QuoteRequestCategory,
  CityLocation,
  QuoteRequest,
  QuoteRequestApplication,
  QuoteRequestFilters,
  QuoteRequestListResult,
  MyApplicationsParams,
  MyApplicationItem,
  MyApplicationsListResult,
  CreateQuoteRequestPayload,
  UpdateQuoteRequestPayload,
} from './quoteRequests'

export { quotesService } from './quotes'
export type {
  QuoteStatus,
  QuoteItem,
  QuoteAttachment,
  Quote,
  QuoteJob,
  QuoteItemInput,
  CreateQuotePayload,
  RequestDirectQuotePayload,
  RespondDirectQuotePayload,
  AcceptQuoteResult,
  QuoteSummary,
  QuoteListParams,
  QuoteListResult,
} from './quotes'

export { jobsService } from './jobs'
export type {
  JobStatus,
  Job,
  JobPhoto,
  JobReasonPayload,
  PendingRatingSummary,
} from './jobs'

export { ratingsService } from './ratings'
export type {
  Rating,
  SubmitRatingPayload,
} from './ratings'

// Chat (tarea 13.6, Requisitos 11.4, 11.9).
export { chatService } from './chat'
export type {
  ChatChannelStatus,
  ChatChannel,
  ChatMessage,
  ChatMessagesResult,
} from './chat'

// Notificaciones (tarea 14.4, Requisitos 12.3, 12.4, 12.5, 12.7).
export { notificationsService } from './notifications'
export type {
  Notification,
  NewNotificationPayload,
  UnreadCount,
} from './notifications'

// Catálogo de categorías de servicio (tarea 18.2, Requisitos 4.9, 13.7).
export { serviceCategoriesService } from './serviceCategories'
export type { ServiceCategory } from './serviceCategories'

// Muro de portafolios (spec muro-de-portafolios, tarea 11.1).
export { wallService } from './wall'
export type {
  InteractionState,
  PrivacyStatus,
  FeedEventType,
  WallFeedMeta,
  WallCategoryFilter,
  WallCityFilter,
  WallFilters,
  PrivacySummary,
  FeedEventHistoryItem,
  FeedEventHistoryPage,
  // Muro de Trabajos y Portafolios (spec muro-trabajos-portafolios, tarea 10.1).
  SubjectType,
  WallTab,
  WallEventType,
  WallEventPayload,
  WallPortfolioFilters,
  WallFiltersByTab,
  WallCategoryRef,
  WallPhoto,
  ComplianceKind,
  ComplianceSummary,
  ClientRating,
  WallJobCard,
  WallJobDetail,
  WallPortfolioLayout,
  WallPortfolioProvider,
  WallPortfolioCard,
  WallPortfolioDetail,
  WallTabPage,
  WallTabResult,
  WallSavedTabResult,
  WallTabParams,
} from './wall'

// Catálogo de ubicaciones (tarea 19.5, Requisitos 15.4, 15.5, 15.6).
export { locationsService } from './locations'
export type { Country, Department, City } from './locations'
