import { create } from 'zustand'
import type { FilterState, SelectionSource, UrlState, ViewMode } from '../../shared/types'

export const defaultFilters: FilterState = {
  searchQuery: '',
  region: '',
  county: '',
  city: '',
  maintenance: '',
  routeId: '',
}

interface AppStore {
  filters: FilterState
  viewMode: ViewMode
  selectedCameraId: string | null
  selectionSource: SelectionSource
  setFilter: (key: keyof FilterState, value: string) => void
  resetFilters: () => void
  setViewMode: (viewMode: ViewMode) => void
  setSelectedCamera: (selectedCameraId: string | null, selectionSource: SelectionSource) => void
  hydrateFromUrl: (urlState: UrlState) => void
}

export const useAppStore = create<AppStore>((set) => ({
  filters: { ...defaultFilters },
  viewMode: 'gallery',
  selectedCameraId: null,
  selectionSource: null,
  setFilter: (key, value) =>
    set((state) => ({
      filters: {
        ...state.filters,
        [key]: value,
      },
    })),
  resetFilters: () =>
    set({
      filters: { ...defaultFilters },
      selectedCameraId: null,
      selectionSource: null,
    }),
  setViewMode: (viewMode) => set({ viewMode }),
  setSelectedCamera: (selectedCameraId, selectionSource) =>
    set({
      selectedCameraId,
      selectionSource,
    }),
  hydrateFromUrl: (urlState) =>
    set((state) => ({
      viewMode: urlState.viewMode ?? state.viewMode,
      selectedCameraId:
        urlState.selectedCameraId === undefined ? state.selectedCameraId : urlState.selectedCameraId,
      selectionSource: urlState.selectedCameraId === undefined ? state.selectionSource : 'url',
      filters: {
        ...state.filters,
        ...urlState.filters,
      },
    })),
}))