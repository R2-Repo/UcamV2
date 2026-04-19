import { useEffect, useRef, type CSSProperties, type TouchEvent } from 'react'
import clsx from 'clsx'
import { CameraInfoDeck, type CameraModalController } from './modalShared'

const SWIPE_THRESHOLD = 42

interface MobileCameraModalProps {
  controller: CameraModalController
  onClose: () => void
  onCopyLink: (cameraId?: string | null) => void
  onOpenMap: (cameraId: string) => void
}

function getSlidePresentation(slot: number): { className?: string; style: CSSProperties } {
  switch (slot) {
    case -2:
      return {
        style: {
          transform: 'translate3d(-50%, -170%, -220px) rotateX(58deg) scale(0.66)',
          opacity: 0.28,
          zIndex: 1,
          filter: 'saturate(0.8) brightness(0.72)',
          pointerEvents: 'none',
        },
      }
    case -1:
      return {
        className: 'visible-top',
        style: {
          transform: 'translate3d(-50%, -112%, 28px) rotateX(26deg) scale(0.84)',
          opacity: 0.94,
          zIndex: 3,
        },
      }
    case 1:
      return {
        className: 'visible-bottom',
        style: {
          transform: 'translate3d(-50%, 14%, 28px) rotateX(-26deg) scale(0.84)',
          opacity: 0.94,
          zIndex: 3,
        },
      }
    case 2:
      return {
        style: {
          transform: 'translate3d(-50%, 72%, -220px) rotateX(-58deg) scale(0.66)',
          opacity: 0.28,
          zIndex: 1,
          filter: 'saturate(0.8) brightness(0.72)',
          pointerEvents: 'none',
        },
      }
    default:
      return {
        className: 'visible-center',
        style: {
          transform: 'translate3d(-50%, -50%, 140px) rotateX(0deg) scale(1)',
          opacity: 1,
          zIndex: 5,
        },
      }
  }
}

export function MobileCameraModal({
  controller,
  onClose,
  onCopyLink,
  onOpenMap,
}: MobileCameraModalProps) {
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        controller.goNext()
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        controller.goPrevious()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [controller, onClose])

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

    if (Math.abs(deltaY) <= SWIPE_THRESHOLD || Math.abs(deltaY) <= Math.abs(deltaX)) {
      return
    }

    if (deltaY < 0) {
      controller.goNext()
      return
    }

    controller.goPrevious()
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
          className="modal-content glass-modal legacy-modal-shell legacy-react-modal legacy-react-modal--mobile"
          role="presentation"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="modal-header modal-header-tight legacy-modal-topbar legacy-modal-topbar--mobile">
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

          <div className="modal-body modal-body-flex legacy-mobile-modal-body" id="modalBody">
            <CameraInfoDeck
              className="legacy-mobile-info-stack"
              deckCards={controller.deckCards}
              activeInfoCardIndex={controller.activeInfoCardIndex}
              onSelectInfoCard={controller.setActiveInfoCardIndex}
              onStepInfoCard={controller.stepInfoCard}
              displayedCamera={controller.displayedCamera}
              cameraDetails={controller.cameraDetails}
              mapCameras={controller.mapCameras}
              showSideArrows={false}
            />

            <div
              className="mobile-carousel-scene legacy-mobile-carousel-scene"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              <div className="mobile-gallery" role="list">
                {controller.mobileCarouselEntries.map((entry) => {
                  const slot = -entry.relativeOffset
                  const presentation = getSlidePresentation(slot)

                  return (
                    <button
                      key={entry.camera.id}
                      type="button"
                      role="listitem"
                      aria-current={slot === 0}
                      aria-label={`Open ${entry.camera.location}`}
                      className={clsx('mobile-slide', presentation.className, {
                        'is-active': slot === 0,
                      })}
                      style={presentation.style}
                      onClick={() => slot !== 0 && controller.selectCamera(entry.camera.id)}
                    >
                      <img src={entry.camera.imageUrl} alt={`Camera at ${entry.camera.location}`} loading="lazy" />
                      <div className="mobile-slide__label">{entry.camera.location}</div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="legacy-mobile-modal-meta">{controller.footerMeta}</div>

            <div className="legacy-mobile-carousel-nav">
              <button
                className="button ghost"
                type="button"
                title="Next camera"
                disabled={!controller.nextCard.cameraId}
                onClick={controller.goNext}
              >
                <i className="fas fa-chevron-up"></i>
              </button>
              <button
                className="button ghost"
                type="button"
                title="Previous camera"
                disabled={!controller.previousCard.cameraId}
                onClick={controller.goPrevious}
              >
                <i className="fas fa-chevron-down"></i>
              </button>
            </div>

            <div className="legacy-mobile-modal-actions">
              <button className="button" type="button" onClick={controller.handleMapAction}>
                Map
              </button>
              <button className="button" type="button" onClick={() => onOpenMap(controller.displayedCamera.id)}>
                Full Map
              </button>
              <button className="button" type="button" onClick={() => onCopyLink(controller.displayedCamera.id)}>
                Copy
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