import { useEffect, useRef, useState, type TouchEvent } from 'react'
import clsx from 'clsx'
import modalLogoAsset from '../../../../gifLogo.gif'
import { ModalMapCanvas } from './ModalMapCanvas'
import { CameraInfoDeck, type CameraModalController } from './modalShared'

const CAROUSEL_ANIMATION_MS = 750
const CAROUSEL_SWAP_MS = 330
const SWIPE_THRESHOLD = 48

interface DesktopCameraModalProps {
  controller: CameraModalController
  onClose: () => void
  onCopyLink: (cameraId?: string | null) => void
  onOpenMap: (cameraId: string) => void
}

export function DesktopCameraModal({
  controller,
  onClose,
  onCopyLink,
  onOpenMap,
}: DesktopCameraModalProps) {
  const [animationClass, setAnimationClass] = useState('')
  const timersRef = useRef<number[]>([])
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer))
      timersRef.current = []
    }
  }, [])

  function queueTimer(callback: () => void, delay: number) {
    const timer = window.setTimeout(callback, delay)
    timersRef.current.push(timer)
  }

  function navigateToNeighbor(cameraId: string, direction: 'previous' | 'next') {
    if (animationClass) {
      return
    }

    setAnimationClass(direction === 'next' ? 'is-sliding-left' : 'is-sliding-right')

    queueTimer(() => {
      controller.selectCamera(cameraId)
    }, CAROUSEL_SWAP_MS)

    queueTimer(() => {
      setAnimationClass('')
    }, CAROUSEL_ANIMATION_MS)
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }

      if (event.key === 'ArrowLeft' && controller.previousCard.cameraId) {
        event.preventDefault()
        navigateToNeighbor(controller.previousCard.cameraId, 'previous')
      }

      if (event.key === 'ArrowRight' && controller.nextCard.cameraId) {
        event.preventDefault()
        navigateToNeighbor(controller.nextCard.cameraId, 'next')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [controller.nextCard.cameraId, controller.previousCard.cameraId, onClose])

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    const touch = event.touches[0]
    swipeStartRef.current = { x: touch.clientX, y: touch.clientY }
  }

  function handleTouchEnd(event: TouchEvent<HTMLDivElement>) {
    if (!swipeStartRef.current) {
      return
    }

    const touch = event.changedTouches[0]
    const deltaX = touch.clientX - swipeStartRef.current.x
    const deltaY = touch.clientY - swipeStartRef.current.y
    swipeStartRef.current = null

    if (Math.abs(deltaX) <= SWIPE_THRESHOLD || Math.abs(deltaX) <= Math.abs(deltaY)) {
      return
    }

    if (deltaX > 0 && controller.previousCard.cameraId) {
      navigateToNeighbor(controller.previousCard.cameraId, 'previous')
    }

    if (deltaX < 0 && controller.nextCard.cameraId) {
      navigateToNeighbor(controller.nextCard.cameraId, 'next')
    }
  }

  return (
    <div className="legacy-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="legacy-modal-dialog modal-dialog modal-dialog-centered modal-lg"
        role="dialog"
        aria-modal="true"
        aria-label={controller.displayedCamera.location}
      >
        <div
          className="modal-content glass-modal legacy-modal-shell legacy-react-modal legacy-react-modal--desktop"
          role="presentation"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="modal-header modal-header-tight legacy-modal-topbar">
            <h5 className="modal-title">{controller.displayedCamera.location}</h5>
            <button
              className="button legacy-modal-close"
              type="button"
              aria-label="Close modal"
              onClick={onClose}
            >
              <i className="fas fa-times"></i>
            </button>
          </div>

          <div className="modal-body modal-body-flex" id="modalBody">
            <div className="modal-carousel-wrapper" id="modalCarouselWrapper">
              <div className="carousel-3d">
                <div className={clsx('carousel-3d-track', animationClass)}>
                  <button
                    className={clsx('carousel-card', 'carousel-card--left', {
                      'is-empty': !controller.previousCard.imageUrl,
                    })}
                    type="button"
                    disabled={!controller.previousCard.cameraId}
                    onClick={() =>
                      controller.previousCard.cameraId &&
                      navigateToNeighbor(controller.previousCard.cameraId, 'previous')
                    }
                  >
                    {controller.previousCard.imageUrl ? (
                      <>
                        <img
                          src={controller.previousCard.imageUrl}
                          alt={controller.previousCard.label}
                          loading="lazy"
                        />
                        <div className="carousel-caption">{controller.previousCard.label}</div>
                      </>
                    ) : (
                      <div className="legacy-modal-placeholder">No previous camera</div>
                    )}
                  </button>

                  <div
                    className="carousel-card carousel-card--center"
                    id="modalImageContainer"
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                  >
                    <img
                      id="modalImage"
                      src={controller.displayedCamera.imageUrl}
                      alt={`Camera at ${controller.displayedCamera.location}`}
                    />
                  </div>

                  <button
                    className={clsx('carousel-card', 'carousel-card--right', {
                      'is-empty': !controller.nextCard.imageUrl,
                    })}
                    type="button"
                    disabled={!controller.nextCard.cameraId}
                    onClick={() =>
                      controller.nextCard.cameraId &&
                      navigateToNeighbor(controller.nextCard.cameraId, 'next')
                    }
                  >
                    {controller.nextCard.imageUrl ? (
                      <>
                        <img src={controller.nextCard.imageUrl} alt={controller.nextCard.label} loading="lazy" />
                        <div className="carousel-caption">{controller.nextCard.label}</div>
                      </>
                    ) : (
                      <div className="legacy-modal-placeholder">No next camera</div>
                    )}
                  </button>
                </div>

                <div className="carousel-controls">
                  <button
                    className="button ghost"
                    type="button"
                    title="Previous camera"
                    disabled={!controller.previousCard.cameraId}
                    onClick={() =>
                      controller.previousCard.cameraId &&
                      navigateToNeighbor(controller.previousCard.cameraId, 'previous')
                    }
                  >
                    <i className="fas fa-chevron-left"></i>
                  </button>
                  <div className="carousel-dot"></div>
                  <button
                    className="button ghost"
                    type="button"
                    title="Next camera"
                    disabled={!controller.nextCard.cameraId}
                    onClick={() =>
                      controller.nextCard.cameraId &&
                      navigateToNeighbor(controller.nextCard.cameraId, 'next')
                    }
                  >
                    <i className="fas fa-chevron-right"></i>
                  </button>
                </div>
              </div>
            </div>

            {controller.showInlineMap && (
              <div id="modalMapContainer" className="legacy-modal-map-panel">
                <ModalMapCanvas cameras={controller.mapCameras} className="legacy-modal-map-surface" />
              </div>
            )}

            <CameraInfoDeck
              deckCards={controller.deckCards}
              activeInfoCardIndex={controller.activeInfoCardIndex}
              onSelectInfoCard={controller.setActiveInfoCardIndex}
              onStepInfoCard={controller.stepInfoCard}
              displayedCamera={controller.displayedCamera}
              cameraDetails={controller.cameraDetails}
              mapCameras={controller.mapCameras}
            />

            <div className="modal-mini-map">
              <ModalMapCanvas cameras={controller.mapCameras} interactive={false} />
            </div>

            <div className="modal-logo-container">
              <img src={modalLogoAsset} alt="UDOT Cameras" className="modal-logo" />
              <div className="modal-logo-text">udotcameras.com</div>
            </div>
          </div>

          <div className="modal-footer legacy-modal-footer">
            <div className="legacy-modal-meta">{controller.footerMeta}</div>

            <div className="legacy-modal-actions">
              <button
                className={clsx('button', { off: controller.showInlineMap })}
                type="button"
                onClick={controller.handleMapAction}
              >
                {controller.showInlineMap ? 'Hide Map' : 'Map'}
              </button>
              <button className="button" type="button" onClick={() => onOpenMap(controller.displayedCamera.id)}>
                Open Full Map
              </button>
              <button className="button" type="button" onClick={() => onCopyLink(controller.displayedCamera.id)}>
                Copy URL
              </button>
              <button className="button" type="button" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}