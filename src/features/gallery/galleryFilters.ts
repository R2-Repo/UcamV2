import type { FilterState } from '../../shared/types'

export function hasActiveGalleryFilters(filters: FilterState) {
  return Object.values(filters).some((value) =>
    typeof value === 'string' ? value.trim().length > 0 : value.length > 0,
  )
}
