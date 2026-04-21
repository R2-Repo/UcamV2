import type { CameraSummary, SelectionSource } from '../../shared/types'
import { CameraCard } from './CameraCard'

interface GalleryViewProps {
  cameras: CameraSummary[]
  selectedCameraId: string | null
  imageSize: number
  refreshTokensByCameraId: Readonly<Record<string, number>>
  onSelectCamera: (cameraId: string, source: SelectionSource) => void
}

export function GalleryView({
  cameras,
  selectedCameraId,
  imageSize,
  refreshTokensByCameraId,
  onSelectCamera,
}: GalleryViewProps) {
  if (!cameras.length) {
    return (
      <div className="app-empty-state">
        <h3>No cameras match the current filter set</h3>
        <p>Try clearing a route, county, or city filter and the gallery will repopulate.</p>
      </div>
    )
  }

  return (
    <div className="container-fluid" style={{ position: 'relative' }}>
      <div
        id="imageGallery"
        className="container-fluid fade-in"
        style={{
          gridTemplateColumns: `repeat(auto-fit, minmax(${imageSize}px, 1fr))`,
        }}
      >
        {cameras.map((camera) => (
          <CameraCard
            key={camera.id}
            camera={camera}
            isSelected={camera.id === selectedCameraId}
            sharedRefreshToken={refreshTokensByCameraId[camera.id]}
            onSelect={() => onSelectCamera(camera.id, 'gallery')}
          />
        ))}
      </div>
    </div>
  )
}