import bbox from '@turf/bbox'
import centerMean from '@turf/center-mean'
import clustersDbscan from '@turf/clusters-dbscan'
import distance from '@turf/distance'
import { featureCollection, point } from '@turf/helpers'
import nearestNeighborAnalysis from '@turf/nearest-neighbor-analysis'
import type { FeatureCollection, Point } from 'geojson'
import type { CameraSummary } from '../../shared/types'

const DBSCAN_RADIUS_MILES = 2
const DBSCAN_MIN_POINTS = 3
const MILES_PER_KILOMETER = 0.621371192237334

type NearestNeighborClassification = 'clustered' | 'random' | 'dispersed' | 'insufficient-data'

interface CameraPointProperties {
  cameraId: string
  region: string
  county: string | null
  city: string | null
  status: string
  maintenanceStations: string[]
  routeKeys: string[]
}

export interface AnalyticsCountStat {
  label: string
  count: number
  share: number
}

export interface CameraAnalyticsCenter {
  latitude: number
  longitude: number
}

export interface CameraAnalyticsSpan {
  west: number
  south: number
  east: number
  north: number
  widthMiles: number
  heightMiles: number
  diagonalMiles: number
}

export interface CameraAnalyticsSpread {
  averageDistanceFromCenterMiles: number
  maxDistanceFromCenterMiles: number
}

export interface CameraAnalyticsNearestNeighbor {
  classification: NearestNeighborClassification
  index: number | null
  observedMeanDistanceMiles: number | null
  expectedMeanDistanceMiles: number | null
  zScore: number | null
}

export interface CameraAnalyticsLocalClusters {
  radiusMiles: number
  minPoints: number
  clusterCount: number
  clusteredPointCount: number
  noisePointCount: number
  largestClusterSize: number
}

export interface CameraAnalytics {
  totalCount: number
  center: CameraAnalyticsCenter | null
  span: CameraAnalyticsSpan | null
  spread: CameraAnalyticsSpread | null
  nearestNeighbor: CameraAnalyticsNearestNeighbor
  localClusters: CameraAnalyticsLocalClusters
  breakdowns: {
    regions: AnalyticsCountStat[]
    counties: AnalyticsCountStat[]
    cities: AnalyticsCountStat[]
    maintenanceStations: AnalyticsCountStat[]
    routes: AnalyticsCountStat[]
    statuses: AnalyticsCountStat[]
  }
}

function toMiles(valueInKilometers: number) {
  return valueInKilometers * MILES_PER_KILOMETER
}

function createPointFeature(camera: CameraSummary) {
  return point<CameraPointProperties>([camera.longitude, camera.latitude], {
    cameraId: camera.id,
    region: camera.region,
    county: camera.county,
    city: camera.city,
    status: camera.status,
    maintenanceStations: [...new Set(camera.maintenanceStations.filter(Boolean))].sort((left, right) =>
      left.localeCompare(right),
    ),
    routeKeys: [...new Set(camera.routeRefs.map((route) => route.routeKey).filter(Boolean))].sort((left, right) =>
      left.localeCompare(right),
    ),
  })
}

export function createCameraPointCollection(cameras: CameraSummary[]): FeatureCollection<Point, CameraPointProperties> {
  return featureCollection(cameras.map(createPointFeature))
}

function buildCountStats(values: string[], totalCount: number) {
  const counts = new Map<string, number>()

  values.forEach((value) => {
    counts.set(value, (counts.get(value) ?? 0) + 1)
  })

  return [...counts.entries()]
    .map(([label, count]) => ({
      label,
      count,
      share: totalCount ? count / totalCount : 0,
    }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
}

function buildSingleValueStats(
  cameras: CameraSummary[],
  picker: (camera: CameraSummary) => string | null,
  totalCount: number,
) {
  return buildCountStats(
    cameras
      .map(picker)
      .filter((value): value is string => Boolean(value && value.trim())),
    totalCount,
  )
}

function buildMultiValueStats(
  cameras: CameraSummary[],
  picker: (camera: CameraSummary) => string[],
  totalCount: number,
) {
  return buildCountStats(
    cameras.flatMap((camera) => [...new Set(picker(camera).filter((value) => value.trim()))]),
    totalCount,
  )
}

function getCenter(collection: FeatureCollection<Point>) {
  if (!collection.features.length) {
    return null
  }

  const center = centerMean(collection)
  const [longitude, latitude] = center.geometry.coordinates

  return {
    latitude,
    longitude,
  } satisfies CameraAnalyticsCenter
}

function getSpan(collection: FeatureCollection<Point>) {
  if (!collection.features.length) {
    return null
  }

  const [west, south, east, north] = bbox(collection)
  const southwest = point([west, south])

  return {
    west,
    south,
    east,
    north,
    widthMiles: distance(southwest, point([east, south]), { units: 'miles' }),
    heightMiles: distance(southwest, point([west, north]), { units: 'miles' }),
    diagonalMiles: distance(southwest, point([east, north]), { units: 'miles' }),
  } satisfies CameraAnalyticsSpan
}

function getSpread(collection: FeatureCollection<Point>, center: CameraAnalyticsCenter | null) {
  if (!collection.features.length || !center) {
    return null
  }

  const centerPoint = point([center.longitude, center.latitude])
  const distances = collection.features.map((feature) => distance(feature, centerPoint, { units: 'miles' }))
  const totalDistance = distances.reduce((sum, value) => sum + value, 0)

  return {
    averageDistanceFromCenterMiles: totalDistance / distances.length,
    maxDistanceFromCenterMiles: Math.max(...distances),
  } satisfies CameraAnalyticsSpread
}

function getNearestNeighbor(collection: FeatureCollection<Point>): CameraAnalyticsNearestNeighbor {
  if (collection.features.length < 3) {
    return {
      classification: 'insufficient-data',
      index: null,
      observedMeanDistanceMiles: null,
      expectedMeanDistanceMiles: null,
      zScore: null,
    }
  }

  const analysis = nearestNeighborAnalysis(collection, { units: 'kilometers' })
  const stats = analysis.properties.nearestNeighborAnalysis
  const index = stats.expectedMeanDistance
    ? stats.observedMeanDistance / stats.expectedMeanDistance
    : null

  let classification: NearestNeighborClassification = 'random'

  if (stats.zScore <= -2) {
    classification = 'clustered'
  } else if (stats.zScore >= 2) {
    classification = 'dispersed'
  }

  return {
    classification,
    index,
    observedMeanDistanceMiles: toMiles(stats.observedMeanDistance),
    expectedMeanDistanceMiles: toMiles(stats.expectedMeanDistance),
    zScore: stats.zScore,
  }
}

function getLocalClusters(collection: FeatureCollection<Point>): CameraAnalyticsLocalClusters {
  if (!collection.features.length) {
    return {
      radiusMiles: DBSCAN_RADIUS_MILES,
      minPoints: DBSCAN_MIN_POINTS,
      clusterCount: 0,
      clusteredPointCount: 0,
      noisePointCount: 0,
      largestClusterSize: 0,
    }
  }

  const clustered = clustersDbscan(collection, DBSCAN_RADIUS_MILES, {
    units: 'miles',
    minPoints: DBSCAN_MIN_POINTS,
  })
  const clusterSizes = new Map<number, number>()

  clustered.features.forEach((feature) => {
    const clusterId = feature.properties?.cluster

    if (typeof clusterId === 'number') {
      clusterSizes.set(clusterId, (clusterSizes.get(clusterId) ?? 0) + 1)
    }
  })

  const clusteredPointCount = [...clusterSizes.values()].reduce((sum, value) => sum + value, 0)

  return {
    radiusMiles: DBSCAN_RADIUS_MILES,
    minPoints: DBSCAN_MIN_POINTS,
    clusterCount: clusterSizes.size,
    clusteredPointCount,
    noisePointCount: collection.features.length - clusteredPointCount,
    largestClusterSize: clusterSizes.size ? Math.max(...clusterSizes.values()) : 0,
  }
}

export function analyzeCameras(cameras: CameraSummary[]): CameraAnalytics {
  const totalCount = cameras.length
  const collection = createCameraPointCollection(cameras)
  const center = getCenter(collection)

  return {
    totalCount,
    center,
    span: getSpan(collection),
    spread: getSpread(collection, center),
    nearestNeighbor: getNearestNeighbor(collection),
    localClusters: getLocalClusters(collection),
    breakdowns: {
      regions: buildSingleValueStats(cameras, (camera) => camera.region, totalCount),
      counties: buildSingleValueStats(cameras, (camera) => camera.county, totalCount),
      cities: buildSingleValueStats(cameras, (camera) => camera.city, totalCount),
      maintenanceStations: buildMultiValueStats(cameras, (camera) => camera.maintenanceStations, totalCount),
      routes: buildMultiValueStats(cameras, (camera) => camera.routeRefs.map((route) => route.routeKey), totalCount),
      statuses: buildSingleValueStats(cameras, (camera) => camera.status, totalCount),
    },
  }
}