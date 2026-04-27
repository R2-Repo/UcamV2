import type { CameraSummary, CuratedRoute, FilterOptions, FilterState } from '../../shared/types'
import { createCustomRoute } from './customRoute'
import { cameraMatchesRoute, createRouteLookup, getRouteSortValue } from '../../shared/lib/routes'

function uniqueSorted(values: Array<string | null>) {
  return [...new Set(values.filter(Boolean) as string[])].sort((left, right) => left.localeCompare(right))
}

function compareByDefault(left: CameraSummary, right: CameraSummary) {
  return left.sortOrder - right.sortOrder || left.location.localeCompare(right.location)
}

function compareByRoute(left: CameraSummary, right: CameraSummary, route: CuratedRoute) {
  const leftValue = getRouteSortValue(left, route)
  const rightValue = getRouteSortValue(right, route)

  if (!leftValue || !rightValue) {
    return compareByDefault(left, right)
  }

  if (leftValue.segmentIndex !== rightValue.segmentIndex) {
    return leftValue.segmentIndex - rightValue.segmentIndex
  }

  const leftMilepost = leftValue.milepost ?? Number.POSITIVE_INFINITY
  const rightMilepost = rightValue.milepost ?? Number.POSITIVE_INFINITY

  if (leftMilepost !== rightMilepost) {
    return leftValue.sortOrder === 'desc'
      ? rightMilepost - leftMilepost
      : leftMilepost - rightMilepost
  }

  return left.location.localeCompare(right.location)
}

function matchesCamera(camera: CameraSummary, filters: FilterState, routeLookup: Map<string, CuratedRoute>) {
  const route =
    createCustomRoute(filters.customRouteSegments) ??
    (filters.routeId ? routeLookup.get(filters.routeId) ?? null : null)
  const query = filters.searchQuery.trim().toLowerCase()

  if (filters.region && camera.region !== filters.region) {
    return false
  }

  if (filters.county && camera.county !== filters.county) {
    return false
  }

  if (filters.city && camera.city !== filters.city) {
    return false
  }

  if (filters.maintenance && !camera.maintenanceStations.includes(filters.maintenance)) {
    return false
  }

  if (route && !cameraMatchesRoute(camera, route)) {
    return false
  }

  if (query && !camera.searchText.includes(query)) {
    return false
  }

  return true
}

export function filterCameras(
  cameras: CameraSummary[],
  routeLookup: Map<string, CuratedRoute>,
  filters: FilterState,
) {
  const selectedRoute =
    createCustomRoute(filters.customRouteSegments) ??
    (filters.routeId ? routeLookup.get(filters.routeId) ?? null : null)
  const filtered = cameras.filter((camera) => matchesCamera(camera, filters, routeLookup))

  return filtered.toSorted((left, right) =>
    selectedRoute ? compareByRoute(left, right, selectedRoute) : compareByDefault(left, right),
  )
}

function withFilterRemoved(filters: FilterState, key: keyof FilterState): FilterState {
  return {
    ...filters,
    [key]: key === 'customRouteSegments' ? [] : '',
  }
}

export function deriveFilterOptions(
  cameras: CameraSummary[],
  routes: CuratedRoute[],
  routeLookup: Map<string, CuratedRoute>,
  filters: FilterState,
): FilterOptions {
  const byRegion = filterCameras(cameras, routeLookup, withFilterRemoved(filters, 'region'))
  const byCounty = filterCameras(cameras, routeLookup, withFilterRemoved(filters, 'county'))
  const byCity = filterCameras(cameras, routeLookup, withFilterRemoved(filters, 'city'))
  const byMaintenance = filterCameras(cameras, routeLookup, withFilterRemoved(filters, 'maintenance'))
  const byRoute = filterCameras(cameras, routeLookup, withFilterRemoved(filters, 'routeId'))

  return {
    regions: uniqueSorted(byRegion.map((camera) => camera.region)),
    counties: uniqueSorted(byCounty.map((camera) => camera.county)),
    cities: uniqueSorted(byCity.map((camera) => camera.city)),
    maintenanceStations: uniqueSorted(byMaintenance.flatMap((camera) => camera.maintenanceStations)),
    routes: routes.filter((route) => byRoute.some((camera) => cameraMatchesRoute(camera, route))),
  }
}

export function createRouteSelectors(routes: CuratedRoute[]) {
  return createRouteLookup(routes)
}