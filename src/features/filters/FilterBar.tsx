import type { FilterState, FilterOptions, ViewMode } from '../../shared/types'

interface FilterBarProps {
  filters: FilterState
  options: FilterOptions
  filteredCount: number
  totalCount: number
  viewMode: ViewMode
  imageSize: number
  onFilterChange: (key: keyof FilterState, value: string) => void
  onCopyLink: () => void
  onImageSizeChange: (value: number) => void
  onRefresh: () => void
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
  onFilterChange,
  onCopyLink,
  onImageSizeChange,
  onRefresh,
  onReset,
  onViewModeChange,
}: FilterBarProps) {
  const selectedRouteLabel =
    options.routes.find((route) => route.id === filters.routeId)?.displayName ?? 'All routes'

  return (
    <div className="app-filterbar">
      <div className="app-filterbar__cluster app-filterbar__cluster--status">
        <details className="dropdown app-dropdown">
          <summary id="cameraCount" className="dropdown-toggle button" aria-label="Menu">
            {filteredCount} Cameras
          </summary>
          <div className="dropdown-menu app-menu">
            <div className="app-menu-panel">
              <p className="app-inline-note">Showing {filteredCount} of {totalCount} cameras.</p>
              <button className="dropdown-item" type="button" onClick={onCopyLink}>
                <i className="fas fa-link"></i> Copy View Link
              </button>
              <button
                className="dropdown-item"
                type="button"
                onClick={() => onViewModeChange(viewMode === 'map' ? 'gallery' : 'map')}
              >
                <i className={`fas ${viewMode === 'map' ? 'fa-images' : 'fa-map-marked-alt'}`}></i>{' '}
                {viewMode === 'map' ? 'Return to Gallery' : 'Open Full Map'}
              </button>
              <button className="dropdown-item" type="button" onClick={onReset}>
                <i className="fas fa-undo"></i> Reset Filters
              </button>
            </div>
          </div>
        </details>
      </div>

      <div className="app-filterbar__cluster app-filterbar__cluster--filters">
        <details className="dropdown app-dropdown">
          <summary className="dropdown-toggle button" aria-label="Filters">
            <i className="fas fa-filter"></i>
          </summary>
          <div className="dropdown-menu app-menu">
            <div className="app-menu-panel">
              <label className="app-field">
                <span className="app-field-label">Region</span>
                <select value={filters.region} onChange={(event) => onFilterChange('region', event.target.value)}>
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
                <select value={filters.county} onChange={(event) => onFilterChange('county', event.target.value)}>
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
                <select value={filters.city} onChange={(event) => onFilterChange('city', event.target.value)}>
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
                  onChange={(event) => onFilterChange('maintenance', event.target.value)}
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

        <details className="dropdown app-dropdown">
          <summary className="dropdown-toggle button" aria-label="Routes">
            <i className="fas fa-road"></i>
          </summary>
          <div className="dropdown-menu app-menu">
            <div className="app-menu-panel">
              <p className="app-inline-note">{selectedRouteLabel}</p>
              <label className="app-field">
                <span className="app-field-label">Curated Route</span>
                <select value={filters.routeId} onChange={(event) => onFilterChange('routeId', event.target.value)}>
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

        <details className="dropdown app-dropdown">
          <summary className="dropdown-toggle button" aria-label="Search">
            <i className="fas fa-search"></i>
          </summary>
          <div className="dropdown-menu app-menu app-search-input">
            <div className="app-menu-panel">
              <input
                id="searchInput"
                placeholder="Camera Name"
                type="search"
                value={filters.searchQuery}
                onChange={(event) => onFilterChange('searchQuery', event.target.value)}
              />
            </div>
          </div>
        </details>
      </div>

      <div className="app-filterbar__cluster app-filterbar__cluster--actions">
        <button className="button" type="button" title="Refresh Images" onClick={onRefresh}>
          <i className="fas fa-sync"></i>
        </button>

        <details id="sizeControlContainer">
          <summary id="sizeControlButton" aria-label="Gallery image size">
            <i className="fas fa-compress"></i> <i className="fas fa-expand"></i>
          </summary>
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
        </details>
      </div>
    </div>
  )
}