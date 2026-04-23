import type {
  HillshadeLayerSpecification,
  RasterDEMSourceSpecification,
  StyleSpecification,
  TerrainSpecification,
} from 'maplibre-gl'

export type MapDimensionMode = '2d' | '3d'

export const DEFAULT_MAP_DIMENSION_MODE: MapDimensionMode = '2d'
export const MAP_3D_PITCH = 58
export const MAP_TERRAIN_SOURCE_ID = 'terrain-dem'
export const MAP_HILLSHADE_SOURCE_ID = 'terrain-dem-hillshade'
export const MAP_HILLSHADE_LAYER_ID = 'terrain-hillshade'

export const MAP_TERRAIN_SOURCE: RasterDEMSourceSpecification = {
  type: 'raster-dem',
  tiles: ['https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png'],
  tileSize: 256,
  encoding: 'terrarium',
  maxzoom: 15,
  attribution: 'Terrain © Mapzen, AWS',
}

export const MAP_HILLSHADE_SOURCE: RasterDEMSourceSpecification = {
  type: 'raster-dem',
  tiles: ['https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png'],
  tileSize: 256,
  encoding: 'terrarium',
  maxzoom: 15,
  attribution: 'Terrain © Mapzen, AWS',
}

export const MAP_TERRAIN_SPEC: TerrainSpecification = {
  source: MAP_TERRAIN_SOURCE_ID,
  exaggeration: 1.28,
}

export const MAP_HILLSHADE_LAYER: HillshadeLayerSpecification = {
  id: MAP_HILLSHADE_LAYER_ID,
  type: 'hillshade',
  source: MAP_HILLSHADE_SOURCE_ID,
  paint: {
    'hillshade-method': 'multidirectional',
    'hillshade-illumination-anchor': 'map',
    'hillshade-exaggeration': 0.42,
    'hillshade-shadow-color': 'rgba(10, 17, 20, 0.48)',
    'hillshade-highlight-color': 'rgba(255, 247, 228, 0.36)',
    'hillshade-accent-color': 'rgba(201, 126, 34, 0.18)',
  },
}

export function getNextMapDimensionMode(mode: MapDimensionMode): MapDimensionMode {
  return mode === '3d' ? '2d' : '3d'
}

export function getMapDimensionToggleCopy(mode: MapDimensionMode) {
  if (mode === '3d') {
    return {
      buttonLabel: '2D Mode',
      buttonTitle: 'Switch to the 2D overhead map',
      contextMenuLabel: 'Switch To 2D Overhead',
      contextMenuMeta: 'Flatten terrain and return to the overhead view',
    }
  }

  return {
    buttonLabel: '3D Mode',
    buttonTitle: 'Switch to the 3D terrain map',
    contextMenuLabel: 'Switch To 3D Terrain',
    contextMenuMeta: 'Enable elevation and hillshading for a pitched view',
  }
}

export const DEFAULT_MAP_STYLE: StyleSpecification = {
  version: 8,
  glyphs: '/map-glyphs/{fontstack}/{range}.pbf',
  sources: {
    esriImagery: {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      attribution: 'Tiles © Esri',
    },
    esriReference: {
      type: 'raster',
      tiles: [
        'https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      attribution: 'Reference © Esri',
    },
  },
  layers: [
    {
      id: 'esri-imagery-layer',
      type: 'raster',
      source: 'esriImagery',
    },
    {
      id: 'esri-reference-layer',
      type: 'raster',
      source: 'esriReference',
      paint: {
        'raster-opacity': 0.9,
      },
    },
  ],
}

export const UTAH_VIEW = {
  center: [-111.9, 39.35] as [number, number],
  zoom: 5.4,
}