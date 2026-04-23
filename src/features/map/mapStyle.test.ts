import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MAP_DIMENSION_MODE,
  MAP_HILLSHADE_LAYER,
  MAP_HILLSHADE_LAYER_ID,
  MAP_HILLSHADE_SOURCE,
  MAP_HILLSHADE_SOURCE_ID,
  MAP_TERRAIN_SOURCE,
  MAP_TERRAIN_SOURCE_ID,
  MAP_TERRAIN_SPEC,
  getMapDimensionToggleCopy,
  getNextMapDimensionMode,
} from './mapStyle'

describe('map 3d mode helpers', () => {
  it('defaults the map to 2d and flips between the two modes', () => {
    expect(DEFAULT_MAP_DIMENSION_MODE).toBe('2d')
    expect(getNextMapDimensionMode('2d')).toBe('3d')
    expect(getNextMapDimensionMode('3d')).toBe('2d')
  })

  it('returns action copy that matches the current mode', () => {
    expect(getMapDimensionToggleCopy('2d')).toEqual({
      buttonLabel: '3D Mode',
      buttonTitle: 'Switch to the 3D terrain map',
      contextMenuLabel: 'Switch To 3D Terrain',
      contextMenuMeta: 'Enable elevation and hillshading for a pitched view',
    })

    expect(getMapDimensionToggleCopy('3d')).toEqual({
      buttonLabel: '2D Mode',
      buttonTitle: 'Switch to the 2D overhead map',
      contextMenuLabel: 'Switch To 2D Overhead',
      contextMenuMeta: 'Flatten terrain and return to the overhead view',
    })
  })

  it('keeps hillshade and terrain on separate raster-dem sources', () => {
    expect(MAP_TERRAIN_SOURCE_ID).not.toBe(MAP_HILLSHADE_SOURCE_ID)
    expect(MAP_TERRAIN_SOURCE.type).toBe('raster-dem')
    expect(MAP_HILLSHADE_SOURCE.type).toBe('raster-dem')
    expect(MAP_TERRAIN_SOURCE.url).toBe(MAP_HILLSHADE_SOURCE.url)
    expect(MAP_TERRAIN_SPEC.source).toBe(MAP_TERRAIN_SOURCE_ID)
    expect(MAP_HILLSHADE_LAYER.id).toBe(MAP_HILLSHADE_LAYER_ID)
    expect(MAP_HILLSHADE_LAYER.source).toBe(MAP_HILLSHADE_SOURCE_ID)
    expect(MAP_HILLSHADE_LAYER.type).toBe('hillshade')
  })
})