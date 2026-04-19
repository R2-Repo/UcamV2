// js/dropdowns.js

import { filterImages } from './filters.js';
import { updateURLParameters } from './ui.js';
import { clearNearestCamerasMode } from './geolocation.js';

/**
 * Returns filtered cameras based on global selected* settings.
 */
export function getFilteredCameras(exclude) {
  return window.camerasList.filter(camera => {
    if (exclude !== 'region' && window.selectedRegion && `${camera.Region}` !== window.selectedRegion) return false;
    if (exclude !== 'county' && window.selectedCounty && camera.CountyBoundary !== window.selectedCounty) return false;
    if (exclude !== 'city' && window.selectedCity && camera.MunicipalBoundary !== window.selectedCity) return false;
    if (exclude !== 'maintenance' && window.selectedMaintenanceStation) {
      const ok = (camera.MaintenanceStationOption1 === window.selectedMaintenanceStation &&
                  camera.MaintenanceStationOption1.toLowerCase() !== 'not available')
               || (camera.MaintenanceStationOption2 === window.selectedMaintenanceStation &&
                   camera.MaintenanceStationOption2.toLowerCase() !== 'not available');
      if (!ok) return false;
    }
    return true;
  });
}

/**
 * Populates the Region dropdown menu.
 */
export function updateRegionDropdown() {
  const avail = getFilteredCameras('region');
  const set = new Set(avail.map(c => c.Region).filter(v => v != null).map(v => v.toString()));
  const menu = document.getElementById('regionFilterMenu');
  if (!menu) return;
  menu.innerHTML = '';

  // “All Regions” item
  const li0 = document.createElement('li');
  const a0  = document.createElement('a');
  a0.classList.add('dropdown-item');
  a0.href = '#';
  a0.dataset.value = '';
  a0.textContent = 'All Regions';
  a0.addEventListener('click', e => {
    e.preventDefault();
    clearNearestCamerasMode();
    window.selectedRegion = '';
    updateCountyDropdown();
    updateCityDropdown();
    updateMaintenanceStationDropdown();
    filterImages();
    updateURLParameters();
    bootstrap.Collapse.getOrCreateInstance(document.getElementById('regionOptions')).hide();
  });
  li0.append(a0);
  menu.append(li0);

  // One item per region
  Array.from(set).sort().forEach(val => {
    const li = document.createElement('li');
    const a  = document.createElement('a');
    a.classList.add('dropdown-item');
    a.href = '#';
    a.dataset.value = val;
    a.textContent = val;
    a.addEventListener('click', e => {
      e.preventDefault();
      clearNearestCamerasMode();
      window.selectedRegion = val;
      updateCountyDropdown();
      updateCityDropdown();
      updateMaintenanceStationDropdown();
      filterImages();
      updateURLParameters();
      bootstrap.Collapse.getOrCreateInstance(document.getElementById('regionOptions')).hide();
    });
    li.append(a);
    menu.append(li);
  });
}

/**
 * Populates the County dropdown menu.
 */
export function updateCountyDropdown() {
  const avail = getFilteredCameras('county');
  const set = new Set(avail.map(c => c.CountyBoundary).filter(v => v));
  const menu = document.getElementById('countyFilterMenu');
  if (!menu) return;
  menu.innerHTML = '';

  const li0 = document.createElement('li');
  const a0  = document.createElement('a');
  a0.classList.add('dropdown-item');
  a0.href = '#';
  a0.dataset.value = '';
  a0.textContent = 'All Counties';
  a0.addEventListener('click', e => {
    e.preventDefault();
    clearNearestCamerasMode();
    window.selectedCounty = '';
    updateRegionDropdown();
    updateCityDropdown();
    updateMaintenanceStationDropdown();
    filterImages();
    updateURLParameters();
    bootstrap.Collapse.getOrCreateInstance(document.getElementById('countyOptions')).hide();
  });
  li0.append(a0);
  menu.append(li0);

  Array.from(set).sort().forEach(val => {
    const li = document.createElement('li');
    const a  = document.createElement('a');
    a.classList.add('dropdown-item');
    a.href = '#';
    a.dataset.value = val;
    a.textContent = val;
    a.addEventListener('click', e => {
      e.preventDefault();
      clearNearestCamerasMode();
      window.selectedCounty = val;
      updateRegionDropdown();
      updateCityDropdown();
      updateMaintenanceStationDropdown();
      filterImages();
      updateURLParameters();
      bootstrap.Collapse.getOrCreateInstance(document.getElementById('countyOptions')).hide();
    });
    li.append(a);
    menu.append(li);
  });
}

/**
 * Populates the City dropdown menu.
 */
export function updateCityDropdown() {
  const avail = getFilteredCameras('city');
  const set = new Set(avail.map(c => c.MunicipalBoundary).filter(v => v));
  const menu = document.getElementById('cityFilterMenu');
  if (!menu) return;
  menu.innerHTML = '';

  const li0 = document.createElement('li');
  const a0  = document.createElement('a');
  a0.classList.add('dropdown-item');
  a0.href = '#';
  a0.dataset.value = '';
  a0.textContent = 'All Cities';
  a0.addEventListener('click', e => {
    e.preventDefault();
    clearNearestCamerasMode();
    window.selectedCity = '';
    updateRegionDropdown();
    updateCountyDropdown();
    updateMaintenanceStationDropdown();
    filterImages();
    updateURLParameters();
    bootstrap.Collapse.getOrCreateInstance(document.getElementById('cityOptions')).hide();
  });
  li0.append(a0);
  menu.append(li0);

  Array.from(set).sort().forEach(val => {
    const li = document.createElement('li');
    const a  = document.createElement('a');
    a.classList.add('dropdown-item');
    a.href = '#';
    a.dataset.value = val;
    a.textContent = val;
    a.addEventListener('click', e => {
      e.preventDefault();
      clearNearestCamerasMode();
      window.selectedCity = val;
      updateRegionDropdown();
      updateCountyDropdown();
      updateMaintenanceStationDropdown();
      filterImages();
      updateURLParameters();
      bootstrap.Collapse.getOrCreateInstance(document.getElementById('cityOptions')).hide();
    });
    li.append(a);
    menu.append(li);
  });
}

/**
 * Populates the Maintenance Station dropdown menu.
 */
export function updateMaintenanceStationDropdown() {
  const avail = getFilteredCameras('maintenance');
  const set   = new Set();
  avail.forEach(c => {
    const o1 = c.MaintenanceStationOption1, o2 = c.MaintenanceStationOption2;
    if (o1 && o1.toLowerCase() !== 'not available') set.add(o1);
    if (o2 && o2.toLowerCase() !== 'not available') set.add(o2);
  });

  const menu = document.getElementById('maintenanceStationMenu');
  if (!menu) return;
  menu.innerHTML = '';

  const li0 = document.createElement('li');
  const a0  = document.createElement('a');
  a0.classList.add('dropdown-item');
  a0.href = '#';
  a0.dataset.value = '';
  a0.textContent = 'All Stations';
  a0.addEventListener('click', e => {
    e.preventDefault();
    clearNearestCamerasMode();
    window.selectedMaintenanceStation = '';
    updateRegionDropdown();
    updateCountyDropdown();
    updateCityDropdown();
    filterImages();
    updateURLParameters();
    bootstrap.Collapse.getOrCreateInstance(document.getElementById('maintenanceOptions')).hide();
  });
  li0.append(a0);
  menu.append(li0);

  Array.from(set).sort().forEach(val => {
    const li = document.createElement('li');
    const a  = document.createElement('a');
    a.classList.add('dropdown-item');
    a.href = '#';
    a.dataset.value = val;
    a.textContent = val;
    a.addEventListener('click', e => {
      e.preventDefault();
      clearNearestCamerasMode();
      window.selectedMaintenanceStation = val;
      updateRegionDropdown();
      updateCountyDropdown();
      updateCityDropdown();
      filterImages();
      updateURLParameters();
      bootstrap.Collapse.getOrCreateInstance(document.getElementById('maintenanceOptions')).hide();
    });
    li.append(a);
    menu.append(li);
  });
}

/**
 * Populates the Route options dropdown.
 */
export function updateRouteOptions() {
  const menu = document.getElementById('routeFilterMenu');
  if (!menu) return;
  menu.innerHTML = '';



  // — Build Custom Route trigger —
  const liCustom = document.createElement('li');
  const aCustom  = document.createElement('a');
  aCustom.classList.add('dropdown-item', 'text-info', 'fw-bold');
  aCustom.href      = '#';
  aCustom.id        = 'buildCustomRoute';
  aCustom.textContent = '🛠️ Build Custom Route 🛠️';
  // the click handler itself is wired up in customRoute.js → setupCustomRouteBuilder()
  liCustom.append(aCustom);
  menu.append(liCustom);

  // — Curated routes —
  window.curatedRoutes.forEach(route => {
    const li    = document.createElement('li');
    const a     = document.createElement('a');
    const label = route.displayName || route.name;
    a.classList.add('dropdown-item');
    a.href          = '#';
    a.dataset.value = label;
    a.textContent   = label;
    a.addEventListener('click', e => {
      e.preventDefault();
      clearNearestCamerasMode();
      window.selectedRoute = label;
      filterImages();
      updateURLParameters();
    });
    li.append(a);
    menu.append(li);
  });
}
