export type MapPopupRole = 'focus' | 'preview' | 'pinned'

export interface MapPopupDescriptor {
  cameraId: string
  role: MapPopupRole
}

export interface MapPopupState {
  focusCameraId: string | null
  previewCameraId: string | null
  pinnedCameraIds: string[]
  maxPinnedPopups: number
}

export function createMapPopupState(overrides: Partial<MapPopupState> = {}): MapPopupState {
  return {
    focusCameraId: null,
    previewCameraId: null,
    pinnedCameraIds: [],
    maxPinnedPopups: 4,
    ...overrides,
  }
}

export function setFocusedPopup(state: MapPopupState, cameraId: string | null): MapPopupState {
  return {
    ...state,
    focusCameraId: cameraId,
    previewCameraId: state.previewCameraId === cameraId ? null : state.previewCameraId,
  }
}

export function setPreviewPopup(state: MapPopupState, cameraId: string | null): MapPopupState {
  return {
    ...state,
    previewCameraId: cameraId === state.focusCameraId ? null : cameraId,
  }
}

export function togglePinnedPopup(state: MapPopupState, cameraId: string): MapPopupState {
  const nextPinnedCameraIds = state.pinnedCameraIds.includes(cameraId)
    ? state.pinnedCameraIds.filter((pinnedCameraId) => pinnedCameraId !== cameraId)
    : [...state.pinnedCameraIds, cameraId].slice(-state.maxPinnedPopups)

  return {
    ...state,
    pinnedCameraIds: nextPinnedCameraIds,
    previewCameraId: state.previewCameraId === cameraId ? null : state.previewCameraId,
  }
}

export function getVisiblePopupDescriptors(state: MapPopupState): MapPopupDescriptor[] {
  const descriptors: MapPopupDescriptor[] = []
  const seenCameraIds = new Set<string>()

  if (state.focusCameraId) {
    descriptors.push({ cameraId: state.focusCameraId, role: 'focus' })
    seenCameraIds.add(state.focusCameraId)
  }

  if (state.previewCameraId && !seenCameraIds.has(state.previewCameraId)) {
    descriptors.push({ cameraId: state.previewCameraId, role: 'preview' })
    seenCameraIds.add(state.previewCameraId)
  }

  state.pinnedCameraIds.forEach((cameraId) => {
    if (seenCameraIds.has(cameraId)) {
      return
    }

    descriptors.push({ cameraId, role: 'pinned' })
    seenCameraIds.add(cameraId)
  })

  return descriptors
}