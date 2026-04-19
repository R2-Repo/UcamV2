import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { DEFAULT_MAP_STYLE, UTAH_VIEW } from '../map/mapStyle'
import type { CameraSummary } from '../../shared/types'

interface ModalMapCamera {
  camera: CameraSummary
  tone: 'previous' | 'current' | 'next'
}

interface ModalMapCanvasProps {
  cameras: ModalMapCamera[]
  interactive?: boolean
  className?: string
}

function createMarkerElement(tone: ModalMapCamera['tone'], label: string) {
  const marker = document.createElement('div')
  marker.className = `legacy-modal-map-marker is-${tone}`
  marker.setAttribute('aria-label', label)
  marker.title = label
  return marker
}

export function ModalMapCanvas({ cameras, interactive = true, className }: ModalMapCanvasProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<maplibregl.Marker[]>([])

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
      dragRotate: false,
      pitchWithRotate: false,
      cooperativeGestures: interactive,
      interactive,
    })

    if (interactive) {
      map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), 'top-right')
    }

    const resizeObserver = new ResizeObserver(() => {
      map.resize()
    })

    resizeObserver.observe(mapContainerRef.current)
    mapRef.current = map

    return () => {
      resizeObserver.disconnect()
      markersRef.current.forEach((marker) => marker.remove())
      markersRef.current = []
      map.remove()
      mapRef.current = null
    }
  }, [interactive])

  useEffect(() => {
    const map = mapRef.current

    if (!map) {
      return
    }

    markersRef.current.forEach((marker) => marker.remove())
    markersRef.current = []

    if (!cameras.length) {
      map.easeTo({ center: UTAH_VIEW.center, zoom: UTAH_VIEW.zoom, duration: 300 })
      return
    }

    const bounds = new maplibregl.LngLatBounds()

    cameras.forEach(({ camera, tone }) => {
      bounds.extend([camera.longitude, camera.latitude])

      const marker = new maplibregl.Marker({
        element: createMarkerElement(tone, camera.location),
        anchor: 'center',
      })
        .setLngLat([camera.longitude, camera.latitude])
        .addTo(map)

      markersRef.current.push(marker)
    })

    requestAnimationFrame(() => {
      map.resize()

      if (cameras.length === 1) {
        const [camera] = cameras
        map.easeTo({
          center: [camera.camera.longitude, camera.camera.latitude],
          zoom: 12.6,
          duration: 350,
        })
        return
      }

      map.fitBounds(bounds, {
        padding: 48,
        duration: 350,
        maxZoom: 13,
      })
    })
  }, [cameras])

  return <div ref={mapContainerRef} className={className ?? 'legacy-modal-map-surface'} />
}