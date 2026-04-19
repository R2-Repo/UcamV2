export type ViewMode = 'gallery' | 'map'

export type SelectionSource = 'gallery' | 'map' | 'url' | null

export interface CameraRouteRef {
  routeKey: string
  milepost: number | null
}

export interface CameraSummary {
  id: string
  source: string
  sourceId: string
  location: string
  latitude: number
  longitude: number
  imageUrl: string
  region: string
  county: string | null
  city: string | null
  direction: string | null
  maintenanceStations: string[]
  routeRefs: CameraRouteRef[]
  status: string
  sortOrder: number
  classification: string | null
  poeFailure: boolean
  timestampIsStale: boolean
  searchText: string
}

export interface CameraDetailRoute {
  routeCode: string | null
  altNameA: string | null
  altNameB: string | null
  altNameC: string | null
  logicalMilepost: number | null
  physicalMilepost: number | null
}

export interface CameraDetailNeighbor {
  cameraId: string | null
  name: string | null
  imageUrl: string | null
}

export interface CameraDetailEmbeds {
  googleMapsUrl: string
  arcgisUrl: string
  streetViewUrl: string | null
}

export interface CameraDetailLocation {
  city: string | null
  county: string | null
  region: string
}

export interface CameraDetailQuality {
  classification: string | null
  poeFailure: boolean
  timestampIsStale: boolean
}

export interface CameraDetails {
  id: string
  description: string | null
  latitude: number
  longitude: number
  location: CameraDetailLocation
  embeds: CameraDetailEmbeds
  routes: {
    primary: CameraDetailRoute
    secondary: CameraDetailRoute
  }
  neighbors: {
    previous: CameraDetailNeighbor
    next: CameraDetailNeighbor
  }
  quality: CameraDetailQuality
}

export interface RouteSegment {
  routeKey: string
  mpMin: number | null
  mpMax: number | null
  sortOrder: 'asc' | 'desc'
}

export interface CuratedRoute {
  id: string
  displayName: string
  segments: RouteSegment[]
}

export interface FilterState {
  searchQuery: string
  region: string
  county: string
  city: string
  maintenance: string
  routeId: string
  issueFilter: string
}

export interface FilterOptions {
  regions: string[]
  counties: string[]
  cities: string[]
  maintenanceStations: string[]
  routes: CuratedRoute[]
}

export interface UrlState {
  viewMode?: ViewMode
  selectedCameraId?: string | null
  filters?: Partial<FilterState>
}