import { validateImageFile } from './portfolio'

export { extractApiError, validateImageFile } from './portfolio'

export const TILE_MAX_SIZE = 320
export const GRID_GAP = 12

/** 2 columnas por debajo de 600 px, 3 de 600 a 959 y 4 desde 960 (Req. 10.2, 10.4). */
export function columnsForWidth (px: number): number {
  if (px < 600) {
    return 2
  }
  if (px < 960) {
    return 3
  }
  return 4
}

/** Lado (px) de una miniatura cuadrada: ancho de columna, con tope de 320 px (Req. 10.4, 10.5). */
export function tileSize (containerWidth: number, columns: number, gap: number = GRID_GAP): number {
  const cols = Math.max(1, Math.floor(columns))
  const column = Math.floor((containerWidth - gap * (cols - 1)) / cols)
  return Math.max(0, Math.min(TILE_MAX_SIZE, column))
}

/** Relación de aspecto w / h para reservar espacio antes de cargar (Req. 9.9). */
export function aspectRatio (w: number, h: number): number {
  if (!(w > 0) || !(h > 0)) {
    return 1
  }
  return w / h
}

/** Índice resultante de avanzar `delta` posiciones, sin wrap-around (Req. 10.10, 10.18). */
export function stepIndex (index: number, count: number, delta: number): number {
  if (count <= 0) {
    return 0
  }
  return Math.min(count - 1, Math.max(0, index + delta))
}

/** false en los extremos: no se puede avanzar desde el final ni retroceder desde el inicio (Req. 10.12). */
export function canStep (index: number, count: number, delta: number): boolean {
  const target = index + delta
  return count > 0 && target >= 0 && target <= count - 1
}

export interface PendingFile {
  id: string
  file: File
}

export interface RejectedFile {
  file: File
  reason: string
}

export interface AddPendingResult {
  pending: PendingFile[]
  rejected: RejectedFile[]
  /** Archivos válidos que no cupieron por la capacidad. */
  overflow: number
}

let pendingSeq = 0

function nextPendingId (): string {
  pendingSeq += 1
  return `pending-${Date.now().toString(36)}-${pendingSeq}`
}

/**
 * Agrega archivos válidos a la lista pendiente conservando el orden, sin superar
 * `capacity` (cupo restante para los entrantes). Descarta los inválidos con su motivo (Req. 10.7).
 */
export function addPendingFiles (
  current: PendingFile[],
  incoming: File[],
  capacity: number,
): AddPendingResult {
  const room = Math.max(0, Math.floor(capacity))
  const added: PendingFile[] = []
  const rejected: RejectedFile[] = []
  let overflow = 0

  for (const file of incoming) {
    const reason = validateImageFile(file)
    if (reason) {
      rejected.push({ file, reason })
    } else if (added.length < room) {
      added.push({ id: nextPendingId(), file })
    } else {
      overflow += 1
    }
  }

  return { pending: [...current, ...added], rejected, overflow }
}

/** Quita el pendiente con ese id y conserva los demás en orden (Req. 10.8). */
export function removePending (current: PendingFile[], id: string): PendingFile[] {
  return current.filter(item => item.id !== id)
}

/** Descripción si no está vacía; si no, el nombre del Portafolio (Req. 10.14). */
export function altText (description: string | null | undefined, portfolioName: string): string {
  return typeof description === 'string' && description.trim() !== '' ? description : portfolioName
}

export interface PhotoUrls {
  thumb_url?: string | null
  medium_url?: string | null
  image_url: string
}

/** Conversión disponible (según `preferred`, luego la otra) o, si no existe, el Original (Req. 10.17). */
export function pickImageUrl (photo: PhotoUrls, preferred: 'thumb' | 'medium' = 'medium'): string {
  const thumb = photo.thumb_url || null
  const medium = photo.medium_url || null
  const converted = preferred === 'thumb' ? (thumb ?? medium) : (medium ?? thumb)
  return converted ?? photo.image_url
}
