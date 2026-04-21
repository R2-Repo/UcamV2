import { describe, expect, it } from 'vitest'
import { buildRefreshedImageUrl, resolveCameraImageUrl } from './cameras'

describe('camera image urls', () => {
  it('adds a refresh token to plain image urls', () => {
    expect(buildRefreshedImageUrl('https://example.com/camera.jpg', 123)).toBe(
      'https://example.com/camera.jpg?refresh=123',
    )
  })

  it('appends a refresh token to image urls with an existing query string', () => {
    expect(buildRefreshedImageUrl('https://example.com/camera.jpg?size=large', 123)).toBe(
      'https://example.com/camera.jpg?size=large&refresh=123',
    )
  })

  it('keeps the raw image url when no refresh token is active', () => {
    expect(resolveCameraImageUrl('https://example.com/camera.jpg')).toBe(
      'https://example.com/camera.jpg',
    )
  })

  it('uses the refreshed image url when a refresh token is present', () => {
    expect(resolveCameraImageUrl('https://example.com/camera.jpg', 123)).toBe(
      'https://example.com/camera.jpg?refresh=123',
    )
  })
})