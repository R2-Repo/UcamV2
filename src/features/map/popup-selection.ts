import type { PopupLayoutItem } from './popup-layout'

export const AUTO_POPUP_MIN_ZOOM = 10.4
export const MAX_AUTO_POPUPS = 10

interface Point {
  x: number
  y: number
}

function getDistanceToViewportCenterSquared(point: Point, viewportCenter: Point) {
  const deltaX = point.x - viewportCenter.x
  const deltaY = point.y - viewportCenter.y

  return deltaX * deltaX + deltaY * deltaY
}

export function selectPopupLayoutItems({
  focusItem = null,
  pinnedItems = [],
  candidates,
  viewportCenter,
  maxPopups = MAX_AUTO_POPUPS,
}: {
  focusItem?: PopupLayoutItem | null
  pinnedItems?: PopupLayoutItem[]
  candidates: PopupLayoutItem[]
  viewportCenter: Point
  maxPopups?: number
}) {
  if (maxPopups <= 0) {
    return []
  }

  const items: PopupLayoutItem[] = []
  const seenCameraIds = new Set<string>()

  if (focusItem) {
    items.push(focusItem)
    seenCameraIds.add(focusItem.camera.id)
  }

  for (const pinnedItem of pinnedItems) {
    if (items.length >= maxPopups) {
      break
    }

    if (seenCameraIds.has(pinnedItem.camera.id)) {
      continue
    }

    items.push(pinnedItem)
    seenCameraIds.add(pinnedItem.camera.id)
  }

  const sortedCandidates = [...candidates].sort((firstCandidate, secondCandidate) => {
    const firstDistance = getDistanceToViewportCenterSquared(firstCandidate.point, viewportCenter)
    const secondDistance = getDistanceToViewportCenterSquared(secondCandidate.point, viewportCenter)

    if (firstDistance !== secondDistance) {
      return firstDistance - secondDistance
    }

    if (firstCandidate.camera.sortOrder !== secondCandidate.camera.sortOrder) {
      return firstCandidate.camera.sortOrder - secondCandidate.camera.sortOrder
    }

    return firstCandidate.camera.id.localeCompare(secondCandidate.camera.id)
  })

  for (const candidate of sortedCandidates) {
    if (items.length >= maxPopups) {
      break
    }

    if (seenCameraIds.has(candidate.camera.id)) {
      continue
    }

    items.push(candidate)
    seenCameraIds.add(candidate.camera.id)
  }

  return items
}