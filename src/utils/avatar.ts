/**
 * Funciones puras para la foto de perfil / avatar por defecto.
 */

export const AVATAR_PALETTE = [
  'primary',
  'secondary',
  'success',
  'info',
  'warning',
  'error',
  'purple',
  'teal',
] as const

export type AvatarColor = (typeof AVATAR_PALETTE)[number]

/** 5 MB exactos son válidos. */
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024

export const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

/**
 * Iniciales (1 a 2 code points en mayúsculas) de las dos primeras palabras.
 * Nombre nulo, vacío o solo espacios devuelve ''.
 */
export function getInitials(name: string | null | undefined): string {
  const trimmed = (name ?? '').trim()
  if (!trimmed)
    return ''

  return trimmed
    .split(/\s+/u)
    .slice(0, 2)
    .map(word => Array.from(word.toUpperCase())[0] ?? '')
    .join('')
}

/** Color determinista según el id del usuario (no depende del nombre). */
export function avatarColor(userId: number | null | undefined): AvatarColor {
  const n = AVATAR_PALETTE.length
  if (typeof userId !== 'number' || !Number.isFinite(userId))
    return AVATAR_PALETTE[0]

  return AVATAR_PALETTE[((Math.trunc(userId) % n) + n) % n]
}

export function avatarAlt(name: string | null | undefined): string {
  const trimmed = (name ?? '').trim()

  return trimmed ? `Avatar de ${trimmed}` : 'Avatar de usuario (Sin nombre)'
}

export type AvatarFileError = 'type' | 'size' | null

export interface AvatarFileValidation {
  error: AvatarFileError
  message: string | null
}

export function validateAvatarFile(file: Pick<File, 'type' | 'size'> | null | undefined): AvatarFileValidation {
  if (!file)
    return { error: null, message: null }

  if (!(ALLOWED_AVATAR_TYPES as readonly string[]).includes(file.type))
    return { error: 'type', message: 'El archivo debe ser una imagen JPG, PNG o WebP.' }

  if (file.size > MAX_AVATAR_BYTES)
    return { error: 'size', message: 'La imagen no puede superar los 5 MB.' }

  return { error: null, message: null }
}
