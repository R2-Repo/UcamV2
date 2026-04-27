import type { FilterState } from '../../shared/types'

export function hasActiveGalleryFilters(filters: FilterState) {
  return Object.values(filters).some((value) => value.trim().length > 0)
}
