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

export interface Rect {
  left: number
  top: number
  right: number
  bottom: number
}

interface PopupCandidate {
  direction: PopupDirection
  left: number
  top: number
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

const POPUP_WIDTH = 132
const POPUP_HEIGHT = 84
const POPUP_MARGIN = 12
const POPUP_GAP = 22
const POPUP_EDGE_INSET = 16
const POSITION_EPSILON = 0.25

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
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

function getPopupCandidates(markerX: number, markerY: number): PopupCandidate[] {
  return [
    {
      direction: 'top',
      left: markerX - POPUP_WIDTH / 2,
      top: markerY - POPUP_HEIGHT - POPUP_GAP,
    },
    {
      direction: 'top-left',
      left: markerX - POPUP_WIDTH + POPUP_EDGE_INSET,
      top: markerY - POPUP_HEIGHT - POPUP_GAP,
    },
    {
      direction: 'top-right',
      left: markerX - POPUP_EDGE_INSET,
      top: markerY - POPUP_HEIGHT - POPUP_GAP,
    },
    {
      direction: 'right',
      left: markerX + POPUP_GAP,
      top: markerY - POPUP_HEIGHT / 2,
    },
    {
      direction: 'left',
      left: markerX - POPUP_WIDTH - POPUP_GAP,
      top: markerY - POPUP_HEIGHT / 2,
    },
    {
      direction: 'bottom',
      left: markerX - POPUP_WIDTH / 2,
      top: markerY + POPUP_GAP,
    },
    {
      direction: 'bottom-left',
      left: markerX - POPUP_WIDTH + POPUP_EDGE_INSET,
      top: markerY + POPUP_GAP,
    },
    {
      direction: 'bottom-right',
      left: markerX - POPUP_EDGE_INSET,
      top: markerY + POPUP_GAP,
    },
  ]
}

function resolvePopupAnchor(direction: PopupDirection, rect: Rect, markerX: number, markerY: number) {
  switch (direction) {
    case 'top':
    case 'top-left':
    case 'top-right':
      return {
        anchorX: clamp(markerX, rect.left + POPUP_EDGE_INSET, rect.right - POPUP_EDGE_INSET),
        anchorY: rect.bottom,
      }
    case 'bottom':
    case 'bottom-left':
    case 'bottom-right':
      return {
        anchorX: clamp(markerX, rect.left + POPUP_EDGE_INSET, rect.right - POPUP_EDGE_INSET),
        anchorY: rect.top,
      }
    case 'left':
      return {
        anchorX: rect.right,
        anchorY: clamp(markerY, rect.top + POPUP_EDGE_INSET, rect.bottom - POPUP_EDGE_INSET),
      }
    case 'right':
      return {
        anchorX: rect.left,
        anchorY: clamp(markerY, rect.top + POPUP_EDGE_INSET, rect.bottom - POPUP_EDGE_INSET),
      }
  }
}

function scoreCandidate(
  rect: Rect,
  viewportRect: Rect,
  blockedRects: Rect[],
  placedRects: Rect[],
  clampPenalty: number,
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

  blockedRects.forEach((blockedRect) => {
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

  return score
}

function isCollisionFree(rect: Rect, blockedRects: Rect[], placedRects: Rect[]) {
  return (
    !blockedRects.some((blockedRect) => rectsIntersect(rect, blockedRect)) &&
    !placedRects.some((placedRect) => rectsIntersect(rect, placedRect))
  )
}

function createPopupLayout(
  camera: CameraSummary,
  point: { x: number; y: number },
  viewportRect: Rect,
  candidate: PopupCandidate,
) {
  const rawRect = createRect(candidate.left, candidate.top, POPUP_WIDTH, POPUP_HEIGHT)
  const clampedLeft = clamp(rawRect.left, viewportRect.left, viewportRect.right - POPUP_WIDTH)
  const clampedTop = clamp(rawRect.top, viewportRect.top, viewportRect.bottom - POPUP_HEIGHT)
  const rect = createRect(clampedLeft, clampedTop, POPUP_WIDTH, POPUP_HEIGHT)
  const { anchorX, anchorY } = resolvePopupAnchor(candidate.direction, rect, point.x, point.y)

  return {
    clampPenalty: Math.abs(rawRect.left - clampedLeft) + Math.abs(rawRect.top - clampedTop),
    layout: {
      camera,
      direction: candidate.direction,
      left: rect.left,
      top: rect.top,
      width: POPUP_WIDTH,
      height: POPUP_HEIGHT,
      markerX: point.x,
      markerY: point.y,
      anchorX,
      anchorY,
    } satisfies PopupLayout,
    rect,
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
}: {
  items: PopupLayoutItem[]
  blockedRects: Rect[]
  blockedTop: number
  width: number
  height: number
  previousLayouts?: ReadonlyMap<string, PopupLayout>
}) {
  if (!width || !height) {
    return []
  }

  const safeTop = Math.max(POPUP_MARGIN, blockedTop + 8)
  const viewportRect: Rect = {
    left: POPUP_MARGIN,
    top: safeTop,
    right: width - POPUP_MARGIN,
    bottom: height - POPUP_MARGIN,
  }

  if (
    viewportRect.right - viewportRect.left < POPUP_WIDTH ||
    viewportRect.bottom - viewportRect.top < POPUP_HEIGHT
  ) {
    return []
  }

  const placedRects: Rect[] = []

  return items.flatMap(({ camera, point }) => {
    if (
      point.x < -POPUP_WIDTH ||
      point.x > width + POPUP_WIDTH ||
      point.y < -POPUP_HEIGHT ||
      point.y > height + POPUP_HEIGHT
    ) {
      return []
    }

    const candidates = getPopupCandidates(point.x, point.y)
    const previousLayout = previousLayouts.get(camera.id)

    if (previousLayout) {
      const stickyCandidate = candidates.find((candidate) => candidate.direction === previousLayout.direction)

      if (stickyCandidate) {
        const stickyLayout = createPopupLayout(camera, point, viewportRect, stickyCandidate)

        if (isCollisionFree(stickyLayout.rect, blockedRects, placedRects)) {
          placedRects.push(stickyLayout.rect)
          return [stickyLayout.layout]
        }
      }
    }

    let bestLayout: PopupLayout | null = null
    let bestRect: Rect | null = null
    let bestScore = Number.POSITIVE_INFINITY

    for (const [candidateIndex, candidate] of candidates.entries()) {
      const nextLayout = createPopupLayout(camera, point, viewportRect, candidate)
      const score = scoreCandidate(
        nextLayout.rect,
        viewportRect,
        blockedRects,
        placedRects,
        nextLayout.clampPenalty + candidateIndex * 24,
      )

      if (score < bestScore) {
        bestScore = score
        bestLayout = nextLayout.layout
        bestRect = nextLayout.rect
      }
    }

    if (!bestLayout || !bestRect) {
      return []
    }

    placedRects.push(bestRect)
    return [bestLayout]
  })
}