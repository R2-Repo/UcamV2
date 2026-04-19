import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { useInViewport } from '../../shared/hooks/useInViewport'
import { buildRefreshedImageUrl } from '../../shared/lib/cameras'
import type { CameraSummary } from '../../shared/types'

const REFRESH_INTERVAL_MS = 90000

interface CameraCardProps {
  camera: CameraSummary
  isSelected: boolean
  refreshNonce: number
  onSelect: () => void
}

export function CameraCard({ camera, isSelected, refreshNonce, onSelect }: CameraCardProps) {
  const { ref, isInViewport } = useInViewport<HTMLButtonElement>()
  const [refreshToken, setRefreshToken] = useState(() => Date.now())

  useEffect(() => {
    if (refreshNonce > 0) {
      setRefreshToken(refreshNonce)
    }
  }, [refreshNonce])

  useEffect(() => {
    if (!isInViewport) {
      return undefined
    }

    const refreshImage = () => {
      if (document.visibilityState === 'visible') {
        setRefreshToken(Date.now())
      }
    }

    const intervalId = window.setInterval(refreshImage, REFRESH_INTERVAL_MS)
    document.addEventListener('visibilitychange', refreshImage)

    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', refreshImage)
    }
  }, [isInViewport])

  const imageSrc = useMemo(
    () => (isInViewport ? buildRefreshedImageUrl(camera.imageUrl, refreshToken) : camera.imageUrl),
    [camera.imageUrl, isInViewport, refreshToken],
  )

  return (
    <div className="col">
      <div className={clsx('aspect-ratio-box', isSelected && 'is-selected')}>
        <button
          ref={ref}
          className="app-image-button"
          type="button"
          title={camera.location}
          onClick={onSelect}
        >
          <img alt={`Camera at ${camera.location}`} loading="lazy" src={imageSrc} />
        </button>
      </div>
    </div>
  )
}