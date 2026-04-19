import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { useSearchParams } from 'react-router-dom'
import { FilterBar } from '../features/filters/FilterBar'
import { ISSUE_FILTER_LABELS } from '../features/filters/issueFilters'
import { createRouteSelectors, deriveFilterOptions, filterCameras } from '../features/filters/selectors'
import { CameraModal } from '../features/modal/CameraModal'
import { useAppStore } from '../features/filters/store'
import { buildSearchParams, parseSearchParams } from '../features/filters/url-state'
import { GalleryView } from '../features/gallery/GalleryView'
import { useAppData } from '../shared/data/useAppData'
import type { FilterState, SelectionSource, ViewMode } from '../shared/types'
import { SplashScreen } from './SplashScreen'

const LazyMapView = lazy(async () => {
  const module = await import('../features/map/MapView')

  return {
    default: module.MapView,
  }
})

function getActiveBadges(filters: FilterState, routeLabel: string | null) {
  const issueLabel = filters.issueFilter
    ? ISSUE_FILTER_LABELS[filters.issueFilter as keyof typeof ISSUE_FILTER_LABELS] ?? filters.issueFilter
    : null

  return [
    filters.region ? { icon: 'fas fa-map', label: `Region: ${filters.region}` } : null,
    filters.county ? { icon: 'fas fa-building', label: `County: ${filters.county}` } : null,
    filters.city ? { icon: 'fas fa-city', label: `City: ${filters.city}` } : null,
    filters.maintenance
      ? { icon: 'fas fa-tools', label: `Maintenance: ${filters.maintenance}` }
      : null,
    routeLabel ? { icon: 'fas fa-road', label: `Route: ${routeLabel}` } : null,
    issueLabel ? { icon: 'fas fa-exclamation-triangle', label: `Image Issue: ${issueLabel}` } : null,
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
  const [refreshNonce, setRefreshNonce] = useState(0)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [galleryScrollTop, setGalleryScrollTop] = useState(0)
  const [isGalleryScrollingUp, setIsGalleryScrollingUp] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const lastAppliedSearch = useRef('')
  const hasHydratedUrlState = useRef(false)
  const skipNextUrlSync = useRef(false)
  const previousGalleryScrollTopRef = useRef(0)

  const routeLookup = useMemo(() => createRouteSelectors(routes), [routes])
  const filteredCameras = useMemo(
    () => filterCameras(cameras, routeLookup, filters),
    [cameras, filters, routeLookup],
  )
  const filterOptions = useMemo(
    () => deriveFilterOptions(cameras, routes, routeLookup, filters),
    [cameras, filters, routeLookup, routes],
  )
  const selectedCamera = useMemo(
    () =>
      filteredCameras.find((camera) => camera.id === selectedCameraId) ??
      cameras.find((camera) => camera.id === selectedCameraId) ??
      null,
    [cameras, filteredCameras, selectedCameraId],
  )
  const selectedRouteLabel = useMemo(
    () => routes.find((route) => route.id === filters.routeId)?.displayName ?? null,
    [filters.routeId, routes],
  )
  const activeBadges = useMemo(
    () => getActiveBadges(filters, selectedRouteLabel),
    [filters, selectedRouteLabel],
  )

  useEffect(() => {
    const incoming = searchParams.toString()

    if (hasHydratedUrlState.current && incoming === lastAppliedSearch.current) {
      return
    }

    skipNextUrlSync.current = true
    hydrateFromUrl(parseSearchParams(searchParams))
    lastAppliedSearch.current = incoming
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
      selectedCameraId,
      viewMode,
    }).toString()

    if (next === lastAppliedSearch.current) {
      return
    }

    lastAppliedSearch.current = next
    setSearchParams(next ? new URLSearchParams(next) : new URLSearchParams(), {
      replace: true,
    })
  }, [filters, selectedCameraId, setSearchParams, viewMode])

  useEffect(() => {
    if (!selectedCameraId) {
      setIsModalOpen(false)
      return
    }

    if (isLoading) {
      return
    }

    if (!cameras.some((camera) => camera.id === selectedCameraId)) {
      setSelectedCamera(null, null)
      setIsModalOpen(false)
    }
  }, [cameras, isLoading, selectedCameraId, setSelectedCamera])

  useEffect(() => {
    if (viewMode === 'map') {
      setIsModalOpen(false)
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
      setViewMode(nextViewMode)
    },
    [setViewMode],
  )

  const handleCameraSelection = useCallback(
    (cameraId: string | null, source: SelectionSource) => {
      setSelectedCamera(cameraId, source)
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
      const url = new URL(window.location.href)
      url.search = buildSearchParams({
        filters,
        selectedCameraId: cameraId ?? selectedCameraId,
        viewMode,
      }).toString()

      void navigator.clipboard?.writeText(url.toString()).catch(() => undefined)
    },
    [filters, selectedCameraId, viewMode],
  )

  const handleRefresh = useCallback(() => {
    setRefreshNonce(Date.now())
  }, [])

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
            onRefresh={handleRefresh}
            onReset={resetFilters}
            onViewModeChange={handleViewModeChange}
          />
        </div>
      </div>

      {error ? (
        <div className="selected-filters" style={{ display: 'block' }}>
          Data load failed: {error}
        </div>
      ) : viewMode === 'gallery' ? (
        <GalleryView
          cameras={filteredCameras}
          imageSize={imageSize}
          refreshNonce={refreshNonce}
          selectedCameraId={selectedCameraId}
          onSelectCamera={handleGallerySelection}
        />
      ) : (
        <Suspense
          fallback={
            <div className="app-empty-state">
              <h3>Loading map view</h3>
              <p>The gallery shell is ready. The map engine is still starting up.</p>
            </div>
          }
        >
          <LazyMapView
            cameras={filteredCameras}
            selectedCamera={selectedCamera}
            selectionSource={selectionSource}
            onOpenGallery={() => handleViewModeChange('gallery')}
            onSelectCamera={handleCameraSelection}
          />
        </Suspense>
      )}

      {isModalOpen && selectedCamera && (
        <CameraModal
          activeCamera={selectedCamera}
          cameraDetailsById={cameraDetailsById}
          cameras={cameras}
          onClose={() => setIsModalOpen(false)}
          onCopyLink={handleCopyLink}
          onOpenMap={handleOpenMap}
          onSelectCamera={handleCameraSelection}
          orderedCameraIds={filteredCameras.map((camera) => camera.id)}
        />
      )}
    </>
  )
}