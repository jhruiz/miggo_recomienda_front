import { describe, expect, it } from 'vitest'
import { getUploadState } from './portfolio'

const validFile = { type: 'image/jpeg', size: 1024 }

describe('getUploadState', () => {
  it('deshabilita sin archivo', () => {
    const state = getUploadState({ hasPortfolios: true, portfolio: { photos_count: 0 }, file: null, uploading: false })
    expect(state.canUpload).toBe(false)
  })

  it('habilita con archivo válido', () => {
    const state = getUploadState({ hasPortfolios: true, portfolio: { photos_count: 3 }, file: validFile, uploading: false })
    expect(state).toEqual({ canUpload: true, reason: null })
  })

  it('deshabilita con 10 fotos', () => {
    const state = getUploadState({ hasPortfolios: true, portfolio: { photos_count: 10 }, file: validFile, uploading: false })
    expect(state.canUpload).toBe(false)
  })
})
