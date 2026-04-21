import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { useSearchParams } from 'react-router-dom'
import { FilterBar } from '../features/filters/FilterBar'
import {
  resolveValidSelectedCameraId,
  shouldClearSelectionForViewModeChange,
  shouldOpenGalleryModalFromSelection,
  shouldPersistSelectedCamera,
} from '../features/filters/selection-contract'
import { createRouteSelectors, deriveFilterOptions, filterCameras } from '../features/filters/selectors'
import { CameraModal } from '../features/modal/CameraModal'
import { useAppStore } from '../features/filters/store'
import { buildSearchParams, parseSearchParams } from '../features/filters/url-state'
import { GalleryView } from '../features/gallery/GalleryView'
import { useAppData } from '../shared/data/useAppData'
import { useElementSize } from '../shared/hooks/useElementSize'
import { IMAGE_REFRESH_INTERVAL_MS } from '../shared/lib/cameras'
import type { FilterState, SelectionSource, ViewMode } from '../shared/types'
import styles from './AppShell.module.css'
import { SplashScreen } from './SplashScreen'

const LazyMapView = lazy(async () => {
  const module = await import('../features/map/MapView')

  return {
    default: module.MapView,
  }
})

function getActiveBadges(filters: FilterState, routeLabel: string | null) {
  return [
    filters.region ? { icon: 'fas fa-map', label: `Region: ${filters.region}` } : null,
    filters.county ? { icon: 'fas fa-building', label: `County: ${filters.county}` } : null,
    filters.city ? { icon: 'fas fa-city', label: `City: ${filters.city}` } : null,
    filters.maintenance
      ? { icon: 'fas fa-tools', label: `Maintenance: ${filters.maintenance}` }
      : null,
    routeLabel ? { icon: 'fas fa-road', label: `Route: ${routeLabel}` } : null,
    filters.searchQuery ? { icon: 'fas fa-search', label: `Search: ${filters.searchQuery}` } : null,
  ].filter(Boolean) as Array<{ icon: string; label: string }>
}

function getScrollTop() {
  return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0
}

export function AppShell() {
  const { cameras, cameraDetailsById, routes, isLoading, showSplash, error } = useAppData()
  const filters = useAppStore((state) => state.filters)
  const viewMode = useAppStore((state) => state.viewMode)
  const selectedCameraId = useAppStore((state) => state.selectedCameraId)
  const selectionSource = useAppStore((state) => state.selectionSource)
  const setFilter = useAppStore((state) => state.setFilter)
  const resetFilters = useAppStore((state) => state.resetFilters)
  const setViewMode = useAppStore((state) => state.setViewMode)
  const setSelectedCamera = useAppStore((state) => state.setSelectedCamera)
  const hydrateFromUrl = useAppStore((state) => state.hydrateFromUrl)
  const [imageSize, setImageSize] = useState(180)
  const [refreshTokensByCameraId, setRefreshTokensByCameraId] = useState<Record<string, number>>({})
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [galleryScrollTop, setGalleryScrollTop] = useState(0)
  const [isGalleryScrollingUp, setIsGalleryScrollingUp] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const lastAppliedSearch = useRef('')
  const hasHydratedUrlState = useRef(false)
  const skipNextUrlSync = useRef(false)
  const lastSyncedViewMode = useRef<ViewMode | null>(null)
  const previousGalleryScrollTopRef = useRef(0)
  const { ref: mapOverlayRef, size: mapOverlaySize } = useElementSize<HTMLDivElement>()

  const routeLookup = useMemo(() => createRouteSelectors(routes), [routes])
  const filteredCameras = useMemo(
    () => filterCameras(cameras, routeLookup, filters),
    [cameras, filters, routeLookup],
  )
  const filterOptions = useMemo(
    () => deriveFilterOptions(cameras, routes, routeLookup, filters),
    [cameras, filters, routeLookup, routes],
  )
  const availableCameraIds = useMemo(() => new Set(cameras.map((camera) => camera.id)), [cameras])
  const filteredCameraIds = useMemo(() => new Set(filteredCameras.map((camera) => camera.id)), [filteredCameras])
  const validSelectedCameraId = useMemo(
    () =>
      resolveValidSelectedCameraId({
        availableCameraIds,
        filteredCameraIds,
        selectedCameraId,
      }),
    [availableCameraIds, filteredCameraIds, selectedCameraId],
  )
  const syncedSelectedCameraId = isLoading ? selectedCameraId : validSelectedCameraId
  const isSelectedCameraRefreshEnabled = Boolean(
    syncedSelectedCameraId && refreshTokensByCameraId[syncedSelectedCameraId] !== undefined,
  )
  const selectedCamera = useMemo(
    () => filteredCameras.find((camera) => camera.id === validSelectedCameraId) ?? null,
    [filteredCameras, validSelectedCameraId],
  )
  const selectedRouteLabel = useMemo(
    () => routes.find((route) => route.id === filters.routeId)?.displayName ?? null,
    [filters.routeId, routes],
  )
  const activeBadges = useMemo(
    () => getActiveBadges(filters, selectedRouteLabel),
    [filters, selectedRouteLabel],
  )

  const handleClearSelection = useCallback(() => {
    setSelectedCamera(null, null)
    setIsModalOpen(false)
  }, [setSelectedCamera])

  useEffect(() => {
    const incoming = searchParams.toString()
    const parsedState = parseSearchParams(searchParams)

    if (hasHydratedUrlState.current && incoming === lastAppliedSearch.current) {
      return
    }

    skipNextUrlSync.current = true
    hydrateFromUrl(parsedState)
    lastAppliedSearch.current = incoming
    lastSyncedViewMode.current = parsedState.viewMode ?? 'gallery'
    hasHydratedUrlState.current = true
  }, [hydrateFromUrl, searchParams])

  useEffect(() => {
    if (!hasHydratedUrlState.current) {
      return
    }

    if (skipNextUrlSync.current) {
      skipNextUrlSync.current = false
      return
    }

    const next = buildSearchParams({
      filters,
      selectedCameraId: shouldPersistSelectedCamera({
        isModalOpen,
        selectedCameraId: syncedSelectedCameraId,
        viewMode,
      })
        ? syncedSelectedCameraId
        : null,
      viewMode,
    }).toString()

    if (next === lastAppliedSearch.current) {
      return
    }

    lastAppliedSearch.current = next
    const shouldReplaceHistoryEntry = lastSyncedViewMode.current === null || lastSyncedViewMode.current === viewMode
    lastSyncedViewMode.current = viewMode
    setSearchParams(next ? new URLSearchParams(next) : new URLSearchParams(), {
      replace: shouldReplaceHistoryEntry,
    })
  }, [filters, isModalOpen, setSearchParams, syncedSelectedCameraId, viewMode])

  useEffect(() => {
    if (!selectedCameraId) {
      setIsModalOpen(false)
      return
    }

    if (isLoading) {
      return
    }

    if (!validSelectedCameraId) {
      handleClearSelection()
    }
  }, [handleClearSelection, isLoading, selectedCameraId, validSelectedCameraId])

  useEffect(() => {
    if (!selectedCamera) {
      return
    }

    if (
      shouldOpenGalleryModalFromSelection({
        selectedCameraId: selectedCamera.id,
        selectionSource,
        viewMode,
      })
    ) {
      setIsModalOpen(true)
    }
  }, [selectedCamera, selectionSource, viewMode])

  useEffect(() => {
    if (viewMode === 'map') {
      setIsModalOpen(false)
    }
  }, [viewMode])

  useEffect(() => {
    if (!syncedSelectedCameraId) {
      return undefined
    }

    if (!isModalOpen && !isSelectedCameraRefreshEnabled) {
      return undefined
    }

    const refreshSelectedCamera = () => {
      setRefreshTokensByCameraId((currentTokens) => ({
        ...currentTokens,
        [syncedSelectedCameraId]: Date.now(),
      }))
    }

    if (isModalOpen) {
      refreshSelectedCamera()
    }

    const intervalId = window.setInterval(refreshSelectedCamera, IMAGE_REFRESH_INTERVAL_MS)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [isModalOpen, isSelectedCameraRefreshEnabled, syncedSelectedCameraId])

  useEffect(() => {
    if (viewMode !== 'map') {
      return undefined
    }

    const previousBodyOverflow = document.body.style.overflow
    const previousHtmlOverflow = document.documentElement.style.overflow

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousHtmlOverflow
    }
  }, [viewMode])

  useEffect(() => {
    if (viewMode !== 'gallery') {
      setGalleryScrollTop(0)
      setIsGalleryScrollingUp(false)
      previousGalleryScrollTopRef.current = 0
      return
    }

    const handleScroll = () => {
      const nextScrollTop = getScrollTop()
      const previousScrollTop = previousGalleryScrollTopRef.current

      setGalleryScrollTop(nextScrollTop)
      if (nextScrollTop < previousScrollTop) {
        setIsGalleryScrollingUp(true)
      } else if (nextScrollTop > previousScrollTop) {
        setIsGalleryScrollingUp(false)
      }

      previousGalleryScrollTopRef.current = nextScrollTop
    }

    const initialScrollTop = getScrollTop()
    setGalleryScrollTop(initialScrollTop)
    setIsGalleryScrollingUp(false)
    previousGalleryScrollTopRef.current = initialScrollTop

    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [viewMode])

  const handleFilterChange = useCallback(
    (key: keyof FilterState, value: string) => {
      setFilter(key, value)
    },
    [setFilter],
  )

  const handleViewModeChange = useCallback(
    (nextViewMode: ViewMode) => {
      if (shouldClearSelectionForViewModeChange(viewMode, nextViewMode)) {
        handleClearSelection()
      }

      setViewMode(nextViewMode)
    },
    [handleClearSelection, setViewMode, viewMode],
  )

  const handleCameraSelection = useCallback(
    (cameraId: string | null, source: SelectionSource) => {
      setSelectedCamera(cameraId, source)

      if (!cameraId) {
        setIsModalOpen(false)
      }
    },
    [setSelectedCamera],
  )

  const handleGallerySelection = useCallback(
    (cameraId: string, source: SelectionSource) => {
      handleCameraSelection(cameraId, source)
      setIsModalOpen(true)
    },
    [handleCameraSelection],
  )

  const handleCopyLink = useCallback(
    (cameraId?: string | null) => {
      const targetCameraId = cameraId ?? validSelectedCameraId
      const url = new URL(window.location.href)
      url.search = buildSearchParams({
        filters,
        selectedCameraId: shouldPersistSelectedCamera({
          isModalOpen: Boolean(cameraId) || isModalOpen,
          selectedCameraId: targetCameraId,
          viewMode,
        })
          ? targetCameraId
          : null,
        viewMode,
      }).toString()

      void navigator.clipboard?.writeText(url.toString()).catch(() => undefined)
    },
    [filters, isModalOpen, validSelectedCameraId, viewMode],
  )

  const handleOpenMap = useCallback(
    (cameraId: string) => {
      setSelectedCamera(cameraId, 'gallery')
      setIsModalOpen(false)
      setViewMode('map')
    },
    [setSelectedCamera, setViewMode],
  )

  const totalCount = cameras.length
  const filteredCount = filteredCameras.length
  const shouldHideHeaderChrome =
    viewMode === 'gallery' &&
    galleryScrollTop > 12 &&
    !isGalleryScrollingUp

  if (showSplash) {
    return <SplashScreen isReady={!isLoading && !error} />
  }

  return (
    <>
      {error ? (
        <div className="selected-filters" style={{ display: 'block' }}>
          Data load failed: {error}
        </div>
      ) : (
        viewMode === 'gallery' ? (
          <>
            <div
              className={clsx('header-chrome', {
                'is-hidden': shouldHideHeaderChrome,
                'is-scrolling-up': isGalleryScrollingUp,
              })}
            >
              <div
                id="selectedFilters"
                className="selected-filters"
                style={{ display: activeBadges.length ? 'flex' : 'none' }}
              >
                <div className="badges">
                  {activeBadges.map((badge) => (
                    <div key={badge.label} className="filter-item">
                      <i className={badge.icon}></i> {badge.label}
                    </div>
                  ))}
                </div>
                <div className="action-buttons">
                  <button className="reset-button" type="button" title="Reset Filters" onClick={resetFilters}>
                    <i className="fas fa-undo"></i>
                  </button>
                  <button className="reset-button" type="button" title="Copy Link" onClick={() => handleCopyLink()}>
                    <i className="fas fa-link"></i>
                  </button>
                </div>
              </div>

              <div className="header-controls fade-in">
                <FilterBar
                  filters={filters}
                  filteredCount={filteredCount}
                  imageSize={imageSize}
                  options={filterOptions}
                  totalCount={totalCount}
                  viewMode={viewMode}
                  onCopyLink={handleCopyLink}
                  onFilterChange={handleFilterChange}
                  onImageSizeChange={setImageSize}
                  onReset={resetFilters}
                  onViewModeChange={handleViewModeChange}
                />
              </div>
            </div>

            <GalleryView
              cameras={filteredCameras}
              imageSize={imageSize}
              refreshTokensByCameraId={refreshTokensByCameraId}
              selectedCameraId={validSelectedCameraId}
              onSelectCamera={handleGallerySelection}
            />
          </>
        ) : (
          <div className={styles.mapExperience}>
            <Suspense
              fallback={
                <div className={styles.mapFallback}>
                  <h3>Loading full map</h3>
                  <p>The map shell is ready. The camera layers are still starting up.</p>
                </div>
              }
            >
              <LazyMapView
                cameras={filteredCameras}
                refreshTokensByCameraId={refreshTokensByCameraId}
                selectedCamera={selectedCamera}
                selectionSource={selectionSource}
                isFullscreen
                overlay={
                  <div ref={mapOverlayRef} className={styles.mapOverlay}>
                    <div className={clsx('header-chrome', styles.mapHeaderChrome)}>
                      <div className="header-controls fade-in">
                        <FilterBar
                          filters={filters}
                          filteredCount={filteredCount}
                          imageSize={imageSize}
                          options={filterOptions}
                          showImageSizeControl={false}
                          totalCount={totalCount}
                          viewMode={viewMode}
                          onCopyLink={handleCopyLink}
                          onFilterChange={handleFilterChange}
                          onImageSizeChange={setImageSize}
                          onReset={resetFilters}
                          onViewModeChange={handleViewModeChange}
                        />
                      </div>
                    </div>
                  </div>
                }
                overlayHeight={mapOverlaySize.height}
                onSelectCamera={handleCameraSelection}
              />
            </Suspense>
          </div>
        )
      )}

      {isModalOpen && selectedCamera && (
        <CameraModal
          activeCamera={selectedCamera}
          cameraDetailsById={cameraDetailsById}
          cameras={cameras}
          refreshTokensByCameraId={refreshTokensByCameraId}
          onClose={handleClearSelection}
          onCopyLink={handleCopyLink}
          onOpenMap={handleOpenMap}
          onSelectCamera={handleCameraSelection}
          orderedCameraIds={filteredCameras.map((camera) => camera.id)}
        />
      )}
    </>
  )
}