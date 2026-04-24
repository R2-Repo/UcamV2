import along from '@turf/along'
import bbox from '@turf/bbox'
import bearing from '@turf/bearing'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import destination from '@turf/destination'
import distance from '@turf/distance'
import { featureCollection, lineString, point, polygon } from '@turf/helpers'
import length from '@turf/length'
import lineSliceAlong from '@turf/line-slice-along'
import nearestPointOnLine from '@turf/nearest-point-on-line'
import type {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  Geometry,
  LineString,
  MultiLineString,
  Point,
  Polygon,
} from 'geojson'
import type { CameraSummary } from '../../shared/types'
import type { ArcGisFeatureCollection } from './arcgis-rest'
import type { MapCoordinate } from './map-actions'

export type CameraFovSelectionMode = 'idle' | 'rectangle' | 'polygon'
export type CameraFovCoverageMode = 'wide' | 'medium' | 'far'

export interface CameraFovArea {
  bounds: [number, number, number, number]
  center: MapCoordinate
  kind: 'rectangle' | 'polygon'
  vertices: MapCoordinate[]
  geometry: Feature<Polygon>
}

export interface CameraFovOverlayProperties {
  blocked?: boolean
  cameraId?: string
  kind:
    | 'analysis-area'
    | 'analyzed-camera'
    | 'coverage'
    | 'blocked-segment'
  mode?: CameraFovCoverageMode
  routeLabel?: string | null
}

export interface CameraFovSummary {
  cameraCountAnalyzed: number
  coverageCameraCount: number
  routeContext: string
  nearestMilepost: string | null
  notes: string[]
}

export interface CameraFovAnalysisResult {
  overlay: FeatureCollection<Geometry, CameraFovOverlayProperties>
  summary: CameraFovSummary
}

export interface RunCameraFovAnalysisOptions {
  area: CameraFovArea
  cameras: CameraSummary[]
  mileposts: ArcGisFeatureCollection
  roads: ArcGisFeatureCollection
  terrainSampler: (coordinate: MapCoordinate) => number | null
}

interface CoverageModeConfig {
  farWidthMeters: number
  id: CameraFovCoverageMode
  maxDistanceMeters: number
  nearWidthMeters: number
  sampleIntervalMeters: number
}

interface RoadSegment {
  feature: Feature<LineString>
  id: string
  label: string | null
}

interface CameraRoadMatch {
  camera: CameraSummary
  matchDistanceMeters: number
  roadLabel: string | null
  roadSegmentId: string
  snappedDistanceMeters: number
  snappedPoint: [number, number]
  traveledLine: Feature<LineString>
}

interface RoadMatchCandidate {
  distanceMeters: number
  line: Feature<LineString>
  roadLabel: string | null
  roadSegmentId: string
  snappedDistanceMeters: number
  snappedPoint: [number, number]
}

const COVERAGE_MODES: CoverageModeConfig[] = [
  {
    id: 'wide',
    maxDistanceMeters: 500,
    nearWidthMeters: 42,
    farWidthMeters: 94,
    sampleIntervalMeters: 45,
  },
  {
    id: 'medium',
    maxDistanceMeters: 950,
    nearWidthMeters: 30,
    farWidthMeters: 72,
    sampleIntervalMeters: 70,
  },
  {
    id: 'far',
    maxDistanceMeters: 1600,
    nearWidthMeters: 20,
    farWidthMeters: 52,
    sampleIntervalMeters: 100,
  },
]

const DEFAULT_NOTE = 'Coverage is an approximate front-end view using only the selected cameras, public road geometry, and map terrain.'
const MAX_ROAD_MATCH_DISTANCE_METERS = 1200
const MIN_COVERAGE_DISTANCE_METERS = 90
const CAMERA_VIEW_HEIGHT_METERS = 6
const TARGET_SURFACE_HEIGHT_METERS = 1.5
const TERRAIN_CLEARANCE_METERS = 4
const TERRAIN_SAMPLE_SPACING_METERS = 140

function toPointFeature(coordinate: MapCoordinate | [number, number]) {
  if (Array.isArray(coordinate)) {
    return point(coordinate)
  }

  return point([coordinate.longitude, coordinate.latitude])
}

function toMapCoordinate(coordinates: [number, number]): MapCoordinate {
  return {
    latitude: coordinates[1],
    longitude: coordinates[0],
  }
}

function normalizeRingVertices(vertices: MapCoordinate[]) {
  if (vertices.length < 3) {
    return []
  }

  const ring = vertices.map((vertex) => [vertex.longitude, vertex.latitude] as [number, number])
  const first = ring[0]
  const last = ring[ring.length - 1]

  if (!first || !last) {
    return []
  }

  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push(first)
  }

  return ring
}

function createArea(kind: CameraFovArea['kind'], vertices: MapCoordinate[]) {
  const ring = normalizeRingVertices(vertices)

  if (ring.length < 4) {
    return null
  }

  const geometry = polygon([ring])
  const [west, south, east, north] = bbox(geometry)

  return {
    bounds: [west, south, east, north] as [number, number, number, number],
    center: {
      latitude: (south + north) / 2,
      longitude: (west + east) / 2,
    },
    kind,
    vertices,
    geometry,
  } satisfies CameraFovArea
}

export function buildRectangleArea(start: MapCoordinate, end: MapCoordinate) {
  const west = Math.min(start.longitude, end.longitude)
  const east = Math.max(start.longitude, end.longitude)
  const south = Math.min(start.latitude, end.latitude)
  const north = Math.max(start.latitude, end.latitude)

  if (west === east || south === north) {
    return null
  }

  return createArea('rectangle', [
    { latitude: south, longitude: west },
    { latitude: south, longitude: east },
    { latitude: north, longitude: east },
    { latitude: north, longitude: west },
  ])
}

export function buildPolygonArea(vertices: MapCoordinate[]) {
  return createArea('polygon', vertices)
}

export function getCamerasInFovArea(cameras: CameraSummary[], area: CameraFovArea) {
  return cameras.filter((camera) =>
    booleanPointInPolygon(point([camera.longitude, camera.latitude]), area.geometry, { ignoreBoundary: false }),
  )
}

function getRouteContextLabels(cameras: CameraSummary[], fallbackRoadLabels: string[]) {
  const counts = new Map<string, number>()

  cameras.forEach((camera) => {
    const uniqueRouteKeys = [...new Set(camera.routeRefs.map((routeRef) => routeRef.routeKey).filter(Boolean))]
    uniqueRouteKeys.forEach((routeKey) => {
      counts.set(routeKey, (counts.get(routeKey) ?? 0) + 1)
    })
  })

  const ranked = [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 3)
    .map(([label]) => label)

  if (ranked.length) {
    return ranked.join(' · ')
  }

  if (fallbackRoadLabels.length) {
    return [...new Set(fallbackRoadLabels)].slice(0, 3).join(' · ')
  }

  return 'No dominant road context'
}

function parseDirectionBearing(direction: string | null) {
  if (!direction) {
    return null
  }

  const normalized = direction.trim().toUpperCase()

  if (!normalized) {
    return null
  }

  if (normalized.includes('NORTH') && normalized.includes('EAST')) {
    return 45
  }

  if (normalized.includes('SOUTH') && normalized.includes('EAST')) {
    return 135
  }

  if (normalized.includes('SOUTH') && normalized.includes('WEST')) {
    return 225
  }

  if (normalized.includes('NORTH') && normalized.includes('WEST')) {
    return 315
  }

  if (normalized.includes('NORTH')) {
    return 0
  }

  if (normalized.includes('EAST')) {
    return 90
  }

  if (normalized.includes('SOUTH')) {
    return 180
  }

  if (normalized.includes('WEST')) {
    return 270
  }

  return null
}

function getAngleDifference(left: number, right: number) {
  const delta = Math.abs(left - right) % 360

  return delta > 180 ? 360 - delta : delta
}

function reverseLine(line: Feature<LineString>) {
  return lineString([...line.geometry.coordinates].reverse(), line.properties)
}

function getLineBearingAtDistance(line: Feature<LineString>, distanceAlongLineMeters: number) {
  const lineLengthMeters = length(line, { units: 'meters' })
  const beforePoint = along(line, Math.max(0, distanceAlongLineMeters - 20), { units: 'meters' })
  const afterPoint = along(line, Math.min(lineLengthMeters, distanceAlongLineMeters + 20), { units: 'meters' })

  return bearing(beforePoint, afterPoint)
}

function getPropertyValue(properties: GeoJsonProperties | null | undefined, keys: string[]) {
  if (!properties) {
    return null
  }

  for (const key of keys) {
    const direct = properties[key]

    if (typeof direct === 'string' && direct.trim()) {
      return direct.trim()
    }

    if (typeof direct === 'number' && Number.isFinite(direct)) {
      return String(direct)
    }

    const propertyKey = Object.keys(properties).find((candidate) => candidate.toLowerCase() === key.toLowerCase())

    if (!propertyKey) {
      continue
    }

    const value = properties[propertyKey]

    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value)
    }
  }

  return null
}

function getRoadLabel(feature: Feature<LineString>) {
  return getPropertyValue(feature.properties, ['RouteID', 'Route', 'RTE_NM', 'ROADNAME', 'Name', 'Label'])
}

function getMilepostLabel(feature: Feature<Point>) {
  const measure = getPropertyValue(feature.properties, ['Measure', 'MP', 'Milepost', 'Mile_Point'])
  const route = getPropertyValue(feature.properties, ['RouteID', 'Route', 'RouteName', 'RTE_NM'])

  if (!measure && !route) {
    return null
  }

  if (measure && route) {
    return `${route} MP ${measure}`
  }

  if (measure) {
    return `MP ${measure}`
  }

  return route
}

function extractRoadSegments(collection: ArcGisFeatureCollection) {
  const segments: RoadSegment[] = []

  collection.features.forEach((feature, index) => {
    if (feature.geometry.type === 'LineString') {
      segments.push({
        feature: feature as Feature<LineString>,
        id: `road-${index}`,
        label: getRoadLabel(feature as Feature<LineString>),
      })
      return
    }

    if (feature.geometry.type !== 'MultiLineString') {
      return
    }

    ;(feature.geometry as MultiLineString).coordinates.forEach((coordinates, partIndex) => {
      segments.push({
        feature: lineString(coordinates, feature.properties),
        id: `road-${index}-${partIndex}`,
        label: getRoadLabel(lineString(coordinates, feature.properties)),
      })
    })
  })

  return segments
}

function extractMileposts(collection: ArcGisFeatureCollection) {
  return collection.features.filter((feature): feature is Feature<Point> => feature.geometry.type === 'Point')
}

function getNearestMilepostLabel(area: CameraFovArea, mileposts: Feature<Point>[]) {
  if (!mileposts.length) {
    return null
  }

  const centerPoint = point([area.center.longitude, area.center.latitude])
  let bestLabel: string | null = null
  let bestDistance = Number.POSITIVE_INFINITY

  mileposts.forEach((milepost) => {
    const label = getMilepostLabel(milepost)

    if (!label) {
      return
    }

    const candidateDistance = distance(centerPoint, milepost, { units: 'meters' })

    if (candidateDistance < bestDistance) {
      bestDistance = candidateDistance
      bestLabel = label
    }
  })

  return bestLabel
}

function buildRoadMatch(camera: CameraSummary, roadSegments: RoadSegment[]): CameraRoadMatch | null {
  const cameraPoint = point([camera.longitude, camera.latitude])
  let bestMatch: RoadMatchCandidate | null = null

  for (const roadSegment of roadSegments) {
    const snapped = nearestPointOnLine(roadSegment.feature, cameraPoint, { units: 'meters' })
    const snappedDistanceMeters = Number(snapped.properties?.location)
    const distanceMeters = Number(snapped.properties?.dist)

    if (!Number.isFinite(snappedDistanceMeters) || !Number.isFinite(distanceMeters)) {
      continue
    }

    if (bestMatch && distanceMeters >= bestMatch.distanceMeters) {
      continue
    }

    bestMatch = {
      line: roadSegment.feature,
      roadLabel: roadSegment.label,
      roadSegmentId: roadSegment.id,
      snappedDistanceMeters,
      snappedPoint: snapped.geometry.coordinates as [number, number],
      distanceMeters,
    }
  }

  if (!bestMatch || bestMatch.distanceMeters > MAX_ROAD_MATCH_DISTANCE_METERS) {
    return null
  }

  const routeBearing = parseDirectionBearing(camera.direction)
  const lineLengthMeters = length(bestMatch.line, { units: 'meters' })
  const forwardBearing = getLineBearingAtDistance(bestMatch.line, bestMatch.snappedDistanceMeters)
  const reverseBearing = (forwardBearing + 180) % 360
  const forwardAvailableMeters = lineLengthMeters - bestMatch.snappedDistanceMeters
  const reverseAvailableMeters = bestMatch.snappedDistanceMeters

  const shouldReverse =
    routeBearing === null
      ? reverseAvailableMeters > forwardAvailableMeters
      : getAngleDifference(routeBearing, reverseBearing) < getAngleDifference(routeBearing, forwardBearing)

  const traveledLine = shouldReverse ? reverseLine(bestMatch.line) : bestMatch.line
  const snappedDistanceMeters = shouldReverse
    ? lineLengthMeters - bestMatch.snappedDistanceMeters
    : bestMatch.snappedDistanceMeters

  return {
    camera,
    matchDistanceMeters: bestMatch.distanceMeters,
    roadLabel: bestMatch.roadLabel ?? camera.routeRefs[0]?.routeKey ?? null,
    roadSegmentId: bestMatch.roadSegmentId,
    snappedDistanceMeters,
    snappedPoint: bestMatch.snappedPoint,
    traveledLine,
  } satisfies CameraRoadMatch
}

function getTerrainBlockedDistanceMeters(
  camera: CameraSummary,
  targetCoordinates: [number, number],
  terrainSampler: RunCameraFovAnalysisOptions['terrainSampler'],
) {
  const cameraCoordinate = { latitude: camera.latitude, longitude: camera.longitude }
  const targetCoordinate = toMapCoordinate(targetCoordinates)
  const totalDistanceMeters = distance(toPointFeature(cameraCoordinate), toPointFeature(targetCoordinate), {
    units: 'meters',
  })

  if (totalDistanceMeters < MIN_COVERAGE_DISTANCE_METERS) {
    return null
  }

  const cameraTerrain = terrainSampler(cameraCoordinate) ?? 0
  const targetTerrain = terrainSampler(targetCoordinate) ?? 0
  const sampleCount = Math.max(3, Math.ceil(totalDistanceMeters / TERRAIN_SAMPLE_SPACING_METERS))
  const travelBearing = bearing(toPointFeature(cameraCoordinate), toPointFeature(targetCoordinate))

  for (let sampleIndex = 1; sampleIndex < sampleCount; sampleIndex += 1) {
    const ratio = sampleIndex / sampleCount
    const sampleDistanceMeters = totalDistanceMeters * ratio
    const samplePoint = destination(toPointFeature(cameraCoordinate), sampleDistanceMeters, travelBearing, {
      units: 'meters',
    })
    const sampleCoordinate = toMapCoordinate(samplePoint.geometry.coordinates as [number, number])
    const terrainElevation = terrainSampler(sampleCoordinate)

    if (terrainElevation === null) {
      continue
    }

    const visibleElevation =
      cameraTerrain +
      CAMERA_VIEW_HEIGHT_METERS +
      ((targetTerrain + TARGET_SURFACE_HEIGHT_METERS - (cameraTerrain + CAMERA_VIEW_HEIGHT_METERS)) * ratio)

    if (terrainElevation > visibleElevation + TERRAIN_CLEARANCE_METERS) {
      return sampleDistanceMeters
    }
  }

  return null
}

function getCoverageWidthMeters(mode: CoverageModeConfig, ratio: number) {
  return mode.nearWidthMeters + (mode.farWidthMeters - mode.nearWidthMeters) * ratio
}

function buildCoverageGeometry(
  match: CameraRoadMatch,
  mode: CoverageModeConfig,
  terrainSampler: RunCameraFovAnalysisOptions['terrainSampler'],
) {
  const lineLengthMeters = length(match.traveledLine, { units: 'meters' })
  const availableDistanceMeters = Math.min(mode.maxDistanceMeters, lineLengthMeters - match.snappedDistanceMeters)

  if (availableDistanceMeters < MIN_COVERAGE_DISTANCE_METERS) {
    return null
  }

  const sampleCount = Math.max(4, Math.ceil(availableDistanceMeters / mode.sampleIntervalMeters) + 1)
  const sampleDistances = [...Array(sampleCount).keys()].map((index) =>
    index === sampleCount - 1 ? availableDistanceMeters : (availableDistanceMeters / (sampleCount - 1)) * index,
  )

  let blockedAtDistanceMeters: number | null = null

  for (const sampleDistanceMeters of sampleDistances.slice(1)) {
    const samplePoint = along(match.traveledLine, match.snappedDistanceMeters + sampleDistanceMeters, {
      units: 'meters',
    })
    const blockedDistanceMeters = getTerrainBlockedDistanceMeters(
      match.camera,
      samplePoint.geometry.coordinates as [number, number],
      terrainSampler,
    )

    if (blockedDistanceMeters !== null) {
      blockedAtDistanceMeters = sampleDistanceMeters
      break
    }
  }

  const visibleDistanceMeters =
    blockedAtDistanceMeters === null
      ? availableDistanceMeters
      : Math.max(mode.sampleIntervalMeters, blockedAtDistanceMeters - mode.sampleIntervalMeters * 0.45)

  const visibleSampleDistances = sampleDistances.filter((sampleDistanceMeters) => sampleDistanceMeters <= visibleDistanceMeters)

  if (visibleSampleDistances.length < 2) {
    return null
  }

  const leftBoundary: [number, number][] = []
  const rightBoundary: [number, number][] = []

  visibleSampleDistances.forEach((sampleDistanceMeters) => {
    const absoluteDistanceMeters = match.snappedDistanceMeters + sampleDistanceMeters
    const samplePoint = along(match.traveledLine, absoluteDistanceMeters, { units: 'meters' })
    const sampleBearing = getLineBearingAtDistance(match.traveledLine, absoluteDistanceMeters)
    const ratio = visibleDistanceMeters === 0 ? 0 : sampleDistanceMeters / visibleDistanceMeters
    const sampleWidthMeters = getCoverageWidthMeters(mode, ratio)
    const leftPoint = destination(samplePoint, sampleWidthMeters, sampleBearing - 90, { units: 'meters' })
    const rightPoint = destination(samplePoint, sampleWidthMeters, sampleBearing + 90, { units: 'meters' })

    leftBoundary.push(leftPoint.geometry.coordinates as [number, number])
    rightBoundary.push(rightPoint.geometry.coordinates as [number, number])
  })

  const coveragePolygon = polygon([
    [...leftBoundary, ...rightBoundary.reverse(), leftBoundary[0]],
  ])

  let blockedSegment: Feature<LineString> | null = null

  if (blockedAtDistanceMeters !== null && blockedAtDistanceMeters < availableDistanceMeters) {
    const blockedLine = lineSliceAlong(
      match.traveledLine,
      match.snappedDistanceMeters + Math.max(0, blockedAtDistanceMeters - mode.sampleIntervalMeters * 0.2),
      match.snappedDistanceMeters + availableDistanceMeters,
      { units: 'meters' },
    )

    if (blockedLine.geometry.coordinates.length >= 2) {
      blockedSegment = blockedLine
    }
  }

  return {
    blocked: blockedSegment !== null,
    blockedSegment,
    coveragePolygon,
  }
}

function createAnalysisAreaFeature(area: CameraFovArea) {
  return {
    ...area.geometry,
    properties: {
      kind: 'analysis-area',
    },
  } satisfies Feature<Polygon, CameraFovOverlayProperties>
}

function createCameraFeature(match: CameraRoadMatch) {
  return point<CameraFovOverlayProperties>([match.camera.longitude, match.camera.latitude], {
    cameraId: match.camera.id,
    kind: 'analyzed-camera',
    routeLabel: match.roadLabel,
  })
}

function buildContinuityNotes(matches: CameraRoadMatch[]) {
  const overlapThresholdMeters = COVERAGE_MODES[1].maxDistanceMeters * 0.9
  const gapThresholdMeters = COVERAGE_MODES[2].maxDistanceMeters * 1.15
  let overlapPairs = 0
  let gapPairs = 0

  const groups = new Map<string, CameraRoadMatch[]>()

  matches.forEach((match) => {
    const key = `${match.roadSegmentId}:${match.roadLabel ?? 'road'}`
    const group = groups.get(key)

    if (group) {
      group.push(match)
      return
    }

    groups.set(key, [match])
  })

  groups.forEach((group) => {
    group
      .slice()
      .sort((left, right) => left.snappedDistanceMeters - right.snappedDistanceMeters)
      .forEach((match, index, sorted) => {
        const next = sorted[index + 1]

        if (!next) {
          return
        }

        const separationMeters = next.snappedDistanceMeters - match.snappedDistanceMeters

        if (separationMeters <= overlapThresholdMeters) {
          overlapPairs += 1
        } else if (separationMeters >= gapThresholdMeters) {
          gapPairs += 1
        }
      })
  })

  const notes: string[] = []

  if (overlapPairs > 0) {
    notes.push(
      overlapPairs === 1
        ? 'One nearby camera pair shows likely overlap along the same roadway.'
        : `${overlapPairs} nearby camera pairs show likely overlap along the same roadway.`,
    )
  }

  if (gapPairs > 0) {
    notes.push(
      gapPairs === 1
        ? 'One gap appears between analyzed cameras on the same roadway.'
        : `${gapPairs} gaps appear between analyzed cameras on the same roadway.`,
    )
  }

  return notes
}

export function runCameraFovAnalysis({ area, cameras, mileposts, roads, terrainSampler }: RunCameraFovAnalysisOptions) {
  const overlayFeatures: Feature<Geometry, CameraFovOverlayProperties>[] = [createAnalysisAreaFeature(area)]
  const roadSegments = extractRoadSegments(roads)
  const filteredMileposts = extractMileposts(mileposts)

  if (!cameras.length) {
    return {
      overlay: featureCollection(overlayFeatures),
      summary: {
        cameraCountAnalyzed: 0,
        coverageCameraCount: 0,
        routeContext: 'No cameras in selection',
        nearestMilepost: getNearestMilepostLabel(area, filteredMileposts),
        notes: ['No filtered cameras were inside the selected analysis area.'],
      },
    } satisfies CameraFovAnalysisResult
  }

  const matches = cameras
    .map((camera) => buildRoadMatch(camera, roadSegments))
    .filter((match): match is CameraRoadMatch => match !== null)
  const blockedCameraIds = new Set<string>()

  matches.forEach((match) => {
    overlayFeatures.push(createCameraFeature(match))

    COVERAGE_MODES.forEach((mode) => {
      const coverage = buildCoverageGeometry(match, mode, terrainSampler)

      if (!coverage) {
        return
      }

      overlayFeatures.push({
        ...coverage.coveragePolygon,
        properties: {
          blocked: false,
          cameraId: match.camera.id,
          kind: 'coverage',
          mode: mode.id,
          routeLabel: match.roadLabel,
        },
      })

      if (coverage.blockedSegment) {
        blockedCameraIds.add(match.camera.id)
        overlayFeatures.push({
          ...coverage.blockedSegment,
          properties: {
            blocked: true,
            cameraId: match.camera.id,
            kind: 'blocked-segment',
            mode: mode.id,
            routeLabel: match.roadLabel,
          },
        })
      }
    })
  })

  const routeContext = getRouteContextLabels(
    cameras,
    matches.map((match) => match.roadLabel).filter((label): label is string => Boolean(label)),
  )
  const notes = [
    ...buildContinuityNotes(matches),
    ...(blockedCameraIds.size
      ? [
          blockedCameraIds.size === 1
            ? 'Terrain appears to limit one analyzed camera range.'
            : `Terrain appears to limit ${blockedCameraIds.size} analyzed camera ranges.`,
        ]
      : []),
    ...(matches.length < cameras.length
      ? [
          matches.length === 0
            ? 'No selected cameras could be matched to a nearby road centerline.'
            : `${cameras.length - matches.length} selected cameras were not matched to a nearby road centerline.`,
        ]
      : []),
  ]

  if (!notes.length) {
    notes.push(DEFAULT_NOTE)
  }

  return {
    overlay: featureCollection(overlayFeatures),
    summary: {
      cameraCountAnalyzed: cameras.length,
      coverageCameraCount: matches.length,
      routeContext,
      nearestMilepost: getNearestMilepostLabel(area, filteredMileposts),
      notes,
    },
  } satisfies CameraFovAnalysisResult
}