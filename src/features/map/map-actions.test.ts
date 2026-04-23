import { describe, expect, it } from 'vitest'
import {
  buildGoogleEarthWebUrl,
  buildGoogleMapsUrl,
  buildGoogleStreetViewUrl,
  formatCoordinatePair,
  formatDistanceSummary,
  getPathDistanceMeters,
  type MapCoordinate,
} from './map-actions'

const sampleCoordinate: MapCoordinate = {
  latitude: 40.1234567,
  longitude: -111.6543214,
}

describe('map action helpers', () => {
  it('formats coordinate pairs with stable precision', () => {
    expect(formatCoordinatePair(sampleCoordinate)).toBe('40.123457, -111.654321')
  })

  it('builds a Google Maps URL for a clicked coordinate', () => {
    expect(buildGoogleMapsUrl(sampleCoordinate)).toBe('https://www.google.com/maps?q=40.123457,-111.654321')
  })

  it('builds a Google Street View URL for a clicked coordinate', () => {
    expect(buildGoogleStreetViewUrl(sampleCoordinate)).toBe(
      'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=40.123457%2C-111.654321',
    )
  })

  it('builds a Google Earth Web URL for a clicked coordinate', () => {
    expect(buildGoogleEarthWebUrl(sampleCoordinate)).toBe(
      'https://earth.google.com/web/@40.123457,-111.654321,1500a,12000d,35y,0h,45t,0r',
    )
  })

  it('measures a multi-segment path', () => {
    const measuredDistance = getPathDistanceMeters([
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: 1 },
      { latitude: 1, longitude: 1 },
    ])

    expect(measuredDistance).toBeGreaterThan(222000)
    expect(measuredDistance).toBeLessThan(223000)
  })

  it('formats short distances in feet by default', () => {
    expect(formatDistanceSummary(100)).toBe('328 ft')
  })

  it('formats long distances in miles by default', () => {
    expect(formatDistanceSummary(3218.688)).toBe('2.00 mi')
  })
})