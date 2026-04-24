import type { FeatureCollection, GeoJsonProperties, Geometry } from 'geojson'

export type ArcGisGeometryType = 'esriGeometryPoint' | 'esriGeometryPolyline' | 'esriGeometryPolygon'

export interface ArcGisLayerConfig {
  id: string
  title: string
  url: string
  enabled: boolean
  geometryType: ArcGisGeometryType
  minZoom: number
  maxRecordCount: number
  labelField?: string
  labelsEnabled?: boolean
  isRemovable?: boolean
}

export interface ArcGisLayerMetadata {
  title: string
  geometryType: ArcGisGeometryType
  minZoom: number
  maxRecordCount: number
}

export interface ArcGisQueryBounds {
  west: number
  south: number
  east: number
  north: number
}

interface ArcGisLayerMetadataResponse {
  error?: {
    message?: string
  }
  geometryType?: string
  maxRecordCount?: number
  name?: string
}

export type ArcGisFeatureCollection = FeatureCollection<Geometry, GeoJsonProperties>

export const DEFAULT_ARCGIS_RESULT_RECORD_COUNT = 2000
export const SAMPLE_ARCGIS_LAYER_URL =
  'https://roads.udot.utah.gov/server/rest/services/Public/Mile_Point_Measures_Open_Data/MapServer/0'
export const UDOT_ROUTES_ALRS_LAYER_URL =
  'https://services.arcgis.com/pA2nEVnB6tquxgOW/arcgis/rest/services/UDOT_Routes_ALRS/FeatureServer/0'
const ARCGIS_LAYER_COLORS = ['#67d38f', '#6ab3ff', '#ffb55f', '#f7797d', '#7cd7d0', '#d39cff']

const LAYER_URL_PATTERN = /\/(?:FeatureServer|MapServer)\/\d+\/?$/i
const TITLE_URL_PATTERN = /\/([^/]+)\/(?:FeatureServer|MapServer)\/\d+$/i

function isSupportedGeometryType(value: string): value is ArcGisGeometryType {
  return value === 'esriGeometryPoint' || value === 'esriGeometryPolyline' || value === 'esriGeometryPolygon'
}

export function normalizeArcGisLayerUrl(input: string) {
  const trimmedInput = input.trim()

  if (!trimmedInput) {
    return null
  }

  let url: URL

  try {
    url = new URL(trimmedInput)
  } catch {
    return null
  }

  if (!LAYER_URL_PATTERN.test(url.pathname)) {
    return null
  }

  url.search = ''
  url.hash = ''
  url.pathname = url.pathname.replace(/\/+$/, '')

  return url.toString()
}

export function createArcGisLayerId(url: string) {
  let hash = 0x811c9dc5

  for (const character of url) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 0x01000193)
  }

  return `arcgis-${(hash >>> 0).toString(16)}`
}

export function getArcGisLayerSourceId(layerId: string) {
  return `arcgis-source-${layerId}`
}

export function getArcGisLabelLayerId(layerId: string) {
  return `arcgis-label-${layerId}`
}

export function getArcGisLayerColor(layerId: string) {
  const suffix = layerId.slice(-2)
  const colorIndex = Number.parseInt(suffix, 16)

  return ARCGIS_LAYER_COLORS[(Number.isFinite(colorIndex) ? colorIndex : 0) % ARCGIS_LAYER_COLORS.length]
}

export function getArcGisStyleLayerIds(layerId: string, geometryType: ArcGisGeometryType) {
  if (geometryType === 'esriGeometryPoint') {
    return [`arcgis-point-${layerId}`]
  }

  if (geometryType === 'esriGeometryPolyline') {
    return [`arcgis-line-${layerId}`]
  }

  return [`arcgis-fill-${layerId}`, `arcgis-outline-${layerId}`]
}

export function createEmptyArcGisFeatureCollection(): ArcGisFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [],
  }
}

export function getDefaultArcGisLayerMinZoom(geometryType: ArcGisGeometryType) {
  if (geometryType === 'esriGeometryPolygon') {
    return 10
  }

  return 9
}

export function getArcGisGeometryTypeLabel(geometryType: ArcGisGeometryType) {
  if (geometryType === 'esriGeometryPoint') {
    return 'Point'
  }

  if (geometryType === 'esriGeometryPolyline') {
    return 'Line'
  }

  return 'Polygon'
}

export function getFallbackArcGisLayerTitle(url: string) {
  const match = url.match(TITLE_URL_PATTERN)

  if (!match) {
    return 'ArcGIS Layer'
  }

  return decodeURIComponent(match[1]).replace(/_/g, ' ')
}

export function buildArcGisQueryUrl(
  url: string,
  bounds: ArcGisQueryBounds,
  maxRecordCount = DEFAULT_ARCGIS_RESULT_RECORD_COUNT,
) {
  const queryUrl = new URL(`${url}/query`)

  queryUrl.searchParams.set('where', '1=1')
  queryUrl.searchParams.set('returnGeometry', 'true')
  queryUrl.searchParams.set('outFields', '*')
  queryUrl.searchParams.set('f', 'geojson')
  queryUrl.searchParams.set(
    'geometry',
    `${bounds.west},${bounds.south},${bounds.east},${bounds.north}`,
  )
  queryUrl.searchParams.set('geometryType', 'esriGeometryEnvelope')
  queryUrl.searchParams.set('inSR', '4326')
  queryUrl.searchParams.set('spatialRel', 'esriSpatialRelIntersects')
  queryUrl.searchParams.set('outSR', '4326')
  queryUrl.searchParams.set('resultRecordCount', String(maxRecordCount))

  return queryUrl.toString()
}

export async function fetchArcGisLayerMetadata(url: string, signal?: AbortSignal): Promise<ArcGisLayerMetadata> {
  const metadataUrl = new URL(url)
  metadataUrl.searchParams.set('f', 'pjson')

  const response = await fetch(metadataUrl, { signal })

  if (!response.ok) {
    throw new Error(`ArcGIS metadata request failed with status ${response.status}.`)
  }

  const payload = (await response.json()) as ArcGisLayerMetadataResponse

  if (payload.error?.message) {
    throw new Error(payload.error.message)
  }

  if (!payload.geometryType || !isSupportedGeometryType(payload.geometryType)) {
    throw new Error('Only public ArcGIS point, line, and polygon layers are supported.')
  }

  return {
    title: payload.name?.trim() || getFallbackArcGisLayerTitle(url),
    geometryType: payload.geometryType,
    minZoom: getDefaultArcGisLayerMinZoom(payload.geometryType),
    maxRecordCount:
      typeof payload.maxRecordCount === 'number' && payload.maxRecordCount > 0
        ? payload.maxRecordCount
        : DEFAULT_ARCGIS_RESULT_RECORD_COUNT,
  }
}