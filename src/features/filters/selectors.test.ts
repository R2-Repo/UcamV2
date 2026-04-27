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
  {
    id: 'cam-3',
    source: 'UDOT',
    sourceId: '3',
    location: 'Mountain Dell',
    latitude: 40.77,
    longitude: -111.77,
    imageUrl: 'https://example.com/3.jpg',
    region: '2',
    county: 'Salt Lake',
    city: 'Salt Lake City',
    direction: 'Eastbound',
    maintenanceStations: ['Salt Lake'],
    routeRefs: [{ routeKey: '80P', milepost: 145 }],
    status: 'Enabled',
    sortOrder: 3,
    searchText: 'mountain dell salt lake city 80p',
  },
  {
    id: 'cam-4',
    source: 'UDOT',
    sourceId: '4',
    location: 'State Street',
    latitude: 40.7,
    longitude: -111.88,
    imageUrl: 'https://example.com/4.jpg',
    region: '2',
    county: 'Salt Lake',
    city: 'Murray',
    direction: 'Northbound',
    maintenanceStations: ['Salt Lake'],
    routeRefs: [{ routeKey: '15P', milepost: 305 }],
    status: 'Enabled',
    sortOrder: 4,
    searchText: 'state street murray 15p',
  },
  {
    id: 'cam-5',
    source: 'UDOT',
    sourceId: '5',
    location: 'Draper',
    latitude: 40.53,
    longitude: -111.87,
    imageUrl: 'https://example.com/5.jpg',
    region: '2',
    county: 'Salt Lake',
    city: 'Draper',
    direction: 'Southbound',
    maintenanceStations: ['Salt Lake'],
    routeRefs: [{ routeKey: '15P', milepost: 290 }],
    status: 'Enabled',
    sortOrder: 5,
    searchText: 'draper salt lake 15p',
  },
]

describe('filter selectors', () => {
  it('filters cameras by curated route', () => {
    const routeLookup = createRouteSelectors(routes)

    const result = filterCameras(cameras, routeLookup, {
      ...defaultFilters,
      routeId: 'parleys-canyon-1',
    })

    expect(result.map((camera) => camera.id)).toEqual(['cam-1', 'cam-3'])
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

  it('filters and orders cameras by custom multi-segment routes', () => {
    const routeLookup = createRouteSelectors(routes)

    const result = filterCameras(cameras, routeLookup, {
      ...defaultFilters,
      customRouteSegments: [
        {
          routeKey: '80P',
          mpMin: 130,
          mpMax: 150,
          sortOrder: 'asc',
        },
        {
          routeKey: '15P',
          mpMin: 280,
          mpMax: 310,
          sortOrder: 'desc',
        },
      ],
    })

    expect(result.map((camera) => camera.id)).toEqual(['cam-1', 'cam-3', 'cam-4', 'cam-5'])
  })
})