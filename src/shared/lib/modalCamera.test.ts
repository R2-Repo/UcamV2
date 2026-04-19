import { describe, expect, it } from 'vitest'
import type { CameraDetails, CameraSummary } from '../types'
import {
  createCameraDetailsLookup,
  createCameraLookup,
  resolveModalCameraWindow,
  resolveModalNeighborIds,
} from './modalCamera'

function createCamera(id: string): CameraSummary {
  return {
    id,
    source: 'UDOT',
    sourceId: id,
    location: `Camera ${id}`,
    latitude: 40,
    longitude: -111,
    imageUrl: `https://example.com/${id}.jpg`,
    region: '3',
    county: 'Utah',
    city: 'American Fork',
    direction: 'Northbound',
    maintenanceStations: [],
    routeRefs: [],
    status: 'Enabled',
    sortOrder: 0,
    classification: null,
    poeFailure: false,
    timestampIsStale: false,
    searchText: id,
  }
}

function createDetails(id: string, previousCameraId: string | null, nextCameraId: string | null): CameraDetails {
  return {
    id,
    description: null,
    latitude: 40,
    longitude: -111,
    location: {
      city: 'American Fork',
      county: 'Utah',
      region: '3',
    },
    embeds: {
      googleMapsUrl: 'https://example.com/google',
      arcgisUrl: 'https://example.com/arcgis',
      streetViewUrl: null,
    },
    routes: {
      primary: {
        routeCode: '74P',
        altNameA: '100 E',
        altNameB: null,
        altNameC: null,
        logicalMilepost: 0.16,
        physicalMilepost: null,
      },
      secondary: {
        routeCode: null,
        altNameA: null,
        altNameB: null,
        altNameC: null,
        logicalMilepost: null,
        physicalMilepost: null,
      },
    },
    neighbors: {
      previous: {
        cameraId: previousCameraId,
        name: previousCameraId ? `Camera ${previousCameraId}` : null,
        imageUrl: previousCameraId ? `https://example.com/${previousCameraId}.jpg` : null,
      },
      next: {
        cameraId: nextCameraId,
        name: nextCameraId ? `Camera ${nextCameraId}` : null,
        imageUrl: nextCameraId ? `https://example.com/${nextCameraId}.jpg` : null,
      },
    },
    quality: {
      classification: null,
      poeFailure: false,
      timestampIsStale: false,
    },
  }
}

describe('modal camera data helpers', () => {
  it('creates fast camera lookups by id', () => {
    const cameraLookup = createCameraLookup([createCamera('cam-1'), createCamera('cam-2')])
    const detailsLookup = createCameraDetailsLookup([
      createDetails('cam-1', null, 'cam-2'),
      createDetails('cam-2', 'cam-1', null),
    ])

    expect(cameraLookup.get('cam-2')?.location).toBe('Camera cam-2')
    expect(detailsLookup.get('cam-1')?.neighbors.next.cameraId).toBe('cam-2')
  })

  it('uses filtered gallery order while keeping metadata fallbacks at the edges', () => {
    const detailsLookup = createCameraDetailsLookup([
      createDetails('cam-1', null, 'cam-2'),
      createDetails('cam-2', 'cam-1', 'cam-3'),
      createDetails('cam-3', 'cam-2', 'cam-4'),
      createDetails('cam-4', 'cam-3', null),
    ])

    expect(
      resolveModalNeighborIds({
        activeCameraId: 'cam-2',
        orderedCameraIds: ['cam-2', 'cam-3'],
        cameraDetailsById: detailsLookup,
      }),
    ).toEqual({
      previousCameraId: 'cam-1',
      nextCameraId: 'cam-3',
    })

    expect(
      resolveModalNeighborIds({
        activeCameraId: 'cam-3',
        orderedCameraIds: ['cam-2', 'cam-3'],
        cameraDetailsById: detailsLookup,
      }),
    ).toEqual({
      previousCameraId: 'cam-2',
      nextCameraId: 'cam-4',
    })
  })

  it('falls back to metadata neighbors when the active camera is outside the current gallery set', () => {
    const detailsLookup = createCameraDetailsLookup([
      createDetails('cam-4', 'cam-3', 'cam-5'),
    ])

    expect(
      resolveModalNeighborIds({
        activeCameraId: 'cam-4',
        orderedCameraIds: ['cam-1', 'cam-2'],
        cameraDetailsById: detailsLookup,
      }),
    ).toEqual({
      previousCameraId: 'cam-3',
      nextCameraId: 'cam-5',
    })
  })

  it('builds a centered modal window for the mobile carousel using filtered order and metadata edges', () => {
    const detailsLookup = createCameraDetailsLookup([
      createDetails('cam-1', null, 'cam-2'),
      createDetails('cam-2', 'cam-1', 'cam-3'),
      createDetails('cam-3', 'cam-2', 'cam-4'),
      createDetails('cam-4', 'cam-3', 'cam-5'),
      createDetails('cam-5', 'cam-4', null),
    ])

    expect(
      resolveModalCameraWindow({
        activeCameraId: 'cam-3',
        orderedCameraIds: ['cam-2', 'cam-3', 'cam-4'],
        cameraDetailsById: detailsLookup,
      }),
    ).toEqual(['cam-1', 'cam-2', 'cam-3', 'cam-4', 'cam-5'])
  })

  it('walks metadata when the mobile carousel active camera is outside the current gallery set', () => {
    const detailsLookup = createCameraDetailsLookup([
      createDetails('cam-4', 'cam-3', 'cam-5'),
      createDetails('cam-3', 'cam-2', 'cam-4'),
      createDetails('cam-5', 'cam-4', 'cam-6'),
    ])

    expect(
      resolveModalCameraWindow({
        activeCameraId: 'cam-4',
        orderedCameraIds: ['cam-1', 'cam-2'],
        cameraDetailsById: detailsLookup,
      }),
    ).toEqual(['cam-2', 'cam-3', 'cam-4', 'cam-5', 'cam-6'])
  })
})