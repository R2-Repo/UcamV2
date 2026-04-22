import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { FeatureCollection, Point } from 'geojson'
import type { CameraSummary, SelectionSource } from '../../shared/types'
import { resolveCameraImageUrl } from '../../shared/lib/cameras'
import { getPrimaryRouteLabel } from '../../shared/lib/routes'
import { DEFAULT_MAP_STYLE, UTAH_VIEW } from './mapStyle'
import {
  buildPopupLayouts,
  createRect,
  popupLayoutsEqual,
  type PopupBlockedRect,
  type PopupLayout,
  type PopupSizeMode,
} from './popup-layout'
import { AUTO_POPUP_MIN_ZOOM, MAX_AUTO_POPUPS, selectPopupLayoutItems } from './popup-selection'
import styles from './MapView.module.css'

interface MapViewProps {
  cameras: CameraSummary[]
  selectedCamera: CameraSummary | null
  selectionSource: SelectionSource
  refreshTokensByCameraId: Readonly<Record<string, number>>
  isFullscreen?: boolean
  overlay?: ReactNode
  overlayHeight?: number
  popupSizeMode?: PopupSizeMode
  onSelectCamera: (cameraId: string | null, source: SelectionSource) => void
}

type CameraFeatureCollection = FeatureCollection<Point, { id: string; location: string; routeLabel: string }>

const CAMERA_FOCUS_ZOOM = 13
const CAMERA_CLUSTER_MAX_ZOOM = 10
const CAMERA_CLUSTER_RADIUS = 48
const POPUP_MARKER_PADDING = 12
const TRACKPAD_ZOOM_RATE = 1 / 45
const WHEEL_ZOOM_RATE = 1 / 260

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

export function MapView({
  cameras,
  selectedCamera,
  selectionSource,
  refreshTokensByCameraId,
  isFullscreen = false,
  overlay,
  overlayHeight = 0,
  popupSizeMode = 'default',
  onSelectCamera,
}: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const popupLayoutsRef = useRef<PopupLayout[]>([])
  const [isReady, setIsReady] = useState(false)
  const [popupLayouts, setPopupLayouts] = useState<PopupLayout[]>([])

  const cameraCollection = useMemo(() => createFeatureCollection(cameras), [cameras])
  const selectedCollection = useMemo(
    () => createFeatureCollection(selectedCamera ? [selectedCamera] : []),
    [selectedCamera],
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
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right')

    const handleLoad = () => {
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

      map.on('click', 'camera-clusters', async (event) => {
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
        const id = event.features?.[0]?.properties?.id

        if (typeof id === 'string') {
          onSelectCameraRef.current(id, 'map')
        }
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
      map.off('load', handleLoad)
      map.remove()
      mapRef.current = null
      setIsReady(false)
      setPopupLayouts([])
      popupLayoutsRef.current = []
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

    const source = mapRef.current.getSource('selected-camera') as maplibregl.GeoJSONSource | undefined
    source?.setData(selectedCollection)
  }, [isReady, selectedCollection])

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
      setPopupLayouts((currentLayouts) => (currentLayouts.length ? [] : currentLayouts))
      return undefined
    }

    const map = mapRef.current

    const updateLayouts = () => {
      const focusItem = getFocusPopupItem(map, selectedCamera)
      const autoPopupCandidates =
        map.getZoom() >= AUTO_POPUP_MIN_ZOOM ? getRenderedPopupCandidates(map, camerasById) : []
      const items = selectPopupLayoutItems({
        focusItem,
        candidates: autoPopupCandidates,
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
        sizeMode: popupSizeMode,
      })

      if (popupLayoutsEqual(popupLayoutsRef.current, nextLayouts)) {
        return
      }

      popupLayoutsRef.current = nextLayouts
      setPopupLayouts(nextLayouts)
    }

    updateLayouts()
    map.on('render', updateLayouts)
    map.on('resize', updateLayouts)

    return () => {
      map.off('render', updateLayouts)
      map.off('resize', updateLayouts)
    }
  }, [camerasById, isFullscreen, isReady, overlayHeight, popupSizeMode, selectedCamera])

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
    </div>
  )
}
