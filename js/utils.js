// utils.js - General helper functions

/**
 * Converts degrees to radians.
 * @param {number} deg - Degrees.
 * @returns {number} Radians.
 */
export function toRadians(deg) {
  return deg * Math.PI / 180;
}

/**
 * Computes the great-circle distance between two points.
 * @param {number} lat1 - Latitude of first point.
 * @param {number} lon1 - Longitude of first point.
 * @param {number} lat2 - Latitude of second point.
 * @param {number} lon2 - Longitude of second point.
 * @returns {number} Distance in kilometers.
 */


export function computeDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  // Corrected: cos(lat1) * cos(lat2) rather than cos(lat1) * cos(lon1)
  const a = Math.sin(dLat / 2) ** 2
          + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2))
          * Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Debounces a function call.
 * @param {Function} func - Function to debounce.
 * @param {number} delay - Delay in ms.
 * @returns {Function} Debounced function.
 */
export function debounce(func, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => func.apply(this, args), delay);
  };
}

/**
 * Calculates distance between two pointer/touch points.
 * @param {{clientX: number, clientY: number}} p1 - First point.
 * @param {{clientX: number, clientY: number}} p2 - Second point.
 * @returns {number} Distance in pixels.
 */
export function getDistance(p1, p2) {
  const dx = p1.clientX - p2.clientX;
  const dy = p1.clientY - p2.clientY;
  return Math.hypot(dx, dy);
}

/**
 * Copies text to the clipboard.
 * @param {string} text - Text to copy.
 * @returns {Promise<void>}
 */
export function copyToClipboard(text) {
  if (navigator.clipboard) {
    return navigator.clipboard.writeText(text);
  }
  const tmp = document.createElement('input');
  document.body.append(tmp);
  tmp.value = text;
  tmp.select();
  document.execCommand('copy');
  tmp.remove();
  return Promise.resolve();
}

/**
 * Copies the current page URL to the clipboard.
 * @returns {Promise<void>}
 */
export function copyURLToClipboard() {
  return copyToClipboard(window.location.href);
}

/**
 * Wraps Geolocation API in a Promise.
 * @param {PositionOptions} [options] - Geolocation options.
 * @returns {Promise<GeolocationPosition>}
 */
export function getCurrentPosition(options) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
    } else {
      navigator.geolocation.getCurrentPosition(resolve, reject, options);
    }
  });
}
