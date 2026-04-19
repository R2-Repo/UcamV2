import type { CameraSummary, CuratedRoute, RouteSegment } from '../types'

export function normalizeRouteKey(routeName: string | null | undefined) {
  if (!routeName) {
    return null
  }

  return routeName
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/^0+/, '')
    .replace(/[PN]$/, 'P')
}

export function cameraMatchesSegment(camera: CameraSummary, segment: RouteSegment) {
  const match = camera.routeRefs.find((routeRef) => routeRef.routeKey === segment.routeKey)

  if (!match) {
    return false
  }

  if ((segment.mpMin !== null || segment.mpMax !== null) && match.milepost === null) {
    return false
  }

  if (segment.mpMin !== null && match.milepost !== null && match.milepost < segment.mpMin) {
    return false
  }

  if (segment.mpMax !== null && match.milepost !== null && match.milepost > segment.mpMax) {
    return false
  }

  return true
}

export function cameraMatchesRoute(camera: CameraSummary, route: CuratedRoute) {
  return route.segments.some((segment) => cameraMatchesSegment(camera, segment))
}

export function createRouteLookup(routes: CuratedRoute[]) {
  return new Map(routes.map((route) => [route.id, route]))
}

export function getRouteSortValue(camera: CameraSummary, route: CuratedRoute) {
  const segmentIndex = route.segments.findIndex((segment) => cameraMatchesSegment(camera, segment))

  if (segmentIndex === -1) {
    return null
  }

  const segment = route.segments[segmentIndex]
  const routeRef = camera.routeRefs.find((ref) => ref.routeKey === segment.routeKey) ?? null

  return {
    segmentIndex,
    milepost: routeRef?.milepost ?? null,
    sortOrder: segment.sortOrder,
  }
}

export function getPrimaryRouteLabel(camera: CameraSummary) {
  return camera.routeRefs[0]?.routeKey ?? 'Camera'
}