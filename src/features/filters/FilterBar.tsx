import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, MouseEvent } from 'react'
import type { FilterState, FilterOptions, ViewMode } from '../../shared/types'

type DropdownId = 'status' | 'filters' | 'routes' | 'search' | null
type AutoClosingSelectKey = 'region' | 'county' | 'city' | 'maintenance' | 'routeId'

interface FilterBarProps {
  filters: FilterState
  options: FilterOptions
  filteredCount: number
  totalCount: number
  viewMode: ViewMode
  imageSize: number
  showImageSizeControl?: boolean
  showViewToggleButton?: boolean
  onFilterChange: (key: keyof FilterState, value: string) => void
  onCopyLink: () => void
  onImageSizeChange: (value: number) => void
  onReset: () => void
  onViewModeChange: (viewMode: ViewMode) => void
}

export function FilterBar({
  filters,
  options,
  filteredCount,
  totalCount,
  viewMode,
  imageSize,
  showImageSizeControl = true,
  showViewToggleButton = true,
  onFilterChange,
  onCopyLink,
  onImageSizeChange,
  onReset,
  onViewModeChange,
}: FilterBarProps) {
  const [isSizeControlOpen, setIsSizeControlOpen] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<DropdownId>(null)
  const filterBarRef = useRef<HTMLDivElement | null>(null)
  const sizeControlContainerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isSizeControlOpen && !openDropdown) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target

      if (!(target instanceof Node)) {
        return
      }

      if (!filterBarRef.current?.contains(target)) {
        setOpenDropdown(null)
        setIsSizeControlOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenDropdown(null)
        setIsSizeControlOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isSizeControlOpen, openDropdown])

  const toggleDropdown = (dropdownId: Exclude<DropdownId, null>) => (event: MouseEvent<HTMLElement>) => {
    event.preventDefault()
    setIsSizeControlOpen(false)
    setOpenDropdown((currentDropdown) => (currentDropdown === dropdownId ? null : dropdownId))
  }

  const closeOpenDropdown = () => {
    setOpenDropdown(null)
  }

  const handleStatusAction = (action: () => void) => () => {
    action()
    closeOpenDropdown()
  }

  const handleSelectChange = (key: AutoClosingSelectKey) => (event: ChangeEvent<HTMLSelectElement>) => {
    onFilterChange(key, event.target.value)
    closeOpenDropdown()
  }

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    onFilterChange('searchQuery', event.target.value)
  }

  const handleSizeControlToggle = () => {
    closeOpenDropdown()
    setIsSizeControlOpen((isOpen) => !isOpen)
  }

  const selectedRouteLabel =
    options.routes.find((route) => route.id === filters.routeId)?.displayName ?? 'All routes'
  const showActionControls = showViewToggleButton || showImageSizeControl
  const viewToggleLabel = viewMode === 'map' ? 'Go Back to Gallery' : 'Open Full Map'
  const viewToggleText = viewMode === 'map' ? 'Go Back to Gallery' : 'Full Map'

  return (
    <div ref={filterBarRef} className="app-filterbar">
      <div className="app-filterbar__cluster app-filterbar__cluster--status">
        <details open={openDropdown === 'status'} className="dropdown app-dropdown">
          <summary
            id="cameraCount"
            className="app-filterbar__control dropdown-toggle button"
            aria-expanded={openDropdown === 'status'}
            aria-label="Menu"
            onClick={toggleDropdown('status')}
          >
            {filteredCount} Cameras
          </summary>
          <div className="dropdown-menu app-menu">
            <div className="app-menu-panel">
              <p className="app-inline-note">Showing {filteredCount} of {totalCount} cameras.</p>
              <button className="dropdown-item" type="button" onClick={handleStatusAction(onCopyLink)}>
                <i className="fas fa-link"></i> Copy View Link
              </button>
              <button
                className="dropdown-item"
                type="button"
                onClick={handleStatusAction(() => onViewModeChange(viewMode === 'map' ? 'gallery' : 'map'))}
              >
                <i className={`fas ${viewMode === 'map' ? 'fa-images' : 'fa-map-marked-alt'}`}></i>{' '}
                {viewToggleLabel}
              </button>
              <button className="dropdown-item" type="button" onClick={handleStatusAction(onReset)}>
                <i className="fas fa-undo"></i> Reset Filters
              </button>
            </div>
          </div>
        </details>
      </div>

      <div className="app-filterbar__cluster app-filterbar__cluster--filters">
        <details open={openDropdown === 'filters'} className="dropdown app-dropdown">
          <summary
            className="app-filterbar__control app-filterbar__control--icon dropdown-toggle button"
            aria-expanded={openDropdown === 'filters'}
            aria-label="Filters"
            onClick={toggleDropdown('filters')}
          >
            <i className="fas fa-filter"></i>
          </summary>
          <div className="dropdown-menu app-menu">
            <div className="app-menu-panel">
              <label className="app-field">
                <span className="app-field-label">Region</span>
                <select value={filters.region} onChange={handleSelectChange('region')}>
                  <option value="">All regions</option>
                  {options.regions.map((region) => (
                    <option key={region} value={region}>
                      Region {region}
                    </option>
                  ))}
                </select>
              </label>

              <label className="app-field">
                <span className="app-field-label">County</span>
                <select value={filters.county} onChange={handleSelectChange('county')}>
                  <option value="">All counties</option>
                  {options.counties.map((county) => (
                    <option key={county} value={county}>
                      {county}
                    </option>
                  ))}
                </select>
              </label>

              <label className="app-field">
                <span className="app-field-label">City</span>
                <select value={filters.city} onChange={handleSelectChange('city')}>
                  <option value="">All cities</option>
                  {options.cities.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </label>

              <label className="app-field">
                <span className="app-field-label">Maintenance Station</span>
                <select
                  value={filters.maintenance}
                  onChange={handleSelectChange('maintenance')}
                >
                  <option value="">All stations</option>
                  {options.maintenanceStations.map((station) => (
                    <option key={station} value={station}>
                      {station}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </details>

        <details open={openDropdown === 'routes'} className="dropdown app-dropdown">
          <summary
            className="app-filterbar__control app-filterbar__control--icon dropdown-toggle button"
            aria-expanded={openDropdown === 'routes'}
            aria-label="Routes"
            onClick={toggleDropdown('routes')}
          >
            <i className="fas fa-road"></i>
          </summary>
          <div className="dropdown-menu app-menu">
            <div className="app-menu-panel">
              <p className="app-inline-note">{selectedRouteLabel}</p>
              <label className="app-field">
                <span className="app-field-label">Curated Route</span>
                <select value={filters.routeId} onChange={handleSelectChange('routeId')}>
                  <option value="">All routes</option>
                  {options.routes.map((route) => (
                    <option key={route.id} value={route.id}>
                      {route.displayName}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </details>

        <details open={openDropdown === 'search'} className="dropdown app-dropdown">
          <summary
            className="app-filterbar__control app-filterbar__control--icon dropdown-toggle button"
            aria-expanded={openDropdown === 'search'}
            aria-label="Search"
            onClick={toggleDropdown('search')}
          >
            <i className="fas fa-search"></i>
          </summary>
          <div className="dropdown-menu app-menu app-search-input">
            <div className="app-menu-panel">
              <input
                id="searchInput"
                placeholder="Camera Name"
                type="search"
                value={filters.searchQuery}
                onChange={handleSearchChange}
              />
            </div>
          </div>
        </details>
      </div>

      {showActionControls ? (
        <div className="app-filterbar__cluster app-filterbar__cluster--actions">
          {showViewToggleButton ? (
            <button
              className="app-filterbar__control app-filterbar__control--view button"
              type="button"
              title={viewToggleLabel}
              aria-label={viewToggleLabel}
              onClick={() => onViewModeChange(viewMode === 'map' ? 'gallery' : 'map')}
            >
              <i className={`fas ${viewMode === 'map' ? 'fa-images' : 'fa-map-marked-alt'}`}></i>
              <span>{viewToggleText}</span>
            </button>
          ) : null}

          {showImageSizeControl ? (
            <div
              id="sizeControlContainer"
              ref={sizeControlContainerRef}
              className={isSizeControlOpen ? 'is-open' : undefined}
            >
              <button
                id="sizeControlButton"
                className="app-filterbar__control app-filterbar__control--icon button"
                type="button"
                aria-label="Gallery image size"
                aria-expanded={isSizeControlOpen}
                onClick={handleSizeControlToggle}
              >
                <i className="fas fa-compress"></i> <i className="fas fa-expand"></i>
              </button>
              <div className="slider-dropdown">
                <input
                  id="sizeSlider"
                  className="vertical-slider"
                  type="range"
                  min="80"
                  max="380"
                  value={imageSize}
                  step="2"
                  onChange={(event) => onImageSizeChange(Number(event.target.value))}
                />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}