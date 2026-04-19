// js/filters.js

import { refreshGallery } from './ui.js';
import { resetImageSizeOverride } from './gallery.js';

function matchesIssueFilter(cam) {
  if (!window.selectedIssueFilter) return true;
  const isDisabled = cam.Views?.[0]?.Status === 'Disabled';
  const quality = cam._geoJsonMetadata?.quality || {};
  const classification = quality.classification || cam.classification;
  const poeFailure = quality.poeFailure ?? cam.poeFailure ?? false;
  const timestampIsStale = quality.timestampIsStale ?? cam.timestampIsStale ?? false;

  switch (window.selectedIssueFilter) {
    case 'disabled':
      return isDisabled;
    case 'offline':
      return classification === 'offline';
    case 'upside_down':
      return classification === 'upside_down';
    case 'grayscale':
      return classification === 'grayscale';
    case 'old_timestamp':
      return timestampIsStale === true && classification === 'night';
    case 'poe_error':
      return poeFailure === true;
    case 'poor_road':
      return classification === 'poor_road';
    default:
      return true;
  }
}

/**
 * Determines if a camera falls on a given single route segment.
 */
function isCameraOnSingleRoute(camera, { name, mpMin, mpMax }) {
  // Normalize route names for comparison (remove leading zeros, handle direction suffixes)
  const normalizeRoute = (routeName) => {
    if (!routeName) return null;
    // Remove leading zeros and normalize format
    let normalized = routeName.replace(/^0+/, ''); // Remove leading zeros
    // Handle direction suffixes (P = positive/eastbound, N = negative/westbound)
    normalized = normalized.replace(/[PN]$/, 'P'); // Standardize to P suffix
    return normalized;
  };
  
  const targetRoute = normalizeRoute(name);
  const route1 = normalizeRoute(camera.RoadwayOption1);
  const route2 = normalizeRoute(camera.RoadwayOption2);
  
  if (route1 === targetRoute) {
    const mp = camera.MilepostOption1;
    if (mpMin != null && mp < mpMin) return false;
    if (mpMax != null && mp > mpMax) return false;
    return true;
  }
  if (route2 === targetRoute) {
    const mp = camera.MilepostOption2;
    if (mpMin != null && mp < mpMin) return false;
    if (mpMax != null && mp > mpMax) return false;
    return true;
  }
  return false;
}

/**
 * Determines if a camera falls on any part of a route object.
 */
function isCameraOnRoute(camera, routeObj) {
  if (Array.isArray(routeObj.routes)) {
    return routeObj.routes.some(sub => isCameraOnSingleRoute(camera, sub));
  }
  return isCameraOnSingleRoute(camera, routeObj);
}

/**
 * Filters and renders camera images based on current selections.
 */
export function filterImages() {
  const cameras = window.camerasList;
  const routes  = window.curatedRoutes;
  let filtered;

  // Debug logging for route filtering
  if (window.selectedRoute !== 'All') {
    const routeObj = routes.find(r => (r.displayName || r.name) === window.selectedRoute);
    console.log(`Filtering for route: ${window.selectedRoute}`, routeObj);
    if (routeObj) {
      const sampleCamera = cameras[0];
      console.log('Sample camera routes:', {
        roadway1: sampleCamera?.RoadwayOption1,
        roadway2: sampleCamera?.RoadwayOption2,
        milepost1: sampleCamera?.MilepostOption1,
        milepost2: sampleCamera?.MilepostOption2
      });
    }
  }

  filtered = cameras.filter(cam => {
    const isDisabled = cam.Views?.[0]?.Status === 'Disabled';
    if (window.selectedIssueFilter !== 'disabled' && isDisabled) return false;
    
    // Enhanced search including alternative names from GeoJSON metadata
    let searchText = `${cam.SignalID || ''} ${cam.Location || ''}`;
    if (cam._geoJsonMetadata?.altNames) {
      const altNames = cam._geoJsonMetadata.altNames;
      searchText += ` ${altNames.route1A || ''} ${altNames.route1B || ''} ${altNames.route1C || ''}`;
      searchText += ` ${altNames.route2A || ''} ${altNames.route2B || ''} ${altNames.route2C || ''}`;
    }
    
    const matchesSearch = !window.searchQuery || 
      searchText.toLowerCase().includes(window.searchQuery.toLowerCase());
    
    const matchesMaintenance = !window.selectedMaintenanceStation ||
      ((cam.MaintenanceStationOption1 === window.selectedMaintenanceStation &&
        cam.MaintenanceStationOption1.toLowerCase() !== 'not available') ||
       (cam.MaintenanceStationOption2 === window.selectedMaintenanceStation &&
        cam.MaintenanceStationOption2.toLowerCase() !== 'not available'));
    const routeObj = window.selectedRoute !== 'All'
      ? routes.find(r => (r.displayName || r.name) === window.selectedRoute)
      : null;
    const matchesRoute  = routeObj ? isCameraOnRoute(cam, routeObj) : true;
    const matchesRegion = !window.selectedRegion || cam.Region == window.selectedRegion;
    const matchesCounty = !window.selectedCounty || cam.CountyBoundary === window.selectedCounty;
    const matchesCity   = !window.selectedCity || cam.MunicipalBoundary === window.selectedCity;
        const matchesIssue  = matchesIssueFilter(cam);
    return matchesSearch &&
           matchesMaintenance &&
           matchesRoute &&
           matchesRegion &&
          matchesCounty &&
          matchesCity &&
          matchesIssue;
  });

  // Log results for debugging
  if (window.selectedRoute !== 'All') {
    console.log(`Route filter result: ${filtered.length} cameras found for route "${window.selectedRoute}"`);
    if (filtered.length > 0) {
      console.log('First matching camera:', {
        id: filtered[0].Id,
        location: filtered[0].Location,
        roadway1: filtered[0].RoadwayOption1,
        roadway2: filtered[0].RoadwayOption2
      });
    }
  }

  // Optional route-based sorting (unchanged)
  if (window.selectedRoute !== 'All') {
    const routeObj = routes.find(r => (r.displayName || r.name) === window.selectedRoute);
    if (routeObj) {
      if (Array.isArray(routeObj.routes)) {
        filtered.sort((a, b) => {
          const subA = routeObj.routes.find(sr => isCameraOnSingleRoute(a, sr));
          const subB = routeObj.routes.find(sr => isCameraOnSingleRoute(b, sr));
          const idxA = routeObj.routes.indexOf(subA);
          const idxB = routeObj.routes.indexOf(subB);
          if (idxA !== idxB) return idxA - idxB;
          
          // Use the same normalization logic as filtering
          const normalizeRoute = (routeName) => {
            if (!routeName) return null;
            let normalized = routeName.replace(/^0+/, ''); // Remove leading zeros
            normalized = normalized.replace(/[PN]$/, 'P'); // Standardize to P suffix
            return normalized;
          };
          
          const getMp = (c, s) => {
            const targetRoute = normalizeRoute(s.name);
            const route1 = normalizeRoute(c.RoadwayOption1);
            const route2 = normalizeRoute(c.RoadwayOption2);
            
            if (route1 === targetRoute) return c.MilepostOption1;
            if (route2 === targetRoute) return c.MilepostOption2;
            return 0;
          };
          
          const mpA = getMp(a, subA);
          const mpB = getMp(b, subB);
          return (subA.sortOrder === 'desc') ? mpB - mpA : mpA - mpB;
        });
      } else {
        filtered.sort((a, b) => {
          // Use the same normalization logic as filtering
          const normalizeRoute = (routeName) => {
            if (!routeName) return null;
            let normalized = routeName.replace(/^0+/, ''); // Remove leading zeros
            normalized = normalized.replace(/[PN]$/, 'P'); // Standardize to P suffix
            return normalized;
          };
          
          const targetRoute = normalizeRoute(routeObj.name);
          
          const getMp = (cam) => {
            const route1 = normalizeRoute(cam.RoadwayOption1);
            const route2 = normalizeRoute(cam.RoadwayOption2);
            
            if (route1 === targetRoute) return cam.MilepostOption1;
            if (route2 === targetRoute) return cam.MilepostOption2;
            return 0;
          };
          
          const mpA = getMp(a);
          const mpB = getMp(b);
          return mpA - mpB;
        });
      }
    }
  }

  refreshGallery(filtered);
  resetImageSizeOverride(); // Reset image size override on filter change
}
