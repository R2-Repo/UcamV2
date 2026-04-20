import { describe, expect, it } from 'vitest'
import type { CameraSummary, CuratedRoute } from '../../shared/types'
import { filterCameras, deriveFilterOptions, createRouteSelectors } from './selectors'
import { defaultFilters } from './store'

const routes: CuratedRoute[] = [
  {
    id: 'parleys-canyon-1',
    displayName: 'Parleys Canyon',
    segments: [
      {
        routeKey: '80P',
        mpMin: 128,
        mpMax: 150,
        sortOrder: 'asc',
      },
    ],
  },
]

const cameras: CameraSummary[] = [
  {
    id: 'cam-1',
    source: 'UDOT',
    sourceId: '1',
    location: 'Foothill Drive',
    latitude: 40.75,
    longitude: -111.83,
    imageUrl: 'https://example.com/1.jpg',
    region: '2',
    county: 'Salt Lake',
    city: 'Salt Lake City',
    direction: 'Eastbound',
    maintenanceStations: ['Salt Lake'],
    routeRefs: [{ routeKey: '80P', milepost: 132 }],
    status: 'Enabled',
    sortOrder: 1,
    searchText: 'foothill drive salt lake city 80p',
  },
  {
    id: 'cam-2',
    source: 'UDOT',
    sourceId: '2',
    location: 'Spanish Fork Canyon',
    latitude: 39.99,
    longitude: -111.6,
    imageUrl: 'https://example.com/2.jpg',
    region: '3',
    county: 'Utah',
    city: 'Spanish Fork',
    direction: 'Westbound',
    maintenanceStations: ['Spanish Fork'],
    routeRefs: [{ routeKey: '6P', milepost: 190 }],
    status: 'Enabled',
    sortOrder: 2,
    searchText: 'spanish fork canyon utah 6p',
  },
]

describe('filter selectors', () => {
  it('filters cameras by curated route', () => {
    const routeLookup = createRouteSelectors(routes)

    const result = filterCameras(cameras, routeLookup, {
      ...defaultFilters,
      routeId: 'parleys-canyon-1',
    })

    expect(result.map((camera) => camera.id)).toEqual(['cam-1'])
  })

  it('derives cascading filter options from the remaining cameras', () => {
    const routeLookup = createRouteSelectors(routes)

    const options = deriveFilterOptions(cameras, routes, routeLookup, {
      ...defaultFilters,
      region: '2',
    })

    expect(options.counties).toEqual(['Salt Lake'])
    expect(options.routes.map((route) => route.id)).toEqual(['parleys-canyon-1'])
  })
})