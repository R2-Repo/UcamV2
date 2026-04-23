export interface MapCoordinate {
  latitude: number
  longitude: number
}

const COORDINATE_DECIMALS = 6
const EARTH_RADIUS_METERS = 6_371_008.8
const FEET_PER_METER = 3.28083989501312
const METERS_PER_MILE = 1609.344
const FEET_PER_MILE = 5280

function toRadians(value: number) {
  return (value * Math.PI) / 180
}

function getSegmentDistanceMeters(start: MapCoordinate, end: MapCoordinate) {
  const startLatitude = toRadians(start.latitude)
  const endLatitude = toRadians(end.latitude)
  const latitudeDelta = toRadians(end.latitude - start.latitude)
  const longitudeDelta = toRadians(end.longitude - start.longitude)
  const haversineA =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2

  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(haversineA), Math.sqrt(1 - haversineA))
}

export function formatCoordinatePair(coordinate: MapCoordinate, separator = ', ') {
  return `${coordinate.latitude.toFixed(COORDINATE_DECIMALS)}${separator}${coordinate.longitude.toFixed(
    COORDINATE_DECIMALS,
  )}`
}

export function buildGoogleMapsUrl(coordinate: MapCoordinate) {
  return `https://www.google.com/maps?q=${formatCoordinatePair(coordinate, ',')}`
}

export function buildGoogleStreetViewUrl(coordinate: MapCoordinate) {
  const url = new URL('https://www.google.com/maps/@')

  url.searchParams.set('api', '1')
  url.searchParams.set('map_action', 'pano')
  url.searchParams.set('viewpoint', formatCoordinatePair(coordinate, ','))

  return url.toString()
}

export function buildGoogleEarthWebUrl(coordinate: MapCoordinate) {
  return `https://earth.google.com/web/@${coordinate.latitude.toFixed(COORDINATE_DECIMALS)},${coordinate.longitude.toFixed(COORDINATE_DECIMALS)},1500a,12000d,35y,0h,45t,0r`
}

export function getPathDistanceMeters(points: MapCoordinate[]) {
  if (points.length < 2) {
    return 0
  }

  return points.slice(1).reduce((totalDistance, point, index) => {
    return totalDistance + getSegmentDistanceMeters(points[index], point)
  }, 0)
}

export function formatDistanceSummary(distanceMeters: number) {
  if (distanceMeters < 0.3048) {
    return '0 ft'
  }

  const distanceFeet = distanceMeters * FEET_PER_METER

  if (distanceFeet < FEET_PER_MILE) {
    return `${distanceFeet.toFixed(0)} ft`
  }

  const miles = distanceMeters / METERS_PER_MILE

  return `${miles.toFixed(miles >= 10 ? 1 : 2)} mi`
}