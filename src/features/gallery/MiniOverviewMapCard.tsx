import { useEffect, useMemo, useRef } from 'react'
import type { FeatureCollection, Point } from 'geojson'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { CameraSummary } from '../../shared/types'
import { DEFAULT_MAP_STYLE, UTAH_VIEW } from '../map/mapStyle'
import styles from './MiniOverviewMapCard.module.css'

interface MiniOverviewMapCardProps {
  cameras: CameraSummary[]
  onSelect: () => void
}

type OverviewFeatureCollection = FeatureCollection<Point, { id: string }>

const OVERVIEW_SOURCE_ID = 'mini-overview-cameras'
const OVERVIEW_LAYER_ID = 'mini-overview-camera-points'

function createFeatureCollection(cameras: CameraSummary[]): OverviewFeatureCollection {
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
      },
    })),
  }
}

function fitMapToCameras(map: maplibregl.Map, cameras: CameraSummary[]) {
  if (!cameras.length) {
    map.jumpTo({ center: UTAH_VIEW.center, zoom: UTAH_VIEW.zoom })
    return
  }

  if (cameras.length === 1) {
    const [camera] = cameras

    map.jumpTo({
      center: [camera.longitude, camera.latitude],
      zoom: 11.75,
    })
    return
  }

  const bounds = new maplibregl.LngLatBounds()
  cameras.forEach((camera) => bounds.extend([camera.longitude, camera.latitude]))
  map.fitBounds(bounds, {
    padding: 24,
    duration: 0,
    maxZoom: 10.75,
  })
}

export function MiniOverviewMapCard({ cameras, onSelect }: MiniOverviewMapCardProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const isMapReadyRef = useRef(false)
  const featureCollection = useMemo(() => createFeatureCollection(cameras), [cameras])

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
      interactive: false,
      fadeDuration: 0,
    })

    mapRef.current = map

    const handleLoad = () => {
      map.addSource(OVERVIEW_SOURCE_ID, {
        type: 'geojson',
        data: featureCollection,
      })

      map.addLayer({
        id: OVERVIEW_LAYER_ID,
        type: 'circle',
        source: OVERVIEW_SOURCE_ID,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 3.5, 8, 4.75, 11, 6],
          'circle-color': '#ff7800',
          'circle-stroke-width': 1.35,
          'circle-stroke-color': '#fffdf7',
          'circle-opacity': 0.95,
        },
      })

      isMapReadyRef.current = true
      map.resize()
      fitMapToCameras(map, cameras)
    }

    map.on('load', handleLoad)

    let observer: ResizeObserver | null = null

    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        map.resize()

        if (isMapReadyRef.current) {
          fitMapToCameras(map, cameras)
        }
      })
      observer.observe(mapContainerRef.current)
    }

    return () => {
      observer?.disconnect()
      map.off('load', handleLoad)
      isMapReadyRef.current = false
      map.remove()
      mapRef.current = null
    }
  }, [cameras, featureCollection])

  useEffect(() => {
    const map = mapRef.current

    if (!map || !isMapReadyRef.current) {
      return
    }

    const source = map.getSource(OVERVIEW_SOURCE_ID) as maplibregl.GeoJSONSource | undefined
    source?.setData(featureCollection)
    fitMapToCameras(map, cameras)
  }, [cameras, featureCollection])

  return (
    <div className="col">
      <div className="aspect-ratio-box">
        <button
          className={`app-image-button ${styles.button}`.trim()}
          type="button"
          title="Open filtered overview in full map"
          aria-label="Open filtered overview in full map"
          onClick={onSelect}
        >
          <div className={styles.mapFrame}>
            <div ref={mapContainerRef} aria-hidden="true" className={styles.mapCanvas} />
          </div>
          <div className={styles.overlay}>
            <span className={styles.eyebrow}>Map Overview</span>
            <strong className={styles.title}>Filtered gallery</strong>
            <span className={styles.meta}>{cameras.length} cameras</span>
          </div>
        </button>
      </div>
    </div>
  )
}
