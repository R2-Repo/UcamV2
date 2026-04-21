import { type ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { FeatureCollection, Point } from 'geojson'
import type { CameraSummary, SelectionSource } from '../../shared/types'
import { getPrimaryRouteLabel } from '../../shared/lib/routes'
import { DEFAULT_MAP_STYLE, UTAH_VIEW } from './mapStyle'
import { buildPopupLayouts, createRect, type PopupLayout } from './popup-layout'
import styles from './MapView.module.css'

interface MapViewProps {
  cameras: CameraSummary[]
  selectedCamera: CameraSummary | null
  selectionSource: SelectionSource
  isFullscreen?: boolean
  overlay?: ReactNode
  overlayHeight?: number
  onSelectCamera: (cameraId: string | null, source: SelectionSource) => void
}

type CameraFeatureCollection = FeatureCollection<Point, { id: string; location: string; routeLabel: string }>

const CAMERA_FOCUS_ZOOM = 13
const POPUP_MARKER_PADDING = 12

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

function getRenderedMarkerRects(map: maplibregl.Map, selectedCameraIds: Set<string>) {
  const features = map.queryRenderedFeatures(undefined, {
    layers: ['camera-clusters', 'camera-points'],
  }) as maplibregl.MapGeoJSONFeature[]

  return features.flatMap((feature) => {
    if (feature.geometry.type !== 'Point') {
      return []
    }

    const featureId = typeof feature.properties?.id === 'string' ? feature.properties.id : null

    if (featureId && selectedCameraIds.has(featureId)) {
      return []
    }

    const point = map.project(feature.geometry.coordinates as [number, number])
    const radius = getRenderedFeatureRadius(feature) + POPUP_MARKER_PADDING

    return [createRect(point.x - radius, point.y - radius, radius * 2, radius * 2)]
  })
}

export function MapView({
  cameras,
  selectedCamera,
  selectionSource,
  isFullscreen = false,
  overlay,
  overlayHeight = 0,
  onSelectCamera,
}: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const popupLayerRef = useRef<HTMLDivElement | null>(null)
  const popupThumbRef = useRef<HTMLDivElement | null>(null)
  const popupConnectorRef = useRef<SVGLineElement | null>(null)
  const popupLayoutsRef = useRef<PopupLayout[]>([])
  const [isReady, setIsReady] = useState(false)

  const cameraCollection = useMemo(() => createFeatureCollection(cameras), [cameras])
  const selectedCollection = useMemo(
    () => createFeatureCollection(selectedCamera ? [selectedCamera] : []),
    [selectedCamera],
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
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right')

    const handleLoad = () => {
      map.addSource('cameras', {
        type: 'geojson',
        data: cameraCollectionRef.current,
        cluster: true,
        clusterMaxZoom: 12,
        clusterRadius: 56,
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
      popupLayoutsRef.current = []
    }
  }, [])

  const applyPopupLayout = (layout: PopupLayout | null) => {
    const popupLayer = popupLayerRef.current
    const popupThumb = popupThumbRef.current
    const popupConnector = popupConnectorRef.current

    if (!popupLayer || !popupThumb || !popupConnector) {
      return
    }

    if (!layout) {
      popupLayer.dataset.visible = 'false'
      popupThumb.style.visibility = 'hidden'
      popupThumb.style.transform = 'translate3d(-9999px, -9999px, 0)'
      popupConnector.setAttribute('visibility', 'hidden')
      return
    }

    popupLayer.dataset.visible = 'true'
    popupThumb.style.visibility = 'visible'
    popupThumb.style.transform = `translate3d(${layout.left}px, ${layout.top}px, 0)`
    popupConnector.setAttribute('visibility', 'visible')
    popupConnector.setAttribute('x1', String(layout.markerX))
    popupConnector.setAttribute('y1', String(layout.markerY))
    popupConnector.setAttribute('x2', String(layout.anchorX))
    popupConnector.setAttribute('y2', String(layout.anchorY))
  }

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

  useLayoutEffect(() => {
    if (!selectedCamera) {
      popupLayoutsRef.current = []
      applyPopupLayout(null)
    }
  }, [selectedCamera])

  useEffect(() => {
    if (!mapRef.current || !isReady || !selectedCamera) {
      popupLayoutsRef.current = []
      applyPopupLayout(null)
      return undefined
    }

    const map = mapRef.current

    const updateLayouts = () => {
      const selectedCameraIds = new Set([selectedCamera.id])
      const nextLayouts = buildPopupLayouts({
        items: [
          {
            camera: selectedCamera,
            point: map.project([selectedCamera.longitude, selectedCamera.latitude]),
          },
        ],
        blockedRects: getRenderedMarkerRects(map, selectedCameraIds),
        blockedTop: isFullscreen ? overlayHeight : 0,
        width: map.getContainer().clientWidth,
        height: map.getContainer().clientHeight,
        previousLayouts: new Map(popupLayoutsRef.current.map((layout) => [layout.camera.id, layout])),
      })

      popupLayoutsRef.current = nextLayouts
      applyPopupLayout(nextLayouts[0] ?? null)
    }

    updateLayouts()
    map.on('render', updateLayouts)
    map.on('resize', updateLayouts)

    return () => {
      map.off('render', updateLayouts)
      map.off('resize', updateLayouts)
    }
  }, [cameras, isFullscreen, isReady, overlayHeight, selectedCamera])

  return (
    <div className={`${styles.root} ${isFullscreen ? styles.isFullscreen : ''}`.trim()}>
      <div ref={mapContainerRef} className={styles.mapCanvas} />

      {selectedCamera ? (
        <div ref={popupLayerRef} className={styles.popupLayer} aria-hidden="true" key={selectedCamera.id}>
          <svg className={styles.popupConnectorLayer} width="100%" height="100%" preserveAspectRatio="none">
            <line ref={popupConnectorRef} className={styles.popupConnector} visibility="hidden" />
          </svg>

          <div ref={popupThumbRef} className={styles.popupThumb}>
            <img alt="" loading="lazy" src={selectedCamera.imageUrl} />
          </div>
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
