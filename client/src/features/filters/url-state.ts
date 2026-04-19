import type { FilterState, UrlState } from '../../shared/types'

export function parseSearchParams(searchParams: URLSearchParams): UrlState {
  const filters: Partial<FilterState> = {}

  if (searchParams.has('search')) {
    filters.searchQuery = searchParams.get('search') ?? ''
  }

  if (searchParams.has('region')) {
    filters.region = searchParams.get('region') ?? ''
  }

  if (searchParams.has('county')) {
    filters.county = searchParams.get('county') ?? ''
  }

  if (searchParams.has('city')) {
    filters.city = searchParams.get('city') ?? ''
  }

  if (searchParams.has('maintenance')) {
    filters.maintenance = searchParams.get('maintenance') ?? ''
  }

  if (searchParams.has('route')) {
    filters.routeId = searchParams.get('route') ?? ''
  }

  if (searchParams.has('issue')) {
    filters.issueFilter = searchParams.get('issue') ?? ''
  }

  return {
    viewMode: searchParams.get('view') === 'map' ? 'map' : 'gallery',
    selectedCameraId: searchParams.get('camera'),
    filters,
  }
}

export function buildSearchParams({
  filters,
  selectedCameraId,
  viewMode,
}: {
  filters: FilterState
  selectedCameraId: string | null
  viewMode: 'gallery' | 'map'
}) {
  const searchParams = new URLSearchParams()

  if (viewMode === 'map') {
    searchParams.set('view', 'map')
  }

  if (filters.searchQuery) {
    searchParams.set('search', filters.searchQuery)
  }

  if (filters.region) {
    searchParams.set('region', filters.region)
  }

  if (filters.county) {
    searchParams.set('county', filters.county)
  }

  if (filters.city) {
    searchParams.set('city', filters.city)
  }

  if (filters.maintenance) {
    searchParams.set('maintenance', filters.maintenance)
  }

  if (filters.routeId) {
    searchParams.set('route', filters.routeId)
  }

  if (filters.issueFilter) {
    searchParams.set('issue', filters.issueFilter)
  }

  if (selectedCameraId) {
    searchParams.set('camera', selectedCameraId)
  }

  return searchParams
}