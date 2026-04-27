import { describe, expect, it } from 'vitest'
import { buildSearchParams, parseSearchParams } from './url-state'
import { defaultFilters } from './store'

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

  it('hydrates custom route segments from the multiRoute param', () => {
    expect(parseSearchParams(new URLSearchParams('multiRoute=15P:280-270,201:4-10'))).toEqual({
      filters: {
        customRouteSegments: [
          {
            routeKey: '15P',
            mpMin: 270,
            mpMax: 280,
            sortOrder: 'desc',
          },
          {
            routeKey: '201P',
            mpMin: 4,
            mpMax: 10,
            sortOrder: 'asc',
          },
        ],
      },
      selectedCameraId: null,
      viewMode: 'gallery',
    })
  })
})

describe('url state serialization', () => {
  it('serializes custom route segments into the multiRoute param', () => {
    expect(
      buildSearchParams({
        filters: {
          ...defaultFilters,
          customRouteSegments: [
            {
              routeKey: '15P',
              mpMin: 270,
              mpMax: 280,
              sortOrder: 'desc',
            },
            {
              routeKey: '201P',
              mpMin: 4,
              mpMax: 10,
              sortOrder: 'asc',
            },
          ],
        },
        selectedCameraId: null,
        viewMode: 'map',
      }).toString(),
    ).toBe('view=map&multiRoute=15P%3A280-270%2C201P%3A4-10')
  })
})