// events.js
import { debounce, getDistance } from './utils.js';
import { filterImages } from './filters.js';
import { updateURLParameters } from './ui.js';
import { copyURLToClipboard } from './ui.js';

const DEBOUNCE_DELAY = 300;
const MIN_IMAGE_SIZE = 80;

export function setupCopyUrlButton() {
  const btn = document.getElementById('copyUrlButton');
  if (!btn) return;

  btn.addEventListener('click', e => {
    e.preventDefault();

    // ensure address bar is up‑to‑date
    updateURLParameters();

    copyURLToClipboard()
      .then(() => {
        // Optional feedback:
        const old = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = old, 1500);
      })
      .catch(err => {
        console.error('Failed to copy URL:', err);
      });
  });
}


/**
 * Sets up the search input listener with debounce.
 */
export function setupSearchListener() {
  const searchInput = document.getElementById('searchInput');
  if (!searchInput) return;
  searchInput.addEventListener('input', debounce(e => {
    window.searchQuery = e.target.value;
    filterImages();
  }, DEBOUNCE_DELAY));
  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      bootstrap.Dropdown.getInstance(document.getElementById('searchDropdownButton'))?.hide();
    }
  });
}

/**
 * Sets up the refresh button to bust image cache.
 */
export function setupRefreshButton() {
  const refreshButton = document.getElementById('refreshButton');
  if (!refreshButton) return;
  refreshButton.addEventListener('click', e => {
    e.preventDefault();
    document.getElementById('imageGallery').querySelectorAll('img').forEach(img => {
      let orig = img.dataset.originalSrc || img.src;
      img.dataset.originalSrc = orig;
      orig = orig.split('?refresh=')[0];
      img.src = orig + (orig.includes('?') ? '&' : '?') + 'refresh=' + Date.now();
    });
  });
}

/**
 * Sets up the image size slider and pinch-zoom controls.
 */
export function setupSizeSlider() {
  const sizeSlider = document.getElementById('sizeSlider');
  const sizeControlButton = document.getElementById('sizeControlButton');
  const sizeSliderContainer = document.getElementById('sizeSliderContainer');
  if (sizeControlButton && sizeSliderContainer) {
    sizeControlButton.addEventListener('click', e => {
      e.stopPropagation();
      sizeSliderContainer.classList.toggle('active');
      setTimeout(() => sizeSliderContainer.classList.remove('active'), 3000);
    });
  }
  if (!sizeSlider) return;
  const galleryContainer = document.getElementById('imageGallery');
  sizeSlider.addEventListener('input', () => {
    const v = parseInt(sizeSlider.value, 10);
    const n = Math.max(v, MIN_IMAGE_SIZE);
    galleryContainer.style.gridTemplateColumns = `repeat(auto-fit, minmax(${n}px, 1fr))`;
    window.userImageSizeOverride = true;
    clearTimeout(sizeSlider.autoHideTimeout);
    sizeSlider.autoHideTimeout = setTimeout(() => sizeSliderContainer.classList.remove('active'), 3000);
  });
  document.addEventListener('click', e => {
    if (!sizeControlButton.contains(e.target) && !sizeSliderContainer.contains(e.target)) {
      sizeSliderContainer.classList.remove('active');
    }
  });

  // Pinch-zoom handling
  let initialGridDistance = null;
  let initialGridSize     = parseInt(sizeSlider.value, 10) || 120;
  galleryContainer.style.touchAction = 'pan-y pinch-zoom';
  galleryContainer.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
      e.preventDefault();
      initialGridDistance = getDistance(e.touches[0], e.touches[1]);
      initialGridSize     = parseInt(sizeSlider.value, 10) || 120;
    }
  }, { passive: false });
  galleryContainer.addEventListener('touchmove', e => {
    if (e.touches.length === 2 && initialGridDistance) {
      e.preventDefault();
      const currentDist = getDistance(e.touches[0], e.touches[1]);
      let newSize = Math.round(initialGridSize * (currentDist / initialGridDistance));
      newSize = Math.max(MIN_IMAGE_SIZE, Math.min(newSize, parseInt(sizeSlider.max, 10) || 380));
      sizeSlider.value = newSize;
      galleryContainer.style.gridTemplateColumns = `repeat(auto-fit, minmax(${newSize}px, 1fr))`;
    }
  }, { passive: false });
  galleryContainer.addEventListener('touchend', () => {
    initialGridDistance = null;
  }, { passive: true });
}

/**
 * Hides open dropdown panels when the main filter button is collapsed.
 */
export function setupDropdownHide() {
  const parent = document.getElementById('filterDropdownButton')?.parentElement;
  if (!parent) return;
  parent.addEventListener('hide.bs.dropdown', () => {
    ['regionOptions', 'countyOptions', 'cityOptions', 'maintenanceOptions', 'otherFiltersOptions']
      .forEach(id => {
        const el = document.getElementById(id);
        if (el) bootstrap.Collapse.getOrCreateInstance(el).hide();
      });
  });
}

/**
 * Links any [data-modal] items to their respective Bootstrap modals.
 */
export function setupModalLinks() {
  document.querySelectorAll('[data-modal]').forEach(item =>
    item.addEventListener('click', e => {
      e.preventDefault();
      new bootstrap.Modal(document.getElementById(item.dataset.modal)).show();
    })
  );
}


/** Attach click handlers for “Other Filters” submenu items 
export function setupOtherFiltersListener() {
  document
    .querySelectorAll('#otherFiltersMenu .dropdown-item')
    .forEach(item => {
      item.addEventListener('click', e => {
        e.preventDefault();
        // Set the global and re-filter
        window.selectedOtherFilter = item.dataset.value;
        filterImages();
        updateURLParameters();
        // Close the submenu
        bootstrap.Collapse
          .getOrCreateInstance(document.getElementById('otherFiltersOptions'))
          .hide();
      });
    });
}*/