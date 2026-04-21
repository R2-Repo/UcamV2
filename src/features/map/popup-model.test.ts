import { describe, expect, it } from 'vitest'
import {
  createMapPopupState,
  getVisiblePopupDescriptors,
  setFocusedPopup,
  setPreviewPopup,
  togglePinnedPopup,
} from './popup-model'

describe('popup model', () => {
  it('keeps popup roles local to the map feature instead of the global selection store', () => {
    const state = createMapPopupState({
      focusCameraId: 'focus-camera',
      previewCameraId: 'preview-camera',
      pinnedCameraIds: ['pinned-camera'],
    })

    expect(getVisiblePopupDescriptors(state)).toEqual([
      { cameraId: 'focus-camera', role: 'focus' },
      { cameraId: 'preview-camera', role: 'preview' },
      { cameraId: 'pinned-camera', role: 'pinned' },
    ])
  })

  it('deduplicates popup roles so one camera is never rendered twice', () => {
    const state = createMapPopupState({
      focusCameraId: 'camera-1',
      previewCameraId: 'camera-1',
      pinnedCameraIds: ['camera-1', 'camera-2'],
    })

    expect(getVisiblePopupDescriptors(state)).toEqual([
      { cameraId: 'camera-1', role: 'focus' },
      { cameraId: 'camera-2', role: 'pinned' },
    ])
  })

  it('caps pinned popups and clears preview state when that camera becomes pinned', () => {
    let state = createMapPopupState({ maxPinnedPopups: 2 })
    state = setPreviewPopup(state, 'camera-1')
    state = togglePinnedPopup(state, 'camera-1')
    state = togglePinnedPopup(state, 'camera-2')
    state = togglePinnedPopup(state, 'camera-3')

    expect(state.previewCameraId).toBeNull()
    expect(state.pinnedCameraIds).toEqual(['camera-2', 'camera-3'])
  })

  it('drops preview when the same camera becomes the focused popup', () => {
    const state = setFocusedPopup(setPreviewPopup(createMapPopupState(), 'camera-1'), 'camera-1')
    expect(state.previewCameraId).toBeNull()
  })
})