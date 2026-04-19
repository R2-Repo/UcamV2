// gallery.js (mini map for all filtered views, 50 nearest, zoom-in on user for nearest only)
import { updateModalMiniMap, updateModalInfoDeck } from './modal.js';
const galleryContainer   = document.getElementById('imageGallery');
const cameraCountElement = document.getElementById('cameraCount');
let currentIndex = 0;
let currentModalCamera = null;

/**
 * Determines the current filter context for the gallery,
 * including custom multi-segment routes.
 * @returns {{ isFiltered: boolean, type: string, label: string, nearest: {lat:number,lng:number}|null }}
 */
function getGalleryFilterContext() {
  let type       = null;
  let label      = "Overview";
  let nearest    = null;
  let isFiltered = false;

  // Custom multi-segment route takes highest priority
  if (window.customRouteFormData?.length) {
    type       = "multiRoute";
    label      = "Custom Route";
    isFiltered = true;
  }
  // Nearest-camera mode
  else if (window.isNearestFilterActive && window.nearestUserLocation) {
    type       = "nearest";
    label      = "Nearest Cameras";
    nearest    = window.nearestUserLocation;
    isFiltered = true;
  }
  // Single curated route
  else if (window.selectedRoute && window.selectedRoute !== 'All') {
    type       = "route";
    label      = window.selectedRoute;
    isFiltered = true;
  }
  // Image issues filter
  else if (window.selectedIssueFilter) {
    type       = "issue";
    label      = window.issueFilterLabels?.[window.selectedIssueFilter] || "Image Issues";
    isFiltered = true;
  }
  // Region overview
  else if (window.selectedRegion) {
    type       = "region";
    label      = "Region Overview";
    isFiltered = true;
  }
  // County overview
  else if (window.selectedCounty) {
    type       = "county";
    label      = "County Overview";
    isFiltered = true;
  }
  // City overview
  else if (window.selectedCity) {
    type       = "city";
    label      = "City Overview";
    isFiltered = true;
  }
  // Maintenance-station overview
  else if (window.selectedMaintenanceStation) {
    type       = "maintenance";
    label      = "Maintenance Overview";
    isFiltered = true;
  }
  // Any other filter (e.g. Inactive Cameras)
  else if (window.selectedOtherFilter) {
    type       = "other";
    label      = window.selectedOtherFilter;
    isFiltered = true;
  }
  // Free-text search
  else if (window.searchQuery) {
    type       = "search";
    label      = "Search Results";
    isFiltered = true;
  }

  return { isFiltered, type, label, nearest };
}


/**
 * Renders an array of camera objects into the gallery.
 * @param {Array} cameras
 */
// gallery.js

export function renderGallery(cameras) {
  galleryContainer.innerHTML = '';

  // 0) Normalize legacy vs. new format
  // If the first item has no .type, we assume it's a raw camera array.
  const unified = Array.isArray(cameras) && cameras.length && cameras[0].type
    ? cameras
    : cameras.map(camObj => ({ type: 'camera', camera: camObj }));

  // 1) Determine filter context
  const filterCtx = getGalleryFilterContext();
  window.currentGalleryFilterType = filterCtx.type || '';

  // 2) For “nearest” only show top 50
  let itemsToShow = unified;
  if (filterCtx.type === 'nearest') {
    itemsToShow = unified.slice(0, 50);
  }

  // --- Dynamic image size application ---
  const sizeSlider = document.getElementById('sizeSlider');
  const galleryWidth = galleryContainer.offsetWidth || window.innerWidth;
  let dynamicSize = calculateDynamicImageSize(itemsToShow.length, galleryWidth);
  if (!userImageSizeOverride && sizeSlider) {
    sizeSlider.value = dynamicSize;
    galleryContainer.style.gridTemplateColumns = `repeat(auto-fit, minmax(${dynamicSize}px, 1fr))`;
  }

  // 3) Insert mini‐overview map for any filtered view
  if (filterCtx.isFiltered && itemsToShow.length > 0) {
    const overviewCell = document.createElement('div');
    overviewCell.className = 'col';
    overviewCell.innerHTML = `
      <div class="aspect-ratio-box overview-map">
        <a href="#" data-bs-toggle="modal" data-bs-target="#overviewMapModal">
          <div id="overview-tile" style="width:100%;height:100%;"></div>
        </a>
      </div>
    `;
    galleryContainer.append(overviewCell);

    // Build the mini‐map only from actual cameras:
    const overviewTile = overviewCell.querySelector('#overview-tile');
    requestAnimationFrame(() => {
      const coords = itemsToShow
        .filter(item => item.type === 'camera')
        .map(item => [item.camera.Latitude, item.camera.Longitude])
        .filter(([lat, lng]) => typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng));
      const bounds = L.latLngBounds(coords);

      let mapCenter = null;
      if (filterCtx.type === 'nearest' && filterCtx.nearest) {
        mapCenter = [filterCtx.nearest.lat, filterCtx.nearest.lng];
      }

      if (overviewTile._miniMapInstance) {
        overviewTile._miniMapInstance.remove();
        overviewTile._miniMapInstance = null;
      }

      const miniMap = L.map(overviewTile, {
        attributionControl: false,
        zoomControl:      false,
        dragging:         true,
        scrollWheelZoom:  true,
        doubleClickZoom:  false,
        touchZoom:        true
      });
      overviewTile._miniMapInstance = miniMap;

      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { attribution: '&copy; Esri', subdomains: 'abcd', maxZoom: 20 }
      ).addTo(miniMap);

      L.tileLayer(
        'https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
        { attribution: '&copy; Esri', minZoom: 0, maxZoom: 18 }
      ).addTo(miniMap);

      coords.forEach(([lat, lng]) => {
        L.circleMarker([lat, lng], {
          radius:      3,
          fillColor:   '#ff7800',
          color:       '#ffffff',
          weight:      0.75,
          opacity:     1,
          fillOpacity: 1
        }).addTo(miniMap);
      });

      if (filterCtx.type === 'nearest' && filterCtx.nearest) {
        L.circleMarker([filterCtx.nearest.lat, filterCtx.nearest.lng], {
          radius:      6,
          fillColor:   '#2186f6',
          color:       '#ffffff',
          weight:      2,
          opacity:     1,
          fillOpacity: 1
        }).addTo(miniMap);
      }

      const fitMap = () => {
        miniMap.invalidateSize();
        if (filterCtx.type === 'nearest' && mapCenter) {
          miniMap.setView(mapCenter, 14);
        } else if (coords.length > 0) {
          miniMap.fitBounds(bounds, { padding: [8, 8], maxZoom: 16 });
        }
      };
      fitMap();
      new ResizeObserver(fitMap).observe(overviewTile);
    });
  }

  // 4) Render each tile (forecast or camera)
  itemsToShow.forEach((item, i) => {
    const col = document.createElement('div');
    col.classList.add('col');

    if (item.type === 'forecast') {
      // Forecast tile
      col.innerHTML = `
        <div class="aspect-ratio-box forecast-item">
          ${item.html}
        </div>`;
    } else {
      // Camera tile
      const cam = item.camera;
      const arb = document.createElement('div');
      arb.classList.add('aspect-ratio-box');

      const anc = document.createElement('a');
      anc.href = '#';
      anc.setAttribute('data-bs-toggle', 'modal');
      anc.setAttribute('data-bs-target', '#imageModal');
      anc.addEventListener('click', e => {
        e.preventDefault();
        showImage(i);
      });

      const img = document.createElement('img');
      img.loading = 'lazy';
      img.src     = cam.Views[0].Url;
      img.alt     = `Camera at ${cam.Location}`;
      img.dataset.cameraInfo = `Location: ${cam.Location}\nUrl: ${cam.Views[0].Url}`;

      anc.append(img);
      arb.append(anc);
      col.append(arb);
    }

    galleryContainer.append(col);
  });
}

// --- Dynamic image size logic ---
let userImageSizeOverride = false;

function calculateDynamicImageSize(imageCount, containerWidth) {
  // On mobile, default to 120px (restores previous sizing)
  if (window.innerWidth <= 600) return 180;
  if (imageCount <= 3) {
    const maxImg = Math.min(420, Math.floor(containerWidth / imageCount) - 8);
    return Math.max(260, maxImg);
  } else if (imageCount <= 10) {
    const maxImg = Math.min(600, Math.floor(containerWidth / imageCount) - 8);
    return Math.max(340, maxImg);
  } else if (imageCount <= 15) {
    const maxImg = Math.min(480, Math.floor(containerWidth / imageCount) - 8);
    return Math.max(280, maxImg);
  } else if (imageCount <= 25) {
    const maxImg = Math.min(380, Math.floor(containerWidth / imageCount) - 8);
    return Math.max(220, maxImg);
  }
  // For more images, use default 200px
  return 200;
}

/**
 * Updates the camera count display.
 */
export function updateCameraCount() {
  cameraCountElement.textContent = `${window.visibleCameras.length}`;
}

/**
 * Shows the selected image in the modal.
 * @param {number} index
 */
export function showImage(index) {
  document.querySelectorAll('.aspect-ratio-box.selected')
    .forEach(el => el.classList.remove('selected'));
  currentIndex = index;
  const item = window.visibleCameras[index];
  if (item.type !== 'camera') return;
  const cam = item.camera;
  setModalFromCamera(cam, index);
}

// Expose a reset for the override flag
export function resetImageSizeOverride() {
  userImageSizeOverride = false;
}

function setModalFromCamera(cam, indexInVisible) {
  const modal = document.getElementById('imageModal');
  if (!modal) return;
  const modalImage = modal.querySelector('#modalImage');
  const modalTitle = modal.querySelector('.modal-title');
  if (!modalImage || !modalTitle) return;

  modalImage.src         = cam?.Views?.[0]?.Url || '';
  modalTitle.textContent = cam?.Location || 'Camera';
  modalImage.dataset.latitude  = cam?.Latitude ?? '';
  modalImage.dataset.longitude = cam?.Longitude ?? '';

  currentModalCamera = cam;
  const neighbors = setNeighborCards(cam);
  updateModalMiniMap(
    cam,
    neighbors?.neg?.cam || neighbors?.neg?.camera,
    neighbors?.pos?.cam || neighbors?.pos?.camera
  );
  updateModalInfoDeck(cam);

  if (typeof indexInVisible === 'number') {
    const tiles = document.querySelectorAll('.aspect-ratio-box');
    if (tiles[indexInVisible]) tiles[indexInVisible].classList.add('selected');
  }
}

function setNeighborCards(cam) {
  const neighbors = getNeighborEntries(cam);
  setNeighborCard('Prev', neighbors.neg);
  setNeighborCard('Next', neighbors.pos);
  return neighbors;
}

function setNeighborCard(positionLabel, entry) {
  const card     = document.getElementById(`carousel${positionLabel}Card`);
  const img      = document.getElementById(`carousel${positionLabel}Image`);
  if (!card || !img) return;

  if (entry && entry.imageUrl) {
    img.src = entry.imageUrl;
    img.alt = entry.label || 'Neighbor camera';
    card.classList.remove('is-empty');
    card.onclick = () => showNeighbor(entry, positionLabel === 'Prev' ? 'neg' : 'pos');
  } else {
    img.src = '';
    img.alt = '';
    card.classList.add('is-empty');
    card.onclick = null;
  }
}

const carouselTrack   = document.querySelector('.carousel-3d-track');
const CAROUSEL_ANIM_MS = 750;

function animateCarousel(direction, entry) {
  if (!carouselTrack) {
    if (entry?.cam) setModalFromCamera(entry.cam);
    return Promise.resolve();
  }

  const cls = direction === 'neg' ? 'is-sliding-right' : 'is-sliding-left';
  carouselTrack.classList.remove('is-sliding-left', 'is-sliding-right', 'is-flipping-left', 'is-flipping-right');
  // force reflow to restart animation
  void carouselTrack.offsetWidth;
  carouselTrack.classList.add(cls);

  // Swap the modal image roughly mid-flight so the incoming card feels like it takes over the center.
  if (entry?.cam) {
    setTimeout(() => setModalFromCamera(entry.cam), Math.floor(CAROUSEL_ANIM_MS * 0.45));
  }

  return new Promise(resolve => {
    const clear = () => {
      carouselTrack.classList.remove(cls);
      resolve();
    };
    setTimeout(clear, CAROUSEL_ANIM_MS);
  });
}

async function showNeighbor(entry, direction) {
  if (!entry?.cam) return;
  await animateCarousel(direction, entry);
  const idx = (window.visibleCameras || []).findIndex(item => item.type === 'camera' && item.camera.Id === entry.cam.Id);
  if (idx >= 0) {
    showImage(idx);
    return;
  }
  setModalFromCamera(entry.cam);
}

function findAdjacentInGallery(cam) {
  const visible = (window.visibleCameras || []).filter(item => item.type === 'camera');
  const idx = visible.findIndex(item => item.camera?.Id === cam?.Id);
  if (idx === -1) return null; // Camera not in gallery

  const prevCam = idx > 0 ? visible[idx - 1].camera : null;
  const nextCam = idx < visible.length - 1 ? visible[idx + 1].camera : null;
  return {
    prev: buildNeighborFromCam(prevCam),
    next: buildNeighborFromCam(nextCam)
  };
}

function getNeighborEntries(cam) {
  const meta = cam?._geoJsonMetadata?.neighbors || {};
  const negMeta = buildNeighbor(meta.route1NegName, meta.route1NegUrl);
  const posMeta = buildNeighbor(meta.route1PosName, meta.route1PosUrl);
  const adj = findAdjacentNeighbors(cam);

  // When gallery is filtered, use gallery order with neighbor fallback at edges
  if (window.currentGalleryFilterType) {
    const galleryAdj = findAdjacentInGallery(cam);

    if (galleryAdj) {
      // Camera is in the filtered gallery — use gallery order
      // At edges (first/last), fill the empty slot with neighbor metadata
      const neg = galleryAdj.prev || negMeta || adj.prev || null;
      const pos = galleryAdj.next || posMeta || adj.next || null;
      return { neg, pos };
    }
    // Camera not in gallery (scrolled past edge into neighbor territory)
    // Fall through to standard neighbor logic below
  }

  const neg = negMeta || adj.prev || null;
  const pos = posMeta || adj.next || null;
  return { neg, pos };
}

function buildNeighbor(name, imageUrl) {
  if (!name && !imageUrl) return null;
  const cam = findCameraByUrl(imageUrl);
  const url = imageUrl || cam?.Views?.[0]?.Url;
  return { cam, imageUrl: url, label: name || cam?.Location || 'Nearby camera' };
}

function findAdjacentNeighbors(cam) {
  const list = window.camerasList || [];
  const idx = list.findIndex(c => c.Id === cam.Id);
  if (idx === -1) return { prev: null, next: null };

  const prevCam = list[idx - 1];
  const nextCam = list[idx + 1];

  const prev = buildNeighborFromCam(prevCam);
  const next = buildNeighborFromCam(nextCam);
  return { prev, next };
}

function buildNeighborFromCam(cam) {
  if (!cam) return null;
  const url = cam?.Views?.[0]?.Url;
  if (!url) return null;
  return { cam, imageUrl: url, label: cam.Location || 'Nearby camera' };
}

function findCameraByUrl(url) {
  if (!url) return null;
  const normalized = normalizeUrl(url);
  const fromVisible = (window.visibleCameras || []).find(item => item.type === 'camera' && normalizeUrl(item.camera?.Views?.[0]?.Url) === normalized);
  if (fromVisible) return fromVisible.camera;
  return (window.camerasList || []).find(cam => normalizeUrl(cam?.Views?.[0]?.Url) === normalized) || null;
}

function normalizeUrl(u) {
  return (u || '').trim();
}

function navigateNeighbor(direction) {
  if (!currentModalCamera) return;
  const neighbors = getNeighborEntries(currentModalCamera);
  const entry = direction === 'neg' ? neighbors.neg : neighbors.pos;
  if (entry?.cam) showNeighbor(entry, direction);
}

const prevBtn = document.getElementById('carouselPrevButton');
const nextBtn = document.getElementById('carouselNextButton');
if (prevBtn) prevBtn.addEventListener('click', () => navigateNeighbor('neg'));
if (nextBtn) nextBtn.addEventListener('click', () => navigateNeighbor('pos'));
