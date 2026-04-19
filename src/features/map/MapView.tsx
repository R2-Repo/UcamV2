import { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { FeatureCollection, Point } from 'geojson'
import type { CameraSummary, SelectionSource } from '../../shared/types'
import { getCameraSubtitle } from '../../shared/lib/cameras'
import { getPrimaryRouteLabel } from '../../shared/lib/routes'
import { DEFAULT_MAP_STYLE, UTAH_VIEW } from './mapStyle'
import styles from './MapView.module.css'

interface MapViewProps {
  cameras: CameraSummary[]
  selectedCamera: CameraSummary | null
  selectionSource: SelectionSource
  onSelectCamera: (cameraId: string | null, source: SelectionSource) => void
  onOpenGallery: () => void
}

type CameraFeatureCollection = FeatureCollection<Point, { id: string; location: string; routeLabel: string }>

function disposePopupRoot(root: Root | null) {
  if (!root) {
    return
  }

  queueMicrotask(() => {
    root.unmount()
  })
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

function fitMapToCameras(map: maplibregl.Map, cameras: CameraSummary[]) {
  if (!cameras.length) {
    map.easeTo({ center: UTAH_VIEW.center, zoom: UTAH_VIEW.zoom, duration: 450 })
    return
  }

  const bounds = new maplibregl.LngLatBounds()
  cameras.forEach((camera) => bounds.extend([camera.longitude, camera.latitude]))
  map.fitBounds(bounds, {
    padding: 72,
    duration: 550,
    maxZoom: 11,
  })
}

function MapPopupCard({
  camera,
  onClearSelection,
  onOpenGallery,
}: {
  camera: CameraSummary
  onClearSelection: () => void
  onOpenGallery: () => void
}) {
  return (
    <div className={styles.popupCard}>
      <div className={styles.popupImageFrame}>
        <img alt={camera.location} loading="lazy" src={camera.imageUrl} />
      </div>

      <div className={styles.popupBody}>
        <span className={styles.popupRoute}>{getPrimaryRouteLabel(camera)}</span>
        <strong>{camera.location}</strong>
        <p>{getCameraSubtitle(camera)}</p>

        <div className={styles.popupActions}>
          <button type="button" onClick={onOpenGallery}>
            Open gallery
          </button>
          <button type="button" onClick={onClearSelection}>
            Clear
          </button>
        </div>
      </div>
    </div>
  )
}

export function MapView({
  cameras,
  selectedCamera,
  selectionSource,
  onSelectCamera,
  onOpenGallery,
}: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const popupRef = useRef<maplibregl.Popup | null>(null)
  const popupRootRef = useRef<Root | null>(null)
  const [isReady, setIsReady] = useState(false)

  const cameraCollection = useMemo(() => createFeatureCollection(cameras), [cameras])
  const selectedCollection = useMemo(
    () => createFeatureCollection(selectedCamera ? [selectedCamera] : []),
    [selectedCamera],
  )

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
    })

    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right')

    const handleLoad = () => {
      map.addSource('cameras', {
        type: 'geojson',
        data: cameraCollection,
      })

      map.addLayer({
        id: 'camera-points',
        type: 'circle',
        source: 'cameras',
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            5,
            4,
            8,
            6,
            11,
            8,
          ],
          'circle-color': '#ff7800',
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#fefdf8',
          'circle-opacity': 0.85,
        },
      })

      map.addSource('selected-camera', {
        type: 'geojson',
        data: selectedCollection,
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

      map.on('click', 'camera-points', (event) => {
        const id = event.features?.[0]?.properties?.id

        if (typeof id === 'string') {
          onSelectCamera(id, 'map')
        }
      })

      map.on('mouseenter', 'camera-points', () => {
        map.getCanvas().style.cursor = 'pointer'
      })

      map.on('mouseleave', 'camera-points', () => {
        map.getCanvas().style.cursor = ''
      })

      setIsReady(true)
    }

    map.on('load', handleLoad)

    return () => {
      disposePopupRoot(popupRootRef.current)
      popupRootRef.current = null
      popupRef.current?.remove()
      popupRef.current = null
      map.remove()
      mapRef.current = null
      setIsReady(false)
    }
  }, [cameraCollection, onSelectCamera, selectedCollection])

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
        zoom: Math.max(mapRef.current.getZoom(), 10),
        duration: 650,
      })
      return
    }

    if (!selectedCamera) {
      fitMapToCameras(mapRef.current, cameras)
    }
  }, [cameras, isReady, selectedCamera, selectionSource])

  useEffect(() => {
    disposePopupRoot(popupRootRef.current)
    popupRootRef.current = null
    popupRef.current?.remove()
    popupRef.current = null

    if (!mapRef.current || !isReady || !selectedCamera) {
      return undefined
    }

    const popupNode = document.createElement('div')
    const popupRoot = createRoot(popupNode)
    popupRoot.render(
      <MapPopupCard
        camera={selectedCamera}
        onClearSelection={() => onSelectCamera(null, 'map')}
        onOpenGallery={onOpenGallery}
      />,
    )

    const popup = new maplibregl.Popup({
      className: styles.popupShell,
      closeButton: false,
      closeOnMove: false,
      offset: 18,
      maxWidth: '320px',
    })
      .setLngLat([selectedCamera.longitude, selectedCamera.latitude])
      .setDOMContent(popupNode)
      .addTo(mapRef.current)

    popupRef.current = popup
    popupRootRef.current = popupRoot

    return () => {
      popup.remove()
      disposePopupRoot(popupRoot)
    }
  }, [isReady, onOpenGallery, onSelectCamera, selectedCamera])

  return (
    <div className={styles.root}>
      <div ref={mapContainerRef} className={styles.mapCanvas} />

      {!cameras.length && (
        <div className={styles.emptyState}>
          <h3>No points in the current map window</h3>
          <p>Clear a route or regional filter to bring cameras back into the shared dataset.</p>
        </div>
      )}
    </div>
  )
}