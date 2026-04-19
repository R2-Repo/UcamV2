import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const clientRoot = path.resolve(__dirname, '..')
const repoRoot = path.resolve(clientRoot, '..')
const sourceGeoJsonPath = path.resolve(repoRoot, 'cctv_locations_processed_classified.geojson')
const sourceRoutesPath = path.resolve(repoRoot, 'routes.json')
const outputDir = path.resolve(clientRoot, 'public', 'data')

function asNull(value) {
  if (value === undefined || value === null) {
    return null
  }

  if (typeof value === 'string') {
    const normalized = value.trim()

    if (!normalized || normalized.toUpperCase() === 'NULL') {
      return null
    }

    return normalized
  }

  return value
}

function parseNumber(value) {
  const nextValue = asNull(value)

  if (nextValue === null) {
    return null
  }

  const parsed = Number(nextValue)
  return Number.isFinite(parsed) ? parsed : null
}

function parseMilepost(value) {
  return parseNumber(value)
}

function normalizeRouteKey(routeName) {
  const nextValue = asNull(routeName)

  if (!nextValue) {
    return null
  }

  return String(nextValue)
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/^0+/, '')
    .replace(/[PN]$/, 'P')
}

function extractRegionNumber(regionText) {
  const normalized = asNull(regionText)

  if (!normalized) {
    return '1'
  }

  const regionMap = {
    one: '1',
    two: '2',
    three: '3',
    four: '4',
    '1': '1',
    '2': '2',
    '3': '3',
    '4': '4',
  }

  const match = String(normalized).toLowerCase().match(/(one|two|three|four|\d)/)
  return match ? regionMap[match[1]] ?? '1' : '1'
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean))]
}

function uniqueRouteRefs(routeRefs) {
  return [...new Map(routeRefs.map((routeRef) => [`${routeRef.routeKey}:${routeRef.milepost ?? 'null'}`, routeRef])).values()]
}

function slugify(value, index) {
  return `${String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')}-${index + 1}`
}

function buildRouteRef(routeName, milepost) {
  const routeKey = normalizeRouteKey(routeName)

  if (!routeKey) {
    return null
  }

  return {
    routeKey,
    milepost: parseMilepost(milepost),
  }
}

function buildDetailRoute({
  routeCode,
  altNameA,
  altNameB,
  altNameC,
  logicalMilepost,
  physicalMilepost,
}) {
  return {
    routeCode: asNull(routeCode),
    altNameA: asNull(altNameA),
    altNameB: asNull(altNameB),
    altNameC: asNull(altNameC),
    logicalMilepost: parseMilepost(logicalMilepost),
    physicalMilepost: parseMilepost(physicalMilepost),
  }
}

function buildNeighborRef(name, imageUrl) {
  return {
    cameraId: null,
    name: asNull(name),
    imageUrl: asNull(imageUrl),
  }
}

function getUrlKey(value) {
  const normalized = asNull(value)
  return normalized ? String(normalized).trim() : null
}

function buildSearchText(parts) {
  return parts
    .flatMap((part) => (Array.isArray(part) ? part : [part]))
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

async function main() {
  const geoJson = JSON.parse(await fs.readFile(sourceGeoJsonPath, 'utf8'))
  const rawRoutes = JSON.parse(await fs.readFile(sourceRoutesPath, 'utf8'))

  const summary = []
  const details = []

  for (const feature of geoJson.features ?? []) {
    const props = feature.properties ?? {}
    const coords = feature.geometry?.coordinates ?? []
    const latitude = parseNumber(props.latitude ?? props.Latitude ?? coords[1])
    const longitude = parseNumber(props.longitude ?? props.Longitude ?? coords[0])
    const imageUrl = asNull(props.ImageUrl ?? props.ImageURL ?? props.Url)

    if (!imageUrl || latitude === null || longitude === null) {
      continue
    }

    const id = String(props.Id ?? props.ID ?? summary.length + 1)
    const location = asNull(props.name ?? props.Location) ?? `Camera ${id}`
    const primaryRouteCode = asNull(
      props.DOT_RTNAME_1 ?? props.ROUTE_1 ?? props.Route1 ?? props.RoadwayOption1 ?? props.Roadway,
    )
    const secondaryRouteCode = asNull(
      props.DOT_RTNAME_2 ?? props.ROUTE_2 ?? props.Route2 ?? props.RoadwayOption2,
    )
    const routeRefs = uniqueRouteRefs(
      [
        buildRouteRef(
          primaryRouteCode,
          props.MP_LM_1 ?? props.MilepostOption1,
        ),
        buildRouteRef(
          secondaryRouteCode,
          props.MP_LM_2 ?? props.MilepostOption2,
        ),
      ].filter(Boolean),
    )

    const maintenanceStations = uniqueStrings([
      asNull(props.Maintenance_Station),
      asNull(props.Maintenance_Station_2),
    ]).filter((station) => station.toLowerCase() !== 'not available')

    const altNames = uniqueStrings([
      asNull(props.ALT_NAME_1A),
      asNull(props.ALT_NAME_1B),
      asNull(props.ALT_NAME_1C),
      asNull(props.ALT_NAME_2A),
      asNull(props.ALT_NAME_2B),
      asNull(props.ALT_NAME_2C),
    ])

    const region = extractRegionNumber(props.UDOT_Region)
    const county = asNull(props.County)
    const city = asNull(props.City)
    const direction = asNull(props.Direction ?? props.Side_Of_Road_1)
    const sourceId = String(asNull(props.SourceId) ?? id)
    const status = asNull(props.Status) ?? 'Enabled'
    const classification = asNull(props.classification)
    const poeFailure = props.poe_failure === true
    const timestampIsStale = props.timestamp_is_stale === true
    const description = asNull(props.Description)
    const googleMapsUrl =
      asNull(props.GoogleMaps_Embed) ??
      `https://www.google.com/maps?q=${latitude},${longitude}`

    summary.push({
      id,
      source: asNull(props.Source) ?? 'UDOT',
      sourceId,
      location,
      latitude,
      longitude,
      imageUrl,
      region,
      county,
      city,
      direction,
      maintenanceStations,
      routeRefs,
      status,
      sortOrder: parseNumber(props.SortOrder) ?? 0,
      classification,
      poeFailure,
      timestampIsStale,
      searchText: buildSearchText([
        id,
        sourceId,
        location,
        county,
        city,
        region,
        direction,
        maintenanceStations,
        altNames,
        routeRefs.map((routeRef) => routeRef.routeKey),
      ]),
    })

    details.push({
      id,
      description,
      latitude,
      longitude,
      location: {
        city,
        county,
        region,
      },
      embeds: {
        googleMapsUrl,
        arcgisUrl: `https://uplan.maps.arcgis.com/apps/webappviewer/index.html?id=07c3dc8429ca42c4b4066e383631681f&find=${latitude},${longitude}`,
        streetViewUrl: asNull(props.StreetView_Embed),
      },
      routes: {
        primary: buildDetailRoute({
          routeCode: primaryRouteCode,
          altNameA: props.ALT_NAME_1A,
          altNameB: props.ALT_NAME_1B,
          altNameC: props.ALT_NAME_1C,
          logicalMilepost: props.MP_LM_1 ?? props.MilepostOption1,
          physicalMilepost: props.MP_PHYS_1,
        }),
        secondary: buildDetailRoute({
          routeCode: secondaryRouteCode,
          altNameA: props.ALT_NAME_2A,
          altNameB: props.ALT_NAME_2B,
          altNameC: props.ALT_NAME_2C,
          logicalMilepost: props.MP_LM_2 ?? props.MilepostOption2,
          physicalMilepost: props.MP_PHYS_2,
        }),
      },
      neighbors: {
        previous: buildNeighborRef(
          props.ROUTE_1_NEG_NEIGHBOR_NAME,
          props.ROUTE_1_NEG_NEIGHBOR_IMAGE_URL,
        ),
        next: buildNeighborRef(
          props.ROUTE_1_POS_NEIGHBOR_NAME,
          props.ROUTE_1_POS_NEIGHBOR_IMAGE_URL,
        ),
      },
      quality: {
        classification,
        poeFailure,
        timestampIsStale,
      },
    })
  }

  const cameraIdByImageUrl = new Map()
  summary.forEach((camera) => {
    const key = getUrlKey(camera.imageUrl)

    if (key) {
      cameraIdByImageUrl.set(key, camera.id)
    }
  })

  const modalDetails = details.map((detail) => ({
    ...detail,
    neighbors: {
      previous: {
        ...detail.neighbors.previous,
        cameraId: detail.neighbors.previous.imageUrl
          ? cameraIdByImageUrl.get(getUrlKey(detail.neighbors.previous.imageUrl)) ?? null
          : null,
      },
      next: {
        ...detail.neighbors.next,
        cameraId: detail.neighbors.next.imageUrl
          ? cameraIdByImageUrl.get(getUrlKey(detail.neighbors.next.imageUrl)) ?? null
          : null,
      },
    },
  }))

  const routes = rawRoutes.map((route, index) => {
    const displayName = route.displayName ?? route.name ?? `Route ${index + 1}`
    const sourceSegments = Array.isArray(route.routes) ? route.routes : [route]

    return {
      id: slugify(displayName, index),
      displayName,
      segments: sourceSegments
        .map((segment) => {
          const routeKey = normalizeRouteKey(segment.name)

          if (!routeKey) {
            return null
          }

          return {
            routeKey,
            mpMin: parseMilepost(segment.mpMin),
            mpMax: parseMilepost(segment.mpMax),
            sortOrder: segment.sortOrder === 'desc' ? 'desc' : 'asc',
          }
        })
        .filter(Boolean),
    }
  })

  await fs.mkdir(outputDir, { recursive: true })
  await Promise.all([
    fs.writeFile(path.join(outputDir, 'cameras.summary.json'), JSON.stringify(summary)),
    fs.writeFile(path.join(outputDir, 'cameras.details.json'), JSON.stringify(modalDetails)),
    fs.writeFile(path.join(outputDir, 'routes.processed.json'), JSON.stringify(routes)),
    fs.writeFile(
      path.join(outputDir, 'build-meta.json'),
      JSON.stringify({
        generatedAt: new Date().toISOString(),
        cameraCount: summary.length,
        routeCount: routes.length,
      }),
    ),
  ])

  console.log(`Generated ${summary.length} cameras and ${routes.length} routes into ${outputDir}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})