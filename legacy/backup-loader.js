// backup-loader.js
// Fallback data loader with automatic retry mechanism

/**
 * Enhanced data loader with fallback support
 * Tries new GeoJSON format first, falls back to old JSON format if needed
 */
export async function getCamerasListWithFallback() {
  try {
    // Try new GeoJSON format first
    console.log('Attempting to load cctv_locations_processed_classified.geojson...');
    const response = await fetch('cctv_locations_processed_classified.geojson');
    
    if (response.ok) {
      const data = await response.json();
      if (data.features && Array.isArray(data.features)) {
        console.log('Successfully loaded GeoJSON format');
        return await loadFromGeoJSON(data);
      }
    }
    throw new Error('GeoJSON format failed or invalid');
    
  } catch (geoJsonError) {
    console.warn('GeoJSON loading failed, trying legacy format:', geoJsonError);
    
    try {
      // Fallback to old format
      const response = await fetch('cameras.json');
      const data = await response.json();
      console.log('Successfully loaded legacy JSON format');
      return data.CamerasList.filter(camera => 
        !(camera.Latitude === 0.0 && camera.Longitude === 0.0)
      );
    } catch (legacyError) {
      console.error('Both data sources failed:', legacyError);
      return [];
    }
  }
}

async function loadFromGeoJSON(data) {
  // Your existing GeoJSON transformation logic here
  // (copy from cameraData.js)
  return data.features.map(/* transformation logic */).filter(/* validation logic */);
}
