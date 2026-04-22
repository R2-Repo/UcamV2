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
})