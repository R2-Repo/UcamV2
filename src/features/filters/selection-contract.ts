import type { SelectionSource, ViewMode } from '../../shared/types'

export function resolveValidSelectedCameraId({
  availableCameraIds,
  filteredCameraIds,
  selectedCameraId,
}: {
  availableCameraIds: ReadonlySet<string>
  filteredCameraIds: ReadonlySet<string>
  selectedCameraId: string | null
}) {
  if (!selectedCameraId) {
    return null
  }

  if (!availableCameraIds.has(selectedCameraId)) {
    return null
  }

  if (!filteredCameraIds.has(selectedCameraId)) {
    return null
  }

  return selectedCameraId
}

export function shouldPersistSelectedCamera({
  isModalOpen,
  selectedCameraId,
  viewMode,
}: {
  isModalOpen: boolean
  selectedCameraId: string | null
  viewMode: ViewMode
}) {
  return Boolean(selectedCameraId) && (viewMode === 'map' || isModalOpen)
}

export function shouldOpenGalleryModalFromSelection({
  selectedCameraId,
  selectionSource,
  viewMode,
}: {
  selectedCameraId: string | null
  selectionSource: SelectionSource
  viewMode: ViewMode
}) {
  return viewMode === 'gallery' && Boolean(selectedCameraId) && selectionSource === 'url'
}

export function shouldClearSelectionForViewModeChange(currentViewMode: ViewMode, nextViewMode: ViewMode) {
  return currentViewMode === 'map' && nextViewMode === 'gallery'
}