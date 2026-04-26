import { describe, expect, it } from 'vitest'
import type { CameraSummary } from '../../shared/types'
import { buildPopupLayouts, createRect, getPopupSize, type PopupLayout } from './popup-layout'

function createCamera(id: string): CameraSummary {
  return {
    id,
    source: 'test',
    sourceId: id,
    location: `Camera ${id}`,
    latitude: 40,
    longitude: -111,
    imageUrl: '/camera.jpg',
    region: '2',
    county: null,
    city: null,
    direction: null,
    maintenanceStations: [],
    routeRefs: [],
    status: 'ok',
    sortOrder: 0,
    searchText: id,
  }
}

function connectorLength(layout: PopupLayout) {
  return Math.hypot(layout.anchorX - layout.markerX, layout.anchorY - layout.markerY)
}

function createPreviousLayout(camera: CameraSummary, direction: PopupLayout['direction']): PopupLayout {
  const popupSize = getPopupSize('default')

  return {
    camera,
    direction,
    left: 0,
    top: 0,
    width: popupSize.width,
    height: popupSize.height,
    markerX: 0,
    markerY: 0,
    anchorX: 0,
    anchorY: 0,
  }
}

describe('popup layout stickiness', () => {
  it('keeps the current popup direction when that placement still fits', () => {
    const camera = createCamera('cam-1')
    const layouts = buildPopupLayouts({
      items: [
        {
          camera,
          point: { x: 160, y: 120 },
        },
      ],
      blockedRects: [],
      blockedTop: 0,
      width: 420,
      height: 260,
      previousLayouts: new Map([[camera.id, createPreviousLayout(camera, 'right')]]),
    })

    expect(layouts).toHaveLength(1)
    expect(layouts[0]?.direction).toBe('right')
  })

  it('reflows to a new direction when the sticky placement collides with another marker', () => {
    const camera = createCamera('cam-1')
    const layouts = buildPopupLayouts({
      items: [
        {
          camera,
          point: { x: 160, y: 120 },
        },
      ],
      blockedRects: [{ cameraId: null, rect: createRect(180, 70, 140, 100) }],
      blockedTop: 0,
      width: 420,
      height: 260,
      previousLayouts: new Map([[camera.id, createPreviousLayout(camera, 'right')]]),
    })

    expect(layouts).toHaveLength(1)
    expect(layouts[0]?.direction).not.toBe('right')
  })

  it('uses the requested popup size mode when laying out the popup cards', () => {
    const camera = createCamera('cam-1')
    const popupSize = getPopupSize('large')
    const layouts = buildPopupLayouts({
      items: [
        {
          camera,
          point: { x: 210, y: 160 },
        },
      ],
      blockedRects: [],
      blockedTop: 0,
      width: 520,
      height: 320,
      sizeMode: 'large',
    })

    expect(layouts).toHaveLength(1)
    expect(layouts[0]).toMatchObject({
      width: popupSize.width,
      height: popupSize.height,
    })
  })

  it('preserves the previous popup card position while updating the live marker connector', () => {
    const camera = createCamera('cam-1')
    const popupSize = getPopupSize('default')
    const previousLayout: PopupLayout = {
      ...createPreviousLayout(camera, 'right'),
      left: 220,
      top: 70,
    }
    const layouts = buildPopupLayouts({
      items: [
        {
          camera,
          point: { x: 120, y: 160 },
        },
      ],
      blockedRects: [],
      blockedTop: 0,
      width: 520,
      height: 320,
      previousLayouts: new Map([[camera.id, previousLayout]]),
      preservePreviousPositions: true,
    })

    expect(layouts).toHaveLength(1)
    expect(layouts[0]).toMatchObject({
      left: previousLayout.left,
      top: previousLayout.top,
      markerX: 120,
      markerY: 160,
      anchorX: previousLayout.left,
      anchorY: previousLayout.top + popupSize.height - popupSize.edgeInset,
      width: popupSize.width,
      height: popupSize.height,
    })
  })

  it('reflows during interaction when preserving the previous card would collide', () => {
    const camera = createCamera('cam-1')
    const previousLayout: PopupLayout = {
      ...createPreviousLayout(camera, 'right'),
      left: 220,
      top: 70,
    }
    const layouts = buildPopupLayouts({
      items: [
        {
          camera,
          point: { x: 120, y: 160 },
        },
      ],
      blockedRects: [{ cameraId: null, rect: createRect(210, 60, 170, 120) }],
      blockedTop: 0,
      width: 520,
      height: 320,
      previousLayouts: new Map([[camera.id, previousLayout]]),
      preservePreviousPositions: true,
    })

    expect(layouts).toHaveLength(1)
    expect(layouts[0]?.left).not.toBe(previousLayout.left)
    expect(layouts[0]?.top).not.toBe(previousLayout.top)
  })
})

describe('popup connector length', () => {
  it('extends short marker–popup edges to at least 25px along the same direction', () => {
    const camera = createCamera('cam-1')
    const layouts = buildPopupLayouts({
      items: [{ camera, point: { x: 260, y: 200 } }],
      blockedRects: [],
      blockedTop: 0,
      width: 520,
      height: 320,
    })

    expect(layouts).toHaveLength(1)
    expect(connectorLength(layouts[0]!)).toBeGreaterThanOrEqual(25 - 0.01)
  })

  it('caps a long marker–anchor segment at 150px along the same direction', () => {
    const camera = createCamera('cam-1')
    const popupSize = getPopupSize('default')
    const previousLayout: PopupLayout = {
      ...createPreviousLayout(camera, 'right'),
      left: 480,
      top: 120,
    }
    const layouts = buildPopupLayouts({
      items: [{ camera, point: { x: 80, y: 160 } }],
      blockedRects: [],
      blockedTop: 0,
      width: 640,
      height: 360,
      previousLayouts: new Map([[camera.id, previousLayout]]),
      preservePreviousPositions: true,
    })

    expect(layouts).toHaveLength(1)
    expect(layouts[0]).toMatchObject({
      left: previousLayout.left,
      top: previousLayout.top,
      markerX: 80,
      markerY: 160,
    })
    // Ideal edge anchor would be ~400px away; clamp keeps the line at 150px toward the card.
    expect(layouts[0]!.anchorX).toBeCloseTo(230, 0)
    expect(layouts[0]!.anchorY).toBeCloseTo(160, 0)
    expect(connectorLength(layouts[0]!)).toBeCloseTo(150, 5)
  })
})