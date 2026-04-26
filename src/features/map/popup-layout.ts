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
  layout: PopupLayout
  rect: Rect
  connector: PopupConnector
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
/** Matches legacy Leaflet tooltips: keep marker–popup edge at least this many pixels apart. */
const MIN_ANCHOR_PX = 10

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

/**
 * Candidate order mirrors legacy `maps.js` / `modal.js`: top, bottom, left, right,
 * then shifted top/bottom variants (equivalent to top-left, top-right, etc.).
 */
function getPopupCandidates(markerX: number, markerY: number, size: PopupSize): PopupCandidate[] {
  return [
    {
      direction: 'top',
      left: markerX - size.width / 2,
      top: markerY - size.height - size.gap,
    },
    {
      direction: 'bottom',
      left: markerX - size.width / 2,
      top: markerY + size.gap,
    },
    {
      direction: 'left',
      left: markerX - size.width - size.gap,
      top: markerY - size.height / 2,
    },
    {
      direction: 'right',
      left: markerX + size.gap,
      top: markerY - size.height / 2,
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

/** Push the anchor away from the marker along the same ray until segment length ≥ minLen (legacy behavior). */
function ensureMinAnchorLength(markerX: number, markerY: number, idealAnchorX: number, idealAnchorY: number) {
  const dx = idealAnchorX - markerX
  const dy = idealAnchorY - markerY
  const len = Math.hypot(dx, dy)

  if (len <= POSITION_EPSILON) {
    return { anchorX: markerX, anchorY: markerY + MIN_ANCHOR_PX }
  }

  if (len >= MIN_ANCHOR_PX) {
    return { anchorX: idealAnchorX, anchorY: idealAnchorY }
  }

  const scale = MIN_ANCHOR_PX / len
  return {
    anchorX: markerX + dx * scale,
    anchorY: markerY + dy * scale,
  }
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
  const ideal = resolvePopupAnchor(candidate.direction, rect, point.x, point.y, size.edgeInset)
  const { anchorX, anchorY } = ensureMinAnchorLength(point.x, point.y, ideal.anchorX, ideal.anchorY)
  const connector: PopupConnector = {
    startX: point.x,
    startY: point.y,
    endX: anchorX,
    endY: anchorY,
  }

  return {
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
  const ideal = resolvePopupAnchor(previousLayout.direction, rect, point.x, point.y, size.edgeInset)
  const { anchorX, anchorY } = ensureMinAnchorLength(point.x, point.y, ideal.anchorX, ideal.anchorY)
  const connector: PopupConnector = {
    startX: point.x,
    startY: point.y,
    endX: anchorX,
    endY: anchorY,
  }

  return {
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
  }
}

function isCollisionFree(rect: Rect, blockedRects: PopupBlockedRect[], placedRects: Rect[], cameraId: string) {
  if (
    blockedRects.some(
      ({ cameraId: blockedCameraId, rect: blockedRect }) =>
        blockedCameraId !== cameraId && rectsIntersect(rect, blockedRect),
    )
  ) {
    return false
  }

  return !placedRects.some((placedRect) => rectsIntersect(rect, placedRect))
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

    const tryPlacement = (placement: PopupPlacement): PopupLayout | null => {
      if (isCollisionFree(placement.rect, blockedRects, placedRects, camera.id)) {
        placedRects.push(placement.rect)
        return placement.layout
      }
      return null
    }

    if (previousLayout) {
      if (preservePreviousPositions) {
        const preserved = createPopupLayoutFromRect(camera, point, viewportRect, previousLayout, popupSize)
        const preservedLayout = tryPlacement(preserved)
        if (preservedLayout) {
          return [preservedLayout]
        }
      }

      const stickyCandidate = candidates.find((candidate) => candidate.direction === previousLayout.direction)

      if (stickyCandidate) {
        const stickyLayout = createPopupLayout(camera, point, viewportRect, stickyCandidate, popupSize)
        const stickyResult = tryPlacement(stickyLayout)
        if (stickyResult) {
          return [stickyResult]
        }
      }
    }

    for (const candidate of candidates) {
      const nextLayout = createPopupLayout(camera, point, viewportRect, candidate, popupSize)
      const chosen = tryPlacement(nextLayout)
      if (chosen) {
        return [chosen]
      }
    }

    return []
  })
}
