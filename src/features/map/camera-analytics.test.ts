import { describe, expect, it } from 'vitest'
import { analyzeCameras, createCameraPointCollection } from './camera-analytics'
import type { CameraSummary } from '../../shared/types'

function createCamera(overrides: Partial<CameraSummary> = {}): CameraSummary {
  return {
    id: overrides.id ?? 'camera-1',
    source: overrides.source ?? 'test-source',
    sourceId: overrides.sourceId ?? overrides.id ?? 'camera-1',
    location: overrides.location ?? 'Test Camera',
    latitude: overrides.latitude ?? 40,
    longitude: overrides.longitude ?? -111,
    imageUrl: overrides.imageUrl ?? 'https://example.com/camera.jpg',
    region: overrides.region ?? 'North',
    county: overrides.county ?? 'Cache',
    city: overrides.city ?? 'Logan',
    direction: overrides.direction ?? null,
    maintenanceStations: overrides.maintenanceStations ?? ['Station A'],
    routeRefs: overrides.routeRefs ?? [{ routeKey: 'I-15', milepost: 10 }],
    status: overrides.status ?? 'online',
    sortOrder: overrides.sortOrder ?? 1,
    searchText: overrides.searchText ?? 'test camera',
  }
}

describe('createCameraPointCollection', () => {
  it('preserves route and maintenance properties with per-camera dedupe', () => {
    const collection = createCameraPointCollection([
      createCamera({
        routeRefs: [
          { routeKey: 'I-15', milepost: 10 },
          { routeKey: 'I-15', milepost: 11 },
          { routeKey: 'US-89', milepost: 12 },
        ],
        maintenanceStations: ['Station B', 'Station A', 'Station B'],
      }),
    ])

    expect(collection.features[0]?.properties?.routeKeys).toEqual(['I-15', 'US-89'])
    expect(collection.features[0]?.properties?.maintenanceStations).toEqual(['Station A', 'Station B'])
  })
})

describe('analyzeCameras', () => {
  it('returns empty-safe analytics when no cameras are provided', () => {
    const analysis = analyzeCameras([])

    expect(analysis.totalCount).toBe(0)
    expect(analysis.center).toBeNull()
    expect(analysis.span).toBeNull()
    expect(analysis.spread).toBeNull()
    expect(analysis.nearestNeighbor.classification).toBe('insufficient-data')
    expect(analysis.localClusters.clusterCount).toBe(0)
    expect(analysis.localClusters.noisePointCount).toBe(0)
    expect(analysis.breakdowns.regions).toEqual([])
  })

  it('computes stable one-point analytics and keeps nearest-neighbor guarded', () => {
    const analysis = analyzeCameras([
      createCamera({
        latitude: 40.1234,
        longitude: -111.5678,
      }),
    ])

    expect(analysis.center).toEqual({ latitude: 40.1234, longitude: -111.5678 })
    expect(analysis.span?.diagonalMiles).toBe(0)
    expect(analysis.spread?.averageDistanceFromCenterMiles).toBe(0)
    expect(analysis.nearestNeighbor.classification).toBe('insufficient-data')
    expect(analysis.localClusters.clusterCount).toBe(0)
    expect(analysis.localClusters.noisePointCount).toBe(1)
  })

  it('detects a tight local cluster and deduplicates multi-value category counts', () => {
    const analysis = analyzeCameras([
      createCamera({
        id: 'camera-a',
        latitude: 40.0,
        longitude: -111.0,
        region: 'North',
        maintenanceStations: ['Station A', 'Station A'],
        routeRefs: [
          { routeKey: 'I-15', milepost: 1 },
          { routeKey: 'I-15', milepost: 2 },
        ],
      }),
      createCamera({
        id: 'camera-b',
        latitude: 40.004,
        longitude: -111.003,
        region: 'North',
        maintenanceStations: ['Station A'],
        routeRefs: [{ routeKey: 'I-15', milepost: 3 }],
      }),
      createCamera({
        id: 'camera-c',
        latitude: 40.007,
        longitude: -111.001,
        region: 'North',
        maintenanceStations: ['Station B'],
        routeRefs: [{ routeKey: 'US-89', milepost: 4 }],
      }),
      createCamera({
        id: 'camera-d',
        latitude: 40.5,
        longitude: -111.5,
        region: 'South',
        maintenanceStations: ['Station C'],
        routeRefs: [{ routeKey: 'SR-92', milepost: 5 }],
        status: 'offline',
      }),
      createCamera({
        id: 'camera-e',
        latitude: 41,
        longitude: -112,
        region: 'South',
        maintenanceStations: ['Station D'],
        routeRefs: [{ routeKey: 'US-6', milepost: 6 }],
        status: 'offline',
      }),
    ])

    expect(analysis.localClusters.clusterCount).toBe(1)
    expect(analysis.localClusters.clusteredPointCount).toBe(3)
    expect(analysis.localClusters.largestClusterSize).toBe(3)
    expect(analysis.localClusters.noisePointCount).toBe(2)
    expect(analysis.breakdowns.regions.slice(0, 2)).toEqual([
      { label: 'North', count: 3, share: 0.6 },
      { label: 'South', count: 2, share: 0.4 },
    ])
    expect(analysis.breakdowns.maintenanceStations[0]).toEqual({
      label: 'Station A',
      count: 2,
      share: 0.4,
    })
    expect(analysis.breakdowns.routes.find((entry) => entry.label === 'I-15')).toEqual({
      label: 'I-15',
      count: 2,
      share: 0.4,
    })
  })

  it('classifies an evenly spaced grid as dispersed', () => {
    const cameras = [
      [40, -112],
      [40, -111],
      [40, -110],
      [41, -112],
      [41, -111],
      [41, -110],
      [42, -112],
      [42, -111],
      [42, -110],
    ].map(([latitude, longitude], index) =>
      createCamera({
        id: `grid-${index + 1}`,
        latitude,
        longitude,
        region: 'Grid',
      }),
    )

    const analysis = analyzeCameras(cameras)

    expect(analysis.nearestNeighbor.classification).toBe('dispersed')
    expect(analysis.nearestNeighbor.index).not.toBeNull()
    expect(analysis.span?.widthMiles).toBeGreaterThan(100)
    expect(analysis.spread?.maxDistanceFromCenterMiles).toBeGreaterThan(0)
  })
})