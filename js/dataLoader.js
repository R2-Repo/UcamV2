// dataLoader.js
import { getCamerasList, getCuratedRoutes } from '../cameraData.js';

/**
 * Loads camera list.
 * @returns {Promise<Array>}
 */
export function loadCameras() {
  return getCamerasList();
}

/**
 * Loads curated routes list.
 * @returns {Promise<Array>}
 */
export function loadRoutes() {
  return getCuratedRoutes();
}

/**
 * Loads both cameras and routes.
 * @returns {Promise<{cameras: Array, routes: Array}>}
 */
export async function loadData() {
  const cameras = await getCamerasList();
  const routes = await getCuratedRoutes();
  return { cameras, routes };
}
