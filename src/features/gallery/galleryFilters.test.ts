import { describe, expect, it } from 'vitest'
import { hasActiveGalleryFilters } from './galleryFilters'

describe('hasActiveGalleryFilters', () => {
  it('returns false when no gallery filters are active', () => {
    expect(
      hasActiveGalleryFilters({
        searchQuery: '',
        region: '',
        county: '',
        city: '',
        maintenance: '',
        routeId: '',
        customRouteSegments: [],
      }),
    ).toBe(false)
  })

  it('returns true when any gallery filter has a value', () => {
    expect(
      hasActiveGalleryFilters({
        searchQuery: '',
        region: '',
        county: '',
        city: '',
        maintenance: 'Salt Lake',
        routeId: '',
        customRouteSegments: [],
      }),
    ).toBe(true)

    expect(
      hasActiveGalleryFilters({
        searchQuery: 'i-15',
        region: '',
        county: '',
        city: '',
        maintenance: '',
        routeId: '',
        customRouteSegments: [],
      }),
    ).toBe(true)
  })
})
