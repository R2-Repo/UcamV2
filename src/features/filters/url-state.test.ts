import { describe, expect, it } from 'vitest'
import { parseSearchParams } from './url-state'

describe('url state parsing', () => {
  it('clears selection when the URL no longer contains a camera param', () => {
    expect(parseSearchParams(new URLSearchParams('view=gallery'))).toEqual({
      filters: {},
      selectedCameraId: null,
      viewMode: 'gallery',
    })
  })

  it('hydrates a selected camera when the URL contains a camera param', () => {
    expect(parseSearchParams(new URLSearchParams('view=map&camera=90362'))).toEqual({
      filters: {},
      selectedCameraId: '90362',
      viewMode: 'map',
    })
  })
})