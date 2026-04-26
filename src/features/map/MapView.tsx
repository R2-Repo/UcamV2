import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { FeatureCollection, LineString, Point } from 'geojson'
import type { CameraSummary, SelectionSource } from '../../shared/types'
import { resolveCameraImageUrl } from '../../shared/lib/cameras'
import { getPrimaryRouteLabel } from '../../shared/lib/routes'
import {
  DEFAULT_MAP_STYLE,
  MAP_3D_PITCH,
  MAP_HILLSHADE_LAYER,
  MAP_HILLSHADE_LAYER_ID,
  MAP_HILLSHADE_SOURCE,
  MAP_HILLSHADE_SOURCE_ID,
  MAP_TERRAIN_SOURCE,
  MAP_TERRAIN_SOURCE_ID,
  MAP_TERRAIN_SPEC,
  UTAH_VIEW,
  getMapDimensionToggleCopy,
  type MapDimensionMode,
} from './mapStyle'
import {
  buildGoogleEarthWebUrl,
  buildGoogleMapsUrl,
  buildGoogleStreetViewUrl,
  formatCoordinatePair,
  formatDistanceSummary,
  getPathDistanceMeters,
  type MapCoordinate,
} from './map-actions'
import {
  buildPopupLayouts,
  createRect,
  popupLayoutsEqual,
  type PopupLayoutItem,
  type PopupBlockedRect,
  type PopupLayout,
  type PopupSizeMode,
} from './popup-layout'
import { AUTO_POPUP_MIN_ZOOM, MAX_AUTO_POPUPS, selectPopupLayoutItems } from './popup-selection'
import {
  buildArcGisQueryUrl,
  createEmptyArcGisFeatureCollection,
  getArcGisLabelLayerId,
  getArcGisLayerColor,
  getArcGisLayerSourceId,
  getArcGisStyleLayerIds,
  type ArcGisFeatureCollection,
  type ArcGisGeometryType,
  type ArcGisLayerConfig,
} from './arcgis-rest'
import styles from './MapView.module.css'

interface MapViewProps {
  cameras: CameraSummary[]
  selectedCamera: CameraSummary | null
  selectionSource: SelectionSource
  refreshTokensByCameraId: Readonly<Record<string, number>>
  isFullscreen?: boolean
  mapDimensionMode: MapDimensionMode
  overlay?: ReactNode
  overlayHeight?: number
  popupSizeMode?: PopupSizeMode
  autoPopupsEnabled?: boolean
  arcGisLayers?: ArcGisLayerConfig[]
  onToggleMapDimensionMode: () => void
  onToggleAutoPopups: () => void
  onSelectCamera: (cameraId: string | null, source: SelectionSource) => void
}

type CameraFeatureCollection = FeatureCollection<Point, { id: string; location: string; routeLabel: string }>
type MeasurementFeatureCollection = FeatureCollection<
  Point | LineString,
  {
    kind: 'path' | 'vertex'
    index?: number
  }
>

const CAMERA_FOCUS_ZOOM = 13
const CAMERA_CLUSTER_MAX_ZOOM = 10
const CAMERA_CLUSTER_RADIUS = 48
const POPUP_MARKER_PADDING = 12
const TRACKPAD_ZOOM_RATE = 1 / 45
const WHEEL_ZOOM_RATE = 1 / 260
const MEASUREMENT_SOURCE_ID = 'measurement-path'
const ARCGIS_LAYER_INSERT_BEFORE_ID = 'camera-clusters'
const CONTEXT_MENU_WIDTH = 248
const CONTEXT_MENU_HEIGHT = 336
const CONTEXT_MENU_MARGIN = 10

interface ContextMenuState {
  containerHeight: number
  containerWidth: number
  coordinate: MapCoordinate
  x: number
  y: number
}

function createFeatureCollection(cameras: CameraSummary[]): CameraFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: cameras.map((camera) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [camera.longitude, camera.latitude],
      },
      properties: {
        id: camera.id,
        location: camera.location,
        routeLabel: getPrimaryRouteLabel(camera),
      },
    })),
  }
}

function createMeasurementFeatureCollection(points: MapCoordinate[]): MeasurementFeatureCollection {
  const features: MeasurementFeatureCollection['features'] = points.map((point, index) => ({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [point.longitude, point.latitude],
    },
    properties: {
      kind: 'vertex',
      index,
    },
  }))

  if (points.length > 1) {
    features.unshift({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: points.map((point) => [point.longitude, point.latitude]),
      },
      properties: {
        kind: 'path',
      },
    })
  }

  return {
    type: 'FeatureCollection',
    features,
  }
}

function toMapCoordinate(lngLat: maplibregl.LngLat): MapCoordinate {
  return {
    latitude: lngLat.lat,
    longitude: lngLat.lng,
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function withAlpha(hexColor: string, alpha: number) {
  const normalized = hexColor.replace('#', '')
  const red = Number.parseInt(normalized.slice(0, 2), 16)
  const green = Number.parseInt(normalized.slice(2, 4), 16)
  const blue = Number.parseInt(normalized.slice(4, 6), 16)

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function formatArcGisAttributeValue(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function getArcGisInteractiveLayerIds(layers: ArcGisLayerConfig[]) {
  return layers.flatMap((layer) => {
    const styleLayerIds = getArcGisStyleLayerIds(layer.id, layer.geometryType)

    if (!layer.labelsEnabled || !layer.labelField?.trim()) {
      return styleLayerIds
    }

    return [...styleLayerIds, getArcGisLabelLayerId(layer.id)]
  })
}

function findArcGisLayerByRenderedLayerId(layers: ArcGisLayerConfig[], renderedLayerId: string) {
  return (
    layers.find((layer) => {
      if (getArcGisLabelLayerId(layer.id) === renderedLayerId) {
        return true
      }

      return getArcGisStyleLayerIds(layer.id, layer.geometryType).includes(renderedLayerId)
    }) ?? null
  )
}

function buildArcGisPopupHtml(layer: ArcGisLayerConfig, feature: maplibregl.MapGeoJSONFeature) {
  const entries = Object.entries(feature.properties ?? {})
    .map(([key, value]) => [key, formatArcGisAttributeValue(value)] as const)
    .filter((entry): entry is [string, string] => entry[1] !== null)
    .sort(([leftKey], [rightKey]) => {
      const labelField = layer.labelField?.trim()

      if (labelField && leftKey === labelField && rightKey !== labelField) {
        return -1
      }

      if (labelField && rightKey === labelField && leftKey !== labelField) {
        return 1
      }

      return leftKey.localeCompare(rightKey)
    })

  const rows = entries.length
    ? entries
        .map(
          ([key, value]) =>
            `<div style="display:grid;gap:0.12rem;padding:0.45rem 0;border-top:1px solid rgba(17,32,30,0.08)"><dt style="margin:0;font-size:0.72rem;font-weight:700;color:#6d7b78;text-transform:uppercase;letter-spacing:0.08em">${escapeHtml(key)}</dt><dd style="margin:0;font-size:0.88rem;line-height:1.35;color:#10201d;overflow-wrap:anywhere">${escapeHtml(value)}</dd></div>`,
        )
        .join('')
    : '<p style="margin:0;color:#54615e">No feature attributes were returned for this layer.</p>'

  return `<div style="display:grid;gap:0.65rem;min-width:240px;max-width:320px"><div style="display:grid;gap:0.18rem"><strong style="font-size:1rem;color:#10201d">${escapeHtml(layer.title)}</strong><span style="font-size:0.76rem;color:#6d7b78">${escapeHtml(layer.url)}</span></div><dl style="margin:0;display:grid">${rows}</dl></div>`
}

function setArcGisLayerVisibility(map: maplibregl.Map, layer: ArcGisLayerConfig, visibility: 'visible' | 'none') {
  getArcGisStyleLayerIds(layer.id, layer.geometryType).forEach((layerId) => {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, 'visibility', visibility)
    }
  })

  const labelLayerId = getArcGisLabelLayerId(layer.id)

  if (map.getLayer(labelLayerId)) {
    map.setLayoutProperty(labelLayerId, 'visibility', visibility)
  }
}

function addArcGisLayerArtifacts(map: maplibregl.Map, layer: ArcGisLayerConfig) {
  const sourceId = getArcGisLayerSourceId(layer.id)
  const color = getArcGisLayerColor(layer.id)
  const labelField = layer.labelField?.trim()

  if (!map.getSource(sourceId)) {
    map.addSource(sourceId, {
      type: 'geojson',
      data: createEmptyArcGisFeatureCollection(),
    })
  }

  if (layer.geometryType === 'esriGeometryPoint') {
    const pointLayerId = getArcGisStyleLayerIds(layer.id, layer.geometryType)[0]

    if (!map.getLayer(pointLayerId)) {
      map.addLayer(
        {
          id: pointLayerId,
          type: 'circle',
          source: sourceId,
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 7, 3.5, 11, 6, 15, 9],
            'circle-color': color,
            'circle-stroke-width': 1.25,
            'circle-stroke-color': '#0f1413',
            'circle-opacity': 0.9,
          },
        },
        ARCGIS_LAYER_INSERT_BEFORE_ID,
      )
    }
  } else if (layer.geometryType === 'esriGeometryPolyline') {
    const lineLayerId = getArcGisStyleLayerIds(layer.id, layer.geometryType)[0]

    if (!map.getLayer(lineLayerId)) {
      map.addLayer(
        {
          id: lineLayerId,
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': color,
            'line-width': ['interpolate', ['linear'], ['zoom'], 7, 1.4, 11, 2.2, 15, 4],
            'line-opacity': 0.88,
          },
        },
        ARCGIS_LAYER_INSERT_BEFORE_ID,
      )
    }
  } else {
    const [fillLayerId, outlineLayerId] = getArcGisStyleLayerIds(layer.id, layer.geometryType)

    if (!map.getLayer(fillLayerId)) {
      map.addLayer(
        {
          id: fillLayerId,
          type: 'fill',
          source: sourceId,
          paint: {
            'fill-color': withAlpha(color, 0.18),
            'fill-opacity': 0.6,
          },
        },
        ARCGIS_LAYER_INSERT_BEFORE_ID,
      )
    }

    if (!map.getLayer(outlineLayerId)) {
      map.addLayer(
        {
          id: outlineLayerId,
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': color,
            'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.8, 12, 1.6, 15, 2.4],
            'line-opacity': 0.88,
          },
        },
        ARCGIS_LAYER_INSERT_BEFORE_ID,
      )
    }
  }

  if (!labelField || !layer.labelsEnabled) {
    return
  }

  const labelLayerId = getArcGisLabelLayerId(layer.id)

  if (!map.getLayer(labelLayerId)) {
    map.addLayer(
      {
        id: labelLayerId,
        type: 'symbol',
        source: sourceId,
        layout: {
          'symbol-placement': layer.geometryType === 'esriGeometryPolyline' ? 'line' : 'point',
          'text-field': ['to-string', ['coalesce', ['get', labelField], '']],
          'text-font': ['Noto Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 8, 10, 12, 12, 16, 14],
          'text-offset': layer.geometryType === 'esriGeometryPolyline' ? [0, 0] : [0, 1.1],
          'text-anchor': layer.geometryType === 'esriGeometryPolyline' ? 'center' : 'top',
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: {
          'text-color': color,
          'text-halo-color': 'rgba(13, 19, 18, 0.96)',
          'text-halo-width': 1.4,
        },
      },
      ARCGIS_LAYER_INSERT_BEFORE_ID,
    )
  }
}

function removeArcGisLayerArtifacts(map: maplibregl.Map, layerId: string, geometryType: ArcGisGeometryType) {
  const sourceId = getArcGisLayerSourceId(layerId)
  const labelLayerId = getArcGisLabelLayerId(layerId)

  if (map.getLayer(labelLayerId)) {
    map.removeLayer(labelLayerId)
  }

  getArcGisStyleLayerIds(layerId, geometryType)
    .slice()
    .reverse()
    .forEach((styleLayerId) => {
      if (map.getLayer(styleLayerId)) {
        map.removeLayer(styleLayerId)
      }
    })

  if (map.getSource(sourceId)) {
    map.removeSource(sourceId)
  }
}

interface RefreshArcGisLayerOptions {
  forceRefresh: boolean
  layer: ArcGisLayerConfig
  map: maplibregl.Map
  requestControllers: Map<string, AbortController>
  viewportSignatures: Map<string, string>
}

async function refreshArcGisLayerData({
  forceRefresh,
  layer,
  map,
  requestControllers,
  viewportSignatures,
}: RefreshArcGisLayerOptions) {
  const source = map.getSource(getArcGisLayerSourceId(layer.id)) as maplibregl.GeoJSONSource | undefined
  const isLayerVisible = layer.enabled && map.getZoom() >= layer.minZoom

  setArcGisLayerVisibility(map, layer, isLayerVisible ? 'visible' : 'none')

  if (!source) {
    return
  }

  if (!isLayerVisible) {
    requestControllers.get(layer.id)?.abort()
    requestControllers.delete(layer.id)
    viewportSignatures.delete(layer.id)
    source.setData(createEmptyArcGisFeatureCollection())
    return
  }

  const bounds = map.getBounds()
  const viewportSignature = [
    map.getZoom().toFixed(2),
    bounds.getWest().toFixed(4),
    bounds.getSouth().toFixed(4),
    bounds.getEast().toFixed(4),
    bounds.getNorth().toFixed(4),
  ].join(':')

  if (!forceRefresh && viewportSignatures.get(layer.id) === viewportSignature) {
    return
  }

  viewportSignatures.set(layer.id, viewportSignature)
  requestControllers.get(layer.id)?.abort()

  const controller = new AbortController()
  requestControllers.set(layer.id, controller)

  try {
    const response = await fetch(
      buildArcGisQueryUrl(
        layer.url,
        {
          west: bounds.getWest(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          north: bounds.getNorth(),
        },
        layer.maxRecordCount,
      ),
      { signal: controller.signal },
    )

    if (!response.ok) {
      throw new Error(`ArcGIS data request failed with status ${response.status}.`)
    }

    const payload = (await response.json()) as ArcGisFeatureCollection & {
      error?: {
        message?: string
      }
    }

    if (payload.error?.message) {
      throw new Error(payload.error.message)
    }

    if (payload.type !== 'FeatureCollection' || !Array.isArray(payload.features)) {
      throw new Error('ArcGIS layer did not return GeoJSON feature data.')
    }

    if (!controller.signal.aborted) {
      source.setData(payload)
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return
    }

    viewportSignatures.delete(layer.id)
    source.setData(createEmptyArcGisFeatureCollection())
    console.warn(`Unable to load ArcGIS layer "${layer.title}".`, error)
  } finally {
    if (requestControllers.get(layer.id) === controller) {
      requestControllers.delete(layer.id)
    }
  }
}

function fitMapToCameras(
  map: maplibregl.Map,
  cameras: CameraSummary[],
  padding: maplibregl.PaddingOptions,
) {
  if (!cameras.length) {
    map.easeTo({ center: UTAH_VIEW.center, zoom: UTAH_VIEW.zoom, duration: 450 })
    return
  }

  const bounds = new maplibregl.LngLatBounds()
  cameras.forEach((camera) => bounds.extend([camera.longitude, camera.latitude]))
  map.fitBounds(bounds, {
    padding,
    duration: 550,
    maxZoom: 11,
  })
}

function getRenderedFeatureRadius(feature: maplibregl.MapGeoJSONFeature) {
  if (feature.layer.id === 'selected-camera-point') {
    return 17
  }

  const pointCount = Number(feature.properties?.point_count)

  if (Number.isFinite(pointCount)) {
    if (pointCount >= 120) {
      return 34
    }

    if (pointCount >= 40) {
      return 28
    }

    if (pointCount >= 12) {
      return 22
    }

    return 18
  }

  return 12
}

function getRectArea(rect: PopupBlockedRect['rect']) {
  return (rect.right - rect.left) * (rect.bottom - rect.top)
}

function getFeatureCameraId(feature: maplibregl.MapGeoJSONFeature) {
  return typeof feature.properties?.id === 'string' ? feature.properties.id : null
}

function getPointGeometryCoordinates(feature: maplibregl.MapGeoJSONFeature) {
  if (feature.geometry.type !== 'Point') {
    return null
  }

  return feature.geometry.coordinates as [number, number]
}

function getRenderedMarkerRects(map: maplibregl.Map) {
  const features = map.queryRenderedFeatures(undefined, {
    layers: ['camera-clusters', 'camera-points', 'selected-camera-point'],
  }) as maplibregl.MapGeoJSONFeature[]

  const rectsByKey = new Map<string, PopupBlockedRect>()

  features.forEach((feature) => {
    const coordinates = getPointGeometryCoordinates(feature)

    if (!coordinates) {
      return
    }

    const featureId = getFeatureCameraId(feature)
    const clusterId = Number(feature.properties?.cluster_id)
    const point = map.project(coordinates)
    const radius = getRenderedFeatureRadius(feature) + POPUP_MARKER_PADDING
    const nextRect = {
      cameraId: featureId,
      rect: createRect(point.x - radius, point.y - radius, radius * 2, radius * 2),
    } satisfies PopupBlockedRect
    const key = featureId
      ? `camera:${featureId}`
      : Number.isFinite(clusterId)
        ? `cluster:${clusterId}`
        : `cluster:${coordinates[0]}:${coordinates[1]}`
    const existingRect = rectsByKey.get(key)

    if (!existingRect || getRectArea(nextRect.rect) > getRectArea(existingRect.rect)) {
      rectsByKey.set(key, nextRect)
    }
  })

  return [...rectsByKey.values()]
}

function getRenderedPopupCandidates(
  map: maplibregl.Map,
  camerasById: ReadonlyMap<string, CameraSummary>,
) {
  const features = map.queryRenderedFeatures(undefined, {
    layers: ['camera-points'],
  }) as maplibregl.MapGeoJSONFeature[]

  const itemsByCameraId = new Map<string, { camera: CameraSummary; point: { x: number; y: number } }>()

  features.forEach((feature) => {
    const coordinates = getPointGeometryCoordinates(feature)
    const featureId = getFeatureCameraId(feature)

    if (!coordinates || !featureId || itemsByCameraId.has(featureId)) {
      return
    }

    const camera = camerasById.get(featureId)

    if (!camera) {
      return
    }

    itemsByCameraId.set(featureId, {
      camera,
      point: map.project(coordinates),
    })
  })

  return [...itemsByCameraId.values()]
}

function getViewportCenter(map: maplibregl.Map) {
  const container = map.getContainer()

  return {
    x: container.clientWidth / 2,
    y: container.clientHeight / 2,
  }
}

function getFocusPopupItem(map: maplibregl.Map, selectedCamera: CameraSummary | null) {
  if (!selectedCamera) {
    return null
  }

  return {
    camera: selectedCamera,
    point: map.project([selectedCamera.longitude, selectedCamera.latitude]),
  }
}

function getManualPopupItem(
  map: maplibregl.Map,
  camerasById: ReadonlyMap<string, CameraSummary>,
  cameraId: string | null,
) {
  if (!cameraId) {
    return null
  }

  const camera = camerasById.get(cameraId)

  if (!camera) {
    return null
  }

  return {
    camera,
    point: map.project([camera.longitude, camera.latitude]),
  }
}

export function MapView({
  cameras,
  selectedCamera,
  selectionSource,
  refreshTokensByCameraId,
  isFullscreen = false,
  mapDimensionMode,
  overlay,
  overlayHeight = 0,
  popupSizeMode = 'default',
  autoPopupsEnabled = true,
  arcGisLayers = [],
  onToggleMapDimensionMode,
  onToggleAutoPopups,
  onSelectCamera,
}: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const arcGisPopupRef = useRef<maplibregl.Popup | null>(null)
  const popupLayoutsRef = useRef<PopupLayout[]>([])
  const menuRef = useRef<HTMLDivElement | null>(null)
  const isMeasuringRef = useRef(false)
  const arcGisLayersRef = useRef(arcGisLayers)
  const arcGisRequestControllersRef = useRef(new Map<string, AbortController>())
  const arcGisViewportSignaturesRef = useRef(new Map<string, string>())
  const managedArcGisLayersRef = useRef(new Map<string, ArcGisGeometryType>())
  const stableAutoPopupCandidatesRef = useRef<PopupLayoutItem[]>([])
  const [isReady, setIsReady] = useState(false)
  const [popupLayouts, setPopupLayouts] = useState<PopupLayout[]>([])
  const [manualPopupCameraId, setManualPopupCameraId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [contextMenuSize, setContextMenuSize] = useState({
    width: CONTEXT_MENU_WIDTH,
    height: CONTEXT_MENU_HEIGHT,
  })
  const [isMeasuring, setIsMeasuring] = useState(false)
  const [measurementPoints, setMeasurementPoints] = useState<MapCoordinate[]>([])

  const cameraCollection = useMemo(() => createFeatureCollection(cameras), [cameras])
  const selectedCollection = useMemo(
    () => createFeatureCollection(selectedCamera ? [selectedCamera] : []),
    [selectedCamera],
  )
  const measurementCollection = useMemo(
    () => createMeasurementFeatureCollection(measurementPoints),
    [measurementPoints],
  )
  const measurementDistance = useMemo(
    () => getPathDistanceMeters(measurementPoints),
    [measurementPoints],
  )
  const popupImageSrcByCameraId = useMemo(
    () =>
      new Map(
        cameras.map((camera) => [
          camera.id,
          resolveCameraImageUrl(camera.imageUrl, refreshTokensByCameraId[camera.id]),
        ]),
      ),
    [cameras, refreshTokensByCameraId],
  )
  const camerasById = useMemo(
    () => new Map(cameras.map((camera) => [camera.id, camera])),
    [cameras],
  )
  const viewportPadding = useMemo<maplibregl.PaddingOptions>(
    () =>
      isFullscreen
        ? {
            top: Math.max(overlayHeight + 18, 104),
            right: 28,
            bottom: 28,
            left: 28,
          }
        : {
            top: 72,
            right: 72,
            bottom: 72,
            left: 72,
          },
    [isFullscreen, overlayHeight],
  )
  const cameraCollectionRef = useRef(cameraCollection)
  const selectedCollectionRef = useRef(selectedCollection)
  const viewportPaddingRef = useRef(viewportPadding)
  const onSelectCameraRef = useRef(onSelectCamera)
  const selectedCameraRef = useRef(selectedCamera)
  const manualPopupCameraIdRef = useRef(manualPopupCameraId)
  const measurementDistanceLabel = measurementPoints.length
    ? formatDistanceSummary(measurementDistance)
    : 'Click the map to place the first point.'
  const mapDimensionToggleCopy = useMemo(
    () => getMapDimensionToggleCopy(mapDimensionMode),
    [mapDimensionMode],
  )
  const menuPosition = contextMenu
    ? (() => {
        const menuWidth = contextMenuSize.width
        const menuHeight = contextMenuSize.height
        const maxLeft = Math.max(CONTEXT_MENU_MARGIN, contextMenu.containerWidth - menuWidth - CONTEXT_MENU_MARGIN)
        const maxTop = Math.max(CONTEXT_MENU_MARGIN, contextMenu.containerHeight - menuHeight - CONTEXT_MENU_MARGIN)
        const spaces = {
          right: contextMenu.containerWidth - contextMenu.x - CONTEXT_MENU_MARGIN,
          left: contextMenu.x - CONTEXT_MENU_MARGIN,
          bottom: contextMenu.containerHeight - contextMenu.y - CONTEXT_MENU_MARGIN,
          top: contextMenu.y - CONTEXT_MENU_MARGIN,
        }
        const canOpenRight = spaces.right >= menuWidth
        const canOpenLeft = spaces.left >= menuWidth
        const canOpenBottom = spaces.bottom >= menuHeight
        const canOpenTop = spaces.top >= menuHeight
        const left = canOpenRight || (!canOpenLeft && spaces.right >= spaces.left)
          ? contextMenu.x + CONTEXT_MENU_MARGIN
          : contextMenu.x - menuWidth - CONTEXT_MENU_MARGIN
        const top = canOpenBottom || (!canOpenTop && spaces.bottom >= spaces.top)
          ? contextMenu.y + CONTEXT_MENU_MARGIN
          : contextMenu.y - menuHeight - CONTEXT_MENU_MARGIN

        return {
          left: clamp(left, CONTEXT_MENU_MARGIN, maxLeft),
          top: clamp(top, CONTEXT_MENU_MARGIN, maxTop),
        }
      })()
    : null

  useEffect(() => {
    cameraCollectionRef.current = cameraCollection
  }, [cameraCollection])

  useEffect(() => {
    selectedCollectionRef.current = selectedCollection
  }, [selectedCollection])

  useEffect(() => {
    viewportPaddingRef.current = viewportPadding
  }, [viewportPadding])

  useEffect(() => {
    onSelectCameraRef.current = onSelectCamera
  }, [onSelectCamera])

  useEffect(() => {
    selectedCameraRef.current = selectedCamera
  }, [selectedCamera])

  useEffect(() => {
    manualPopupCameraIdRef.current = manualPopupCameraId
  }, [manualPopupCameraId])

  useEffect(() => {
    arcGisLayersRef.current = arcGisLayers
  }, [arcGisLayers])

  useEffect(() => {
    isMeasuringRef.current = isMeasuring
  }, [isMeasuring])

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return undefined
    }

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: DEFAULT_MAP_STYLE,
      center: UTAH_VIEW.center,
      zoom: UTAH_VIEW.zoom,
      attributionControl: false,
      cooperativeGestures: true,
      fadeDuration: 0,
    })

    mapRef.current = map
    map.scrollZoom.setZoomRate(TRACKPAD_ZOOM_RATE)
    map.scrollZoom.setWheelZoomRate(WHEEL_ZOOM_RATE)
    map.setMaxPitch(80)
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right')

    const handleLoad = () => {
      map.addSource(MAP_TERRAIN_SOURCE_ID, { ...MAP_TERRAIN_SOURCE })
      map.addSource(MAP_HILLSHADE_SOURCE_ID, { ...MAP_HILLSHADE_SOURCE })

      map.addLayer(MAP_HILLSHADE_LAYER, 'esri-reference-layer')
      map.setLayoutProperty(MAP_HILLSHADE_LAYER_ID, 'visibility', 'none')

      map.addSource('cameras', {
        type: 'geojson',
        data: cameraCollectionRef.current,
        cluster: true,
        clusterMaxZoom: CAMERA_CLUSTER_MAX_ZOOM,
        clusterRadius: CAMERA_CLUSTER_RADIUS,
      })

      map.addLayer({
        id: 'camera-clusters',
        type: 'circle',
        source: 'cameras',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': [
            'step',
            ['get', 'point_count'],
            '#0f8b63',
            12,
            '#188460',
            40,
            '#c17a15',
            120,
            '#9d4614',
          ],
          'circle-radius': ['step', ['get', 'point_count'], 18, 12, 22, 40, 28, 120, 34],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#fefdf8',
          'circle-opacity': 0.92,
        },
      })

      map.addLayer({
        id: 'camera-cluster-count',
        type: 'symbol',
        source: 'cameras',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-font': ['Noto Sans Regular'],
          'text-size': 12,
        },
        paint: {
          'text-color': '#fffdf7',
          'text-halo-color': 'rgba(0, 0, 0, 0.22)',
          'text-halo-width': 1.2,
        },
      })

      map.addLayer({
        id: 'camera-points',
        type: 'circle',
        source: 'cameras',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 4, 8, 6, 11, 8, 14, 10],
          'circle-color': '#ff7800',
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#fefdf8',
          'circle-opacity': 0.88,
        },
      })

      map.addSource('selected-camera', {
        type: 'geojson',
        data: selectedCollectionRef.current,
      })

      map.addLayer({
        id: 'selected-camera-halo',
        type: 'circle',
        source: 'selected-camera',
        paint: {
          'circle-radius': 17,
          'circle-color': 'rgba(4, 170, 109, 0.24)',
          'circle-stroke-width': 0,
        },
      })

      map.addLayer({
        id: 'selected-camera-point',
        type: 'circle',
        source: 'selected-camera',
        paint: {
          'circle-radius': 8,
          'circle-color': '#04aa6d',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#fffdf7',
        },
      })

      map.addSource(MEASUREMENT_SOURCE_ID, {
        type: 'geojson',
        data: createMeasurementFeatureCollection([]),
      })

      map.addLayer({
        id: 'measurement-path-line',
        type: 'line',
        source: MEASUREMENT_SOURCE_ID,
        filter: ['==', ['geometry-type'], 'LineString'],
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': '#ffd166',
          'line-width': ['interpolate', ['linear'], ['zoom'], 5, 2.5, 9, 4, 13, 5.5],
          'line-opacity': 0.95,
          'line-dasharray': [1, 1.25],
        },
      })

      map.addLayer({
        id: 'measurement-path-points-halo',
        type: 'circle',
        source: MEASUREMENT_SOURCE_ID,
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 6, 9, 8, 13, 10],
          'circle-color': 'rgba(255, 209, 102, 0.24)',
          'circle-stroke-width': 0,
        },
      })

      map.addLayer({
        id: 'measurement-path-points',
        type: 'circle',
        source: MEASUREMENT_SOURCE_ID,
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 3.5, 9, 4.5, 13, 6],
          'circle-color': '#ff7800',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#fffdf7',
        },
      })

      map.on('click', 'camera-clusters', async (event) => {
        if (isMeasuringRef.current) {
          return
        }

        const feature = event.features?.[0]
        const geometry = feature?.geometry
        const clusterId = Number(feature?.properties?.cluster_id)

        if (!feature || !Number.isFinite(clusterId) || geometry?.type !== 'Point') {
          return
        }

        const source = map.getSource('cameras') as maplibregl.GeoJSONSource | undefined
        const zoom = await source?.getClusterExpansionZoom(clusterId)

        if (!source || typeof zoom !== 'number') {
          return
        }

        map.easeTo({
          center: geometry.coordinates as [number, number],
          zoom,
          duration: 450,
          padding: viewportPaddingRef.current,
        })
      })

      map.on('click', 'camera-points', (event) => {
        if (isMeasuringRef.current) {
          return
        }

        const id = event.features?.[0]?.properties?.id

        if (typeof id === 'string') {
          arcGisPopupRef.current?.remove()
          arcGisPopupRef.current = null

          const isOpenManualPopup = manualPopupCameraIdRef.current === id

          setManualPopupCameraId(isOpenManualPopup ? null : id)
          onSelectCameraRef.current(isOpenManualPopup ? null : id, isOpenManualPopup ? null : 'map')
        }
      })

      map.on('click', (event) => {
        setContextMenu(null)

        if (isMeasuringRef.current) {
          arcGisPopupRef.current?.remove()
          arcGisPopupRef.current = null
          setMeasurementPoints((currentPoints) => [...currentPoints, toMapCoordinate(event.lngLat)])
          return
        }

        const cameraHit = map.queryRenderedFeatures(event.point, {
          layers: ['camera-clusters', 'camera-points', 'selected-camera-point'],
        })

        if (cameraHit.length) {
          arcGisPopupRef.current?.remove()
          arcGisPopupRef.current = null
          return
        }

        const interactiveArcGisLayerIds = getArcGisInteractiveLayerIds(arcGisLayersRef.current)

        if (!interactiveArcGisLayerIds.length) {
          arcGisPopupRef.current?.remove()
          arcGisPopupRef.current = null
          return
        }

        const arcGisFeature = map.queryRenderedFeatures(event.point, {
          layers: interactiveArcGisLayerIds,
        })[0] as maplibregl.MapGeoJSONFeature | undefined

        if (!arcGisFeature) {
          arcGisPopupRef.current?.remove()
          arcGisPopupRef.current = null
          return
        }

        const layer = findArcGisLayerByRenderedLayerId(arcGisLayersRef.current, arcGisFeature.layer.id)

        if (!layer) {
          arcGisPopupRef.current?.remove()
          arcGisPopupRef.current = null
          return
        }

        arcGisPopupRef.current?.remove()
        arcGisPopupRef.current = new maplibregl.Popup({
          closeButton: true,
          closeOnClick: false,
          maxWidth: '340px',
        })
          .setLngLat(event.lngLat)
          .setHTML(buildArcGisPopupHtml(layer, arcGisFeature))
          .addTo(map)
      })

      map.on('contextmenu', (event) => {
        event.preventDefault()
        event.originalEvent.preventDefault()
        event.originalEvent.stopPropagation()

        const container = map.getContainer()
        setContextMenu({
          containerHeight: container.clientHeight,
          containerWidth: container.clientWidth,
          coordinate: toMapCoordinate(event.lngLat),
          x: event.point.x,
          y: event.point.y,
        })
      })

      map.on('movestart', () => {
        setContextMenu(null)
      })

      map.on('mouseenter', 'camera-clusters', () => {
        map.getCanvas().style.cursor = 'pointer'
      })

      map.on('mouseenter', 'camera-points', () => {
        map.getCanvas().style.cursor = 'pointer'
      })

      map.on('mouseleave', 'camera-clusters', () => {
        map.getCanvas().style.cursor = ''
      })

      map.on('mouseleave', 'camera-points', () => {
        map.getCanvas().style.cursor = ''
      })

      setIsReady(true)
    }

    map.on('load', handleLoad)

    return () => {
      arcGisPopupRef.current?.remove()
      arcGisPopupRef.current = null
      arcGisRequestControllersRef.current.forEach((controller) => controller.abort())
      arcGisRequestControllersRef.current.clear()
      arcGisViewportSignaturesRef.current.clear()
      managedArcGisLayersRef.current.clear()
      map.off('load', handleLoad)
      map.remove()
      mapRef.current = null
      setIsReady(false)
      setContextMenu(null)
      setIsMeasuring(false)
      setMeasurementPoints([])
      setManualPopupCameraId(null)
      setPopupLayouts([])
      popupLayoutsRef.current = []
      stableAutoPopupCandidatesRef.current = []
    }
  }, [])

  useEffect(() => {
    if (!mapRef.current || !isReady) {
      return
    }

    const source = mapRef.current.getSource('cameras') as maplibregl.GeoJSONSource | undefined
    source?.setData(cameraCollection)
  }, [cameraCollection, isReady])

  useEffect(() => {
    if (!mapRef.current || !isReady) {
      return
    }

    const map = mapRef.current
    const nextIs3D = mapDimensionMode === '3d'
    const nextPitch = nextIs3D ? MAP_3D_PITCH : 0

    if (map.getLayer(MAP_HILLSHADE_LAYER_ID)) {
      map.setLayoutProperty(MAP_HILLSHADE_LAYER_ID, 'visibility', nextIs3D ? 'visible' : 'none')
    }

    map.setTerrain(nextIs3D ? MAP_TERRAIN_SPEC : null)

    if (Math.abs(map.getPitch() - nextPitch) > 0.1) {
      map.easeTo({
        pitch: nextPitch,
        duration: 650,
      })
    }
  }, [isReady, mapDimensionMode])

  useEffect(() => {
    if (!mapRef.current || !isReady) {
      return
    }

    const source = mapRef.current.getSource('selected-camera') as maplibregl.GeoJSONSource | undefined
    source?.setData(selectedCollection)
  }, [isReady, selectedCollection])

  useEffect(() => {
    if (!mapRef.current || !isReady) {
      return
    }

    const source = mapRef.current.getSource(MEASUREMENT_SOURCE_ID) as maplibregl.GeoJSONSource | undefined
    source?.setData(measurementCollection)
  }, [isReady, measurementCollection])

  useEffect(() => {
    if (!mapRef.current || !isReady) {
      return
    }

    arcGisPopupRef.current?.remove()
    arcGisPopupRef.current = null

    const map = mapRef.current
    const nextLayerIds = new Set(arcGisLayers.map((layer) => layer.id))

    managedArcGisLayersRef.current.forEach((geometryType, layerId) => {
      if (nextLayerIds.has(layerId)) {
        return
      }

      arcGisRequestControllersRef.current.get(layerId)?.abort()
      arcGisRequestControllersRef.current.delete(layerId)
      arcGisViewportSignaturesRef.current.delete(layerId)
      removeArcGisLayerArtifacts(map, layerId, geometryType)
      managedArcGisLayersRef.current.delete(layerId)
    })

    arcGisLayers.forEach((layer) => {
      managedArcGisLayersRef.current.set(layer.id, layer.geometryType)
      addArcGisLayerArtifacts(map, layer)

      if ((!layer.labelField?.trim() || !layer.labelsEnabled) && map.getLayer(getArcGisLabelLayerId(layer.id))) {
        map.removeLayer(getArcGisLabelLayerId(layer.id))
      }
    })

    arcGisLayers.forEach((layer) => {
      void refreshArcGisLayerData({
        forceRefresh: true,
        layer,
        map,
        requestControllers: arcGisRequestControllersRef.current,
        viewportSignatures: arcGisViewportSignaturesRef.current,
      })
    })
  }, [arcGisLayers, isReady])

  useEffect(() => {
    if (!mapRef.current || !isReady) {
      return undefined
    }

    const map = mapRef.current

    const handleMoveEnd = () => {
      arcGisLayersRef.current.forEach((layer) => {
        void refreshArcGisLayerData({
          forceRefresh: false,
          layer,
          map,
          requestControllers: arcGisRequestControllersRef.current,
          viewportSignatures: arcGisViewportSignaturesRef.current,
        })
      })
    }

    map.on('moveend', handleMoveEnd)

    return () => {
      map.off('moveend', handleMoveEnd)
    }
  }, [isReady])

  useEffect(() => {
    if (!mapRef.current || !isReady) {
      return
    }

    if (isMeasuring) {
      mapRef.current.doubleClickZoom.disable()
      return undefined
    }

    mapRef.current.doubleClickZoom.enable()
    return undefined
  }, [isMeasuring, isReady])

  useEffect(() => {
    if (!mapRef.current || !isReady) {
      return
    }

    if (selectedCamera && (selectionSource === 'gallery' || selectionSource === 'url')) {
      mapRef.current.easeTo({
        center: [selectedCamera.longitude, selectedCamera.latitude],
        zoom: Math.max(mapRef.current.getZoom(), CAMERA_FOCUS_ZOOM),
        duration: 650,
        padding: viewportPadding,
      })
      return
    }

    if (!selectedCamera) {
      fitMapToCameras(mapRef.current, cameras, viewportPadding)
    }
  }, [cameras, isReady, selectedCamera, selectionSource, viewportPadding])

  useEffect(() => {
    if (!mapRef.current || !isReady) {
      popupLayoutsRef.current = []
      stableAutoPopupCandidatesRef.current = []
      setPopupLayouts((currentLayouts) => (currentLayouts.length ? [] : currentLayouts))
      return undefined
    }

    const map = mapRef.current
    let isInteracting = false
    let shouldRefreshAutoCandidates = true

    const refreshAutoPopupCandidates = () => {
      const nextCandidates =
        autoPopupsEnabled && map.getZoom() >= AUTO_POPUP_MIN_ZOOM ? getRenderedPopupCandidates(map, camerasById) : []
      const manualCameraId = manualPopupCameraIdRef.current

      stableAutoPopupCandidatesRef.current = manualCameraId
        ? nextCandidates.filter((candidate) => candidate.camera.id !== manualCameraId)
        : nextCandidates
      shouldRefreshAutoCandidates = false
    }

    const updateLayouts = () => {
      if (!autoPopupsEnabled) {
        stableAutoPopupCandidatesRef.current = []
        shouldRefreshAutoCandidates = false
      }

      if (shouldRefreshAutoCandidates || (!isInteracting && autoPopupsEnabled)) {
        refreshAutoPopupCandidates()
      }

      const focusItem = getFocusPopupItem(map, selectedCamera)
      const manualItem =
        manualPopupCameraId && manualPopupCameraId !== selectedCamera?.id
          ? getManualPopupItem(map, camerasById, manualPopupCameraId)
          : null
      const autoCandidates = autoPopupsEnabled && isInteracting
        ? stableAutoPopupCandidatesRef.current.map(({ camera }) => ({
            camera,
            point: map.project([camera.longitude, camera.latitude]),
          }))
        : autoPopupsEnabled
          ? stableAutoPopupCandidatesRef.current
          : []
      const items = selectPopupLayoutItems({
        focusItem,
        pinnedItems: manualItem ? [manualItem] : [],
        candidates: autoCandidates,
        viewportCenter: getViewportCenter(map),
        maxPopups: MAX_AUTO_POPUPS,
      })
      const nextLayouts = buildPopupLayouts({
        items,
        blockedRects: getRenderedMarkerRects(map),
        blockedTop: isFullscreen ? overlayHeight : 0,
        width: map.getContainer().clientWidth,
        height: map.getContainer().clientHeight,
        previousLayouts: new Map(popupLayoutsRef.current.map((layout) => [layout.camera.id, layout])),
        preservePreviousPositions: true,
        sizeMode: popupSizeMode,
      })

      if (popupLayoutsEqual(popupLayoutsRef.current, nextLayouts)) {
        return
      }

      popupLayoutsRef.current = nextLayouts
      setPopupLayouts(nextLayouts)
    }

    const handleMoveStart = () => {
      isInteracting = true
    }

    const handleMoveEnd = () => {
      isInteracting = false
      shouldRefreshAutoCandidates = true
      updateLayouts()
    }

    const handleResize = () => {
      shouldRefreshAutoCandidates = true
      updateLayouts()
    }

    updateLayouts()
    map.on('movestart', handleMoveStart)
    map.on('moveend', handleMoveEnd)
    map.on('render', updateLayouts)
    map.on('resize', handleResize)

    return () => {
      map.off('movestart', handleMoveStart)
      map.off('moveend', handleMoveEnd)
      map.off('render', updateLayouts)
      map.off('resize', handleResize)
    }
  }, [autoPopupsEnabled, camerasById, isFullscreen, isReady, manualPopupCameraId, overlayHeight, popupSizeMode, selectedCamera])

  useEffect(() => {
    if (!contextMenu) {
      return undefined
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current?.contains(event.target as Node)) {
        return
      }

      setContextMenu(null)
    }

    window.addEventListener('pointerdown', handlePointerDown)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [contextMenu])

  useEffect(() => {
    if (!contextMenu || !menuRef.current) {
      setContextMenuSize({
        width: CONTEXT_MENU_WIDTH,
        height: CONTEXT_MENU_HEIGHT,
      })
      return undefined
    }

    const updateMenuSize = () => {
      const menuRect = menuRef.current?.getBoundingClientRect()

      if (!menuRect) {
        return
      }

      setContextMenuSize({
        width: Math.ceil(menuRect.width),
        height: Math.ceil(menuRect.height),
      })
    }

    updateMenuSize()

    if (typeof ResizeObserver === 'undefined') {
      return undefined
    }

    const observer = new ResizeObserver(updateMenuSize)
    observer.observe(menuRef.current)

    return () => {
      observer.disconnect()
    }
  }, [contextMenu])

  useEffect(() => {
    if (!contextMenu && !isMeasuring) {
      return undefined
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return
      }

      if (contextMenu) {
        setContextMenu(null)
        return
      }

      setIsMeasuring(false)
      setMeasurementPoints([])
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [contextMenu, isMeasuring])

  function openExternalMapUrl(urlBuilder: (coordinate: MapCoordinate) => string) {
    if (!contextMenu) {
      return
    }

    window.open(urlBuilder(contextMenu.coordinate), '_blank', 'noopener,noreferrer')
    setContextMenu(null)
  }

  function handleCopyCoordinates() {
    if (!contextMenu) {
      return
    }

    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(formatCoordinatePair(contextMenu.coordinate)).catch(() => undefined)
    }

    setContextMenu(null)
  }

  function startMeasurementFrom(coordinate: MapCoordinate) {
    setIsMeasuring(true)
    setMeasurementPoints([coordinate])
    setContextMenu(null)
  }

  function handleUndoMeasurementPoint() {
    setMeasurementPoints((currentPoints) => currentPoints.slice(0, -1))
  }

  function handleClearMeasurement() {
    setMeasurementPoints([])
  }

  function handleStopMeasurement() {
    setIsMeasuring(false)
    setMeasurementPoints([])
    setContextMenu(null)
  }

  function handleToggleMapDimensionFromMenu() {
    onToggleMapDimensionMode()
    setContextMenu(null)
  }

  function handleToggleAutoPopupsFromMenu() {
    onToggleAutoPopups()
    setContextMenu(null)
  }

  return (
    <div className={`${styles.root} ${isFullscreen ? styles.isFullscreen : ''}`.trim()}>
      <div ref={mapContainerRef} className={styles.mapCanvas} />

      {popupLayouts.length ? (
        <div className={styles.popupLayer} aria-hidden="true">
          <svg className={styles.popupConnectorLayer} width="100%" height="100%" preserveAspectRatio="none">
            {popupLayouts.map((layout) => {
              const isFocusedPopup = selectedCamera?.id === layout.camera.id

              return (
                <line
                  key={`${layout.camera.id}-connector`}
                  className={`${styles.popupConnector} ${isFocusedPopup ? styles.popupConnectorFocused : ''}`.trim()}
                  x1={layout.markerX}
                  y1={layout.markerY}
                  x2={layout.anchorX}
                  y2={layout.anchorY}
                />
              )
            })}
          </svg>

          {popupLayouts.map((layout) => {
            const isFocusedPopup = selectedCamera?.id === layout.camera.id

            return (
              <div
                key={layout.camera.id}
                className={`${styles.popupThumb} ${isFocusedPopup ? styles.popupThumbFocused : ''}`.trim()}
                data-popup-size={popupSizeMode}
                style={{
                  transform: `translate3d(${layout.left}px, ${layout.top}px, 0)`,
                  width: `${layout.width}px`,
                  height: `${layout.height}px`,
                }}
              >
                <img
                  alt=""
                  decoding="async"
                  loading={isFocusedPopup ? 'eager' : 'lazy'}
                  src={popupImageSrcByCameraId.get(layout.camera.id) ?? layout.camera.imageUrl}
                />
              </div>
            )
          })}
        </div>
      ) : null}

      {!cameras.length && (
        <div className={styles.emptyState}>
          <h3>No cameras match the active map filters</h3>
          <p>Clear a route, county, city, or maintenance filter to bring cameras back into view.</p>
        </div>
      )}

      {overlay}

      {isMeasuring ? (
        <div className={styles.measureHud}>
          <div className={styles.measureHudEyebrow}>Path Measure</div>
          <div className={styles.measureHudValue}>{measurementDistanceLabel}</div>
          <p className={styles.measureHudText}>
            {measurementPoints.length > 1
              ? `Tracking ${measurementPoints.length} points. Click the map to keep extending the path.`
              : measurementPoints.length === 1
                ? 'Start point locked. Click the map to add the next point.'
                : 'Click the map to place the first point.'}
          </p>
          <div className={styles.measureHudActions}>
            <button
              className={styles.measureHudButton}
              type="button"
              disabled={!measurementPoints.length}
              onClick={handleUndoMeasurementPoint}
            >
              Undo
            </button>
            <button className={styles.measureHudButton} type="button" onClick={handleClearMeasurement}>
              Clear
            </button>
            <button className={`${styles.measureHudButton} ${styles.measureHudButtonPrimary}`.trim()} type="button" onClick={handleStopMeasurement}>
              Done
            </button>
          </div>
        </div>
      ) : null}

      {contextMenu && menuPosition ? (
        <div
          ref={menuRef}
          className={styles.contextMenu}
          role="menu"
          aria-label="Map quick actions"
          style={{
            left: `${menuPosition.left}px`,
            top: `${menuPosition.top}px`,
          }}
        >
          <div className={styles.contextMenuHeader}>
            <span className={styles.contextMenuEyebrow}>Quick Actions</span>
            <strong>{formatCoordinatePair(contextMenu.coordinate)}</strong>
          </div>

          <button className={styles.contextMenuAction} type="button" role="menuitem" onClick={handleCopyCoordinates}>
            <span className={styles.contextMenuActionLabel}>Copy Coordinates</span>
            <span className={styles.contextMenuActionMeta}>Clipboard-ready lat/lng</span>
          </button>

          <button
            className={styles.contextMenuAction}
            type="button"
            role="menuitem"
            onClick={() => openExternalMapUrl(buildGoogleMapsUrl)}
          >
            <span className={styles.contextMenuActionLabel}>Open In Google Maps</span>
            <span className={styles.contextMenuActionMeta}>Launch the clicked point in a new tab</span>
          </button>

          <button
            className={styles.contextMenuAction}
            type="button"
            role="menuitem"
            onClick={() => openExternalMapUrl(buildGoogleStreetViewUrl)}
          >
            <span className={styles.contextMenuActionLabel}>Open In Street View</span>
            <span className={styles.contextMenuActionMeta}>Jump straight to the roadside panorama</span>
          </button>

          <button
            className={styles.contextMenuAction}
            type="button"
            role="menuitem"
            onClick={handleToggleMapDimensionFromMenu}
          >
            <span className={styles.contextMenuActionLabel}>{mapDimensionToggleCopy.contextMenuLabel}</span>
            <span className={styles.contextMenuActionMeta}>{mapDimensionToggleCopy.contextMenuMeta}</span>
          </button>

          <button
            className={styles.contextMenuAction}
            type="button"
            role="menuitem"
            onClick={handleToggleAutoPopupsFromMenu}
          >
            <span className={styles.contextMenuActionLabel}>
              {autoPopupsEnabled ? 'Pause Auto Popups' : 'Resume Auto Popups'}
            </span>
            <span className={styles.contextMenuActionMeta}>
              {autoPopupsEnabled ? 'Keep map thumbnails from opening by zoom' : 'Let map thumbnails follow zoom'}
            </span>
          </button>

          <button
            className={styles.contextMenuAction}
            type="button"
            role="menuitem"
            onClick={() => openExternalMapUrl(buildGoogleEarthWebUrl)}
          >
            <span className={styles.contextMenuActionLabel}>Open In Google Earth Web 3D</span>
            <span className={styles.contextMenuActionMeta}>Spin up the 3D globe at this location</span>
          </button>

          <button
            className={`${styles.contextMenuAction} ${styles.contextMenuActionAccent}`.trim()}
            type="button"
            role="menuitem"
            onClick={() => startMeasurementFrom(contextMenu.coordinate)}
          >
            <span className={styles.contextMenuActionLabel}>
              {isMeasuring ? 'Restart Measure Here' : 'Measure Path From Here'}
            </span>
            <span className={styles.contextMenuActionMeta}>Keep clicking the map to total the route length</span>
          </button>
        </div>
      ) : null}
    </div>
  )
}
