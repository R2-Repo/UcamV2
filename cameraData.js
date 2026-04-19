// cameraData.js
// Module for fetching external JSON data

export async function getCamerasList() {
  try {
    const response = await fetch('cctv_locations_processed_classified.geojson');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (!data.features || !Array.isArray(data.features)) {
      throw new Error('Invalid GeoJSON format: missing features array');
    }

    console.log(`Loading ${data.features.length} cameras from GeoJSON...`);

    // Helpers to normalize incoming values (handles legacy and new schemas)
    const asNull = (v) => (v === undefined || v === null || v === 'NULL' || v === '') ? null : v;

    // Transform GeoJSON features to match existing camera structure
    const transformedCameras = data.features.map((feature, index) => {
      try {
        const props  = feature.properties || {};
        const coords = feature.geometry?.coordinates || [];

        if (coords.length < 2) {
          console.warn(`Skipping camera ${index}: missing coordinates`);
          return null;
        }

        const rawId    = props.Id ?? props.ID ?? index;
        const idString = rawId?.toString() ?? index.toString();

        const lat = parseFloat(props.latitude ?? props.Latitude ?? coords[1]);
        const lon = parseFloat(props.longitude ?? props.Longitude ?? coords[0]);

        // Route names: prefer DOT_RTNAME_* from the new schema, fall back to legacy fields
        const route1 = asNull(props.DOT_RTNAME_1 ?? props.ROUTE_1 ?? props.Route1 ?? props.RoadwayOption1 ?? props.Roadway);
        const route2 = asNull(props.DOT_RTNAME_2 ?? props.ROUTE_2 ?? props.Route2 ?? props.RoadwayOption2);

        const mile1  = parseMilepost(props.MP_LM_1 ?? props.MilepostOption1);
        const mile2  = parseMilepost(props.MP_LM_2 ?? props.MilepostOption2);

        const status = (props.Status && typeof props.Status === 'string') ? props.Status : 'Enabled';

        return {
          Id: rawId,
          Source: props.Source || 'UDOT',
          SourceId: props.SourceId || idString,
          Roadway: route1 || 'Unknown',
          RoadwayOption1: route1,
          MilepostOption1: mile1,
          RoadwayOption2: route2,
          MilepostOption2: mile2,
          MunicipalBoundary: asNull(props.City),
          CountyBoundary: asNull(props.County),
          Region: extractRegionNumber(props.UDOT_Region),
          MaintenanceStationOption1: asNull(props.Maintenance_Station),
          MaintenanceStationOption2: asNull(props.Maintenance_Station_2),
          GoogleMapsURL: asNull(props.GoogleMaps_Embed) || `https://www.google.com/maps?q=${lat},${lon}`,
          ArcGISURL: `https://uplan.maps.arcgis.com/apps/webappviewer/index.html?id=07c3dc8429ca42c4b4066e383631681f&find=${lat},${lon}`,
          Direction: asNull(props.Direction) || asNull(props.Side_Of_Road_1) || 'Unknown',
          classification: asNull(props.classification),
          poeFailure: props.poe_failure === true,
          timestampIsStale: props.timestamp_is_stale === true,
          Latitude: lat || 0,
          Longitude: lon || 0,
          Location: props.name || props.Location || `Camera ${rawId ?? index}`,
          SortOrder: props.SortOrder ?? 0,
          Views: [
            {
              Id: rawId ?? index,
              Url: props.ImageUrl || props.ImageURL || props.Url,
              Status: status,
              Description: props.Description || ''
            }
          ],
          _geoJsonMetadata: {
            routes: {
              route1Code: asNull(props.ROUTE_1),
              route2Code: asNull(props.ROUTE_2)
            },
            altNames: {
              route1A: asNull(props.ALT_NAME_1A),
              route1B: asNull(props.ALT_NAME_1B),
              route1C: asNull(props.ALT_NAME_1C),
              route2A: asNull(props.ALT_NAME_2A),
              route2B: asNull(props.ALT_NAME_2B),
              route2C: asNull(props.ALT_NAME_2C)
            },
            positioning: {
              logicalMP1: asNull(props.MP_LM_1),
              logicalMP2: asNull(props.MP_LM_2),
              physicalMP1: asNull(props.MP_PHYS_1),
              physicalMP2: asNull(props.MP_PHYS_2),
              offset1: asNull(props.Offset_1),
              offset2: asNull(props.Offset_2),
              heading1: asNull(props.Heading_1),
              heading2: asNull(props.Heading_2),
              centerlineLat1: asNull(props.Centerline_lat_1),
              centerlineLon1: asNull(props.Centerline_lon_1),
              centerlineLat2: asNull(props.Centerline_lat_2),
              centerlineLon2: asNull(props.Centerline_lon_2)
            },
            neighbors: {
              route1PosName: asNull(props.ROUTE_1_POS_NEIGHBOR_NAME),
              route1PosUrl: asNull(props.ROUTE_1_POS_NEIGHBOR_IMAGE_URL),
              route1NegName: asNull(props.ROUTE_1_NEG_NEIGHBOR_NAME),
              route1NegUrl: asNull(props.ROUTE_1_NEG_NEIGHBOR_IMAGE_URL)
            },
            embeds: {
              googleMaps: asNull(props.GoogleMaps_Embed),
              streetView: asNull(props.StreetView_Embed),
              udotTraffic: asNull(props.UDOT_Traffic_URL)
            },
            quality: {
              classification: asNull(props.classification),
              poeFailure: props.poe_failure === true,
              timestampIsStale: props.timestamp_is_stale === true
            },
            objectId: props.ObjectId
          }
        };
      } catch (err) {
        console.warn(`Error processing camera ${index}:`, err);
        return null;
      }
    }).filter(camera => camera !== null);

    // Filter out cameras with invalid coordinates or missing image URLs
    const validCameras = transformedCameras.filter(camera => {
      const hasValidCoords = !(camera.Latitude === 0.0 && camera.Longitude === 0.0) &&
                            !isNaN(camera.Latitude) && !isNaN(camera.Longitude);
      const hasValidImage = camera.Views[0].Url && 
                           camera.Views[0].Url !== 'NULL' && 
                           camera.Views[0].Url.startsWith('http');
      return hasValidCoords && hasValidImage;
    });

    console.log(`Successfully loaded ${validCameras.length} valid cameras (filtered from ${transformedCameras.length})`);
    return validCameras;

  } catch (e) {
    console.error('Error fetching cameras GeoJSON:', e);
    // Fallback to empty array - app should handle gracefully
    return [];
  }
}

/**
 * Parse milepost value, handling "NULL" strings and various number formats
 * @param {string|number} value - Milepost value from GeoJSON
 * @returns {number|null} - Parsed milepost or null if invalid
 */
function parseMilepost(value) {
  if (value === null || value === undefined || value === "NULL") {
    return null;
  }
  const parsed = parseFloat(value);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Extract region number from region text
 * @param {string} regionText - Text like "Region Four" 
 * @returns {number} - Region number (1-4)
 */
function extractRegionNumber(regionText) {
  if (!regionText) return 1;
  
  const regionMap = {
    'one': 1, 'two': 2, 'three': 3, 'four': 4,
    '1': 1, '2': 2, '3': 3, '4': 4
  };
  
  const match = regionText.toLowerCase().match(/(one|two|three|four|\d)/);
  return match ? (regionMap[match[1]] || 1) : 1;
}

export async function getCuratedRoutes() {
    try {
      const response = await fetch('routes.json');
      return await response.json();
    } catch (e) {
      console.error('Error fetching routes:', e);
      return [];
    }
  }