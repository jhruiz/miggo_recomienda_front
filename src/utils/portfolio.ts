export const MAX_PORTFOLIOS = 20
export const MAX_PHOTOS_PER_PORTFOLIO = 10
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const GENERIC_ERROR = 'No se pudo completar la acción. Revisa tu conexión e inténtalo de nuevo.'

/** null si es válido; si no, el motivo (tipo o tamaño) en español. */
export function validateImageFile (file: Pick<File, 'type' | 'size'> | null): string | null {
  if (!file) {
    return null
  }
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return 'El archivo debe ser una imagen JPG, PNG o WebP.'
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return 'La imagen no puede superar los 10 MB.'
  }
  return null
}

export interface UploadStateInput {
  hasPortfolios: boolean
  portfolio: { photos_count: number } | null
  files: Array<Pick<File, 'type' | 'size'>>
  uploading: boolean
}

export interface UploadState {
  canUpload: boolean
  reason: string | null
}

/** Orden de motivos: sin portafolios → límite → sin archivo → archivo inválido → en curso. */
export function getUploadState (input: UploadStateInput): UploadState {
  if (!input.hasPortfolios || !input.portfolio) {
    return { canUpload: false, reason: 'Crea un portafolio para subir fotos.' }
  }
  if (input.portfolio.photos_count >= MAX_PHOTOS_PER_PORTFOLIO) {
    return {
      canUpload: false,
      reason: `Este portafolio alcanzó el máximo de ${MAX_PHOTOS_PER_PORTFOLIO} fotos.`,
    }
  }
  if (input.files.length === 0) {
    return { canUpload: false, reason: 'Selecciona una imagen.' }
  }
  if (input.portfolio.photos_count + input.files.length > MAX_PHOTOS_PER_PORTFOLIO) {
    return {
      canUpload: false,
      reason: `Este portafolio admite como máximo ${MAX_PHOTOS_PER_PORTFOLIO} fotos.`,
    }
  }
  for (const file of input.files) {
    const invalid = validateImageFile(file)
    if (invalid) {
      return { canUpload: false, reason: invalid }
    }
  }
  if (input.uploading) {
    return { canUpload: false, reason: 'Subida en curso.' }
  }
  return { canUpload: true, reason: null }
}

/** true si n ≥ MAX_PORTFOLIOS (Req. 6.4). */
export function isPortfolioCreationDisabled (count: number): boolean {
  return count >= MAX_PORTFOLIOS
}

/** "n / max" (Req. 6.1, 6.4). */
export function formatCounter (n: number, max: number): string {
  return `${n} / ${max}`
}

export interface ApiError {
  message: string
  fieldErrors: Record<string, string>
}

function nonEmptyString (value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

/** Mensaje del backend si existe; GENERIC_ERROR si no hay respuesta o no trae mensaje (Req. 5.5, 5.6, 6.5). */
export function extractApiError (error: unknown): ApiError {
  const data = (error as { response?: { data?: unknown } } | null | undefined)?.response?.data
  if (!data || typeof data !== 'object') {
    return { message: GENERIC_ERROR, fieldErrors: {} }
  }

  const body = data as { message?: unknown, errors?: unknown }
  const fieldErrors: Record<string, string> = {}
  if (body.errors && typeof body.errors === 'object' && !Array.isArray(body.errors)) {
    for (const [field, value] of Object.entries(body.errors as Record<string, unknown>)) {
      const msg = Array.isArray(value) ? nonEmptyString(value[0]) : nonEmptyString(value)
      if (msg) {
        fieldErrors[field] = msg
      }
    }
  }

  return { message: nonEmptyString(body.message) ?? GENERIC_ERROR, fieldErrors }
}
