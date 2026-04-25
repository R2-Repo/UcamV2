import { describe, expect, it } from 'vitest'
import type { CameraSummary } from '../../shared/types'
import type { PopupLayoutItem } from './popup-layout'
import { MAX_AUTO_POPUPS, selectPopupLayoutItems } from './popup-selection'

function createCamera(id: string, sortOrder = 0): CameraSummary {
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
    sortOrder,
    searchText: id,
  }
}

function createItem(camera: CameraSummary, x: number, y: number): PopupLayoutItem {
  return {
    camera,
    point: { x, y },
  }
}

describe('popup selection', () => {
  it('keeps the focused popup first and never duplicates it', () => {
    const cameraA = createCamera('camera-a', 1)
    const cameraB = createCamera('camera-b', 2)
    const cameraC = createCamera('camera-c', 3)

    const items = selectPopupLayoutItems({
      focusItem: createItem(cameraB, 120, 120),
      candidates: [createItem(cameraA, 140, 120), createItem(cameraB, 120, 120), createItem(cameraC, 180, 120)],
      viewportCenter: { x: 120, y: 120 },
      maxPopups: 3,
    })

    expect(items.map((item) => item.camera.id)).toEqual(['camera-b', 'camera-a', 'camera-c'])
  })

  it('caps the auto-open list to the closest cameras to the viewport center', () => {
    const cameraA = createCamera('camera-a', 1)
    const cameraB = createCamera('camera-b', 2)
    const cameraC = createCamera('camera-c', 3)

    const items = selectPopupLayoutItems({
      candidates: [createItem(cameraA, 100, 100), createItem(cameraB, 130, 100), createItem(cameraC, 200, 100)],
      viewportCenter: { x: 100, y: 100 },
      maxPopups: 2,
    })

    expect(items.map((item) => item.camera.id)).toEqual(['camera-a', 'camera-b'])
  })

  it('counts the focused popup toward the maximum popup limit', () => {
    const focusedCamera = createCamera('focused', 10)
    const nearbyCamera = createCamera('nearby', 1)
    const fartherCamera = createCamera('farther', 2)

    const items = selectPopupLayoutItems({
      focusItem: createItem(focusedCamera, 240, 140),
      candidates: [createItem(nearbyCamera, 120, 120), createItem(fartherCamera, 180, 120)],
      viewportCenter: { x: 100, y: 100 },
      maxPopups: 2,
    })

    expect(items.map((item) => item.camera.id)).toEqual(['focused', 'nearby'])
  })

  it('defaults the automatic popup limit to ten cameras', () => {
    const candidates = Array.from({ length: 12 }, (_, index) =>
      createItem(createCamera(`camera-${index}`, index), 100 + index, 100),
    )

    const items = selectPopupLayoutItems({
      candidates,
      viewportCenter: { x: 100, y: 100 },
    })

    expect(MAX_AUTO_POPUPS).toBe(10)
    expect(items).toHaveLength(10)
  })

  it('prioritizes a manual popup candidate after the focused popup', () => {
    const focusedCamera = createCamera('focused', 10)
    const manualCamera = createCamera('manual', 99)
    const closerCamera = createCamera('closer', 1)

    const items = selectPopupLayoutItems({
      focusItem: createItem(focusedCamera, 300, 100),
      pinnedItems: [createItem(manualCamera, 500, 100)],
      candidates: [createItem(closerCamera, 100, 100)],
      viewportCenter: { x: 100, y: 100 },
      maxPopups: 3,
    })

    expect(items.map((item) => item.camera.id)).toEqual(['focused', 'manual', 'closer'])
  })
})