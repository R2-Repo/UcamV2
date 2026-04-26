import type { CameraSummary } from '../../shared/types'

export type PopupDirection =
  | 'top'
  | 'top-left'
  | 'top-right'
  | 'right'
  | 'left'
  | 'bottom'
  | 'bottom-left'
  | 'bottom-right'

export type PopupSizeMode = 'default' | 'large'

export interface Rect {
  left: number
  top: number
  right: number
  bottom: number
}

export interface PopupBlockedRect {
  cameraId: string | null
  rect: Rect
}

interface PopupCandidate {
  direction: PopupDirection
  left: number
  top: number
}

interface PopupConnector {
  startX: number
  startY: number
  endX: number
  endY: number
}

interface PopupPlacement {
  clampPenalty: number
  layout: PopupLayout
  rect: Rect
  connector: PopupConnector
  connectorBounds: Rect
}

export interface PopupLayoutItem {
  camera: CameraSummary
  point: {
    x: number
    y: number
  }
}

export interface PopupLayout {
  camera: CameraSummary
  direction: PopupDirection
  left: number
  top: number
  width: number
  height: number
  markerX: number
  markerY: number
  anchorX: number
  anchorY: number
}

const POPUP_MARGIN = 12
const POSITION_EPSILON = 0.25
const CONNECTOR_PADDING = 6

const POPUP_SIZES = {
  default: {
    width: 144,
    height: 81,
    gap: 24,
    edgeInset: 16,
  },
  large: {
    width: 192,
    height: 108,
    gap: 28,
    edgeInset: 18,
  },
} as const

type PopupSize = (typeof POPUP_SIZES)[PopupSizeMode]

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function getPopupSize(mode: PopupSizeMode = 'default'): PopupSize {
  return POPUP_SIZES[mode]
}

export function createRect(left: number, top: number, width: number, height: number): Rect {
  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
  }
}

function rectsIntersect(a: Rect, b: Rect) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
}

function getIntersectionArea(a: Rect, b: Rect) {
  if (!rectsIntersect(a, b)) {
    return 0
  }

  return (
    (Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
    (Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
  )
}

function pointInRect(x: number, y: number, rect: Rect) {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
}

function getPopupCandidates(markerX: number, markerY: number, size: PopupSize): PopupCandidate[] {
  return [
    {
      direction: 'top',
      left: markerX - size.width / 2,
      top: markerY - size.height - size.gap,
    },
    {
      direction: 'top-left',
      left: markerX - size.width + size.edgeInset,
      top: markerY - size.height - size.gap,
    },
    {
      direction: 'top-right',
      left: markerX - size.edgeInset,
      top: markerY - size.height - size.gap,
    },
    {
      direction: 'right',
      left: markerX + size.gap,
      top: markerY - size.height / 2,
    },
    {
      direction: 'left',
      left: markerX - size.width - size.gap,
      top: markerY - size.height / 2,
    },
    {
      direction: 'bottom',
      left: markerX - size.width / 2,
      top: markerY + size.gap,
    },
    {
      direction: 'bottom-left',
      left: markerX - size.width + size.edgeInset,
      top: markerY + size.gap,
    },
    {
      direction: 'bottom-right',
      left: markerX - size.edgeInset,
      top: markerY + size.gap,
    },
  ]
}

function resolvePopupAnchor(
  direction: PopupDirection,
  rect: Rect,
  markerX: number,
  markerY: number,
  edgeInset: number,
) {
  switch (direction) {
    case 'top':
    case 'top-left':
    case 'top-right':
      return {
        anchorX: clamp(markerX, rect.left + edgeInset, rect.right - edgeInset),
        anchorY: rect.bottom,
      }
    case 'bottom':
    case 'bottom-left':
    case 'bottom-right':
      return {
        anchorX: clamp(markerX, rect.left + edgeInset, rect.right - edgeInset),
        anchorY: rect.top,
      }
    case 'left':
      return {
        anchorX: rect.right,
        anchorY: clamp(markerY, rect.top + edgeInset, rect.bottom - edgeInset),
      }
    case 'right':
      return {
        anchorX: rect.left,
        anchorY: clamp(markerY, rect.top + edgeInset, rect.bottom - edgeInset),
      }
  }
}

function createConnectorBounds(connector: PopupConnector) {
  const left = Math.min(connector.startX, connector.endX) - CONNECTOR_PADDING
  const top = Math.min(connector.startY, connector.endY) - CONNECTOR_PADDING
  const right = Math.max(connector.startX, connector.endX) + CONNECTOR_PADDING
  const bottom = Math.max(connector.startY, connector.endY) + CONNECTOR_PADDING

  return {
    left,
    top,
    right,
    bottom,
  }
}

function orientation(
  firstX: number,
  firstY: number,
  secondX: number,
  secondY: number,
  thirdX: number,
  thirdY: number,
) {
  const value = (secondY - firstY) * (thirdX - secondX) - (secondX - firstX) * (thirdY - secondY)

  if (Math.abs(value) <= POSITION_EPSILON) {
    return 0
  }

  return value > 0 ? 1 : 2
}

function pointOnSegment(
  pointX: number,
  pointY: number,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
) {
  return (
    pointX <= Math.max(startX, endX) + POSITION_EPSILON &&
    pointX >= Math.min(startX, endX) - POSITION_EPSILON &&
    pointY <= Math.max(startY, endY) + POSITION_EPSILON &&
    pointY >= Math.min(startY, endY) - POSITION_EPSILON
  )
}

function segmentsIntersect(first: PopupConnector, second: PopupConnector) {
  const firstOrientation = orientation(
    first.startX,
    first.startY,
    first.endX,
    first.endY,
    second.startX,
    second.startY,
  )
  const secondOrientation = orientation(
    first.startX,
    first.startY,
    first.endX,
    first.endY,
    second.endX,
    second.endY,
  )
  const thirdOrientation = orientation(
    second.startX,
    second.startY,
    second.endX,
    second.endY,
    first.startX,
    first.startY,
  )
  const fourthOrientation = orientation(
    second.startX,
    second.startY,
    second.endX,
    second.endY,
    first.endX,
    first.endY,
  )

  if (firstOrientation !== secondOrientation && thirdOrientation !== fourthOrientation) {
    return true
  }

  if (
    firstOrientation === 0 &&
    pointOnSegment(second.startX, second.startY, first.startX, first.startY, first.endX, first.endY)
  ) {
    return true
  }

  if (
    secondOrientation === 0 &&
    pointOnSegment(second.endX, second.endY, first.startX, first.startY, first.endX, first.endY)
  ) {
    return true
  }

  if (
    thirdOrientation === 0 &&
    pointOnSegment(first.startX, first.startY, second.startX, second.startY, second.endX, second.endY)
  ) {
    return true
  }

  if (
    fourthOrientation === 0 &&
    pointOnSegment(first.endX, first.endY, second.startX, second.startY, second.endX, second.endY)
  ) {
    return true
  }

  return false
}

function segmentIntersectsRect(connector: PopupConnector, rect: Rect) {
  if (
    pointInRect(connector.startX, connector.startY, rect) ||
    pointInRect(connector.endX, connector.endY, rect)
  ) {
    return true
  }

  const edges: PopupConnector[] = [
    { startX: rect.left, startY: rect.top, endX: rect.right, endY: rect.top },
    { startX: rect.right, startY: rect.top, endX: rect.right, endY: rect.bottom },
    { startX: rect.right, startY: rect.bottom, endX: rect.left, endY: rect.bottom },
    { startX: rect.left, startY: rect.bottom, endX: rect.left, endY: rect.top },
  ]

  return edges.some((edge) => segmentsIntersect(connector, edge))
}

function hasHardConnectorCollision(
  connector: PopupConnector,
  blockedRects: PopupBlockedRect[],
  placedRects: Rect[],
  placedConnectors: PopupConnector[],
  cameraId: string,
) {
  if (
    blockedRects.some(
      ({ cameraId: blockedCameraId, rect }) => blockedCameraId !== cameraId && segmentIntersectsRect(connector, rect),
    )
  ) {
    return true
  }

  if (placedRects.some((placedRect) => segmentIntersectsRect(connector, placedRect))) {
    return true
  }

  return placedConnectors.some((placedConnector) => segmentsIntersect(connector, placedConnector))
}

function scoreConnectorCandidate(
  connector: PopupConnector,
  connectorBounds: Rect,
  blockedRects: PopupBlockedRect[],
  placedRects: Rect[],
  placedConnectors: PopupConnector[],
  placedConnectorBounds: Rect[],
  cameraId: string,
) {
  let score = 0

  blockedRects.forEach(({ cameraId: blockedCameraId, rect }) => {
    if (blockedCameraId === cameraId) {
      return
    }

    if (segmentIntersectsRect(connector, rect)) {
      score += 1500
      return
    }

    if (rectsIntersect(connectorBounds, rect)) {
      score += 260
    }
  })

  placedRects.forEach((placedRect) => {
    if (segmentIntersectsRect(connector, placedRect)) {
      score += 2100
      return
    }

    if (rectsIntersect(connectorBounds, placedRect)) {
      score += 380
    }
  })

  placedConnectors.forEach((placedConnector, index) => {
    if (segmentsIntersect(connector, placedConnector)) {
      score += 1650
      return
    }

    if (rectsIntersect(connectorBounds, placedConnectorBounds[index]!)) {
      score += 280
    }
  })

  return score
}

function scoreCandidate(
  rect: Rect,
  connector: PopupConnector,
  connectorBounds: Rect,
  viewportRect: Rect,
  blockedRects: PopupBlockedRect[],
  placedRects: Rect[],
  placedConnectors: PopupConnector[],
  placedConnectorBounds: Rect[],
  clampPenalty: number,
  cameraId: string,
) {
  let score = clampPenalty * 10

  if (rect.left < viewportRect.left) {
    score += (viewportRect.left - rect.left) * 120
  }

  if (rect.right > viewportRect.right) {
    score += (rect.right - viewportRect.right) * 120
  }

  if (rect.top < viewportRect.top) {
    score += (viewportRect.top - rect.top) * 160
  }

  if (rect.bottom > viewportRect.bottom) {
    score += (rect.bottom - viewportRect.bottom) * 120
  }

  blockedRects.forEach(({ cameraId: blockedCameraId, rect: blockedRect }) => {
    if (blockedCameraId === cameraId) {
      return
    }

    const overlap = getIntersectionArea(rect, blockedRect)

    if (overlap > 0) {
      score += overlap * 6 + 900
    }
  })

  placedRects.forEach((placedRect) => {
    const overlap = getIntersectionArea(rect, placedRect)

    if (overlap > 0) {
      score += overlap * 10 + 1600
    }
  })

  score += scoreConnectorCandidate(
    connector,
    connectorBounds,
    blockedRects,
    placedRects,
    placedConnectors,
    placedConnectorBounds,
    cameraId,
  )

  return score
}

function isCollisionFree(
  rect: Rect,
  connector: PopupConnector,
  blockedRects: PopupBlockedRect[],
  placedRects: Rect[],
  placedConnectors: PopupConnector[],
  cameraId: string,
) {
  return (
    !blockedRects.some(
      ({ cameraId: blockedCameraId, rect: blockedRect }) => blockedCameraId !== cameraId && rectsIntersect(rect, blockedRect),
    ) &&
    !placedRects.some((placedRect) => rectsIntersect(rect, placedRect)) &&
    !hasHardConnectorCollision(connector, blockedRects, placedRects, placedConnectors, cameraId)
  )
}

function createPopupLayout(
  camera: CameraSummary,
  point: { x: number; y: number },
  viewportRect: Rect,
  candidate: PopupCandidate,
  size: PopupSize,
): PopupPlacement {
  const rawRect = createRect(candidate.left, candidate.top, size.width, size.height)
  const clampedLeft = clamp(rawRect.left, viewportRect.left, viewportRect.right - size.width)
  const clampedTop = clamp(rawRect.top, viewportRect.top, viewportRect.bottom - size.height)
  const rect = createRect(clampedLeft, clampedTop, size.width, size.height)
  const { anchorX, anchorY } = resolvePopupAnchor(candidate.direction, rect, point.x, point.y, size.edgeInset)
  const connector: PopupConnector = {
    startX: point.x,
    startY: point.y,
    endX: anchorX,
    endY: anchorY,
  }

  return {
    clampPenalty: Math.abs(rawRect.left - clampedLeft) + Math.abs(rawRect.top - clampedTop),
    layout: {
      camera,
      direction: candidate.direction,
      left: rect.left,
      top: rect.top,
      width: size.width,
      height: size.height,
      markerX: point.x,
      markerY: point.y,
      anchorX,
      anchorY,
    } satisfies PopupLayout,
    rect,
    connector,
    connectorBounds: createConnectorBounds(connector),
  }
}

function createPopupLayoutFromRect(
  camera: CameraSummary,
  point: { x: number; y: number },
  viewportRect: Rect,
  previousLayout: PopupLayout,
  size: PopupSize,
): PopupPlacement {
  const clampedLeft = clamp(previousLayout.left, viewportRect.left, viewportRect.right - size.width)
  const clampedTop = clamp(previousLayout.top, viewportRect.top, viewportRect.bottom - size.height)
  const rect = createRect(clampedLeft, clampedTop, size.width, size.height)
  const { anchorX, anchorY } = resolvePopupAnchor(previousLayout.direction, rect, point.x, point.y, size.edgeInset)
  const connector: PopupConnector = {
    startX: point.x,
    startY: point.y,
    endX: anchorX,
    endY: anchorY,
  }

  return {
    clampPenalty: Math.abs(previousLayout.left - clampedLeft) + Math.abs(previousLayout.top - clampedTop),
    layout: {
      camera,
      direction: previousLayout.direction,
      left: rect.left,
      top: rect.top,
      width: size.width,
      height: size.height,
      markerX: point.x,
      markerY: point.y,
      anchorX,
      anchorY,
    } satisfies PopupLayout,
    rect,
    connector,
    connectorBounds: createConnectorBounds(connector),
  }
}

function almostEqual(a: number, b: number) {
  return Math.abs(a - b) <= POSITION_EPSILON
}

export function popupLayoutsEqual(currentLayouts: PopupLayout[], nextLayouts: PopupLayout[]) {
  if (currentLayouts.length !== nextLayouts.length) {
    return false
  }

  return currentLayouts.every((layout, index) => {
    const nextLayout = nextLayouts[index]

    return (
      layout.camera.id === nextLayout.camera.id &&
      layout.direction === nextLayout.direction &&
      almostEqual(layout.left, nextLayout.left) &&
      almostEqual(layout.top, nextLayout.top) &&
      almostEqual(layout.width, nextLayout.width) &&
      almostEqual(layout.height, nextLayout.height) &&
      almostEqual(layout.markerX, nextLayout.markerX) &&
      almostEqual(layout.markerY, nextLayout.markerY) &&
      almostEqual(layout.anchorX, nextLayout.anchorX) &&
      almostEqual(layout.anchorY, nextLayout.anchorY)
    )
  })
}

export function buildPopupLayouts({
  items,
  blockedRects,
  blockedTop,
  width,
  height,
  previousLayouts = new Map<string, PopupLayout>(),
  preservePreviousPositions = false,
  sizeMode = 'default',
}: {
  items: PopupLayoutItem[]
  blockedRects: PopupBlockedRect[]
  blockedTop: number
  width: number
  height: number
  previousLayouts?: ReadonlyMap<string, PopupLayout>
  preservePreviousPositions?: boolean
  sizeMode?: PopupSizeMode
}) {
  if (!width || !height) {
    return []
  }

  const popupSize = getPopupSize(sizeMode)

  const safeTop = Math.max(POPUP_MARGIN, blockedTop + 8)
  const viewportRect: Rect = {
    left: POPUP_MARGIN,
    top: safeTop,
    right: width - POPUP_MARGIN,
    bottom: height - POPUP_MARGIN,
  }

  if (
    viewportRect.right - viewportRect.left < popupSize.width ||
    viewportRect.bottom - viewportRect.top < popupSize.height
  ) {
    return []
  }

  const placedRects: Rect[] = []
  const placedConnectors: PopupConnector[] = []
  const placedConnectorBounds: Rect[] = []

  return items.flatMap(({ camera, point }) => {
    if (
      point.x < -popupSize.width ||
      point.x > width + popupSize.width ||
      point.y < -popupSize.height ||
      point.y > height + popupSize.height
    ) {
      return []
    }

    const candidates = getPopupCandidates(point.x, point.y, popupSize)
    const previousLayout = previousLayouts.get(camera.id)

    if (previousLayout) {
      if (preservePreviousPositions) {
        const preservedLayout = createPopupLayoutFromRect(camera, point, viewportRect, previousLayout, popupSize)

        if (
          isCollisionFree(
            preservedLayout.rect,
            preservedLayout.connector,
            blockedRects,
            placedRects,
            placedConnectors,
            camera.id,
          )
        ) {
          placedRects.push(preservedLayout.rect)
          placedConnectors.push(preservedLayout.connector)
          placedConnectorBounds.push(preservedLayout.connectorBounds)
          return [preservedLayout.layout]
        }
      }

      const stickyCandidate = candidates.find((candidate) => candidate.direction === previousLayout.direction)

      if (stickyCandidate) {
        const stickyLayout = createPopupLayout(camera, point, viewportRect, stickyCandidate, popupSize)

        if (
          isCollisionFree(
            stickyLayout.rect,
            stickyLayout.connector,
            blockedRects,
            placedRects,
            placedConnectors,
            camera.id,
          )
        ) {
          placedRects.push(stickyLayout.rect)
          placedConnectors.push(stickyLayout.connector)
          placedConnectorBounds.push(stickyLayout.connectorBounds)
          return [stickyLayout.layout]
        }
      }
    }

    let bestLayout: PopupLayout | null = null
    let bestRect: Rect | null = null
    let bestConnector: PopupConnector | null = null
    let bestConnectorBounds: Rect | null = null
    let bestScore = Number.POSITIVE_INFINITY

    for (const [candidateIndex, candidate] of candidates.entries()) {
      const nextLayout = createPopupLayout(camera, point, viewportRect, candidate, popupSize)
      const score = scoreCandidate(
        nextLayout.rect,
        nextLayout.connector,
        nextLayout.connectorBounds,
        viewportRect,
        blockedRects,
        placedRects,
        placedConnectors,
        placedConnectorBounds,
        nextLayout.clampPenalty + candidateIndex * 24,
        camera.id,
      )

      if (score < bestScore) {
        bestScore = score
        bestLayout = nextLayout.layout
        bestRect = nextLayout.rect
        bestConnector = nextLayout.connector
        bestConnectorBounds = nextLayout.connectorBounds
      }
    }

    if (!bestLayout || !bestRect || !bestConnector || !bestConnectorBounds) {
      return []
    }

    placedRects.push(bestRect)
    placedConnectors.push(bestConnector)
    placedConnectorBounds.push(bestConnectorBounds)
    return [bestLayout]
  })
}