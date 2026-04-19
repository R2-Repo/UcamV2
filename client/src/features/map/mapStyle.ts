import type { StyleSpecification } from 'maplibre-gl'

export const DEFAULT_MAP_STYLE: StyleSpecification = {
  version: 8,
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