import { describe, expect, it } from 'vitest'
import { getRouterBasePath, normalizeBasePath, resolveBaseAssetPath } from './basePath'

describe('base path helpers', () => {
  it('normalizes missing and nested base paths for static hosting', () => {
    expect(normalizeBasePath()).toBe('/')
    expect(normalizeBasePath('/')).toBe('/')
    expect(normalizeBasePath('demo-repo')).toBe('/demo-repo/')
    expect(normalizeBasePath('/demo-repo')).toBe('/demo-repo/')
    expect(normalizeBasePath('/demo-repo/')).toBe('/demo-repo/')
  })

  it('returns a router basename without a trailing slash for nested deployments', () => {
    expect(getRouterBasePath('/')).toBe('/')
    expect(getRouterBasePath('/demo-repo/')).toBe('/demo-repo')
  })

  it('resolves bundled asset paths against the current base url', () => {
    expect(resolveBaseAssetPath('data/cameras.summary.json', '/')).toBe('/data/cameras.summary.json')
    expect(resolveBaseAssetPath('/map-glyphs/font.pbf', '/demo-repo/')).toBe('/demo-repo/map-glyphs/font.pbf')
  })
})
