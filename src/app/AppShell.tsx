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
import { ArcGisLayerPanel } from '../features/map/ArcGisLayerPanel'
import { AnalyticsPanel } from '../features/map/AnalyticsPanel'
import {
  DEFAULT_ARCGIS_RESULT_RECORD_COUNT,
  SAMPLE_ARCGIS_LAYER_URL,
  createArcGisLayerId,
  fetchArcGisLayerMetadata,
  getDefaultArcGisLayerMinZoom,
  normalizeArcGisLayerUrl,
  type ArcGisLayerConfig,
} from '../features/map/arcgis-rest'
import { analyzeCameras } from '../features/map/camera-analytics'
import { useAppData } from '../shared/data/useAppData'
import { useElementSize } from '../shared/hooks/useElementSize'
import { IMAGE_REFRESH_INTERVAL_MS } from '../shared/lib/cameras'
import type { FilterState, SelectionSource, ViewMode } from '../shared/types'
import type { PopupSizeMode } from '../features/map/popup-layout'
import {
  DEFAULT_MAP_DIMENSION_MODE,
  getMapDimensionToggleCopy,
  getNextMapDimensionMode,
  type MapDimensionMode,
} from '../features/map/mapStyle'
import styles from './AppShell.module.css'
import { SplashScreen } from './SplashScreen'

const LazyMapView = lazy(async () => {
  const module = await import('../features/map/MapView')

  return {
    default: module.MapView,
  }
})

const DEFAULT_ARCGIS_LAYERS: ArcGisLayerConfig[] = [
  {
    id: createArcGisLayerId(SAMPLE_ARCGIS_LAYER_URL),
    title: 'UDOT Mile Point Measures',
    url: SAMPLE_ARCGIS_LAYER_URL,
    enabled: false,
    geometryType: 'esriGeometryPoint',
    minZoom: getDefaultArcGisLayerMinZoom('esriGeometryPoint'),
    maxRecordCount: DEFAULT_ARCGIS_RESULT_RECORD_COUNT,
    labelField: 'Measure',
    labelsEnabled: true,
    isRemovable: false,
  },
]

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
  const [mapDimensionMode, setMapDimensionMode] = useState<MapDimensionMode>(DEFAULT_MAP_DIMENSION_MODE)
  const [mapPopupSizeMode, setMapPopupSizeMode] = useState<PopupSizeMode>('default')
  const [areMapAutoPopupsEnabled, setAreMapAutoPopupsEnabled] = useState(true)
  const [arcGisLayers, setArcGisLayers] = useState<ArcGisLayerConfig[]>(DEFAULT_ARCGIS_LAYERS)
  const [arcGisLayerUrl, setArcGisLayerUrl] = useState('')
  const [arcGisLayerError, setArcGisLayerError] = useState<string | null>(null)
  const [isAddingArcGisLayer, setIsAddingArcGisLayer] = useState(false)
  const [isArcGisMenuOpen, setIsArcGisMenuOpen] = useState(false)
  const [isAnalyticsMenuOpen, setIsAnalyticsMenuOpen] = useState(false)
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
  const arcGisMenuRef = useRef<HTMLDivElement | null>(null)
  const analyticsMenuRef = useRef<HTMLDivElement | null>(null)
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
  const cameraAnalytics = useMemo(() => analyzeCameras(filteredCameras), [filteredCameras])
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
  const mapDimensionToggleCopy = useMemo(
    () => getMapDimensionToggleCopy(mapDimensionMode),
    [mapDimensionMode],
  )
  const activeArcGisLayerCount = useMemo(
    () => arcGisLayers.filter((layer) => layer.enabled).length,
    [arcGisLayers],
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
      return
    }

    setIsArcGisMenuOpen(false)
    setIsAnalyticsMenuOpen(false)
  }, [viewMode])

  useEffect(() => {
    if (!isArcGisMenuOpen) {
      return undefined
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (arcGisMenuRef.current?.contains(event.target as Node)) {
        return
      }

      setIsArcGisMenuOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsArcGisMenuOpen(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isArcGisMenuOpen])

  useEffect(() => {
    if (!isAnalyticsMenuOpen) {
      return undefined
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (analyticsMenuRef.current?.contains(event.target as Node)) {
        return
      }

      setIsAnalyticsMenuOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsAnalyticsMenuOpen(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isAnalyticsMenuOpen])

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

  const handleToggleMapPopupSize = useCallback(() => {
    setMapPopupSizeMode((currentMode) => (currentMode === 'default' ? 'large' : 'default'))
  }, [])

  const handleToggleMapAutoPopups = useCallback(() => {
    setAreMapAutoPopupsEnabled((currentValue) => !currentValue)
  }, [])

  const handleToggleMapDimensionMode = useCallback(() => {
    setMapDimensionMode((currentMode) => getNextMapDimensionMode(currentMode))
  }, [])

  const handleToggleAnalyticsMenu = useCallback(() => {
    setIsAnalyticsMenuOpen((currentValue) => {
      const nextValue = !currentValue

      if (nextValue) {
        setIsArcGisMenuOpen(false)
      }

      return nextValue
    })
  }, [])

  const handleToggleArcGisMenu = useCallback(() => {
    setIsArcGisMenuOpen((currentValue) => {
      const nextValue = !currentValue

      if (nextValue) {
        setIsAnalyticsMenuOpen(false)
      }

      return nextValue
    })
  }, [])

  const handleArcGisLayerInputChange = useCallback(
    (value: string) => {
      setArcGisLayerUrl(value)

      if (arcGisLayerError) {
        setArcGisLayerError(null)
      }
    },
    [arcGisLayerError],
  )

  const handleToggleArcGisLayer = useCallback((layerId: string, enabled: boolean) => {
    setArcGisLayers((currentLayers) =>
      currentLayers.map((layer) => (layer.id === layerId ? { ...layer, enabled } : layer)),
    )
  }, [])

  const handleArcGisLayerMinZoomChange = useCallback((layerId: string, minZoom: number) => {
    const clampedMinZoom = Math.min(Math.max(minZoom, 0), 22)

    setArcGisLayers((currentLayers) =>
      currentLayers.map((layer) => (layer.id === layerId ? { ...layer, minZoom: clampedMinZoom } : layer)),
    )
  }, [])

  const handleRemoveArcGisLayer = useCallback((layerId: string) => {
    setArcGisLayers((currentLayers) => currentLayers.filter((layer) => layer.id !== layerId))
  }, [])

  const handleAddArcGisLayer = useCallback(async () => {
    const normalizedUrl = normalizeArcGisLayerUrl(arcGisLayerUrl)

    if (!normalizedUrl) {
      setArcGisLayerError('Enter a public ArcGIS layer URL ending in /MapServer/{id} or /FeatureServer/{id}.')
      return
    }

    const layerId = createArcGisLayerId(normalizedUrl)

    if (arcGisLayers.some((layer) => layer.id === layerId)) {
      setArcGisLayerUrl('')
      setArcGisLayerError(null)
      return
    }

    setIsAddingArcGisLayer(true)
    setArcGisLayerError(null)

    try {
      const metadata = await fetchArcGisLayerMetadata(normalizedUrl)

      setArcGisLayers((currentLayers) => [
        ...currentLayers,
        {
          id: layerId,
          title: metadata.title,
          url: normalizedUrl,
          enabled: false,
          geometryType: metadata.geometryType,
          minZoom: metadata.minZoom,
          maxRecordCount: metadata.maxRecordCount,
          labelsEnabled: false,
          isRemovable: true,
        },
      ])
      setArcGisLayerUrl('')
    } catch (error) {
      setArcGisLayerError(
        error instanceof Error ? error.message : 'Unable to load ArcGIS metadata for that layer.',
      )
    } finally {
      setIsAddingArcGisLayer(false)
    }
  }, [arcGisLayerUrl, arcGisLayers])

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
                arcGisLayers={arcGisLayers}
                cameras={filteredCameras}
                refreshTokensByCameraId={refreshTokensByCameraId}
                selectedCamera={selectedCamera}
                selectionSource={selectionSource}
                isFullscreen
                overlay={
                  <div ref={mapOverlayRef} className={styles.mapOverlay}>
                    <div className={clsx('header-chrome', styles.mapHeaderChrome)}>
                      <div className="header-controls fade-in">
                        <div className={styles.mapHeaderControls}>
                          <FilterBar
                            filters={filters}
                            filteredCount={filteredCount}
                            imageSize={imageSize}
                            options={filterOptions}
                            showImageSizeControl={false}
                            totalCount={totalCount}
                            useViewportDropdowns
                            viewMode={viewMode}
                            onCopyLink={handleCopyLink}
                            onFilterChange={handleFilterChange}
                            onImageSizeChange={setImageSize}
                            onReset={resetFilters}
                            onViewModeChange={handleViewModeChange}
                          />
                          <button
                            className={styles.mapPopupSizeButton}
                            data-active={mapDimensionMode === '3d'}
                            type="button"
                            aria-pressed={mapDimensionMode === '3d'}
                            title={mapDimensionToggleCopy.buttonTitle}
                            onClick={handleToggleMapDimensionMode}
                          >
                            <i className={`fas ${mapDimensionMode === '3d' ? 'fa-map' : 'fa-cube'}`}></i>
                            <span>{mapDimensionToggleCopy.buttonLabel}</span>
                          </button>
                          <button
                            className={styles.mapPopupSizeButton}
                            data-active={mapPopupSizeMode === 'large'}
                            type="button"
                            aria-pressed={mapPopupSizeMode === 'large'}
                            title={
                              mapPopupSizeMode === 'large'
                                ? 'Switch to default map popup size'
                                : 'Switch to larger map popups'
                            }
                            onClick={handleToggleMapPopupSize}
                          >
                            <i className={`fas ${mapPopupSizeMode === 'large' ? 'fa-compress' : 'fa-expand'}`}></i>
                            <span>{mapPopupSizeMode === 'large' ? 'Default Popups' : 'Large Popups'}</span>
                          </button>
                          <button
                            className={styles.mapPopupSizeButton}
                            data-active={!areMapAutoPopupsEnabled}
                            type="button"
                            aria-pressed={!areMapAutoPopupsEnabled}
                            title={
                              areMapAutoPopupsEnabled
                                ? 'Pause automatic map popups'
                                : 'Resume automatic map popups'
                            }
                            onClick={handleToggleMapAutoPopups}
                          >
                            <i className={`fas ${areMapAutoPopupsEnabled ? 'fa-eye' : 'fa-eye-slash'}`}></i>
                            <span>{areMapAutoPopupsEnabled ? 'Auto Popups' : 'Popups Paused'}</span>
                          </button>
                          <div
                            ref={analyticsMenuRef}
                            className={styles.mapAnalyticsMenu}
                            data-open={isAnalyticsMenuOpen}
                          >
                            <button
                              className={styles.mapPopupSizeButton}
                              data-active={isAnalyticsMenuOpen}
                              type="button"
                              aria-expanded={isAnalyticsMenuOpen}
                              title="Open camera analytics"
                              onClick={handleToggleAnalyticsMenu}
                            >
                              <i className="fas fa-chart-column"></i>
                              <span>Analytics</span>
                            </button>

                            {isAnalyticsMenuOpen ? (
                              <div className={styles.mapAnalyticsMenuPanel}>
                                <AnalyticsPanel analysis={cameraAnalytics} onClose={() => setIsAnalyticsMenuOpen(false)} />
                              </div>
                            ) : null}
                          </div>
                          <div
                            ref={arcGisMenuRef}
                            className={styles.mapArcGisMenu}
                            data-open={isArcGisMenuOpen}
                          >
                            <button
                              className={styles.mapPopupSizeButton}
                              data-active={isArcGisMenuOpen || activeArcGisLayerCount > 0}
                              type="button"
                              aria-expanded={isArcGisMenuOpen}
                              title="Open external ArcGIS layer controls"
                              onClick={handleToggleArcGisMenu}
                            >
                              <i className="fas fa-layer-group"></i>
                              <span>{activeArcGisLayerCount ? `Layers (${activeArcGisLayerCount})` : 'Layers'}</span>
                            </button>

                            {isArcGisMenuOpen ? (
                              <div className={styles.mapArcGisMenuPanel}>
                                <ArcGisLayerPanel
                                  activeLayerCount={activeArcGisLayerCount}
                                  inputError={arcGisLayerError}
                                  inputValue={arcGisLayerUrl}
                                  isAdding={isAddingArcGisLayer}
                                  layers={arcGisLayers}
                                  onAddLayer={handleAddArcGisLayer}
                                  onClose={() => setIsArcGisMenuOpen(false)}
                                  onInputChange={handleArcGisLayerInputChange}
                                  onMinZoomChange={handleArcGisLayerMinZoomChange}
                                  onRemoveLayer={handleRemoveArcGisLayer}
                                  onToggleLayer={handleToggleArcGisLayer}
                                />
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                }
                autoPopupsEnabled={areMapAutoPopupsEnabled}
                mapDimensionMode={mapDimensionMode}
                overlayHeight={mapOverlaySize.height}
                popupSizeMode={mapPopupSizeMode}
                onToggleMapDimensionMode={handleToggleMapDimensionMode}
                onToggleAutoPopups={handleToggleMapAutoPopups}
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