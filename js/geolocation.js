// geolocation.js
// Handles “Nearest Cameras” mode, one-time permission prompt, and silent startup under your splash.

import { computeDistance } from './utils.js';
import { refreshGallery } from './ui.js';
import { filterImages } from './filters.js';

const STORAGE_KEY = 'udot-location-allowed';
const geoOptions = {
  enableHighAccuracy: true,
  timeout: 5000,
  maximumAge: 0
};

/** Sort all cameras by distance to given lat/lng. */
function getCamerasSortedByProximity(lat, lng) {
  return window.camerasList
    .map(cam => ({
      cam,
      distance: computeDistance(lat, lng, cam.Latitude, cam.Longitude)
    }))
    .sort((a, b) => a.distance - b.distance)
    .map(x => x.cam);
}

/** Activates Nearest-Cameras mode and updates UI & URL. */
function activateNearestCamerasMode(lat, lng) {
  window.isNearestFilterActive    = true;
  window.nearestUserLocation      = { lat, lng };
  localStorage.setItem(STORAGE_KEY, 'yes');

  // clear other filters
  window.selectedRegion             = '';
  window.selectedCounty             = '';
  window.selectedCity               = '';
  window.selectedMaintenanceStation = '';
  window.selectedRoute              = 'All';
  window.selectedOtherFilter        = '';
  window.searchQuery                = '';

  const sorted = getCamerasSortedByProximity(lat, lng).slice(0, 50);
  refreshGallery(sorted);
}

/** Clears Nearest-Cameras mode flags. */
export function clearNearestCamerasMode() {
  window.isNearestFilterActive   = false;
  window.nearestUserLocation     = null;
}

/** Load the default (unfiltered) gallery. */
function loadDefaultGallery() {
  clearNearestCamerasMode();
  filterImages();
}

/** Called by the “Nearest Cameras” button: always triggers the native prompt. */
function requestAndFilter() {
  if (!navigator.geolocation) {
    console.warn('Geolocation not supported');
    return loadDefaultGallery();
  }
  navigator.geolocation.getCurrentPosition(
    pos => {
      // granted
      activateNearestCamerasMode(pos.coords.latitude, pos.coords.longitude);
    },
    err => {
      // denied or error
      console.warn('Geolocation error:', err);
      localStorage.removeItem(STORAGE_KEY);
      loadDefaultGallery();
    },
    geoOptions
  );
}

/**
 * Silent startup logic for your splash.
 * Resolves once either nearest-mode is activated or default gallery loaded.
 */
export function initAutoLocationFilter() {
  return new Promise(async resolve => {
    const userAllowedBefore = localStorage.getItem(STORAGE_KEY) === 'yes';

    // first-time visitor → default
    if (!userAllowedBefore) {
      loadDefaultGallery();
      return resolve();
    }

    // returning visitor → check if geolocation API is available
    if (!navigator.geolocation) {
      loadDefaultGallery();
      return resolve();
    }

    // If Permissions API is available, try to query state
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const status = await navigator.permissions.query({ name: 'geolocation' });
        if (status.state === 'granted') {
          navigator.geolocation.getCurrentPosition(
            pos => {
              activateNearestCamerasMode(pos.coords.latitude, pos.coords.longitude);
              resolve();
            },
            () => {
              loadDefaultGallery();
              resolve();
            },
            geoOptions
          );
        } else {
          // permission was denied or prompt; do NOT call getCurrentPosition, just load default gallery
          loadDefaultGallery();
          resolve();
        }
      } catch {
        // Permissions API un-usable (e.g. iOS WebKit) → try direct geolocation
        navigator.geolocation.getCurrentPosition(
          pos => {
            activateNearestCamerasMode(pos.coords.latitude, pos.coords.longitude);
            resolve();
          },
          () => {
            loadDefaultGallery();
            resolve();
          },
          geoOptions
        );
      }
    } else {
      // no Permissions API → direct geolocation
      navigator.geolocation.getCurrentPosition(
        pos => {
          activateNearestCamerasMode(pos.coords.latitude, pos.coords.longitude);
          resolve();
        },
        () => {
          loadDefaultGallery();
          resolve();
        },
        geoOptions
      );
    }
  });
}

/**
 * Wraps initAutoLocationFilter() in a watchdog timer so your splash can’t hang.
 * The fallback only runs if the silent init hasn’t settled by timeoutMs.
 */
export function initAutoLocationFilterWithTimeout(timeoutMs = 5000) {
  return new Promise(resolve => {
    let settled = false;

    // Kick off the real init
    initAutoLocationFilter().then(() => {
      if (!settled) {
        settled = true;
        resolve();
      }
    });

    // Watchdog timer
    setTimeout(() => {
      if (!settled) {
        settled = true;
        console.warn(`Geolocation init timed out after ${timeoutMs}ms — falling back to default gallery`);
        clearNearestCamerasMode();
        filterImages();
        resolve();
      }
    }, timeoutMs);
  });
}

/** Bind the Nearest-Cameras button to always re-prompt. */
export function setupLocateButton() {
  const btn = document.getElementById('nearestButton');
  if (!btn) return;
  btn.addEventListener('click', requestAndFilter);
}
