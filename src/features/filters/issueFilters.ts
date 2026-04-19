import type { CameraSummary } from '../../shared/types'

export const ISSUE_FILTER_LABELS = {
  disabled: 'Disabled Cameras',
  offline: 'Offline',
  upside_down: 'Upside Down Cameras',
  grayscale: 'Grayscale',
  old_timestamp: 'Old Timestamp',
  poe_error: 'POE Error',
  poor_road: 'Poor Road View',
} as const

export const ISSUE_FILTER_OPTIONS = Object.entries(ISSUE_FILTER_LABELS).map(([value, label]) => ({
  value,
  label,
}))

export function matchesIssueFilter(camera: CameraSummary, issueFilter: string) {
  const isDisabled = camera.status === 'Disabled'

  if (issueFilter !== 'disabled' && isDisabled) {
    return false
  }

  if (!issueFilter) {
    return true
  }

  switch (issueFilter) {
    case 'disabled':
      return isDisabled
    case 'offline':
      return camera.classification === 'offline'
    case 'upside_down':
      return camera.classification === 'upside_down'
    case 'grayscale':
      return camera.classification === 'grayscale'
    case 'old_timestamp':
      return camera.timestampIsStale && camera.classification === 'night'
    case 'poe_error':
      return camera.poeFailure
    case 'poor_road':
      return camera.classification === 'poor_road'
    default:
      return true
  }
}