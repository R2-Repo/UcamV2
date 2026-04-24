import { describe, expect, it } from 'vitest'
import { featureCollection, lineString, point } from '@turf/helpers'
import {
  buildPolygonArea,
  buildRectangleArea,
  getCamerasInFovArea,
  runCameraFovAnalysis,
} from './camera-fov-analysis'
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
    direction: overrides.direction ?? 'Eastbound',
    maintenanceStations: overrides.maintenanceStations ?? ['Station A'],
    routeRefs: overrides.routeRefs ?? [{ routeKey: 'I-15', milepost: 10 }],
    status: overrides.status ?? 'online',
    sortOrder: overrides.sortOrder ?? 1,
    searchText: overrides.searchText ?? 'test camera',
  }
}

describe('Camera FOV areas', () => {
  it('builds a rectangle area and filters cameras inside it', () => {
    const area = buildRectangleArea(
      { latitude: 39.99, longitude: -111.01 },
      { latitude: 40.01, longitude: -110.99 },
    )

    expect(area).not.toBeNull()

    const inside = getCamerasInFovArea(
      [
        createCamera({ id: 'inside', latitude: 40, longitude: -111 }),
        createCamera({ id: 'outside', latitude: 40.03, longitude: -111 }),
      ],
      area!,
    )

    expect(inside.map((camera) => camera.id)).toEqual(['inside'])
  })

  it('builds a polygon area from vertices', () => {
    const area = buildPolygonArea([
      { latitude: 39.99, longitude: -111.01 },
      { latitude: 40.01, longitude: -111.0 },
      { latitude: 39.99, longitude: -110.99 },
    ])

    expect(area?.kind).toBe('polygon')
    expect(area?.geometry.geometry.coordinates[0]).toHaveLength(4)
  })
})

describe('runCameraFovAnalysis', () => {
  const area = buildRectangleArea(
    { latitude: 39.99, longitude: -111.01 },
    { latitude: 40.01, longitude: -110.97 },
  )!

  it('creates three road-following coverage polygons and a summary', () => {
    const result = runCameraFovAnalysis({
      area,
      cameras: [createCamera({ longitude: -111, latitude: 40, direction: 'Eastbound' })],
      mileposts: featureCollection([
        point([-110.995, 40], { Measure: 22.4, RouteID: 'I-15' }),
      ]),
      roads: featureCollection([
        lineString(
          [
            [-111.01, 40],
            [-111.0, 40.0002],
            [-110.99, 40.0008],
            [-110.98, 40.0016],
          ],
          { RouteID: 'I-15' },
        ),
      ]),
      terrainSampler: () => 0,
    })

    expect(result.summary.cameraCountAnalyzed).toBe(1)
    expect(result.summary.coverageCameraCount).toBe(1)
    expect(result.summary.routeContext).toContain('I-15')
    expect(result.summary.nearestMilepost).toContain('22.4')
    expect(
      result.overlay.features.filter(
        (feature) => feature.properties?.kind === 'coverage' && feature.geometry.type === 'Polygon',
      ),
    ).toHaveLength(3)
    expect(
      result.overlay.features.filter((feature) => feature.properties?.kind === 'blocked-segment'),
    ).toHaveLength(0)
  })

  it('adds a terrain note and blocked segments when elevation interrupts sight lines', () => {
    const result = runCameraFovAnalysis({
      area,
      cameras: [createCamera({ id: 'terrain-camera', longitude: -111, latitude: 40, direction: 'Eastbound' })],
      mileposts: featureCollection([]),
      roads: featureCollection([
        lineString(
          [
            [-111.01, 40],
            [-111.0, 40.0002],
            [-110.99, 40.0008],
            [-110.98, 40.0016],
          ],
          { RouteID: 'I-15' },
        ),
      ]),
      terrainSampler: (coordinate) => (coordinate.longitude > -110.992 ? 80 : 0),
    })

    expect(result.summary.notes.some((note) => note.includes('Terrain appears to limit'))).toBe(true)
    expect(
      result.overlay.features.filter((feature) => feature.properties?.kind === 'blocked-segment').length,
    ).toBeGreaterThan(0)
  })
})