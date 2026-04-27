import type { CuratedRoute, RouteSegment } from '../../shared/types'
import { normalizeRouteKey } from '../../shared/lib/routes'

const CUSTOM_ROUTE_ID = 'custom-route'

export function createEmptyCustomRouteSegment(): RouteSegment {
  return {
    routeKey: '',
    mpMin: null,
    mpMax: null,
    sortOrder: 'asc',
  }
}

export function cloneRouteSegment(segment: RouteSegment): RouteSegment {
  return {
    routeKey: segment.routeKey,
    mpMin: segment.mpMin,
    mpMax: segment.mpMax,
    sortOrder: segment.sortOrder,
  }
}

export function cloneRouteSegments(segments: RouteSegment[]) {
  return segments.map(cloneRouteSegment)
}

export function getSegmentDisplayStart(segment: RouteSegment) {
  return segment.sortOrder === 'desc' ? segment.mpMax : segment.mpMin
}

export function getSegmentDisplayEnd(segment: RouteSegment) {
  return segment.sortOrder === 'desc' ? segment.mpMin : segment.mpMax
}

export function normalizeCustomRouteSegment({
  end,
  routeKey,
  start,
}: {
  routeKey: string
  start: number | null
  end: number | null
}): RouteSegment {
  const normalizedRouteKey = (() => {
    const normalized = normalizeRouteKey(routeKey) ?? ''

    if (!normalized) {
      return ''
    }

    return normalized.endsWith('P') ? normalized : `${normalized}P`
  })()
  const sortOrder = start !== null && end !== null && start > end ? 'desc' : 'asc'
  const values = [start, end].filter((value): value is number => value !== null)
  const mpMin = values.length ? Math.min(...values) : null
  const mpMax = values.length ? Math.max(...values) : null

  return {
    routeKey: normalizedRouteKey,
    mpMin,
    mpMax,
    sortOrder,
  }
}

export function updateCustomRouteSegment(
  segment: RouteSegment,
  updates: {
    routeKey?: string
    start?: number | null
    end?: number | null
  },
) {
  const nextStart = updates.start === undefined ? getSegmentDisplayStart(segment) : updates.start
  const nextEnd = updates.end === undefined ? getSegmentDisplayEnd(segment) : updates.end

  return normalizeCustomRouteSegment({
    routeKey: updates.routeKey ?? segment.routeKey,
    start: nextStart,
    end: nextEnd,
  })
}

export function swapCustomRouteSegment(segment: RouteSegment): RouteSegment {
  return {
    ...segment,
    sortOrder: segment.sortOrder === 'asc' ? 'desc' : 'asc',
  }
}

export function isCustomRouteSegmentComplete(segment: RouteSegment) {
  return Boolean(segment.routeKey && segment.mpMin !== null && segment.mpMax !== null)
}

export function hasCustomRouteSegments(segments: RouteSegment[]) {
  return segments.some((segment) => isCustomRouteSegmentComplete(segment))
}

function formatMilepost(value: number | null) {
  return value === null ? '' : String(value)
}

export function serializeCustomRouteSegments(segments: RouteSegment[]) {
  return segments
    .filter((segment) => isCustomRouteSegmentComplete(segment))
    .map((segment) => {
      const start = formatMilepost(getSegmentDisplayStart(segment))
      const end = formatMilepost(getSegmentDisplayEnd(segment))

      return `${segment.routeKey}:${start}-${end}`
    })
    .join(',')
}

export function parseCustomRouteSegments(rawValue: string | null | undefined) {
  if (!rawValue) {
    return []
  }

  return rawValue
    .split(',')
    .map((chunk) => {
      const [routeKeyPart = '', rangePart = ''] = chunk.split(':')
      const [startPart = '', endPart = ''] = rangePart.split('-')
      const start = Number.parseFloat(startPart)
      const end = Number.parseFloat(endPart)

      const segment = normalizeCustomRouteSegment({
        routeKey: routeKeyPart,
        start: Number.isFinite(start) ? start : null,
        end: Number.isFinite(end) ? end : null,
      })

      return isCustomRouteSegmentComplete(segment) ? segment : null
    })
    .filter((segment): segment is RouteSegment => segment !== null)
}

export function getCustomRouteLabel(segments: RouteSegment[]) {
  const segmentCount = segments.length

  return segmentCount === 1 ? 'Custom Route (1 segment)' : `Custom Route (${segmentCount} segments)`
}

export function createCustomRoute(segments: RouteSegment[]): CuratedRoute | null {
  if (!hasCustomRouteSegments(segments)) {
    return null
  }

  return {
    id: CUSTOM_ROUTE_ID,
    displayName: getCustomRouteLabel(segments),
    segments: cloneRouteSegments(segments),
  }
}
