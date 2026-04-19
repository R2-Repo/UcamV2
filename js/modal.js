// js/modal.js
import { debounce } from './utils.js';
import { initMobileCarousel, updateMobileCarousel, removeMobileCarousel } from './mobileCarousel.js';

// DOM references
const mapButton           = document.getElementById('mapButton');
const modalBody           = document.getElementById('modalBody');
const modalImageContainer = document.getElementById('modalImageContainer');
let mapDisplayed          = false;

// Mini-map state
let modalMiniMap          = null;
let modalMiniMapMarkers   = [];
let modalMiniMapContainer = null;
let lastMiniMapCams       = [];

// Info deck state
let infoDeckContainer     = null;
let infoDeckCards         = [];
let infoDeckActiveIndex   = 0;

// Modal logo
let modalLogo             = null;

export function setupModalMapToggle() {
  if (!mapButton) return;
  mapButton.addEventListener('click', () => {
    if (!mapDisplayed) {
      const img = document.querySelector('#imageModal img');
      const lat = img.dataset.latitude;
      const lon = img.dataset.longitude;
      if (!lat || !lon) return alert('No location data');

      const container = document.createElement('div');
      container.id    = 'modalMapContainer';
      container.style.flex = '1';
      const iframe = document.createElement('iframe');
      Object.assign(iframe, { width: '100%', height: '100%', frameBorder: '0', style: 'border:0;' });
      iframe.src = `https://maps.google.com/maps?q=${lat},${lon}&z=15&t=k&output=embed`;
      container.append(iframe);
      modalBody.append(container);
      modalImageContainer.style.flex = '1';
      modalBody.style.display        = 'flex';
      mapButton.textContent          = 'Hide Map';
      mapDisplayed                   = true;
    } else {
      document.getElementById('modalMapContainer')?.remove();
      modalImageContainer.style.flex = '1';
      mapButton.textContent          = 'Map';
      mapDisplayed                   = false;
    }
  });
}

export function setupModalCleanup() {
  document.getElementById('imageModal')
    .addEventListener('hidden.bs.modal', () => {
      document.getElementById('modalMapContainer')?.remove();
      modalImageContainer.style.flex = '1';
      if (mapButton) mapButton.textContent = 'Map';
      mapDisplayed                   = false;
      resetModalMiniMap();
      resetModalInfoDeck();
      removeModalLogo();
      removeMobileCarousel();
    });
}

export function setupModalMiniMapOnShow() {
  const modalEl = document.getElementById('imageModal');
  if (!modalEl) return;
  modalEl.addEventListener('shown.bs.modal', () => {
    ensureModalLogo();
    // Give layout a moment, then recalc map size/view
    requestAnimationFrame(() => refitMiniMap());
    setTimeout(refitMiniMap, 150);
  });
}

// ---- MODAL LOGO (center bottom) ----
function ensureModalLogo() {
  if (!modalBody) return;
  if (!modalLogo) {
    const container = document.createElement('div');
    container.className = 'modal-logo-container';
    
    const logo = document.createElement('img');
    logo.src = 'gifLogo.gif';
    logo.alt = 'App Logo';
    logo.className = 'modal-logo';
    
    const text = document.createElement('div');
    text.className = 'modal-logo-text';
    text.textContent = 'udotcameras.com';
    
    container.appendChild(logo);
    container.appendChild(text);
    modalBody.append(container);
    modalLogo = container;
  }
}

function removeModalLogo() {
  if (modalLogo) {
    modalLogo.remove();
    modalLogo = null;
  }
}

// ---- MINI OVERVIEW MAP (desktop only) ----
function ensureMiniMap() {
  if (!modalBody) return null;
  if (!modalMiniMapContainer) {
    const container = document.createElement('div');
    container.id = 'modalMiniMap';
    container.className = 'modal-mini-map';
    modalBody.append(container);
    modalMiniMapContainer = container;
  }
  if (!modalMiniMap) {
    modalMiniMap = L.map(modalMiniMapContainer, {
      attributionControl: false,
      zoomControl: false,
      dragging: true,
      scrollWheelZoom: true,
      doubleClickZoom: false,
      touchZoom: true,
      boxZoom: false,
      keyboard: false
    });
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19 }
    ).addTo(modalMiniMap);
    // Nudge Leaflet to recalc dimensions once the container is attached
    requestAnimationFrame(() => modalMiniMap && modalMiniMap.invalidateSize());
  }
  return modalMiniMap;
}

function clearMiniMapMarkers() {
  if (!modalMiniMap) return;
  modalMiniMapMarkers.forEach(m => modalMiniMap.removeLayer(m));
  modalMiniMapMarkers = [];
  lastMiniMapCams     = [];
}

function recalcMiniMapView(cams) {
  if (!modalMiniMap || !cams?.length) return;
  if (cams.length === 1) {
    modalMiniMap.setView([cams[0].lat, cams[0].lon], 14);
  } else {
    const bounds = L.latLngBounds(cams.map(c => [c.lat, c.lon]));
    modalMiniMap.fitBounds(bounds, { padding: [14, 14], maxZoom: 16 });
  }
}

function refitMiniMap() {
  if (!lastMiniMapCams.length) return;
  const map = ensureMiniMap();
  if (!map) return;
  map.invalidateSize();
  recalcMiniMapView(lastMiniMapCams);
}

// ---- INFO DECK (bottom-left) ----
function ensureInfoDeck() {
  if (!modalBody) return null;
  if (!infoDeckContainer) {
    const container = document.createElement('div');
    container.id = 'modalInfoDeck';
    container.className = 'modal-info-stack';
    container.innerHTML = `
      <div class="info-stack-track">
        <div class="info-card info-card--mini-map mobile-only is-active">
          <div class="info-card__map-container" id="mobileInfoMiniMap"></div>
        </div>
        <div class="info-card info-card--meta">
          <div class="info-card__columns">
            <div class="info-card__column">
              <div class="info-card__title">Primary Route</div>
              <div class="info-field"><span class="label">Route:</span><span class="value" data-field="ROUTE_1"></span></div>
              <div class="info-field"><span class="label">Alt Name A:</span><span class="value" data-field="ALT_NAME_1A"></span></div>
              <div class="info-field"><span class="label">Alt Name B:</span><span class="value" data-field="ALT_NAME_1B"></span></div>
              <div class="info-field"><span class="label">MP (LM):</span><span class="value" data-field="MP_LM_1"></span></div>
              <div class="info-field"><span class="label">MP (Phys):</span><span class="value" data-field="MP_PHYS_1"></span></div>
            </div>
            <div class="info-card__column">
              <div class="info-card__title">Secondary Route</div>
              <div class="info-field"><span class="label">Route:</span><span class="value" data-field="ROUTE_2"></span></div>
              <div class="info-field"><span class="label">Alt Name A:</span><span class="value" data-field="ALT_NAME_2A"></span></div>
              <div class="info-field"><span class="label">Alt Name B:</span><span class="value" data-field="ALT_NAME_2B"></span></div>
              <div class="info-field"><span class="label">MP (LM):</span><span class="value" data-field="MP_LM_2"></span></div>
              <div class="info-field"><span class="label">MP (Phys):</span><span class="value" data-field="MP_PHYS_2"></span></div>
            </div>
          </div>
          <div class="info-card__footer" data-info-footer></div>
        </div>
        <div class="info-card info-card--street">
          <div class="info-card__embed" data-embed-type="street"></div>
        </div>
        <div class="info-card info-card--map">
          <div class="info-card__embed" data-embed-type="map"></div>
        </div>
      </div>
      <div class="info-stack-controls">
        <button type="button" class="button ghost info-prev" aria-label="Previous info card"><i class="fas fa-chevron-left"></i></button>
        <div class="info-stack-dots">
          <div class="info-stack-dot active" data-card-index="0"></div>
          <div class="info-stack-dot" data-card-index="1"></div>
          <div class="info-stack-dot" data-card-index="2"></div>
          <div class="info-stack-dot mobile-only" data-card-index="3"></div>
        </div>
        <button type="button" class="button ghost info-next" aria-label="Next info card"><i class="fas fa-chevron-right"></i></button>
      </div>
      <button type="button" class="info-stack-arrow info-stack-arrow-left" aria-label="Previous card">
        <i class="fas fa-chevron-left"></i>
      </button>
      <button type="button" class="info-stack-arrow info-stack-arrow-right" aria-label="Next card">
        <i class="fas fa-chevron-right"></i>
      </button>
    `;
    modalBody.append(container);
    infoDeckContainer = container;

    const prev = container.querySelector('.info-prev');
    const next = container.querySelector('.info-next');
    if (prev) prev.addEventListener('click', () => rotateInfoDeck(-1));
    if (next) next.addEventListener('click', () => rotateInfoDeck(1));
    
    // Setup overlay arrow buttons
    const arrowLeft = container.querySelector('.info-stack-arrow-left');
    const arrowRight = container.querySelector('.info-stack-arrow-right');
    if (arrowLeft) arrowLeft.addEventListener('click', () => rotateInfoDeck(-1));
    if (arrowRight) arrowRight.addEventListener('click', () => rotateInfoDeck(1));
    
    // On desktop, exclude mobile-only cards from the deck
    const allCards = Array.from(container.querySelectorAll('.info-card'));
    infoDeckCards = window.innerWidth > 768 
      ? allCards.filter(card => !card.classList.contains('mobile-only'))
      : allCards;
    
    // Setup clickable dots
    const dots = container.querySelectorAll('.info-stack-dot');
    dots.forEach(dot => {
      dot.addEventListener('click', () => {
        const index = parseInt(dot.dataset.cardIndex);
        if (!isNaN(index)) setInfoCardState(index);
      });
    });
    
    // Setup swipe for mobile
    setupInfoDeckSwipe(container);
  }
  return infoDeckContainer;
}

function setupInfoDeckSwipe(container) {
  const track = container.querySelector('.info-stack-track');
  if (!track) return;
  
  let startX = 0;
  let startY = 0;
  let isDragging = false;
  
  track.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    isDragging = true;
  }, { passive: true });
  
  track.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
  }, { passive: true });
  
  track.addEventListener('touchend', (e) => {
    if (!isDragging) return;
    isDragging = false;
    
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const deltaX = endX - startX;
    const deltaY = endY - startY;
    
    // Only swipe if horizontal movement is greater than vertical
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      if (deltaX > 0) {
        rotateInfoDeck(-1); // Swipe right = previous
      } else {
        rotateInfoDeck(1); // Swipe left = next
      }
    }
  }, { passive: true });
}

function resetModalInfoDeck() {
  if (infoDeckContainer) {
    infoDeckContainer.remove();
    infoDeckContainer = null;
  }
  infoDeckCards = [];
  infoDeckActiveIndex = 0;
}

function sanitizeValue(val) {
  if (val === undefined || val === null) return '';
  if (typeof val === 'string' && val.trim().toUpperCase() === 'NULL') return '';
  return String(val).trim();
}

function setInfoCardState(activeIdx) {
  if (!infoDeckCards.length) return;
  infoDeckActiveIndex = activeIdx;
  const total = infoDeckCards.length;
  const leftIdx  = (activeIdx - 1 + total) % total;
  const rightIdx = (activeIdx + 1) % total;

  infoDeckCards.forEach((card, idx) => {
    card.classList.remove('is-active', 'is-left', 'is-right');
    if (idx === activeIdx) card.classList.add('is-active');
    else if (idx === leftIdx) card.classList.add('is-left');
    else if (idx === rightIdx) card.classList.add('is-right');
  });
  
  // Update dots
  if (infoDeckContainer) {
    const dots = infoDeckContainer.querySelectorAll('.info-stack-dot');
    dots.forEach((dot, idx) => {
      dot.classList.toggle('active', idx === activeIdx);
    });
  }

  const activeCard = infoDeckCards[activeIdx];
  const embedType = activeCard?.querySelector('.info-card__embed')?.dataset?.embedType;
  if (embedType) maybeLoadEmbed(embedType);
}

function rotateInfoDeck(step) {
  if (!infoDeckCards.length) return;
  const total = infoDeckCards.length;
  const nextIdx = (infoDeckActiveIndex + step + total) % total;
  setInfoCardState(nextIdx);
}

function populateMetaCard(cam) {
  if (!infoDeckContainer) return;
  const meta = infoDeckContainer.querySelector('.info-card--meta');
  if (!meta) return;

  const geo = cam?._geoJsonMetadata || {};
  const routes = geo.routes || {};
  const alt = geo.altNames || {};
  const pos = geo.positioning || {};

  // Map data fields to their sources - using raw GeoJSON values
  const fieldMap = {
    'ROUTE_1': routes.route1Code,
    'ALT_NAME_1A': alt.route1A,
    'ALT_NAME_1B': alt.route1B,
    'MP_LM_1': pos.logicalMP1,
    'MP_PHYS_1': pos.physicalMP1,
    'ROUTE_2': routes.route2Code,
    'ALT_NAME_2A': alt.route2A,
    'ALT_NAME_2B': alt.route2B,
    'MP_LM_2': pos.logicalMP2,
    'MP_PHYS_2': pos.physicalMP2
  };

  Object.entries(fieldMap).forEach(([field, value]) => {
    const el = meta.querySelector(`[data-field="${field}"]`);
    if (el) el.textContent = sanitizeValue(value);
  });

  const footer = meta.querySelector('[data-info-footer]');
  if (footer) {
    const parts = [
      sanitizeValue(cam?.MunicipalBoundary),
      sanitizeValue(cam?.CountyBoundary),
      cam?.Region ? `Region ${cam.Region}` : ''
    ].filter(Boolean);
    footer.textContent = parts.join(' • ');
  }
}

function resetEmbedCard(type, url) {
  if (!infoDeckContainer) return;
  const target = infoDeckContainer.querySelector(`.info-card__embed[data-embed-type="${type}"]`);
  if (!target) return;
  target.dataset.src = url || '';
  target.textContent = url ? 'Tap to load' : 'Not available';
  const existing = target.querySelector('iframe');
  if (existing) existing.remove();
}

function maybeLoadEmbed(type) {
  if (!infoDeckContainer) return;
  const target = infoDeckContainer.querySelector(`.info-card__embed[data-embed-type="${type}"]`);
  if (!target) return;
  const url = target.dataset.src;
  if (!url || target.querySelector('iframe')) return;

  target.textContent = '';
  const iframe = document.createElement('iframe');
  iframe.loading = 'lazy';
  iframe.src = url;
  iframe.title = type === 'street' ? 'Street View' : 'Map';
  iframe.referrerPolicy = 'no-referrer-when-downgrade';
  iframe.allowFullscreen = true;
  iframe.setAttribute('aria-label', iframe.title);
  target.append(iframe);
}

export function updateModalInfoDeck(cam) {
  const container = ensureInfoDeck();
  if (!container) return;

  populateMetaCard(cam);
  const embeds = cam?._geoJsonMetadata?.embeds || {};
  resetEmbedCard('street', sanitizeValue(embeds.streetView));
  resetEmbedCard('map', sanitizeValue(embeds.googleMaps));

  // Start with first card (meta on desktop, mini-map on mobile)
  setInfoCardState(0);
}

export function resetModalMiniMap() {
  if (modalMiniMap) {
    modalMiniMap.remove();
    modalMiniMap = null;
  }
  if (modalMiniMapContainer) {
    modalMiniMapContainer.remove();
    modalMiniMapContainer = null;
  }
  modalMiniMapMarkers = [];
}

export function updateModalMiniMap(centerCam, prevCam, nextCam) {
  // Desktop mini-map
  if (window.innerWidth > 1024 && window.innerWidth <= 768) {
    // Never true - keeps desktop logic separate
    resetModalMiniMap();
  } else {
    const cams = [centerCam, prevCam, nextCam]
      .filter(Boolean)
      .map((cam, idx) => ({
        cam,
        lat: Number(cam?.Latitude),
        lon: Number(cam?.Longitude),
        isCenter: idx === 0
      }))
      .filter(({ lat, lon }) => Number.isFinite(lat) && Number.isFinite(lon));

    if (!cams.length) {
      resetModalMiniMap();
    } else {
      const map = ensureMiniMap();
      if (map && modalMiniMapContainer) {
        clearMiniMapMarkers();

        cams.forEach(({ cam, lat, lon, isCenter }, idx) => {
          let fillColor;
          if (isCenter) {
            fillColor = '#FFD700'; // Yellow - center/current
          } else if (idx === 1) {
            fillColor = '#00FF88'; // Green - left/behind/NEG (prevCam)
          } else {
            fillColor = '#FF4444'; // Red - right/ahead/POS (nextCam)
          }
          
          const marker = L.circleMarker([lat, lon], {
            radius: isCenter ? 8 : 6,
            fillColor: fillColor,
            color: '#ffffff',
            weight: isCenter ? 2 : 1.5,
            opacity: 1,
            fillOpacity: 1,
            className: isCenter ? 'mini-map-marker-center' : 'mini-map-marker'
          }).addTo(map);
          marker.bindTooltip(cam?.Location || 'Camera', { permanent: false, direction: 'top' });
          modalMiniMapMarkers.push(marker);
        });

        recalcMiniMapView(cams);
        lastMiniMapCams = cams;

        // Ensure tiles fill the container after layout settles
        requestAnimationFrame(() => {
          if (!modalMiniMap) return;
          modalMiniMap.invalidateSize();
          recalcMiniMapView(lastMiniMapCams);
        });
        setTimeout(() => {
          if (!modalMiniMap) return;
          modalMiniMap.invalidateSize();
          recalcMiniMapView(lastMiniMapCams);
        });

        modalMiniMapContainer.style.display = 'block';
      }
    }
  }
  
  // Mobile vertical carousel - ignore neighbor fields, use list order
  if (window.innerWidth <= 768) {
    updateMobileCarousel(centerCam, null, null);
  }
}

export function updateMobileMiniMap(centerCam, prevCam, nextCam) {
  if (window.innerWidth > 768) return; // Mobile only
  
  const mapContainer = document.getElementById('mobileInfoMiniMap');
  if (!mapContainer) return;
  
  // Remove existing map if any
  if (mapContainer._leaflet_id) {
    mapContainer.innerHTML = '';
    delete mapContainer._leaflet_id;
  }
  
  const cams = [centerCam, prevCam, nextCam]
    .filter(Boolean)
    .map((cam, idx) => ({
      cam,
      lat: Number(cam?.Latitude),
      lon: Number(cam?.Longitude),
      isCenter: idx === 0,
      isNext: idx === 2, // Top/POS neighbor (red)
      isPrev: idx === 1  // Bottom/NEG neighbor (green)
    }))
    .filter(({ lat, lon }) => Number.isFinite(lat) && Number.isFinite(lon));

  if (!cams.length) return;
  
  // Wait for container to be visible
  requestAnimationFrame(() => {
    // Create map
    const map = L.map(mapContainer, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      touchZoom: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      tap: false
    });
    
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19
    }).addTo(map);
    
    // Add markers with traffic light colors
    cams.forEach(({ cam, lat, lon, isCenter, isNext, isPrev }) => {
      let fillColor = '#0ddf92'; // Default fallback
      if (isCenter) fillColor = '#FFD700'; // Yellow - center/current
      else if (isNext) fillColor = '#FF4444'; // Red - top/ahead/POS
      else if (isPrev) fillColor = '#00FF88'; // Green - bottom/behind/NEG
      
      L.circleMarker([lat, lon], {
        radius: isCenter ? 8 : 6,
        fillColor: fillColor,
        color: '#ffffff',
        weight: isCenter ? 2 : 1.5,
        opacity: 1,
        fillOpacity: 1
      }).addTo(map).bindTooltip(cam?.Location || 'Camera', { 
        permanent: false, 
        direction: 'top' 
      });
    });
    
    // Fit bounds
    const bounds = L.latLngBounds(cams.map(({ lat, lon }) => [lat, lon]));
    map.fitBounds(bounds, { padding: [30, 30] });
    
    // Force multiple resize attempts to ensure proper rendering
    setTimeout(() => {
      if (map) {
        map.invalidateSize();
        map.fitBounds(bounds, { padding: [30, 30] });
      }
    }, 100);
    
    setTimeout(() => {
      if (map) {
        map.invalidateSize();
        map.fitBounds(bounds, { padding: [30, 30] });
      }
    }, 300);
  });
}

export async function shareImageFile(url, info = "") {
  try {
    const res   = await fetch(url);
    const blob  = await res.blob();
    const file  = new File([blob], 'sharedImage.png', { type: blob.type });
    const data  = { files: [file], title: info, text: info };
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share(data);
    } else {
      alert('Sharing not supported');
    }
  } catch (e) {
    console.error(e);
  }
}
export function setupLongPressShare(sel) {
  const threshold = 500;
  document.querySelectorAll(sel).forEach(img => {
    let timer;
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      img.addEventListener('contextmenu', e => e.preventDefault());
    }
    img.addEventListener('touchstart', () => {
      timer = setTimeout(() => shareImageFile(img.src, img.dataset.cameraInfo || ''), threshold);
    });
    ['touchend','touchcancel'].forEach(evt => img.addEventListener(evt, () => clearTimeout(timer)));
  });
}

// ---- OVERVIEW MODAL ----
export function setupOverviewModal() {
  const smallIcon = L.divIcon({ className: 'custom-marker', iconSize: [12,12], iconAnchor: [6,6], tooltipAnchor: [0,10] });
  const userDotIcon = L.divIcon({
    className: 'user-dot-marker',
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });

  const MAX_TOOLTIPS    = 20;
  const THUMB_WIDTH     = 120;
  const ARROW_HALF      = 6;
  const MARKER_RAD      = 8;
  const MIN_ANCHOR_PX   = 10; // changed from 5 to 10
  const ZOOM_OPEN       = 13;
  const ZOOM_COLLIDE    = 14;

  let map;
  const markers = [];
  const openTips = [];
  let userMarker = null;

  function intersects(a,b) {
    return !(b.left > a.right || b.right < a.left || b.top > a.bottom || b.bottom < a.top);
  }

  function makeHtml(cam) {
    return `<div class="glass-popup-content"><img src="${cam.Views[0].Url}"/></div>`;
  }

  function clearTooltip(marker) {
    if (!marker || !marker.unbindTooltip) return;
    marker.unbindTooltip();
    marker.sticky = false;
    marker._autoOpened = false;
    if (marker._connector) {
      map.removeLayer(marker._connector);
      marker._connector = null;
    }
    if (marker._updateConn) {
      map.off('move zoom viewreset', marker._updateConn);
      marker._updateConn = null;
    }
    const idx = openTips.indexOf(marker);
    if (idx !== -1) openTips.splice(idx, 1);
  }

  function repositionTooltip(marker) {
    if (!marker || !marker.getLatLng) return;
    clearTooltip(marker);
    const html = makeHtml(marker.cam);

    const boxes = markers.map(m => {
      const p = map.latLngToContainerPoint(m.getLatLng());
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
        .addTo(map);
      const r = tmp.getElement().getBoundingClientRect();
      map.removeLayer(tmp);
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

    // enforce minimum anchor length of 10px
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
      offset:      [ox, oy], // use adjusted offset
      permanent:   true,
      interactive: true,
      className:   'glass-popup',
      maxWidth:    THUMB_WIDTH,
      opacity:     1
    }).openTooltip();
    marker.sticky = true;
    openTips.push(marker);

    const markerCP = map.latLngToContainerPoint(marker.getLatLng());
    function computeTipCP() {
      const tt = marker.getTooltip().getElement().getBoundingClientRect();
      const mp = map.getContainer().getBoundingClientRect();
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
    const tipLL = map.containerPointToLatLng(tipCP);

    const poly  = L.polyline([ marker.getLatLng(), tipLL ], { color:'#ff7800', weight:4, interactive:false }).addTo(map);

    // Tooltip/anchor updates on map move/zoom
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
        const mapRect = map.getContainer().getBoundingClientRect();
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
        if (dx || dy) map.panBy([dx, dy], { animate: false });
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
      const adjLL = map.containerPointToLatLng(markerCP.add(v));
      poly.setLatLngs([ marker.getLatLng(), adjLL ]);
    };
    map.on('move zoom viewreset', updateConn);
    marker._connector  = poly;
    marker._updateConn = updateConn;
  }

  function openInView() {
    if (map.getZoom() < ZOOM_OPEN) return;
    const bounds = map.getBounds();
    markers.forEach(m => {
      if (!m.sticky && bounds.contains(m.getLatLng())) m.fire('click');
    });
  }

  const collisionPass = debounce(() => {
    if (map.getZoom() < ZOOM_COLLIDE) return;
    openTips.slice().forEach(m => repositionTooltip(m));
  }, 300);

  const modal = document.getElementById('overviewMapModal');
modal.addEventListener('shown.bs.modal', () => {
  // --- SET PROPER MODAL TITLE ---
  let label = "Overview Map";
  if (window.currentGalleryFilterType === 'route' && window.selectedRoute && window.selectedRoute !== 'All') {
    label = window.selectedRoute;
  } else if (window.currentGalleryFilterType === 'region' && window.selectedRegion) {
    label = `Region: ${window.selectedRegion}`;
  } else if (window.currentGalleryFilterType === 'county' && window.selectedCounty) {
    label = `County: ${window.selectedCounty}`;
  } else if (window.currentGalleryFilterType === 'city' && window.selectedCity) {
    label = `City: ${window.selectedCity}`;
  } else if (window.currentGalleryFilterType === 'maintenance' && window.selectedMaintenanceStation) {
    label = `Maintenance: ${window.selectedMaintenanceStation}`;
  } else if (window.currentGalleryFilterType === 'search' && window.searchQuery) {
    label = `Search: ${window.searchQuery}`;
  } else if (window.currentGalleryFilterType === 'other' && window.selectedOtherFilter) {
    label = `${window.selectedOtherFilter}`;
  } else if (window.currentGalleryFilterType === 'nearest' && window.isNearestFilterActive) {
    label = `Nearest Cameras`;
  } else if (window.selectedRoute && window.selectedRoute !== 'All') {
    label = window.selectedRoute;
  }
  document.getElementById('overviewMapModalLabel').textContent = label;

    if (map) { map.remove(); map = null; }
    markers.length = 0;
    openTips.length = 0;
    if (userMarker) { userMarker.remove(); userMarker = null; }
    const cams = (window.visibleCameras || [])
  .filter(item => item.type === 'camera')
  .map(item => item.camera);
if (!cams.length) return;

// Build bounds from camera coords
const coords = cams.map(c => [c.Latitude, c.Longitude]);
const bounds = L.latLngBounds(coords);
 
    map = L.map('overviewMap', { attributionControl:true, zoomControl:false, dragging:true, doubleClickZoom: true, scrollWheelZoom:true });

    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '&copy; Esri',
        subdomains: 'abcd', maxZoom:20
      }
    ).addTo(map);
    L.tileLayer(
      'https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
        minZoom:0, maxZoom:18,
        attribution: '&copy; OpenStreetMap',
        ext:'png'
      }
    ).addTo(map);

    cams.forEach(cam => {
  const m = L.marker([cam.Latitude, cam.Longitude], { icon: smallIcon }).addTo(map);
  m.cam = cam;
      m.cam = cam; m.sticky = false;
      markers.push(m);
      let hover = null;
      m.on('mouseover', () => {
        if (!m.sticky && !hover) {
          hover = L.tooltip({ permanent:false, interactive:false, opacity:1 })
            .setLatLng(m.getLatLng())
            .setContent(makeHtml(cam))
            .addTo(map);
        }
      });
      m.on('mouseout', () => { if (hover) { map.removeLayer(hover); hover = null; } });
      m.on('click', () => {
        if (m.sticky) { clearTooltip(m); return; }
        if (map.getZoom() >= ZOOM_COLLIDE && openTips.length >= MAX_TOOLTIPS) {
          clearTooltip(openTips.shift());
        }
        repositionTooltip(m);
      });
    });

    // --- USER DOT: show if available ---
    if (window.currentGalleryFilterType === 'nearest' && window.nearestUserLocation) {
      userMarker = L.marker(
        [window.nearestUserLocation.lat, window.nearestUserLocation.lng],
        { icon: userDotIcon, interactive: false }
      ).addTo(map);
    }

    // --- Attach/detach logic for auto-tooltips ---
    function onMoveEnd() {
      if (autoTooltipsEnabled) openInView();
    }
    function onZoomEnd() {
      if (!autoTooltipsEnabled) return openTips.slice().forEach(clearTooltip);
      const z = map.getZoom();
      if (z >= ZOOM_OPEN) openInView(); else openTips.slice().forEach(clearTooltip);
      if (z >= ZOOM_COLLIDE) collisionPass();
    }
    function attachAutoTooltipListeners() {
      map.on('moveend', onMoveEnd);
      map.on('zoomend', onZoomEnd);
    }
    function detachAutoTooltipListeners() {
      map.off('moveend', onMoveEnd);
      map.off('zoomend', onZoomEnd);
    }

    let autoTooltipsEnabled = true;
    const toggleBtn = document.getElementById('toggleAutoTooltips');
    if (toggleBtn) {
      function updateToggleBtn() {
        toggleBtn.textContent = 'Auto Open/Close: ' + (autoTooltipsEnabled ? 'ON' : 'OFF');
        toggleBtn.setAttribute('aria-pressed', autoTooltipsEnabled ? 'true' : 'false');
        if (autoTooltipsEnabled) {
          toggleBtn.classList.remove('off');
        } else {
          toggleBtn.classList.add('off');
        }
      }
      updateToggleBtn();
      toggleBtn.onclick = () => {
        autoTooltipsEnabled = !autoTooltipsEnabled;
        updateToggleBtn();
        if (autoTooltipsEnabled) {
          attachAutoTooltipListeners();
          openInView();
        } else {
          detachAutoTooltipListeners();
          openTips.slice().forEach(clearTooltip);
        }
      };
      // Initial state: listeners attached
      attachAutoTooltipListeners();
    }
    // --- Open All / Close All buttons always override auto logic ---
    const openAllBtn = document.getElementById('openAllTips');
    const closeAllBtn = document.getElementById('closeAllTips');
    if (openAllBtn) {
      openAllBtn.onclick = () => {
        markers.forEach(m => {
          if (!m.sticky) m.fire('click');
          m._pinned = true;
        });
        detachAutoTooltipListeners();
      };
    }
    if (closeAllBtn) {
      closeAllBtn.onclick = () => {
        openTips.slice().forEach(clearTooltip);
        markers.forEach(m => { m._pinned = false; });
        detachAutoTooltipListeners();
      };
    }

    map.invalidateSize();
    map.fitBounds(bounds, { padding:[10,10], maxZoom:12 });
  });

  modal.addEventListener('hidden.bs.modal', () => {
    openTips.slice().forEach(clearTooltip);
    if (userMarker) { userMarker.remove(); userMarker = null; }
    if (map) { map.remove(); map = null; }
  });
}

// ---- WEATHER MODAL ----
export function setupWeatherModal() {
  const modal = document.getElementById('weatherModal');
  if (!modal) return;

  modal.addEventListener('show.bs.modal', () => {
    const iframe = modal.querySelector('iframe');
    if (iframe && window.currentWindyUrl) {
      iframe.src = window.currentWindyUrl;
    }
  });

  modal.addEventListener('hidden.bs.modal', () => {
    const iframe = modal.querySelector('iframe');
    if (iframe) {
      iframe.src = '';
    }
  });
}


