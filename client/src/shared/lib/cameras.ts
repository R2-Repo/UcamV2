import type { CameraSummary } from '../types'

export function buildRefreshedImageUrl(imageUrl: string, refreshToken: number) {
  const separator = imageUrl.includes('?') ? '&' : '?'
  return `${imageUrl}${separator}refresh=${refreshToken}`
}

export function getCameraSubtitle(camera: CameraSummary) {
  const parts = [camera.city ?? camera.county ?? 'Utah camera', camera.direction ?? null]
  return parts.filter(Boolean).join(' · ')
}