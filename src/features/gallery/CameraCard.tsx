import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { useInViewport } from '../../shared/hooks/useInViewport'
import {
  IMAGE_REFRESH_INTERVAL_MS,
  buildRefreshedImageUrl,
  resolveCameraImageUrl,
} from '../../shared/lib/cameras'
import type { CameraSummary } from '../../shared/types'

interface CameraCardProps {
  camera: CameraSummary
  isSelected: boolean
  sharedRefreshToken?: number
  onSelect: () => void
}

export function CameraCard({ camera, isSelected, sharedRefreshToken, onSelect }: CameraCardProps) {
  const { ref, isInViewport } = useInViewport<HTMLButtonElement>()
  const [refreshToken, setRefreshToken] = useState(() => Date.now())
  const isSharedRefreshControlled = isSelected && sharedRefreshToken !== undefined

  useEffect(() => {
    if (isSharedRefreshControlled) {
      setRefreshToken(sharedRefreshToken)
    }
  }, [isSharedRefreshControlled, sharedRefreshToken])

  useEffect(() => {
    if (!isInViewport || isSharedRefreshControlled) {
      return undefined
    }

    const refreshImage = () => {
      if (document.visibilityState === 'visible') {
        setRefreshToken(Date.now())
      }
    }

    const intervalId = window.setInterval(refreshImage, IMAGE_REFRESH_INTERVAL_MS)
    document.addEventListener('visibilitychange', refreshImage)

    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', refreshImage)
    }
  }, [isInViewport, isSharedRefreshControlled])

  const imageSrc = useMemo(() => {
    if (isSharedRefreshControlled) {
      return resolveCameraImageUrl(camera.imageUrl, sharedRefreshToken)
    }

    return isInViewport ? buildRefreshedImageUrl(camera.imageUrl, refreshToken) : camera.imageUrl
  }, [camera.imageUrl, isInViewport, isSharedRefreshControlled, refreshToken, sharedRefreshToken])

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