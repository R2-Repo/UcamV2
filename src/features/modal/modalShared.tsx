import { useCallback, useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { getCameraSubtitle } from '../../shared/lib/cameras'
import {
  createCameraLookup,
  resolveModalCameraWindow,
  resolveModalNeighborIds,
} from '../../shared/lib/modalCamera'
import { getPrimaryRouteLabel } from '../../shared/lib/routes'
import type { CameraDetails, CameraSummary, SelectionSource } from '../../shared/types'
import { ModalMapCanvas } from './ModalMapCanvas'

export interface CameraModalProps {
  activeCamera: CameraSummary
  cameras: CameraSummary[]
  orderedCameraIds: string[]
  cameraDetailsById: ReadonlyMap<string, CameraDetails>
  onClose: () => void
  onCopyLink: (cameraId?: string | null) => void
  onOpenMap: (cameraId: string) => void
  onSelectCamera: (cameraId: string, source: SelectionSource) => void
}

export interface NeighborCardData {
  cameraId: string | null
  camera: CameraSummary | null
  imageUrl: string | null
  label: string
}

export interface DeckCardDescriptor {
  key: 'mini-map' | 'meta' | 'street' | 'map'
  mobileOnly?: boolean
}

export interface ModalMapCamera {
  camera: CameraSummary
  tone: 'previous' | 'current' | 'next'
}

export interface MobileCarouselEntry {
  camera: CameraSummary
  relativeOffset: number
}

export interface CameraModalController {
  displayedCamera: CameraSummary
  cameraDetails: CameraDetails | null
  previousCard: NeighborCardData
  nextCard: NeighborCardData
  deckCards: DeckCardDescriptor[]
  activeInfoCardIndex: number
  setActiveInfoCardIndex: (index: number) => void
  stepInfoCard: (direction: -1 | 1) => void
  handleMapAction: () => void
  mapCameras: ModalMapCamera[]
  footerMeta: string
  mobileCarouselEntries: MobileCarouselEntry[]
  selectCamera: (cameraId: string) => void
  goPrevious: () => void
  goNext: () => void
}

function LazyEmbedCard({
  active,
  label,
  title,
  url,
}: {
  active: boolean
  label: string
  title: string
  url: string | null
}) {
  const [shouldLoad, setShouldLoad] = useState(false)

  useEffect(() => {
    setShouldLoad(false)
  }, [url])

  useEffect(() => {
    if (active && url) {
      setShouldLoad(true)
    }
  }, [active, url])

  if (!url) {
    return <div className="info-card__embed">Not available</div>
  }

  if (!shouldLoad) {
    return <div className="info-card__embed">Tap to load {label}</div>
  }

  return (
    <div className="info-card__embed">
      <iframe
        allowFullScreen
        aria-label={title}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        src={url}
        title={title}
      />
    </div>
  )
}

function createNeighborCard(
  cameraId: string | null,
  cameraLookup: ReadonlyMap<string, CameraSummary>,
  fallback: CameraDetails['neighbors']['previous'] | CameraDetails['neighbors']['next'] | null,
  labelFallback: string,
) {
  const camera = cameraId ? cameraLookup.get(cameraId) ?? null : null

  return {
    cameraId: camera?.id ?? fallback?.cameraId ?? null,
    camera,
    imageUrl: camera?.imageUrl ?? fallback?.imageUrl ?? null,
    label: camera?.location ?? fallback?.name ?? labelFallback,
  } satisfies NeighborCardData
}

export function useIsMobileViewport() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return isMobile
}

export function useCameraModalController({
  activeCamera,
  cameras,
  orderedCameraIds,
  cameraDetailsById,
  onSelectCamera,
  isMobile,
}: Omit<CameraModalProps, 'onClose' | 'onCopyLink' | 'onOpenMap'> & { isMobile: boolean }): CameraModalController {
  const cameraLookup = useMemo(() => createCameraLookup(cameras), [cameras])
  const [displayedCameraId, setDisplayedCameraId] = useState(activeCamera.id)
  const [activeInfoCardIndex, setActiveInfoCardIndex] = useState(0)

  const displayedCamera = cameraLookup.get(displayedCameraId) ?? activeCamera
  const cameraDetails = cameraDetailsById.get(displayedCamera.id) ?? null

  const neighborIds = useMemo(
    () =>
      resolveModalNeighborIds({
        activeCameraId: displayedCamera.id,
        orderedCameraIds,
        cameraDetailsById,
      }),
    [cameraDetailsById, displayedCamera.id, orderedCameraIds],
  )

  const previousCard = useMemo(
    () =>
      createNeighborCard(
        neighborIds.previousCameraId,
        cameraLookup,
        cameraDetails?.neighbors.previous ?? null,
        'Previous camera',
      ),
    [cameraDetails?.neighbors.previous, cameraLookup, neighborIds.previousCameraId],
  )

  const nextCard = useMemo(
    () =>
      createNeighborCard(
        neighborIds.nextCameraId,
        cameraLookup,
        cameraDetails?.neighbors.next ?? null,
        'Next camera',
      ),
    [cameraDetails?.neighbors.next, cameraLookup, neighborIds.nextCameraId],
  )

  const deckCards = useMemo(() => {
    const descriptors: DeckCardDescriptor[] = [{ key: 'meta' }, { key: 'street' }, { key: 'map' }]

    if (isMobile) {
      descriptors.unshift({ key: 'mini-map', mobileOnly: true })
    }

    return descriptors
  }, [isMobile])

  const mapCardIndex = deckCards.findIndex((card) => card.key === 'map')

  const mapCameras = useMemo(
    () =>
      [
        previousCard.camera ? { camera: previousCard.camera, tone: 'previous' as const } : null,
        { camera: displayedCamera, tone: 'current' as const },
        nextCard.camera ? { camera: nextCard.camera, tone: 'next' as const } : null,
      ].filter((camera): camera is ModalMapCamera => camera !== null),
    [displayedCamera, nextCard.camera, previousCard.camera],
  )

  const footerMeta = [getPrimaryRouteLabel(displayedCamera), getCameraSubtitle(displayedCamera)]
    .filter(Boolean)
    .join(' · ')

  const mobileCarouselIds = useMemo(
    () =>
      resolveModalCameraWindow({
        activeCameraId: displayedCamera.id,
        orderedCameraIds,
        cameraDetailsById,
      }),
    [cameraDetailsById, displayedCamera.id, orderedCameraIds],
  )

  const mobileCarouselEntries = useMemo(() => {
    const activeIndex = mobileCarouselIds.indexOf(displayedCamera.id)

    return mobileCarouselIds
      .map((cameraId, index) => {
        const camera = cameraId === displayedCamera.id ? displayedCamera : cameraLookup.get(cameraId) ?? null

        if (!camera) {
          return null
        }

        return {
          camera,
          relativeOffset: activeIndex === -1 ? 0 : index - activeIndex,
        }
      })
      .filter((entry): entry is MobileCarouselEntry => entry !== null)
  }, [cameraLookup, displayedCamera, mobileCarouselIds])

  useEffect(() => {
    setDisplayedCameraId(activeCamera.id)
    setActiveInfoCardIndex(0)
  }, [activeCamera.id])

  useEffect(() => {
    if (displayedCameraId !== activeCamera.id) {
      onSelectCamera(displayedCameraId, 'gallery')
    }
  }, [activeCamera.id, displayedCameraId, onSelectCamera])

  useEffect(() => {
    if (activeInfoCardIndex < deckCards.length) {
      return
    }

    setActiveInfoCardIndex(0)
  }, [activeInfoCardIndex, deckCards.length])

  useEffect(() => {
    ;[previousCard.imageUrl, nextCard.imageUrl]
      .filter((url): url is string => Boolean(url))
      .forEach((url) => {
        const image = new Image()
        image.src = url
      })
  }, [nextCard.imageUrl, previousCard.imageUrl])

  const selectCamera = useCallback((cameraId: string) => {
    setDisplayedCameraId((current) => (current === cameraId ? current : cameraId))
  }, [])

  const goPrevious = useCallback(() => {
    if (previousCard.cameraId) {
      selectCamera(previousCard.cameraId)
    }
  }, [previousCard.cameraId, selectCamera])

  const goNext = useCallback(() => {
    if (nextCard.cameraId) {
      selectCamera(nextCard.cameraId)
    }
  }, [nextCard.cameraId, selectCamera])

  const stepInfoCard = useCallback(
    (direction: -1 | 1) => {
      setActiveInfoCardIndex((current) => (current + direction + deckCards.length) % deckCards.length)
    },
    [deckCards.length],
  )

  const handleMapAction = useCallback(() => {
    if (mapCardIndex >= 0) {
      setActiveInfoCardIndex(mapCardIndex)
    }
  }, [mapCardIndex])

  return {
    displayedCamera,
    cameraDetails,
    previousCard,
    nextCard,
    deckCards,
    activeInfoCardIndex,
    setActiveInfoCardIndex,
    stepInfoCard,
    handleMapAction,
    mapCameras,
    footerMeta,
    mobileCarouselEntries,
    selectCamera,
    goPrevious,
    goNext,
  }
}

interface CameraInfoDeckProps {
  className?: string
  deckCards: DeckCardDescriptor[]
  activeInfoCardIndex: number
  onSelectInfoCard: (index: number) => void
  onStepInfoCard: (direction: -1 | 1) => void
  displayedCamera: CameraSummary
  cameraDetails: CameraDetails | null
  mapCameras: ModalMapCamera[]
  showSideArrows?: boolean
}

export function CameraInfoDeck({
  className,
  deckCards,
  activeInfoCardIndex,
  onSelectInfoCard,
  onStepInfoCard,
  displayedCamera,
  cameraDetails,
  mapCameras,
  showSideArrows = true,
}: CameraInfoDeckProps) {
  const leftCardIndex = (activeInfoCardIndex - 1 + deckCards.length) % deckCards.length
  const rightCardIndex = (activeInfoCardIndex + 1) % deckCards.length

  function renderDeckCard(card: DeckCardDescriptor, index: number) {
    const cardClassName = clsx('info-card', {
      'info-card--mini-map': card.key === 'mini-map',
      'info-card--meta': card.key === 'meta',
      'info-card--street': card.key === 'street',
      'info-card--map': card.key === 'map',
      'is-active': index === activeInfoCardIndex,
      'is-left': index === leftCardIndex,
      'is-right': index === rightCardIndex,
      'mobile-only': card.mobileOnly,
    })

    if (card.key === 'mini-map') {
      return (
        <div key={card.key} className={cardClassName}>
          {index === activeInfoCardIndex ? (
            <ModalMapCanvas
              cameras={mapCameras}
              interactive={false}
              className="info-card__map-container"
            />
          ) : (
            <div className="info-card__map-container" />
          )}
        </div>
      )
    }

    if (card.key === 'street') {
      return (
        <div key={card.key} className={cardClassName}>
          <LazyEmbedCard
            active={index === activeInfoCardIndex}
            label="Street View"
            title={`Street View for ${displayedCamera.location}`}
            url={cameraDetails?.embeds.streetViewUrl ?? null}
          />
        </div>
      )
    }

    if (card.key === 'map') {
      return (
        <div key={card.key} className={cardClassName}>
          <LazyEmbedCard
            active={index === activeInfoCardIndex}
            label="Map"
            title={`Map for ${displayedCamera.location}`}
            url={cameraDetails?.embeds.googleMapsUrl ?? null}
          />
        </div>
      )
    }

    return (
      <div key={card.key} className={cardClassName}>
        <div className="info-card__columns">
          <div className="info-card__column">
            <div className="info-card__title">Primary Route</div>
            <div className="info-field">
              <span className="label">Route:</span>
              <span className="value">
                {cameraDetails?.routes.primary.routeCode ?? getPrimaryRouteLabel(displayedCamera)}
              </span>
            </div>
            <div className="info-field">
              <span className="label">Alt Name A:</span>
              <span className="value">{cameraDetails?.routes.primary.altNameA ?? 'Not available'}</span>
            </div>
            <div className="info-field">
              <span className="label">Alt Name B:</span>
              <span className="value">{cameraDetails?.routes.primary.altNameB ?? 'Not available'}</span>
            </div>
            <div className="info-field">
              <span className="label">MP (LM):</span>
              <span className="value">
                {cameraDetails?.routes.primary.logicalMilepost ??
                  displayedCamera.routeRefs[0]?.milepost ??
                  'Not available'}
              </span>
            </div>
            <div className="info-field">
              <span className="label">MP (Phys):</span>
              <span className="value">{cameraDetails?.routes.primary.physicalMilepost ?? 'Not available'}</span>
            </div>
          </div>

          <div className="info-card__column">
            <div className="info-card__title">Secondary Route</div>
            <div className="info-field">
              <span className="label">Route:</span>
              <span className="value">{cameraDetails?.routes.secondary.routeCode ?? 'Not available'}</span>
            </div>
            <div className="info-field">
              <span className="label">Alt Name A:</span>
              <span className="value">{cameraDetails?.routes.secondary.altNameA ?? 'Not available'}</span>
            </div>
            <div className="info-field">
              <span className="label">Alt Name B:</span>
              <span className="value">{cameraDetails?.routes.secondary.altNameB ?? 'Not available'}</span>
            </div>
            <div className="info-field">
              <span className="label">MP (LM):</span>
              <span className="value">{cameraDetails?.routes.secondary.logicalMilepost ?? 'Not available'}</span>
            </div>
            <div className="info-field">
              <span className="label">MP (Phys):</span>
              <span className="value">{cameraDetails?.routes.secondary.physicalMilepost ?? 'Not available'}</span>
            </div>
          </div>
        </div>

        <div className="info-card__footer">
          {[
            cameraDetails?.location.city,
            cameraDetails?.location.county,
            cameraDetails?.location.region ? `Region ${cameraDetails.location.region}` : null,
            displayedCamera.direction,
          ]
            .filter(Boolean)
            .join(' • ') || displayedCamera.location}
        </div>
      </div>
    )
  }

  return (
    <div className={clsx('modal-info-stack', className)}>
      <div className="info-stack-track">{deckCards.map((card, index) => renderDeckCard(card, index))}</div>

      {deckCards.length > 1 && (
        <div className="info-stack-controls">
          <div className="info-stack-dots">
            {deckCards.map((card, index) => (
              <button
                key={card.key}
                type="button"
                className={clsx('info-stack-dot', {
                  active: index === activeInfoCardIndex,
                  'mobile-only': card.mobileOnly,
                })}
                aria-label={`Open ${card.key.replace('-', ' ')} card`}
                onClick={() => onSelectInfoCard(index)}
              />
            ))}
          </div>
        </div>
      )}

      {showSideArrows && deckCards.length > 1 && (
        <>
          <button
            type="button"
            className="info-stack-arrow info-stack-arrow-left"
            aria-label="Previous card"
            onClick={() => onStepInfoCard(-1)}
          >
            <i className="fas fa-chevron-left"></i>
          </button>
          <button
            type="button"
            className="info-stack-arrow info-stack-arrow-right"
            aria-label="Next card"
            onClick={() => onStepInfoCard(1)}
          >
            <i className="fas fa-chevron-right"></i>
          </button>
        </>
      )}
    </div>
  )
}