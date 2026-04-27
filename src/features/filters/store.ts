import { create } from 'zustand'
import type { FilterState, SelectionSource, UrlState, ViewMode } from '../../shared/types'

export const defaultFilters: FilterState = {
  searchQuery: '',
  region: '',
  county: '',
  city: '',
  maintenance: '',
  routeId: '',
  customRouteSegments: [],
}

interface AppStore {
  filters: FilterState
  viewMode: ViewMode
  selectedCameraId: string | null
  selectionSource: SelectionSource
  setFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void
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
    set((state) => {
      const nextFilters = {
        ...state.filters,
        [key]: value,
      } as FilterState

      if (key === 'routeId' && typeof value === 'string' && value) {
        nextFilters.customRouteSegments = []
      }

      if (key === 'customRouteSegments' && Array.isArray(value) && value.length) {
        nextFilters.routeId = ''
      }

      return {
        filters: nextFilters,
      }
    }),
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
      selectionSource: selectedCameraId ? selectionSource : null,
    }),
  hydrateFromUrl: (urlState) =>
    set((state) => ({
      viewMode: urlState.viewMode ?? state.viewMode,
      selectedCameraId:
        urlState.selectedCameraId === undefined ? state.selectedCameraId : urlState.selectedCameraId,
      selectionSource:
        urlState.selectedCameraId === undefined
          ? state.selectionSource
          : urlState.selectedCameraId
            ? 'url'
            : null,
      filters: {
        ...state.filters,
        ...urlState.filters,
      },
    })),
}))