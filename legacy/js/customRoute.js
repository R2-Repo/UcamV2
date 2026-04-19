// js/customRoute.js
import { refreshGallery } from './ui.js';
import { copyToClipboard } from './utils.js';

// ─────────────────────────────────────────────────────────────────────────────
// Shared icon
// ─────────────────────────────────────────────────────────────────────────────
const smallIcon = L.divIcon({
  className:     'custom-marker',
  iconSize:      [12, 12],
  iconAnchor:    [6,  6],
  tooltipAnchor: [0, 10]
});

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const MAX_TOOLTIPS  = 20;
const THUMB_WIDTH   = 120;
const ARROW_HALF    = 6;
const MARKER_RAD    = 8;
const MIN_ANCHOR    = 10;
const ZOOM_OPEN     = 13;
const ZOOM_COLLIDE  = 14;

// ─────────────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────────────
let mapInstance    = null;
let segmentMarkers = [];
let openTips       = [];
let renderTimer    = null; // for debouncing

// ─────────────────────────────────────────────────────────────────────────────
// Test if a camera lies on a given segment
// ─────────────────────────────────────────────────────────────────────────────
function isCameraOnSegment(cam, seg) {
  // Normalize route names for comparison (same logic as filters.js)
  const normalizeRoute = (routeName) => {
    if (!routeName) return null;
    let normalized = routeName.replace(/^0+/, ''); // Remove leading zeros
    normalized = normalized.replace(/[PN]$/, 'P'); // Standardize to P suffix
    return normalized;
  };
  
  const targetRoute = normalizeRoute(seg.name);
  const route1 = normalizeRoute(cam.RoadwayOption1);
  const route2 = normalizeRoute(cam.RoadwayOption2);
  
  let mp = null;
  if (route1 === targetRoute) {
    mp = cam.MilepostOption1;
  } else if (route2 === targetRoute) {
    mp = cam.MilepostOption2;
  }
  
  if (mp == null || isNaN(mp)) return false;
  let lo = seg.mpMin, hi = seg.mpMax;
  if (lo != null && hi != null && lo > hi) [lo, hi] = [hi, lo];
  if (lo != null && mp < lo) return false;
  if (hi != null && mp > hi) return false;
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// URL serialization / parsing
// ─────────────────────────────────────────────────────────────────────────────
export function serializeSegments(segs) {
  return segs.map(s => `${s.name}:${s.mpMin}-${s.mpMax}`).join(',');
}
export function parseMultiRouteFromURL() {
  const p = new URLSearchParams(window.location.search);
  const raw = p.get('multiRoute');
  if (!raw) {
    window.customRouteFormData = [];
    return;
  }
  window.customRouteFormData = raw.split(',').map(chunk => {
    const [r,range]       = chunk.split(':');
    const code            = (r||'').toUpperCase();
    const name            = code.endsWith('P') ? code : `${code}P`;
    const [minStr,maxStr] = (range||'').split('-');
    const mpMin = parseFloat(minStr),
          mpMax = parseFloat(maxStr);
    return {
      name,
      mpMin: isNaN(mpMin) ? null : mpMin,
      mpMax: isNaN(mpMax) ? null : mpMax
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Tooltip & connector helpers
// ─────────────────────────────────────────────────────────────────────────────
function clearTooltip(marker) {
  if (!marker.getTooltip) return;
  marker.unbindTooltip();
  marker.sticky = false;
  if (marker._connector) {
    mapInstance.removeLayer(marker._connector);
    marker._connector = null;
  }
  if (marker._updateConn) {
    mapInstance.off('move zoom viewreset', marker._updateConn);
    marker._updateConn = null;
  }
  const i = openTips.indexOf(marker);
  if (i > -1) openTips.splice(i, 1);
}

function repositionTooltip(marker) {
  clearTooltip(marker);

  // build popup HTML
  const cam = marker.cam;
  const html = `
    <div class="glass-popup-content">
      <img src="${cam.Views[0].Url}" alt="Camera View"/>
    </div>`;

  // occupancy boxes of other markers
  const boxes = segmentMarkers.map(m => {
    const p = mapInstance.latLngToContainerPoint(m.getLatLng());
    return {
      left:   p.x - MARKER_RAD,
      top:    p.y - MARKER_RAD,
      right:  p.x + MARKER_RAD,
      bottom: p.y + MARKER_RAD
    };
  });

  // candidate tooltip positions
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

  // measure each candidate safely
  const measured = candidates.map(c => {
    let rect = { left:0, top:0, right:0, bottom:0 };
    try {
      const tmp = L.tooltip({
        direction:   c.dir,
        offset:      c.offset,
        permanent:   true,
        interactive: false,
      })
      .setLatLng(marker.getLatLng())
      .setContent(html)
      .addTo(mapInstance);

      const el = tmp.getElement && tmp.getElement();
      if (el && typeof el.getBoundingClientRect === 'function') {
        rect = el.getBoundingClientRect();
      }
      mapInstance.removeLayer(tmp);
    } catch (e) {
      // if anything goes wrong, just leave rect at zeros
    }
    return { ...c, rect };
  });

  // pick the first non‐colliding candidate or fallback
  const chosen = measured.find(c => {
    // skip if collides with existing markers
    if (boxes.some(b =>
      !(b.right  < c.rect.left ||
        b.left   > c.rect.right ||
        b.bottom < c.rect.top ||
        b.top    > c.rect.bottom)
    )) return false;

    // skip if collides with existing open tooltips
    return !openTips.some(ot => {
      const tip = ot.getTooltip?.();
      if (!tip) return false;
      const el = tip.getElement?.();
      if (!el || typeof el.getBoundingClientRect !== 'function') return false;
      const r2 = el.getBoundingClientRect();
      return !(
        r2.right  < c.rect.left ||
        r2.left   > c.rect.right ||
        r2.bottom < c.rect.top ||
        r2.top    > c.rect.bottom
      );
    });
  }) || measured[0];

  // enforce minimum anchor distance
  let [ox,oy] = chosen.offset;
  const norm = Math.hypot(ox,oy);
  if (norm < MARKER_RAD + MIN_ANCHOR) {
    const f = (MARKER_RAD + MIN_ANCHOR)/(norm||1);
    ox *= f; oy *= f;
  }

  // bind & open the tooltip
  marker.bindTooltip(html, {
    direction:   chosen.dir,
    offset:      [ox, oy],
    permanent:   true,
    interactive: true,
    className:   'glass-popup',
    maxWidth:    THUMB_WIDTH,
    opacity:     1
  }).openTooltip();
  marker.sticky      = true;
  marker._lastOffset = [ox, oy];
  openTips.push(marker);

  // draw connector
  const p0  = marker.getLatLng();
  const cp  = mapInstance.latLngToContainerPoint(p0);
  const tip = mapInstance.containerPointToLatLng(cp.add([ox, oy]));
  marker._connector = L.polyline([p0, tip], {
    color:       '#ff7800',
    weight:      4,
    interactive: false
  }).addTo(mapInstance);

  // safe connector updater
  marker._updateConn = () => {
    if (!marker._connector) return;
    const tooltip = marker.getTooltip?.();
    if (!tooltip) return;
    const el = tooltip.getElement?.();
    if (!el || typeof el.getBoundingClientRect !== 'function') return;

    const tt = el.getBoundingClientRect();
    const mp = mapInstance.getContainer().getBoundingClientRect();
    const cp1 = mapInstance.latLngToContainerPoint(marker.getLatLng());
    const px = tt.left - mp.left + tt.width / 2;
    const py = tt.top  - mp.top  + tt.height / 2;
    const newTip = mapInstance.containerPointToLatLng([px,py]);
    marker._connector.setLatLngs([marker.getLatLng(), newTip]);
  };
  
  mapInstance.on('move zoom viewreset', marker._updateConn);
}


// ─────────────────────────────────────────────────────────────────────────────
// Form rendering + drag-and-drop
// ─────────────────────────────────────────────────────────────────────────────
function ensureSegmentData() {
  if (!Array.isArray(window.customRouteFormData)) window.customRouteFormData = [];
  if (window.customRouteFormData.length === 0) {
    window.customRouteFormData.push({ name:'', mpMin:null, mpMax:null });
  }
}
function updateApplyButtonState() {
  const btn = document.getElementById('customRouteApply');
  if (!btn) return;
  btn.disabled = !window.customRouteFormData.every(
    s => s.name && s.mpMin!=null && s.mpMax!=null
  );
}

export function renderForm() {
  const container = document.getElementById('customRouteFormContainer');
  if (!container) return;
  container.innerHTML = '';
  ensureSegmentData();

  // header row
  const hdr = document.createElement('div');
  hdr.className = 'custom-route-headers';
  ['','Route #','MP From','','MP To',''].forEach(txt => {
    const span = document.createElement('span');
    span.textContent = txt;
    hdr.append(span);
  });
  container.append(hdr);

  // data rows
  window.customRouteFormData.forEach((seg,idx) => {
    const row = document.createElement('div');
    row.className = 'custom-route-row';

    // drag handle
    const drag = document.createElement('span');
    drag.className = 'drag-handle';
    drag.textContent = '☰';
    row.append(drag);

    // Route #
    const routeIn = document.createElement('input');
    routeIn.type        = 'text';
    routeIn.inputMode   = 'numeric';       // numeric keypad on mobile
    routeIn.setAttribute('pattern','[0-9]*');
    routeIn.placeholder = 'EX: 15, 201, 80';
    routeIn.value       = seg.name.replace(/P$/,'');
    routeIn.className   = 'form-control glass-dropdown-input route-input';
    routeIn.oninput     = () => debounce(() => {
      const d = (routeIn.value||'').replace(/\D/g,'');
      seg.name = d ? `${d}P` : '';
      updateApplyButtonState();
    });
    row.append(routeIn);

    // MP From
    const minIn = document.createElement('input');
    minIn.type        = 'number';
    minIn.inputMode   = 'decimal';
    minIn.setAttribute('pattern','[0-9]*');
    minIn.value       = seg.mpMin!=null ? seg.mpMin : '';
    minIn.className   = 'form-control glass-dropdown-input mp-input';
    minIn.oninput     = () => debounce(() => {
      const v = parseFloat(minIn.value);
      seg.mpMin = isNaN(v)?null:v;
      updateApplyButtonState();
    });
    row.append(minIn);

    // swap button
    const swap = document.createElement('button');
    swap.type      = 'button';
    swap.className = 'swap-btn';
    swap.innerHTML = '<i class="fas fa-sync-alt"></i>';
    swap.onclick   = () => {
      [seg.mpMin,seg.mpMax]=[seg.mpMax,seg.mpMin];
      renderForm();
    };
    row.append(swap);

    // MP To
    const maxIn = document.createElement('input');
    maxIn.type        = 'number';
    maxIn.inputMode   = 'decimal';
    maxIn.setAttribute('pattern','[0-9]*');
    maxIn.value       = seg.mpMax!=null ? seg.mpMax : '';
    maxIn.className   = 'form-control glass-dropdown-input mp-input';
    maxIn.oninput     = () => debounce(() => {
      const v = parseFloat(maxIn.value);
      seg.mpMax = isNaN(v)?null:v;
      updateApplyButtonState();
    });
    row.append(maxIn);

    // remove button
    const rem = document.createElement('button');
    rem.type      = 'button';
    rem.className = 'remove-btn';
    rem.innerHTML = '<i class="fas fa-times"></i>';
    rem.disabled  = window.customRouteFormData.length===1;
    rem.onclick   = () => {
      window.customRouteFormData.splice(idx,1);
      renderForm();
    };
    row.append(rem);

    container.append(row);
  });

  // + Add Segment
  const addBtn = document.createElement('button');
  addBtn.type      = 'button';
  addBtn.className = 'btn button';
  addBtn.textContent = '+ Add Segment';
  addBtn.onclick   = () => {
    window.customRouteFormData.push({ name:'', mpMin:null, mpMax:null });
    renderForm();
  };
  container.append(addBtn);

  updateApplyButtonState();
}

// debounce helper for renderMap()
function debounce(fn) {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(() => {
    fn();
    renderMap();
  }, 150);
}

// ─────────────────────────────────────────────────────────────────────────────
// Mini‐overview map — place **every** matching camera (original logic from :contentReference[oaicite:1]{index=1})
// ─────────────────────────────────────────────────────────────────────────────
export function renderMap() {
  const mapDiv = document.getElementById('customRouteMap');
  if (!mapDiv) return;
  // full teardown
  if (mapInstance) {
    segmentMarkers.forEach(clearTooltip);
    mapInstance.off();
    mapInstance.remove();
    mapInstance = null;
    delete mapDiv._leaflet_id;
  }
  segmentMarkers = [];
  openTips       = [];

  // init map
  mapInstance = L.map(mapDiv, {
    zoomControl:        false,
    attributionControl: false,
    dragging:           true,
    doubleClickZoom:    true,
    scrollWheelZoom:    true
  });
  L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { attribution:'© Esri', maxZoom:20 }
  ).addTo(mapInstance);
  L.tileLayer(
    'https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
    { attribution:'© Esri', minZoom:0, maxZoom:18 }
  ).addTo(mapInstance);

  // place one marker per camera that matches any segment
  (window.camerasList||[]).forEach(cam => {
    if (!window.customRouteFormData.some(seg=>isCameraOnSegment(cam,seg))) return;
    const m = L.marker([cam.Latitude, cam.Longitude], { icon: smallIcon }).addTo(mapInstance);
    m.cam    = cam;
    m.sticky = false;
    segmentMarkers.push(m);

    // open/clear tooltip on click
    m.on('click', () => {
      if (m.sticky) clearTooltip(m);
      else {
        if (mapInstance.getZoom()>=ZOOM_COLLIDE && openTips.length>=MAX_TOOLTIPS) {
          clearTooltip(openTips.shift());
        }
        repositionTooltip(m);
      }
    });
  });

  // auto‐open when you pan into view
  mapInstance.on('moveend', () => {
    if (mapInstance.getZoom()>=ZOOM_OPEN) {
      segmentMarkers.forEach(m => !m.sticky && m.fire('click'));
    }
  });
  // auto‐close below zoom, recompute collision above
  mapInstance.on('zoomend', () => {
    if (mapInstance.getZoom()<ZOOM_OPEN) openTips.slice().forEach(clearTooltip);
    if (mapInstance.getZoom()>=ZOOM_COLLIDE) {
      setTimeout(()=>openTips.forEach(repositionTooltip), 200);
    }
  });

  // fit bounds or fallback
  const pts = segmentMarkers.map(m=>m.getLatLng());
  if (pts.length) {
    mapInstance.fitBounds(pts, { padding:[8,8], maxZoom:14 });
  } else {
    mapInstance.setView([39.5,-111.5], 6);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// apply filter & update gallery
// ─────────────────────────────────────────────────────────────────────────────
export function applyCustomRouteFilter() {
  const ms = serializeSegments(window.customRouteFormData);
  const ps = new URLSearchParams(window.location.search);
  ps.set('multiRoute', ms);
  window.history.replaceState({}, '', `${window.location.pathname}?${ps}`);
  
  const all = window.customRouteFormData.flatMap(seg =>
    (window.camerasList||[])
      .filter(cam=>isCameraOnSegment(cam,seg))
      .sort((a,b)=>{
        // Use the same normalization logic as filtering
        const normalizeRoute = (routeName) => {
          if (!routeName) return null;
          let normalized = routeName.replace(/^0+/, ''); // Remove leading zeros
          normalized = normalized.replace(/[PN]$/, 'P'); // Standardize to P suffix
          return normalized;
        };
        
        const targetRoute = normalizeRoute(seg.name);
        const route1A = normalizeRoute(a.RoadwayOption1);
        const route2A = normalizeRoute(a.RoadwayOption2);
        const route1B = normalizeRoute(b.RoadwayOption1);
        const route2B = normalizeRoute(b.RoadwayOption2);
        
        const ma = route1A === targetRoute ? a.MilepostOption1 : a.MilepostOption2;
        const mb = route1B === targetRoute ? b.MilepostOption1 : b.MilepostOption2;
        return seg.mpMin<seg.mpMax ? ma-mb : mb-ma;
      })
  );
  refreshGallery(Array.from(new Set(all)));
}

// ─────────────────────────────────────────────────────────────────────────────
// wire up modal buttons
// ─────────────────────────────────────────────────────────────────────────────
export function setupCustomRouteBuilder() {
  parseMultiRouteFromURL();
  const buildBtn = document.getElementById('buildCustomRoute'),
        modalEl  = document.getElementById('customRouteModal'),
        resetBtn = document.getElementById('customRouteReset'),
        copyBtn  = document.getElementById('customRouteCopyUrl'),
        applyBtn = document.getElementById('customRouteApply');
  if (!buildBtn||!modalEl||!resetBtn||!copyBtn||!applyBtn) return;

  const modal = new bootstrap.Modal(modalEl);
  let originalData, applyClicked;

  buildBtn.onclick = e => {
    e.preventDefault();
    originalData = JSON.parse(JSON.stringify(window.customRouteFormData||[]));
    applyClicked = false;
    renderForm();
    modal.show();
  };

  modalEl.addEventListener('shown.bs.modal', () => {
    renderForm();
    renderMap();
    mapInstance.invalidateSize();
    Sortable.create(
      document.getElementById('customRouteFormContainer'),
      { handle:'.drag-handle', animation:150, onEnd:({oldIndex,newIndex})=>{
          const from = oldIndex-1, to = newIndex-1;
          if (from>=0 && to>=0) {
            window.customRouteFormData.splice(
              to,0,
              window.customRouteFormData.splice(from,1)[0]
            );
            renderForm();
          }
      }}
    );
  });

  modalEl.addEventListener('hidden.bs.modal', () => {
    if (!applyClicked) {
      window.customRouteFormData = originalData;
      window.filterImages();
      window.updateSelectedFilters();
      window.updateURLParameters();
    }
    if (mapInstance) {
      mapInstance.remove();
      mapInstance = null;
    }
  });

  resetBtn.onclick = () => {
    window.customRouteFormData = [];
    renderForm();
    renderMap();
  };

  copyBtn.addEventListener('click', async e => {
    e.preventDefault();
    const ms = serializeSegments(window.customRouteFormData);
    const ps = new URLSearchParams(window.location.search);
    ps.set('multiRoute', ms);
    window.history.replaceState({}, '', `${window.location.pathname}?${ps}`);
    await copyToClipboard(window.location.href);
    copyBtn.classList.add('copied');
    copyBtn.textContent = 'URL Copied!';
    setTimeout(()=>{
      copyBtn.classList.remove('copied');
      copyBtn.textContent = 'Copy URL';
    },2000);
  });

  applyBtn.onclick = e => {
    e.preventDefault();
    applyClicked = true;
    applyCustomRouteFilter();
    modal.hide();
  };
}
