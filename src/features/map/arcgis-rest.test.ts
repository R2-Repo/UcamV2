import { describe, expect, it } from 'vitest'
import {
  buildArcGisQueryUrl,
  getDefaultArcGisLayerMinZoom,
  getArcGisLabelLayerId,
  getArcGisLayerColor,
  normalizeArcGisLayerUrl,
} from './arcgis-rest'

describe('normalizeArcGisLayerUrl', () => {
  it('keeps a valid ArcGIS layer URL and strips search and hash state', () => {
    expect(
      normalizeArcGisLayerUrl(
        'https://example.com/server/rest/services/Foo/MapServer/3/?f=json#section',
      ),
    ).toBe('https://example.com/server/rest/services/Foo/MapServer/3')
  })

  it('rejects service root URLs that do not include a layer id', () => {
    expect(normalizeArcGisLayerUrl('https://example.com/server/rest/services/Foo/MapServer')).toBeNull()
  })
})

describe('buildArcGisQueryUrl', () => {
  it('builds a bbox query against the layer query endpoint', () => {
    const queryUrl = new URL(
      buildArcGisQueryUrl('https://example.com/server/rest/services/Foo/FeatureServer/0', {
        west: -112.2,
        south: 40.4,
        east: -111.8,
        north: 40.9,
      }),
    )

    expect(queryUrl.pathname).toBe('/server/rest/services/Foo/FeatureServer/0/query')
    expect(queryUrl.searchParams.get('f')).toBe('geojson')
    expect(queryUrl.searchParams.get('geometry')).toBe('-112.2,40.4,-111.8,40.9')
    expect(queryUrl.searchParams.get('geometryType')).toBe('esriGeometryEnvelope')
    expect(queryUrl.searchParams.get('spatialRel')).toBe('esriSpatialRelIntersects')
  })
})

describe('getDefaultArcGisLayerMinZoom', () => {
  it('defaults point and line layers to city-scale loading and polygons to a tighter gate', () => {
    expect(getDefaultArcGisLayerMinZoom('esriGeometryPoint')).toBe(9)
    expect(getDefaultArcGisLayerMinZoom('esriGeometryPolyline')).toBe(9)
    expect(getDefaultArcGisLayerMinZoom('esriGeometryPolygon')).toBe(10)
  })
})

describe('ArcGIS layer ids and colors', () => {
  it('derives a stable label layer id for a configured layer', () => {
    expect(getArcGisLabelLayerId('arcgis-123abc')).toBe('arcgis-label-arcgis-123abc')
  })

  it('derives a repeatable color for a configured layer', () => {
    expect(getArcGisLayerColor('arcgis-123abc')).toBe(getArcGisLayerColor('arcgis-123abc'))
  })
})