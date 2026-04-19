// js/mobileCarousel.js - Mobile-specific 3D drum carousel with infinite scroll

import { updateModalInfoDeck, updateMobileMiniMap } from './modal.js';

let mobileCarouselContainer = null;
let mobileGallery = null;
let mobileCurrentRotation = 0;
let mobileTouchStartY = 0;
let currentCenterCamera = null; // Current camera object at center
let isUpdating = false; // Prevent updates during transitions
let lastSnapPosition = 0; // Track last snapped position to detect movement
let cardCameras = [null, null, null, null, null, null]; // Track which camera each physical card (0-5) is showing
let transitionTimeoutId = null; // Track timeout for cleanup
let borderUpdateThrottle = null; // Throttle border updates during touch

const RADIUS = 160;
const NUM_SLIDES = 6;
const ANGLE_STEP = 360 / NUM_SLIDES; // 60 degrees per slide

// ---- NEIGHBOR RESOLUTION FUNCTIONS ----
// Uses same logic as desktop carousel (gallery.js)

function findCameraByUrl(url) {
  if (!url) return null;
  
  const list = window.camerasList || [];
  // Try exact match first
  let found = list.find(cam => cam?.Views?.[0]?.Url === url);
  
  // Fallback to trimmed
  if (!found) {
    const trimmed = url.trim();
    found = list.find(cam => cam?.Views?.[0]?.Url?.trim() === trimmed);
  }
  
  return found || null;
}

function findAdjacentInList(cam) {
  if (!cam) return { prev: null, next: null };
  
  const list = window.camerasList || [];
  
  // Use ID to find camera (same as desktop)
  const idx = list.findIndex(c => c.Id === cam.Id);
  
  if (idx === -1) {
    console.log('  Camera not found in list by ID:', cam.Id);
    return { prev: null, next: null };
  }
  
  const prevCam = idx > 0 ? list[idx - 1] : null;
  const nextCam = idx < list.length - 1 ? list[idx + 1] : null;
  
  return { prev: prevCam, next: nextCam };
}

function getGalleryAdjacentCamera(cam, direction) {
  const visible = (window.visibleCameras || []).filter(item => item.type === 'camera');
  const idx = visible.findIndex(item => item.camera?.Id === cam?.Id);
  if (idx === -1) return null;

  if (direction === 'pos') {
    return idx < visible.length - 1 ? visible[idx + 1].camera : null;
  } else {
    return idx > 0 ? visible[idx - 1].camera : null;
  }
}

function getNeighborCamera(cam, direction) {
  if (!cam) {
    console.log('getNeighborCamera: no camera provided');
    return null;
  }
  
  console.log(`\n--- getNeighborCamera(${cam.Location}, ${direction}) ---`);
  
  // When gallery is filtered, use gallery order (with neighbor fallback at edges)
  if (window.currentGalleryFilterType) {
    const result = getGalleryAdjacentCamera(cam, direction);
    if (result) {
      console.log(`  ${direction} from gallery:`, result.Location);
      return result;
    }
    // At gallery edge or camera scrolled past gallery — fall through to neighbor metadata
    console.log(`  Gallery edge or not in gallery, falling back to neighbor metadata`);
  }
  
  // Try neighbor field first (same as desktop)
  const meta = cam?._geoJsonMetadata?.neighbors;
  const neighborUrl = direction === 'pos' ? meta?.route1PosUrl : meta?.route1NegUrl;
  const neighborName = direction === 'pos' ? meta?.route1PosName : meta?.route1NegName;
  
  if (neighborUrl) {
    console.log(`  ${direction} neighbor from metadata:`, neighborName || neighborUrl.substring(0, 40) + '...');
    const neighborCam = findCameraByUrl(neighborUrl);
    
    if (neighborCam) {
      console.log(`  ✓ Found via metadata:`, neighborCam.Location);
      return neighborCam;
    }
  }
  
  // Fallback to adjacent in list (same as desktop)
  console.log('  Using fallback - adjacent in list...');
  const adjacent = findAdjacentInList(cam);
  const fallback = direction === 'pos' ? adjacent.next : adjacent.prev;
  
  if (fallback) {
    console.log(`  ✓ Found via list adjacency:`, fallback.Location);
  } else {
    console.log(`  ✗ No neighbor found (at list boundary)`);
  }
  
  return fallback;
}

export function initMobileCarousel(centerCam, prevCam, nextCam) {
  if (window.innerWidth > 768) return; // Only for mobile
  
  const modalBody = document.getElementById('modalBody');
  if (!modalBody) return;

  // Remove any existing mobile carousel
  removeMobileCarousel();

  // Set current center camera
  currentCenterCamera = centerCam;
  console.log(`Starting carousel at camera: ${currentCenterCamera?.Location}`);

  // Create mobile carousel container
  mobileCarouselContainer = document.createElement('div');
  mobileCarouselContainer.className = 'mobile-carousel-scene';
  mobileCarouselContainer.innerHTML = `
    <div class="mobile-gallery" id="mobileGallery"></div>
    <div class="mobile-carousel-controls">
      <button class="button ghost mobile-up-btn" type="button" title="Previous camera">
        <i class="fas fa-chevron-up"></i>
      </button>
      <div class="carousel-dot"></div>
      <button class="button ghost mobile-down-btn" type="button" title="Next camera">
        <i class="fas fa-chevron-down"></i>
      </button>
    </div>
  `;

  modalBody.appendChild(mobileCarouselContainer);
  mobileGallery = document.getElementById('mobileGallery');

  // Create 6 physical cards
  for (let i = 0; i < NUM_SLIDES; i++) {
    const card = document.createElement('div');
    card.className = 'mobile-slide';
    card.style.transform = `rotateX(${i * ANGLE_STEP}deg) translateZ(${RADIUS}px)`;
    card.dataset.position = i;
    
    const img = document.createElement('img');
    img.loading = 'lazy';
    card.appendChild(img);
    mobileGallery.appendChild(card);
  }
  
  // Populate all 6 cards using neighbor chains
  console.log('=== Initial neighbor chain population ===');
  const pos1 = getNeighborCamera(currentCenterCamera, 'pos');  // Top visible
  const neg1 = getNeighborCamera(currentCenterCamera, 'neg');  // Bottom visible
  const pos2 = pos1 ? getNeighborCamera(pos1, 'pos') : null;   // Back-top
  const neg2 = neg1 ? getNeighborCamera(neg1, 'neg') : null;   // Back-bottom
  const pos3 = pos2 ? getNeighborCamera(pos2, 'pos') : null;   // Far back
  
  cardCameras = [
    currentCenterCamera, // P0 (0°, center)
    pos1,                // P1 (60°, top visible)
    pos2,                // P2 (120°, back-top)
    pos3,                // P3 (180°, far back)
    neg2,                // P4 (240°, back-bottom)
    neg1                 // P5 (300°, bottom visible)
  ];
  
  console.log('Card cameras:', cardCameras.map((cam, i) => `P${i}: ${cam?.Location || 'null'}`).join(', '));
  
  // Update all card images
  updateAllCards();
  
  // Start at center (rotation 0 = position 0)
  mobileCurrentRotation = 0;
  lastSnapPosition = 0;
  mobileGallery.style.transform = `rotateX(${mobileCurrentRotation}deg)`;

  setupMobileControls();
  setupMobileTouchEvents();
  
  // Initial border update to ensure correct colors on load
  console.log('=== Initial border setup ===');
  updateVisibleCardBorders();
}

function updateAllCards() {
  console.log('=== updateAllCards START ===');
  
  if (!mobileGallery) {
    console.log('EXIT: No mobileGallery');
    return;
  }
  
  const slides = mobileGallery.querySelectorAll('.mobile-slide');
  
  slides.forEach((slide, position) => {
    const camera = cardCameras[position];
    
    console.log(`Position ${position} (${position * 60}°): ${camera?.Location || 'null'}`);
    
    const img = slide.querySelector('img');
    if (img && camera) {
      const newSrc = camera?.Views?.[0]?.Url || '';
      // Only update src if it changed (iOS optimization)
      if (img.src !== newSrc) {
        img.src = newSrc;
        // Force image decode on iOS for smoother rendering
        if (img.decode) {
          img.decode().catch(() => {
            console.warn('Image decode failed for:', camera?.Location);
          });
        }
      }
      img.alt = camera?.Location || 'Camera';
    } else if (img) {
      img.src = '';
      img.alt = '';
    }
  });
  
  // Update modal title and info cards to show current center camera
  const modalTitle = document.querySelector('#imageModal .modal-title');
  if (modalTitle && currentCenterCamera) {
    modalTitle.textContent = currentCenterCamera?.Location || 'Camera';
  }
  
  // Update info cards with current camera data - use RAF to ensure DOM is ready
  if (currentCenterCamera) {
    // Get the 3 visible cameras for mini map: bottom (P5), center (P0), top (P1)
    const bottomCam = cardCameras[5]; // NEG neighbor
    const topCam = cardCameras[1];    // POS neighbor
    
    console.log('Visible cameras in carousel:');
    console.log('  Bottom (P5):', bottomCam?.Location || 'null');
    console.log('  Center (P0):', currentCenterCamera?.Location);
    console.log('  Top (P1):', topCam?.Location || 'null');
    
    requestAnimationFrame(() => {
      updateModalInfoDeck(currentCenterCamera);
      updateMobileMiniMap(currentCenterCamera, bottomCam, topCam);
    });
  }
  
  // Update visible card borders
  updateVisibleCardBorders();
}

function updateVisibleCardBorders() {
  if (!mobileGallery) return;
  
  // Calculate which physical cards are currently visible
  // Use floor instead of round for more predictable behavior on iOS
  const normalizedRotation = ((mobileCurrentRotation % 360) + 360) % 360;
  const rawIndex = (360 - normalizedRotation) / 60;
  const centerCardIndex = (Math.floor(rawIndex + 0.5)) % 6;
  const topCardIndex = (centerCardIndex + 1) % 6;
  const bottomCardIndex = (centerCardIndex + 5) % 6;
  
  console.log('updateVisibleCardBorders:', {
    rotation: mobileCurrentRotation,
    normalized: normalizedRotation,
    center: centerCardIndex,
    top: topCardIndex,
    bottom: bottomCardIndex
  });
  
  // Remove all visible position classes
  const slides = mobileGallery.querySelectorAll('.mobile-slide');
  slides.forEach(slide => {
    slide.classList.remove('visible-center', 'visible-top', 'visible-bottom');
  });
  
  // Add classes to currently visible cards
  if (slides[centerCardIndex]) {
    slides[centerCardIndex].classList.add('visible-center');
    console.log('  Added visible-center to slide', centerCardIndex);
  }
  if (slides[topCardIndex]) {
    slides[topCardIndex].classList.add('visible-top');
    console.log('  Added visible-top to slide', topCardIndex);
  }
  if (slides[bottomCardIndex]) {
    slides[bottomCardIndex].classList.add('visible-bottom');
    console.log('  Added visible-bottom to slide', bottomCardIndex);
  }
}

function rotateMobile(direction) {
  if (!mobileGallery || isUpdating) {
    console.log('Blocked: isUpdating =', isUpdating);
    return;
  }
  if (!currentCenterCamera) return;
  
  isUpdating = true;
  
  console.log(`\n=== Rotating ${direction} ===`);
  console.log('Before rotation - cardCameras:', cardCameras.map((cam, i) => `P${i}: ${cam?.Location || 'null'}`).join(', '));
  
  // Rotate the drum with existing images (true card rotation)
  mobileCurrentRotation += (direction === 'down' ? -ANGLE_STEP : ANGLE_STEP);
  
  // Normalize rotation to prevent precision loss on iOS (keep between -360 and 360)
  if (Math.abs(mobileCurrentRotation) > 720) {
    const normalizedRot = ((mobileCurrentRotation % 360) + 360) % 360;
    // Adjust to keep the same visual position but smaller number
    mobileCurrentRotation = normalizedRot > 180 ? normalizedRot - 360 : normalizedRot;
    console.log('Normalized rotation to:', mobileCurrentRotation);
  }
  
  mobileGallery.style.transition = 'transform 0.4s cubic-bezier(0.25, 0.1, 0.25, 1)';
  mobileGallery.style.transform = `rotateX(${mobileCurrentRotation}deg)`;
  
  // Use setTimeout as primary method (more reliable on iOS)
  // After rotation completes, update the card that moved to far back
  const handleTransitionEnd = () => {
    
    // Calculate which physical card is now at center (0° effective angle)
    // Use floor instead of round for more predictable behavior on iOS
    const normalizedRotation = ((mobileCurrentRotation % 360) + 360) % 360;
    const rawIndex = (360 - normalizedRotation) / 60;
    const centerCardIndex = (Math.floor(rawIndex + 0.5)) % 6;
    
    console.log('After rotation:');
    console.log('  mobileCurrentRotation:', mobileCurrentRotation);
    console.log('  Physical card at center:', centerCardIndex);
    
    // Update current center camera to what's now at center
    currentCenterCamera = cardCameras[centerCardIndex];
    console.log('  New center camera:', currentCenterCamera?.Location);
    
    // Calculate top and bottom card positions relative to center
    const topCardIndex = (centerCardIndex + 1) % 6;
    const bottomCardIndex = (centerCardIndex + 5) % 6;
    
    // Get the actual neighbor cameras from the current center
    const topNeighbor = getNeighborCamera(currentCenterCamera, 'pos');
    const bottomNeighbor = getNeighborCamera(currentCenterCamera, 'neg');
    
    // Ensure top and bottom positions have the correct neighbors
    cardCameras[topCardIndex] = topNeighbor;
    cardCameras[bottomCardIndex] = bottomNeighbor;
    
    console.log('  Set top neighbor (P' + topCardIndex + '):', topNeighbor?.Location || 'null');
    console.log('  Set bottom neighbor (P' + bottomCardIndex + '):', bottomNeighbor?.Location || 'null');
    
    // Update the card at far back (180° from center) with next in chain
    const backCardIndex = (centerCardIndex + 3) % 6;
    
    if (direction === 'down') {
      // Chain from top neighbor: get its POS neighbor
      const nextInChain = topNeighbor ? getNeighborCamera(topNeighbor, 'pos') : null;
      cardCameras[backCardIndex] = nextInChain;
      console.log(`  Updated far back (P${backCardIndex}) with: ${nextInChain?.Location || 'null'}`);
    } else {
      // Chain from bottom neighbor: get its NEG neighbor
      const prevInChain = bottomNeighbor ? getNeighborCamera(bottomNeighbor, 'neg') : null;
      cardCameras[backCardIndex] = prevInChain;
      console.log(`  Updated far back (P${backCardIndex}) with: ${prevInChain?.Location || 'null'}`);
    }
    
    // Update the physical cards that changed (top, bottom, and back)
    const slides = mobileGallery.querySelectorAll('.mobile-slide');
    [topCardIndex, bottomCardIndex, backCardIndex].forEach(idx => {
      const slide = slides[idx];
      const camera = cardCameras[idx];
      if (slide) {
        const img = slide.querySelector('img');
        if (img) {
          if (camera) {
            const newSrc = camera?.Views?.[0]?.Url || '';
            // Only update src if it changed (iOS optimization)
            if (img.src !== newSrc) {
              img.src = newSrc;
              // Force image decode on iOS for smoother rendering
              if (img.decode) {
                img.decode().catch(() => {});
              }
            }
            img.alt = camera?.Location || 'Camera';
          } else {
            img.src = '';
            img.alt = '';
          }
        }
      }
    });
    
    console.log('After update - cardCameras:', cardCameras.map((cam, i) => `P${i}: ${cam?.Location || 'null'}`).join(', '));
    
    // Update info deck with current center camera
    if (currentCenterCamera) {
      const topCam = cardCameras[topCardIndex];
      const bottomCam = cardCameras[bottomCardIndex];
      
      console.log('  Visible cameras:');
      console.log('    Top (P' + topCardIndex + '):', topCam?.Location || 'null');
      console.log('    Center (P' + centerCardIndex + '):', currentCenterCamera?.Location);
      console.log('    Bottom (P' + bottomCardIndex + '):', bottomCam?.Location || 'null');
      
      requestAnimationFrame(() => {
        updateModalInfoDeck(currentCenterCamera);
        updateMobileMiniMap(currentCenterCamera, bottomCam, topCam);
      });
    }
    
    // Update visible card borders
    updateVisibleCardBorders();
    
    // Update modal title
    const modalTitle = document.querySelector('#imageModal .modal-title');
    if (modalTitle && currentCenterCamera) {
      modalTitle.textContent = currentCenterCamera?.Location || 'Camera';
    }
    
    isUpdating = false;
  };
  
  // Use timeout as primary (more reliable cross-browser)
  setTimeout(handleTransitionEnd, 450);
}

function setupMobileControls() {
  if (!mobileCarouselContainer) return;

  const upBtn = mobileCarouselContainer.querySelector('.mobile-up-btn');
  const downBtn = mobileCarouselContainer.querySelector('.mobile-down-btn');

  if (upBtn) upBtn.addEventListener('click', () => rotateMobile('up'));
  if (downBtn) downBtn.addEventListener('click', () => rotateMobile('down'));
}

function setupMobileTouchEvents() {
  if (!mobileCarouselContainer) return;

  const scene = mobileCarouselContainer;

  scene.addEventListener('touchstart', e => {
    e.stopPropagation();
    mobileTouchStartY = e.touches[0].clientY;
  }, { passive: true });

  scene.addEventListener('touchmove', e => {
    e.stopPropagation();
    e.preventDefault();
    const deltaY = e.touches[0].clientY - mobileTouchStartY;
    mobileTouchStartY = e.touches[0].clientY;
    mobileCurrentRotation -= deltaY * 0.5;
    if (mobileGallery) {
      mobileGallery.style.transform = `rotateX(${mobileCurrentRotation}deg)`;
      
      // Throttled border update during drag (iOS performance)
      if (!borderUpdateThrottle) {
        borderUpdateThrottle = setTimeout(() => {
          updateVisibleCardBorders();
          borderUpdateThrottle = null;
        }, 100);
      }
    }
  }, { passive: false });

  scene.addEventListener('touchend', e => {
    e.stopPropagation();
    snapToNearestPosition();
  }, { passive: true });

  scene.addEventListener('wheel', e => {
    e.preventDefault();
    e.stopPropagation();
    if (e.deltaY > 0) {
      rotateMobile('down');
    } else {
      rotateMobile('up');
    }
  });
}

function snapToNearestPosition() {
  console.log('\n*** snapToNearestPosition ***');
  console.log('  mobileCurrentRotation:', mobileCurrentRotation);
  console.log('  isUpdating:', isUpdating);
  
  if (!mobileGallery) {
    console.log('  EXIT: No gallery');
    return;
  }
  
  if (isUpdating) {
    console.log('  SKIP: Already updating');
    return;
  }
  
  // Use floor instead of round for more consistent snapping on iOS
  const nearestStep = Math.floor(mobileCurrentRotation / ANGLE_STEP + 0.5);
  const targetRotation = nearestStep * ANGLE_STEP;
  const normalizedRotation = ((targetRotation % 360) + 360) % 360;
  const rawPosition = normalizedRotation / ANGLE_STEP;
  const centeredPosition = (Math.floor(rawPosition + 0.5)) % NUM_SLIDES;
  
  console.log('  nearestStep:', nearestStep);
  console.log('  targetRotation:', targetRotation);
  console.log('  normalizedRotation:', normalizedRotation);
  console.log('  centeredPosition:', centeredPosition);
  
  mobileGallery.style.transition = 'transform 0.3s ease-out';
  mobileCurrentRotation = targetRotation;
  mobileGallery.style.transform = `rotateX(${mobileCurrentRotation}deg)`;
  
  // Use setTimeout for snap completion (more reliable cross-browser)
  setTimeout(() => {
    if (mobileGallery) {
      mobileGallery.style.transition = 'transform 0.6s ease';
      console.log('  Calling handleCameraChange with position:', centeredPosition);
      handleCameraChange(centeredPosition);
      // Ensure borders update after snap
      updateVisibleCardBorders();
    }
  }, 350);
}

function handleCameraChange(centeredPosition) {
  console.log('\n### handleCameraChange (touch gesture) ###');
  console.log('  centeredPosition:', centeredPosition);
  console.log('  isUpdating:', isUpdating);
  
  if (isUpdating) {
    console.log('  EXIT: Already updating');
    return;
  }
  
  if (!currentCenterCamera) {
    console.log('  EXIT: No current camera');
    return;
  }
  
  isUpdating = true;
  
  console.log('  Before - currentCenterCamera:', currentCenterCamera?.Location);
  console.log('  Before - cardCameras:', cardCameras.map((cam, i) => `P${i}: ${cam?.Location || 'null'}`).join(', '));
  
  // Calculate which physical card is now at center after the snap
  const normalizedRotation = ((mobileCurrentRotation % 360) + 360) % 360;
  const rawIndex = (360 - normalizedRotation) / 60;
  const finalCenterCardIndex = (Math.floor(rawIndex + 0.5)) % 6;
  
  console.log('  Physical center card index:', finalCenterCardIndex);
  console.log('  Camera at that position:', cardCameras[finalCenterCardIndex]?.Location || 'null');
  
  // The camera at the center position IS the new center camera
  currentCenterCamera = cardCameras[finalCenterCardIndex];
  
  if (!currentCenterCamera) {
    console.log('  ⚠️ No camera at center position, staying with current');
    isUpdating = false;
    return;
  }
  
  console.log('  New center camera:', currentCenterCamera?.Location);
  console.log('  New center camera:', currentCenterCamera?.Location);
  
  const topCardIndex = (finalCenterCardIndex + 1) % 6;
  const bottomCardIndex = (finalCenterCardIndex + 5) % 6;
  
  // Get neighbors of the NEW center camera
  const topNeighbor = getNeighborCamera(currentCenterCamera, 'pos');
  const bottomNeighbor = getNeighborCamera(currentCenterCamera, 'neg');
  
  console.log('  Top neighbor:', topNeighbor?.Location || 'null');
  console.log('  Bottom neighbor:', bottomNeighbor?.Location || 'null');
  
  // Update visible neighbor positions
  cardCameras[topCardIndex] = topNeighbor;
  cardCameras[bottomCardIndex] = bottomNeighbor;
  
  // Update the back 3 cards with chain
  const backCard1 = (finalCenterCardIndex + 2) % 6;
  const backCard2 = (finalCenterCardIndex + 3) % 6;
  const backCard3 = (finalCenterCardIndex + 4) % 6;
  
  cardCameras[backCard1] = topNeighbor ? getNeighborCamera(topNeighbor, 'pos') : null;
  cardCameras[backCard2] = cardCameras[backCard1] ? getNeighborCamera(cardCameras[backCard1], 'pos') : null;
  cardCameras[backCard3] = bottomNeighbor ? getNeighborCamera(bottomNeighbor, 'neg') : null;
  
  console.log('  After updates - cardCameras:', cardCameras.map((cam, i) => `P${i}: ${cam?.Location || 'null'}`).join(', '));
  console.log('  Final center camera (P' + finalCenterCardIndex + '):', currentCenterCamera?.Location);
  
  // Update ALL physical card images to match updated cardCameras array
  const slides = mobileGallery.querySelectorAll('.mobile-slide');
  slides.forEach((slide, position) => {
    const camera = cardCameras[position];
    const img = slide.querySelector('img');
    if (img) {
      if (camera) {
        const newSrc = camera?.Views?.[0]?.Url || '';
        // Only update src if it changed (iOS optimization)
        if (img.src !== newSrc) {
          img.src = newSrc;
          // Force image decode on iOS for smoother rendering
          if (img.decode) {
            img.decode().catch(() => {});
          }
        }
        img.alt = camera?.Location || 'Camera';
      } else {
        img.src = '';
        img.alt = '';
      }
    }
  });
  
  // Update info cards with new camera data
  if (currentCenterCamera) {
    const topCardIndex = (finalCenterCardIndex + 1) % 6;
    const bottomCardIndex = (finalCenterCardIndex + 5) % 6;
    const topCam = cardCameras[topCardIndex];
    const bottomCam = cardCameras[bottomCardIndex];
    
    requestAnimationFrame(() => {
      updateModalInfoDeck(currentCenterCamera);
      updateMobileMiniMap(currentCenterCamera, bottomCam, topCam);
    });
  }
  
  // Update modal title
  const modalTitle = document.querySelector('#imageModal .modal-title');
  if (modalTitle && currentCenterCamera) {
    modalTitle.textContent = currentCenterCamera?.Location || 'Camera';
  }
  
  // Update visible card borders
  updateVisibleCardBorders();
  
  setTimeout(() => {
    console.log('  isUpdating -> false');
    isUpdating = false;
  }, 50);
}

export function updateMobileCarousel(centerCam, prevCam, nextCam) {
  if (window.innerWidth > 768) return;
  initMobileCarousel(centerCam, prevCam, nextCam);
}

export function removeMobileCarousel() {
  if (mobileCarouselContainer) {
    mobileCarouselContainer.remove();
    mobileCarouselContainer = null;
  }
  mobileGallery = null;
  mobileCurrentRotation = 0;
  currentCenterCamera = null;
  cardCameras = [null, null, null, null, null, null];
  isUpdating = false;
  lastSnapPosition = 0;
}
