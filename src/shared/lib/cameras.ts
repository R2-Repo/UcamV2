import type { CameraSummary } from '../types'

export const IMAGE_REFRESH_INTERVAL_MS = 210000

export function buildRefreshedImageUrl(imageUrl: string, refreshToken: number) {
  const separator = imageUrl.includes('?') ? '&' : '?'
  return `${imageUrl}${separator}refresh=${refreshToken}`
}

export function resolveCameraImageUrl(imageUrl: string, refreshToken?: number | null) {
  return refreshToken ? buildRefreshedImageUrl(imageUrl, refreshToken) : imageUrl
}

export function getCameraSubtitle(camera: CameraSummary) {
  const parts = [camera.city ?? camera.county ?? 'Utah camera', camera.direction ?? null]
  return parts.filter(Boolean).join(' · ')
}