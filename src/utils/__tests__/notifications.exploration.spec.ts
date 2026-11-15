/**
 * Exploración de condición de defecto C5 (1.7): título/cuerpo no descriptivos.
 * DEBE FALLAR sobre el código sin corregir (`describeNotification` no existe).
 *
 * **Validates: Requirements 1.7**
 */
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { describeNotification } from '../notifications'

const KNOWN: Array<{ type: string, data: Record<string, unknown> }> = [
  { type: 'quote_request.application_received', data: { quote_request_id: 10, provider_user_id: 4 } },
  { type: 'quote_request.edited', data: { quote_request_id: 10 } },
  { type: 'quote_request.closed', data: { quote_request_id: 10 } },
  { type: 'quote_request.provider_selected', data: { quote_request_id: 10 } },
  { type: 'quote.received', data: { quote_id: 57, quote_request_id: 10, provider_user_id: 4 } },
  { type: 'quote.expired', data: { quote_id: 57, quote_request_id: 10 } },
  { type: 'quote.rejected', data: { quote_id: 57, quote_request_id: 10, client_user_id: 3 } },
  { type: 'quote.direct_requested', data: { quote_id: 61, quote_request_id: null, client_user_id: 3 } },
  { type: 'quote.direct_no_response', data: { quote_id: 61, quote_request_id: null, provider_user_id: 4 } },
  { type: 'job.completion_requested', data: { job_id: 8, provider_user_id: 4 } },
  { type: 'job.completion_rejected', data: { job_id: 8, reason: 'x' } },
  { type: 'job.cancellation_requested', data: { job_id: 8, reason: 'x' } },
  { type: 'job.cancelled', data: { job_id: 8 } },
  { type: 'rating.received', data: { job_id: 8, rater_user_id: 3 } },
  { type: 'chat.message_received', data: { channel_id: 9, message_id: 1, sender_user_id: 3, preview: 'hola' } },
]

describe('C5 describeNotification (exploración)', () => {
  it('cubre los 15 tipos conocidos', () => {
    expect(KNOWN).toHaveLength(15)
  })

  it('título y cuerpo descriptivos para cada tipo con solo ids', () => {
    fc.assert(
      fc.property(fc.constantFrom(...KNOWN), ({ type, data }) => {
        const n = { id: 1, type, data, is_read: false, read_at: null, created_at: null }
        const d = describeNotification(n)
        expect(d.title.trim()).not.toBe('')
        expect(d.title).not.toBe(type.replace(/[_.]/g, ' '))
        expect(d.body.trim()).not.toBe('')
      }),
      { numRuns: 100 },
    )
  })
})
