import { debounce } from './utils.js';

// js/maps.js
// Centralized map logic for all map types (modal overview, custom route, mini overview)
// All Leaflet map creation and marker/tooltip logic should go here.

/**
 * Create a Leaflet map instance.
 * @param {HTMLElement|string} container - DOM element or selector for the map container.
 * @param {Object} options - Map options (type: 'modal' | 'mini', ...)
 * @returns {Object} mapInstance
 */
export function createMap(container, bounds, zoom = 7, options = {}) {
  // Accepts DOM element or string (ID or selector)
  let el = container;
  if (typeof container === 'string') {
    el = document.getElementById(container) || document.querySelector(container);
  }
  if (!el) throw new Error('Map container not found: ' + container);
  // Force container to have width/height if not set
  if (!el.style.width)  el.style.width  = '100%';
  if (!el.style.height) el.style.height = '100%';
  // Remove any previous Leaflet map instance on this element
  if (el._leaflet_id) {
    try { L.map(el).remove(); } catch (e) {}
    el.innerHTML = '';
  }
  // Debug: log container size
  const rect = el.getBoundingClientRect();
  console.log('Creating map in', el, 'size:', rect.width, rect.height);
  const map = L.map(el, {
    attributionControl: false,
    zoomControl:      false,
    dragging:         true,
    scrollWheelZoom:  true,
    doubleClickZoom:  false,
    touchZoom:        true,
    ...options.leafletOptions
  });
  // Always set view or fit bounds
  if (bounds && bounds.isValid && bounds.isValid()) {
    map.fitBounds(bounds, { maxZoom: zoom || 7 });
  } else {
    map.setView([37.0902, -95.7129], zoom || 7); // Center of US, fallback
  }
  // Satellite imagery
  L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { attribution: '&copy; Esri', subdomains: 'abcd', maxZoom: 20 }
  ).addTo(map);
  // Dark reference overlay
  L.tileLayer(
    'https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
    { attribution: '&copy; Esri', minZoom: 0, maxZoom: 18 }
  ).addTo(map);
  setTimeout(() => map.invalidateSize(), 100);
  return map;
}

/**
 * Add camera markers to the map.
 * @param {Object} mapInstance
 * @param {Array} cameras - Array of camera objects
 * @param {Object} options - Marker options (withImage, onClick, etc.)
 * @returns {Array} markers
 */
export function addCameraMarkers(mapInstance, cameras, options = {}) {
  const markers = [];
  const isCustomRoute = options.type === 'customRoute';
  const smallIcon = options.icon || L.divIcon({
    className: 'custom-marker',
    iconSize: [12, 12],
    iconAnchor: [6, 6],
    tooltipAnchor: [0, 10]
  });
  cameras.forEach(cam => {
    let lat, lng;
    if (Array.isArray(cam)) {
      [lat, lng] = cam;
    } else if (cam.Latitude && cam.Longitude) {
      lat = cam.Latitude;
      lng = cam.Longitude;
    } else if (cam.camera && cam.camera.Latitude && cam.camera.Longitude) {
      lat = cam.camera.Latitude;
      lng = cam.camera.Longitude;
    }
    if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
      const marker = L.marker([lat, lng], {
        icon: smallIcon,
        cam: cam
      }).addTo(mapInstance);
      marker.cam = cam;
      if (isCustomRoute) {
        // Hover: show location name
        marker.on('mouseover', () => {
          if (marker._hover) return;
          const loc = cam.Location || 'Unknown';
          marker._hover = L.tooltip({ permanent:false, interactive:false, opacity:1 })
            .setLatLng(marker.getLatLng())
            .setContent(`<span>${loc}</span>`)
            .addTo(mapInstance);
        });
        marker.on('mouseout', () => {
          if (marker._hover) { mapInstance.removeLayer(marker._hover); marker._hover = null; }
        });
        // Click: toggle image tooltip
        marker.on('click', () => {
          if (marker._imgTip) {
            mapInstance.removeLayer(marker._imgTip);
            marker._imgTip = null;
          } else {
            const imgUrl = cam.Views && cam.Views[0] && cam.Views[0].Url ? cam.Views[0].Url : null;
            const html = imgUrl ? `<div class='glass-popup-content'><img src='${imgUrl}'/></div>` : `<div class='glass-popup-content'><span>No image</span></div>`;
            marker._imgTip = L.tooltip({
              permanent: true,
              interactive: true,
              className: 'glass-popup',
              maxWidth: 120,
              opacity: 1
            })
              .setLatLng(marker.getLatLng())
              .setContent(html)
              .addTo(mapInstance);
          }
        });
      }
      markers.push(marker);
    }
  });
  return markers;
}

/**
 * Add user location marker to the map.
 * @param {Object} mapInstance
 * @param {Object} location - {lat, lng}
 */
export function addUserLocation(mapInstance, location) {
  // TODO: Implement user location marker
}

/**
 * Enable anti-collision tooltips for markers (modal maps only).
 * @param {Object} mapInstance
 * @param {Array} markers
 * @param {Object} options - Tooltip options (maxTooltips, ...)
 * @returns {Object} controls - { setAutoTooltip, getAutoTooltip, destroy }
 */
export function enableAntiCollisionTooltips(mapInstance, markers, options = {}) {
  const MAX_TOOLTIPS = options.maxTooltips || 5;
  const THUMB_WIDTH  = 120;
  const ARROW_HALF   = 6;
  const MARKER_RAD   = 8;
  const MIN_ANCHOR_PX = 10;
  const openTips = [];
  let autoTooltipEnabled = options.autoTooltips !== false; // default true

  function intersects(a, b) {
    return !(b.left > a.right || b.right < a.left || b.top > a.bottom || b.bottom < a.top);
  }

  function makeHtml(cam) {
    if (!cam || !cam.Views || !cam.Views[0] || !cam.Views[0].Url) {
      return `<div class="glass-popup-content"><span>No image</span></div>`;
    }
    return `<div class="glass-popup-content"><img src="${cam.Views[0].Url}"/></div>`;
  }

  function clearTooltip(marker) {
    if (!marker || !marker.unbindTooltip) return;
    marker.unbindTooltip();
    marker.sticky = false;
    marker._autoOpened = false;
    marker._pinned = false; // Always clear pin on close
    if (marker._connector) {
      mapInstance.removeLayer(marker._connector);
      marker._connector = null;
    }
    if (marker._updateConn) {
      mapInstance.off('move zoom viewreset', marker._updateConn);
      marker._updateConn = null;
    }
    const idx = openTips.indexOf(marker);
    if (idx !== -1) openTips.splice(idx, 1);
  }

  function repositionTooltip(marker, auto = false) {
    clearTooltip(marker);
    const cam = marker.cam || marker.options.cam;
    if (!cam) return;
    const html = makeHtml(cam);
    const boxes = markers.map(m => {
      const p = mapInstance.latLngToContainerPoint(m.getLatLng());
      return { left: p.x - MARKER_RAD, top: p.y - MARKER_RAD, right: p.x + MARKER_RAD, bottom: p.y + MARKER_RAD };
    });
    const candidates = [
      { dir:'top',    offset:[0, -MARKER_RAD] },
      { dir:'bottom', offset:[0,  MARKER_RAD] },
      { dir:'left',   offset:[-MARKER_RAD, 0] },
      { dir:'right',  offset:[ MARKER_RAD, 0] },
      { dir:'top',    offset:[-(THUMB_WIDTH/2 - ARROW_HALF), -MARKER_RAD] },
      { dir:'top',    offset:[ (THUMB_WIDTH/2 - ARROW_HALF), -MARKER_RAD] },
      { dir:'bottom', offset:[-(THUMB_WIDTH/2 - ARROW_HALF),  MARKER_RAD] },
      { dir:'bottom', offset:[ (THUMB_WIDTH/2 - ARROW_HALF),  MARKER_RAD] }
    ];
    const measured = candidates.map(c => {
      const tmp = L.tooltip({ direction:c.dir, offset:c.offset, permanent:true, interactive:false, opacity:1 })
        .setLatLng(marker.getLatLng())
        .setContent(html)
        .addTo(mapInstance);
      const r = tmp.getElement().getBoundingClientRect();
      mapInstance.removeLayer(tmp);
      return { ...c, rect: r };
    });
    const chosen = measured.find(c => {
      if (boxes.some(b => intersects(b, c.rect))) return false;
      for (let ot of openTips) {
        if (!ot.getTooltip) continue;
        const r2 = ot.getTooltip().getElement().getBoundingClientRect();
        if (intersects(c.rect, r2)) return false;
      }
      return true;
    }) || measured[0];
    let [ox, oy] = chosen.offset;
    const minOffset = Math.max(MARKER_RAD + MIN_ANCHOR_PX, 10);
    const norm = Math.hypot(ox, oy);
    if (norm < minOffset) {
      const factor = minOffset / (norm || minOffset);
      ox *= factor;
      oy *= factor;
    }
    marker.bindTooltip(html, {
      direction:   chosen.dir,
      offset:      [ox, oy],
      permanent:   true,
      interactive: true,
      className:   'glass-popup',
      maxWidth:    THUMB_WIDTH,
      opacity:     1
    }).openTooltip();
    marker.sticky = true;
    marker._autoOpened = auto;
    openTips.push(marker);
    const markerCP = mapInstance.latLngToContainerPoint(marker.getLatLng());
    function computeTipCP() {
      const tt = marker.getTooltip().getElement().getBoundingClientRect();
      const mp = mapInstance.getContainer().getBoundingClientRect();
      let px, py;
      switch (chosen.dir) {
        case 'top':    px = tt.left - mp.left + tt.width/2; py = tt.bottom - mp.top; break;
        case 'bottom': px = tt.left - mp.left + tt.width/2; py = tt.top - mp.top; break;
        case 'left':   px = tt.right - mp.left; py = tt.top - mp.top + tt.height/2; break;
        default:       px = tt.left - mp.left; py = tt.top - mp.top + tt.height/2;
      }
      return L.point(px, py);
    }
    let tipCP = computeTipCP();
    let vec   = tipCP.subtract(markerCP);
    let dist  = markerCP.distanceTo(tipCP);
    if (dist < MIN_ANCHOR_PX) {
      const unit = dist ? vec.multiplyBy(1/dist) : L.point(0,1);
      tipCP = markerCP.add(unit.multiplyBy(MIN_ANCHOR_PX));
    }
    const tipLL = mapInstance.containerPointToLatLng(tipCP);
    const poly  = L.polyline([ marker.getLatLng(), tipLL ], { color:'#ff7800', weight:4, interactive:false }).addTo(mapInstance);
    const tooltip = marker.getTooltip();
    const tooltipEl = tooltip.getElement();
    const imgEl = tooltipEl.querySelector('img');
    if (imgEl) {
      imgEl.style.transition = 'transform 0.2s ease';
      imgEl.style.transformOrigin = 'center center';
      imgEl.addEventListener('click', e => e.stopPropagation());
      function panToFit() {
        const scale = 2;
        const imgRect = imgEl.getBoundingClientRect();
        const mapRect = mapInstance.getContainer().getBoundingClientRect();
        const cx = imgRect.left + imgRect.width/2;
        const cy = imgRect.top + imgRect.height/2;
        const newW = imgRect.width * scale;
        const newH = imgRect.height * scale;
        const newLeft = cx - newW/2;
        const newTop = cy - newH/2;
        const newRight = cx + newW/2;
        const newBottom = cy + newH/2;
        const posLeft = newLeft - mapRect.left;
        const posRight = newRight - mapRect.left;
        const posTop = newTop - mapRect.top;
        const posBottom = newBottom - mapRect.top;
        let dx = 0, dy = 0;
        if (posLeft < 0) dx = posLeft;
        else if (posRight > mapRect.width) dx = posRight - mapRect.width;
        if (posTop < 0) dy = posTop;
        else if (posBottom > mapRect.height) dy = posBottom - mapRect.height;
        if (dx || dy) mapInstance.panBy([dx, dy], { animate: false });
      }
      ['mousedown','touchstart'].forEach(evt =>
        imgEl.addEventListener(evt, e => {
          e.stopPropagation();
          imgEl.style.transform = 'scale(2)';
          tooltip.bringToFront();
          panToFit();
        })
      );
      ['mouseup','touchend','touchcancel'].forEach(evt =>
        imgEl.addEventListener(evt, e => {
          e.stopPropagation();
          imgEl.style.transform = 'scale(1)';
        })
      );
    }
    const updateConn = () => {
      let cp = computeTipCP();
      let v = cp.subtract(markerCP);
      let d = markerCP.distanceTo(cp);
      if (d < MIN_ANCHOR_PX) v = v.multiplyBy(MIN_ANCHOR_PX / (d || MIN_ANCHOR_PX));
      const adjLL = mapInstance.containerPointToLatLng(markerCP.add(v));
      poly.setLatLngs([ marker.getLatLng(), adjLL ]);
    };
    mapInstance.on('move zoom viewreset', updateConn);
    marker._connector  = poly;
    marker._updateConn = updateConn;
  }

  function closeOutOfViewTooltips() {
    const bounds = mapInstance.getBounds();
    openTips.slice().forEach(m => {
      if (!bounds.contains(m.getLatLng()) && !m._pinned) {
        clearTooltip(m);
      }
    });
  }

  function enforceTooltipRules() {
    if (!autoTooltipEnabled) {
      // Only close auto-opened tooltips, leave pinned ones
      openTips.slice().forEach(m => {
        if (!m._pinned) clearTooltip(m);
      });
      return;
    }
    const bounds = mapInstance.getBounds();
    const zoom = mapInstance.getZoom();
    const center = mapInstance.getCenter();
    // First, close all auto-opened tooltips that are out of view or zoomed out
    markers.forEach(m => {
      if (m.sticky && m._autoOpened && (!bounds.contains(m.getLatLng()) || zoom < 13)) {
        clearTooltip(m);
      }
    });
    // If zoom is below threshold, forcibly clear all auto-tooltips
    if (zoom < 13) {
      openTips.slice().forEach(m => {
        if (!m._pinned) {
          clearTooltip(m);
        }
      });
      openTips.length = 0;
      return;
    }
    // Only open auto-tooltips if zoom is at or above threshold
    // Find all markers in view that are not pinned
    const visibleMarkers = markers.filter(m => bounds.contains(m.getLatLng()) && !m._pinned);
    // Sort by distance to map center
    visibleMarkers.sort((a, b) => a.getLatLng().distanceTo(center) - b.getLatLng().distanceTo(center));
    // Count how many auto-tooltips are already open
    let autoOpenCount = openTips.filter(m => m._autoOpened && !m._pinned).length;
    // Open up to MAX_TOOLTIPS closest to center (auto only)
    for (let m of visibleMarkers) {
      if (autoOpenCount >= MAX_TOOLTIPS) break;
      if (!m.sticky) {
        repositionTooltip(m, true);
        autoOpenCount++;
      }
    }
    // Defensive: close extra auto-opened tooltips if any
    const autoOpen = openTips.filter(m => m._autoOpened && !m._pinned);
    if (autoOpen.length > MAX_TOOLTIPS) {
      autoOpen.slice(0, autoOpen.length - MAX_TOOLTIPS).forEach(clearTooltip);
    }
  }

  // Attach event listeners
  function attachListeners() {
    mapInstance.on('moveend', enforceTooltipRules);
    mapInstance.on('zoomend', enforceTooltipRules);
  }
  function detachListeners() {
    mapInstance.off('moveend', enforceTooltipRules);
    mapInstance.off('zoomend', enforceTooltipRules);
  }

  // Marker events
  markers.forEach(m => {
    if (!m.cam && m.options && m.options.cam) m.cam = m.options.cam;
    m._pinned = false;
    m.on('mouseover', () => {
      if (!m.sticky && !m._hover) {
        m._hover = L.tooltip({ permanent:false, interactive:false, opacity:1 })
          .setLatLng(m.getLatLng())
          .setContent(makeHtml(m.cam || m.options.cam))
          .addTo(mapInstance);
      }
    });
    m.on('mouseout', () => { if (m._hover) { mapInstance.removeLayer(m._hover); m._hover = null; } });
    m.on('click', () => {
      if (m.sticky && m._pinned) {
        clearTooltip(m);
      } else if (!m.sticky) {
        repositionTooltip(m, false);
        m._pinned = true;
      } else if (m.sticky && !m._pinned) {
        m._pinned = true;
      }
    });
  });

  // Expose open/close all for modal controls
  if (document.getElementById('openAllTips'))
    document.getElementById('openAllTips').onclick  = () => {
      // Only open up to 50 tooltips, prioritizing markers in view
      const bounds = mapInstance.getBounds();
      // Markers in view and not already open/pinned
      const inView = markers.filter(m => bounds.contains(m.getLatLng()) && !m.sticky && !m._pinned);
      // Markers out of view and not already open/pinned
      const outView = markers.filter(m => !bounds.contains(m.getLatLng()) && !m.sticky && !m._pinned);
      // Concatenate, prioritizing in-view
      const toOpen = inView.concat(outView).slice(0, 50);
      toOpen.forEach(m => {
        repositionTooltip(m, false);
        m._pinned = true;
      });
    };
  if (document.getElementById('closeAllTips'))
    document.getElementById('closeAllTips').onclick = () => {
      // Always close tooltips for all markers, regardless of openTips state
      markers.forEach(m => {
        m._pinned = false;
        if (m.sticky || m._autoOpened) clearTooltip(m);
      });
      // Also clear any remaining in openTips for safety
      openTips.slice().forEach(m => clearTooltip(m));
    };

  // Initial attach
  if (autoTooltipEnabled) {
    attachListeners();
    enforceTooltipRules();
  }

  // --- Auto tooltip toggle logic ---
  let tooltipController = null;
  let autoTooltipsEnabled = true; // default ON

  function wireToggleBtn() {
    const toggleBtn = document.getElementById('toggleAutoTooltips');
    function updateToggleBtn() {
      if (!toggleBtn) return;
      toggleBtn.textContent = 'Auto Open/Close: ' + (autoTooltipsEnabled ? 'ON' : 'OFF');
      toggleBtn.setAttribute('aria-pressed', autoTooltipsEnabled ? 'true' : 'false');
      if (autoTooltipsEnabled) {
        toggleBtn.classList.remove('off');
      } else {
        toggleBtn.classList.add('off');
      }
    }
    function enableTooltips() {
      if (tooltipController) tooltipController.destroy();
      tooltipController = enableAntiCollisionTooltips(mapInstance, markers, { maxTooltips, autoTooltips: true });
    }
    function disableTooltips() {
      if (tooltipController) {
        tooltipController.destroy();
        tooltipController = null;
      }
    }
    if (toggleBtn) {
      updateToggleBtn();
      toggleBtn.onclick = () => {
        autoTooltipsEnabled = !autoTooltipsEnabled;
        updateToggleBtn();
        if (autoTooltipsEnabled) {
          enableTooltips();
        } else {
          disableTooltips();
        }
      };
    } else {
      console.warn('toggleAutoTooltips button not found in DOM when wiring up.');
    }
    // Enable tooltips only after map is at correct zoom (prevents auto-open on load)
    setTimeout(() => {
      if (autoTooltipsEnabled) {
        enableTooltips();
      }
    }, 150);
  }

  // Try to wire up immediately, and again after a short delay in case modal is rendered late
  wireToggleBtn();
  setTimeout(wireToggleBtn, 300);

  return mapInstance;
}
// Ensure file ends with a closing brace and newline
