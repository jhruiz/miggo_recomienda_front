/**
 * Seguimiento de vistas del Muro.
 *
 * Muro nuevo: observa tarjetas con `data-subject-type` y `data-subject-id` (umbral 0,5);
 * tras 1000 ms de visibilidad continua pasa la clave `"{tipo}:{id}"` al `ViewBatcher`
 * (lotes de 50, un envío cada 5 s, sin repetidos) y envía eventos con `subject_type` y
 * `subject_id`. También registra `open_detail` y `open_provider_profile`.
 *
 * Solo registra con el registro de comportamiento activado y nunca bloquea la interfaz
 * si el envío falla. Requisitos 2.15, 5.4, 5.5, 5.7, 5.9, 6.1.
 */
import { onBeforeUnmount, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { wallService } from '@/services/wall'
import type { WallEventPayload } from '@/services/wall'
import { ViewBatcher, parseSubjectKey, subjectKey } from '@/utils/wall'
import type { SubjectType } from '@/utils/wall'

export const VIEW_VISIBLE_RATIO = 0.5
export const VIEW_DWELL_MS = 1000
const FLUSH_TICK_MS = 1000

export interface ViewTrackerOptions {
  /** `true` solo si el registro de comportamiento está activado (`privacy.enabled`). */
  enabled: MaybeRefOrGetter<boolean>
  /** Reemplazable en pruebas. */
  send?: (events: WallEventPayload[]) => Promise<unknown>
  dwellMs?: number
}

export function useViewTracker(options: ViewTrackerOptions) {
  const dwellMs = options.dwellMs ?? VIEW_DWELL_MS
  const sendEvents = options.send ?? ((events: WallEventPayload[]) => wallService.sendEvents(events))

  const batcher = new ViewBatcher<string>({
    now: () => Date.now(),
    send: async (keys) => {
      const occurred_at = new Date().toISOString()
      const events: WallEventPayload[] = []

      for (const key of keys) {
        const subject = parseSubjectKey(key)

        if (subject)
          events.push({ subject_type: subject.type, subject_id: subject.id, type: 'view', occurred_at })
      }
      if (events.length > 0)
        await sendEvents(events)
    },
  })

  const trackedByEl = new Map<Element, string>()
  const timers = new Map<Element, ReturnType<typeof setTimeout>>()
  let observer: IntersectionObserver | null = null
  let ticker: ReturnType<typeof setInterval> | null = null

  const isEnabled = () => toValue(options.enabled) === true

  function ensureTicker() {
    if (ticker !== null)
      return
    ticker = setInterval(() => {
      if (batcher.pending === 0) {
        if (ticker !== null)
          clearInterval(ticker)
        ticker = null

        return
      }
      void batcher.flush()
    }, FLUSH_TICK_MS)
  }

  function fireAndForget(event: WallEventPayload) {
    void Promise.resolve()
      .then(() => sendEvents([event]))
      .catch(() => {})
  }

  /** Registra una vista de un sujeto. Sin efecto si el registro está desactivado. */
  function recordView(type: SubjectType, id: number): void {
    if (!isEnabled())
      return
    batcher.enqueue(subjectKey(type, id))
    void batcher.flush()
    ensureTicker()
  }

  /** Registra `open_detail`. Un fallo o un 429 no reintenta ni bloquea. */
  function recordOpenDetail(type: SubjectType, id: number) {
    if (!isEnabled())
      return
    fireAndForget({ subject_type: type, subject_id: id, type: 'open_detail', occurred_at: new Date().toISOString() })
  }

  /** Registra `open_provider_profile`. Un fallo o un 429 no reintenta ni bloquea. */
  function recordProfileOpen(type: SubjectType, id: number): void {
    if (!isEnabled())
      return
    fireAndForget({ subject_type: type, subject_id: id, type: 'open_provider_profile', occurred_at: new Date().toISOString() })
  }

  function cancelTimer(el: Element) {
    const timer = timers.get(el)

    if (timer !== undefined) {
      clearTimeout(timer)
      timers.delete(el)
    }
  }

  function commit(key: string) {
    const subject = parseSubjectKey(key)

    if (subject)
      recordView(subject.type, subject.id)
  }

  function getObserver(): IntersectionObserver | null {
    if (observer || typeof IntersectionObserver === 'undefined')
      return observer
    observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const tracked = trackedByEl.get(entry.target)

        if (tracked === undefined)
          continue
        if (entry.isIntersecting && entry.intersectionRatio >= VIEW_VISIBLE_RATIO) {
          if (!timers.has(entry.target)) {
            timers.set(entry.target, setTimeout(() => {
              timers.delete(entry.target)
              commit(tracked)
            }, dwellMs))
          }
        }
        else {
          cancelTimer(entry.target)
        }
      }
    }, { threshold: [VIEW_VISIBLE_RATIO] })

    return observer
  }

  /** Observa una tarjeta de un sujeto. */
  function observe(el: Element, type: SubjectType, id: number) {
    const obs = getObserver()

    if (!obs)
      return
    trackedByEl.set(el, subjectKey(type, id))
    obs.observe(el)
  }

  function unobserve(el: Element) {
    cancelTimer(el)
    trackedByEl.delete(el)
    observer?.unobserve(el)
  }

  /**
   * Observa dentro de `container` las tarjetas con `data-subject-type` y `data-subject-id`
   * aún no observadas.
   */
  function scan(container: ParentNode | null | undefined) {
    if (!container)
      return
    container.querySelectorAll<HTMLElement>('[data-subject-type][data-subject-id]').forEach((el) => {
      const type = el.dataset.subjectType
      const id = Number(el.dataset.subjectId)

      if (trackedByEl.has(el) || (type !== 'portfolio' && type !== 'job') || !Number.isSafeInteger(id) || id <= 0)
        return
      observe(el, type, id)
    })
  }

  function stop() {
    for (const el of [...timers.keys()])
      cancelTimer(el)
    observer?.disconnect()
    observer = null
    trackedByEl.clear()
    if (ticker !== null)
      clearInterval(ticker)
    ticker = null
  }

  onBeforeUnmount(() => {
    // Intento final de envío (respeta el intervalo mínimo).
    void batcher.flush()
    stop()
  })

  return { observe, unobserve, scan, recordView, recordOpenDetail, recordProfileOpen, stop }
}
