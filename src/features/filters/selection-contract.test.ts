import { describe, expect, it } from 'vitest'
import {
  resolveValidSelectedCameraId,
  shouldClearSelectionForViewModeChange,
  shouldOpenGalleryModalFromSelection,
  shouldPersistSelectedCamera,
} from './selection-contract'

describe('selection contract', () => {
  it('keeps a selection only while the camera still exists in the filtered set', () => {
    const availableCameraIds = new Set(['a', 'b', 'c'])
    const filteredCameraIds = new Set(['a', 'c'])

    expect(
      resolveValidSelectedCameraId({
        availableCameraIds,
        filteredCameraIds,
        selectedCameraId: 'a',
      }),
    ).toBe('a')

    expect(
      resolveValidSelectedCameraId({
        availableCameraIds,
        filteredCameraIds,
        selectedCameraId: 'b',
      }),
    ).toBeNull()

    expect(
      resolveValidSelectedCameraId({
        availableCameraIds,
        filteredCameraIds,
        selectedCameraId: 'missing',
      }),
    ).toBeNull()
  })

  it('persists camera selection only while the selection is visible in the current UI', () => {
    expect(
      shouldPersistSelectedCamera({
        isModalOpen: false,
        selectedCameraId: 'camera-1',
        viewMode: 'gallery',
      }),
    ).toBe(false)

    expect(
      shouldPersistSelectedCamera({
        isModalOpen: true,
        selectedCameraId: 'camera-1',
        viewMode: 'gallery',
      }),
    ).toBe(true)

    expect(
      shouldPersistSelectedCamera({
        isModalOpen: false,
        selectedCameraId: 'camera-1',
        viewMode: 'map',
      }),
    ).toBe(true)
  })

  it('opens a gallery modal only for URL-driven gallery selections', () => {
    expect(
      shouldOpenGalleryModalFromSelection({
        selectedCameraId: 'camera-1',
        selectionSource: 'url',
        viewMode: 'gallery',
      }),
    ).toBe(true)

    expect(
      shouldOpenGalleryModalFromSelection({
        selectedCameraId: 'camera-1',
        selectionSource: 'gallery',
        viewMode: 'gallery',
      }),
    ).toBe(false)

    expect(
      shouldOpenGalleryModalFromSelection({
        selectedCameraId: 'camera-1',
        selectionSource: 'url',
        viewMode: 'map',
      }),
    ).toBe(false)
  })

  it('clears map selection when returning to the gallery shell', () => {
    expect(shouldClearSelectionForViewModeChange('map', 'gallery')).toBe(true)
    expect(shouldClearSelectionForViewModeChange('gallery', 'map')).toBe(false)
  })
})