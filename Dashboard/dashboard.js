// dashboard/dashboard.js
// Populates the Camera Issues Dashboard with CSV data

/**
 * Configuration for dashboard metrics - extracted from GeoJSON properties
 */
const DASHBOARD_CONFIG = {
  // Data quality flags to display as cards on Data Issues page
  dataQualityFlags: [
    { property: 'Missing_At_Separator', label: 'Missing @ Symbol', icon: 'at', color: 'yellow' },
    { property: 'Missing_Hyphen_In_Route', label: 'Missing Hyphen', icon: 'minus', color: 'yellow' },
    { property: 'Missing_Comma_Separator', label: 'Missing Comma', icon: 'edit', color: 'yellow' },
    { property: 'Unknown_Abbreviation', label: 'Unknown Abbrev', icon: 'question-circle', color: 'yellow' },
    { property: 'County_Mismatch', label: 'County Mismatch', icon: 'map-marker-alt', color: 'red' },
    { property: 'City_Mismatch', label: 'City Mismatch', icon: 'city', color: 'red' },
    { property: 'Duplicate_Location', label: 'Duplicate Location', icon: 'copy', color: 'orange' },
    { property: 'Duplicate_Coordinates', label: 'Duplicate Coords', icon: 'map-pin', color: 'orange' },
    { property: 'High_Offset', label: 'High Offset', icon: 'map-marked', color: 'red' },
    { property: 'High_MP_Difference', label: 'High MP Diff', icon: 'road', color: 'red' }
  ],
  
  // Image/Status issues to display on Image Issues page
  imageIssueTypes: [
    { key: 'disabled', label: 'Disabled Cameras', icon: 'ban', color: 'gray' },
    { key: 'offline', label: 'Offline', icon: 'plug', color: 'red' },
    { key: 'upside_down', label: 'Upside Down', icon: 'undo-alt', color: 'orange' },
    { key: 'grayscale', label: 'Grayscale', icon: 'adjust', color: 'yellow' },
    { key: 'old_timestamp', label: 'Old Timestamp', icon: 'clock', color: 'yellow' },
    { key: 'poe_error', label: 'POE Error', icon: 'exclamation-triangle', color: 'red' },
    { key: 'poor_road', label: 'Poor Road View', icon: 'eye-slash', color: 'orange' }
  ]
};

/**
 * Color mappings for different metric types
 */
const METRIC_COLORS = {
  green: { bg: 'linear-gradient(135deg, #3e8e41, #2a6b2f)', hover: 'rgba(62, 142, 65, 0.2)' },
  red: { bg: 'linear-gradient(135deg, #e74c3c, #c0392b)', hover: 'rgba(231, 76, 60, 0.2)' },
  orange: { bg: 'linear-gradient(135deg, #f39c12, #e67e22)', hover: 'rgba(243, 156, 18, 0.2)' },
  yellow: { bg: 'linear-gradient(135deg, #f1c40f, #f39c12)', hover: 'rgba(241, 196, 15, 0.2)' },
  gray: { bg: 'linear-gradient(135deg, #95a5a6, #7f8c8d)', hover: 'rgba(149, 165, 166, 0.2)' }
};

// Store loaded data globally
let geojsonData = null;
let chartInstances = {};

/**
 * Load GeoJSON file - single source for all dashboard data
 */
async function loadGeoJSONData() {
  try {
    const response = await fetch('cctv_locations_processed_classified.geojson');
    geojsonData = await response.json();
    return true;
  } catch (error) {
    console.error('Error loading GeoJSON data:', error);
    return false;
  }
}

/**
 * Count cameras with a specific data quality flag set to true
 */
function countDataQualityFlag(propertyName) {
  if (!geojsonData) return 0;
  
  let count = 0;
  geojsonData.features.forEach(feature => {
    const value = feature.properties[propertyName];
    // Handle true, "true", 1, "1", "True", etc.
    if (value === true || value === 'true' || value === 'True' || value === 1 || value === '1') {
      count++;
    }
  });
  
  console.log(`${propertyName}: ${count} cameras`);
  return count;
}

/**
 * Get status breakdown (enabled vs disabled)
 */
function getStatusCounts() {
  if (!geojsonData) return { enabled: 0, disabled: 0 };
  
  const enabled = geojsonData.features.filter(f => 
    f.properties.Status === 'Enabled'
  ).length;
  
  const disabled = geojsonData.features.filter(f => 
    f.properties.Status === 'Disabled' || f.properties.Status !== 'Enabled'
  ).length;
  
  return { enabled, disabled };
}

/**
 * Get counts by region
 */
function getCountsByRegion() {
  if (!geojsonData) return {};
  
  const regions = {};
  geojsonData.features.forEach(feature => {
    const region = feature.properties.UDOT_Region || 'Unknown';
    regions[region] = (regions[region] || 0) + 1;
  });
  
  return regions;
}

/**
 * Get counts by county
 */
function getCountsByCounty() {
  if (!geojsonData) return {};
  
  const counties = {};
  geojsonData.features.forEach(feature => {
    const county = feature.properties.County;
    if (county && county !== 'NULL') {
      counties[county] = (counties[county] || 0) + 1;
    }
  });
  
  return counties;
}

/**
 * Get counts by city (top N cities)
 */
function getCountsByCity(limit = 10) {
  if (!geojsonData) return {};
  
  const cities = {};
  geojsonData.features.forEach(feature => {
    const city = feature.properties.City;
    if (city && city !== 'NULL') {
      cities[city] = (cities[city] || 0) + 1;
    }
  });
  
  // Sort and return top N
  return Object.entries(cities)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .reduce((obj, [city, count]) => {
      obj[city] = count;
      return obj;
    }, {});
}

/**
 * Update Data Quality metric cards (Data Issues page)
 */
function updateDataQualityCards() {
  const container = document.getElementById('dashboardMetricsContainer');
  if (!container) return;
  
  container.innerHTML = '';
  
  // Debug: Check if data is loaded
  console.log('=== DATA QUALITY DEBUG ===');
  console.log('GeoJSON loaded:', geojsonData ? 'YES' : 'NO');
  if (geojsonData) {
    console.log('Total features:', geojsonData.features.length);
    
    // Sample first feature to see data structure
    if (geojsonData.features.length > 0) {
      const sample = geojsonData.features[0].properties;
      console.log('Sample camera properties:', {
        Missing_At_Separator: sample.Missing_At_Separator,
        Missing_Hyphen_In_Route: sample.Missing_Hyphen_In_Route,
        High_Offset: sample.High_Offset
      });
    }
    
    // Count how many have any TRUE values
    const trueCount = geojsonData.features.filter(f => 
      f.properties.Missing_At_Separator === true ||
      f.properties.High_Offset === true
    ).length;
    console.log('Cameras with any TRUE flag:', trueCount);
  }
  
  DASHBOARD_CONFIG.dataQualityFlags.forEach(flagConfig => {
    const value = countDataQualityFlag(flagConfig.property);
    const colors = METRIC_COLORS[flagConfig.color] || METRIC_COLORS.gray;
    
    const card = document.createElement('div');
    card.className = 'col-lg-3 col-md-4 col-sm-6';
    card.innerHTML = `
      <div class="dashboard-card">
        <div class="liquidGlass-effect"></div>
        <div class="liquidGlass-tint"></div>
        <div class="liquidGlass-shine"></div>
        <div class="liquidGlass-content">
          <div class="dashboard-card-title">
            <h6 class="dashboard-card-label">${flagConfig.label}</h6>
          </div>
          <div class="dashboard-card-bottom">
            <div class="dashboard-card-value-wrapper">
              <h2 class="dashboard-card-value">${value}</h2>
            </div>
            <div class="dashboard-card-icon" style="background: ${colors.bg};">
              <i class="fas fa-${flagConfig.icon}"></i>
            </div>
          </div>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

/**
 * Create or update a chart
 */
function createChart(canvasId, config) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  
  // Destroy existing chart if it exists
  if (chartInstances[canvasId]) {
    chartInstances[canvasId].destroy();
  }
  
  // Get data - config.data should be an object with counts
  const dataObj = config.data || {};
  const labels = Object.keys(dataObj);
  const values = Object.values(dataObj);
  
  if (labels.length === 0) {
    console.log(`No data available for chart: ${config.label}`);
    return;
  }
  
  const chartData = {
    labels: labels,
    datasets: [{
      label: config.label,
      data: values,
      backgroundColor: config.type === 'pie' ? 
        generateColors(labels.length) :
        'rgba(62, 142, 65, 1)',
      borderColor: config.type === 'pie' ?
        'rgba(255, 255, 255, 1)' :
        'rgba(62, 142, 65, 1)',
      borderWidth: 2
    }]
  };
  
  // Register custom plugin for text shadows
  const textShadowPlugin = {
    id: 'textShadow',
    beforeDraw: (chart) => {
      const ctx = chart.ctx;
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 2;
    },
    afterDraw: (chart) => {
      chart.ctx.restore();
    }
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: config.type === 'pie',
        position: 'right',
        labels: { 
          color: 'white', 
          font: { size: 12 },
          padding: 10,
          generateLabels: function(chart) {
            const data = chart.data;
            if (data.labels.length && data.datasets.length) {
              return data.labels.map((label, i) => {
                const value = data.datasets[0].data[i];
                return {
                  text: `${label}: ${value}`,
                  fillStyle: data.datasets[0].backgroundColor[i],
                  strokeStyle: data.datasets[0].borderColor,
                  lineWidth: data.datasets[0].borderWidth,
                  hidden: false,
                  index: i,
                  fontColor: 'white'
                };
              });
            }
            return [];
          }
        }
      },
      title: {
        display: true,
        text: config.label,
        color: 'white',
        font: { size: 16, weight: 'bold' },
        padding: { top: 10, bottom: 10 }
      },
      textShadow: textShadowPlugin
    },
    scales: config.type === 'bar' ? {
      y: {
        beginAtZero: true,
        ticks: { color: 'white' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' }
      },
      x: {
        ticks: { color: 'white' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' }
      }
    } : {}
  };
  
  chartInstances[canvasId] = new Chart(ctx, {
    type: config.type,
    data: chartData,
    options: chartOptions,
    plugins: [textShadowPlugin]
  });
}

/**
 * Generate colors for pie charts
 */
function generateColors(count) {
  const baseColors = [
    'rgba(62, 142, 65, 1)',   // green
    'rgba(52, 152, 219, 1)',  // blue
    'rgba(243, 156, 18, 1)',  // orange
    'rgba(231, 76, 60, 1)',   // red
    'rgba(155, 89, 182, 1)',  // purple
    'rgba(241, 196, 15, 1)',  // yellow
    'rgba(26, 188, 156, 1)',  // turquoise
    'rgba(230, 126, 34, 1)',  // dark orange
    'rgba(149, 165, 166, 1)', // gray
    'rgba(192, 57, 43, 1)'    // dark red
  ];
  
  const colors = [];
  for (let i = 0; i < count; i++) {
    colors.push(baseColors[i % baseColors.length]);
  }
  return colors;
}

/**
 * Update all charts
 */
/**
 * Update Stats/Counts page with Total Cameras card and charts
 */
async function updateStatsPage() {
  // Ensure GeoJSON data is loaded
  if (!geojsonData) {
    await loadGeoJSONData();
  }
  
  // Add Total Cameras card at the top
  const statsCardsContainer = document.getElementById('dashboardStatsCardsContainer');
  if (statsCardsContainer) {
    const totalCameras = geojsonData ? geojsonData.features.length : 0;
    const statusCounts = getStatusCounts();
    const colors = METRIC_COLORS.green;
    
    const card = document.createElement('div');
    card.className = 'col-12';
    card.innerHTML = `
      <div class="dashboard-card">
        <div class="liquidGlass-effect"></div>
        <div class="liquidGlass-tint"></div>
        <div class="liquidGlass-shine"></div>
        <div class="liquidGlass-content">
          <div class="dashboard-card-title">
            <h6 class="dashboard-card-label">Total Cameras</h6>
          </div>
          <div class="dashboard-card-bottom">
            <div class="dashboard-card-value-wrapper">
              <h2 class="dashboard-card-value">${totalCameras}</h2>
              <div style="margin-top: 8px; font-size: 0.75rem; color: rgba(255,255,255,0.9);">
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                  <span><i class="fas fa-check-circle" style="color: #3e8e41; margin-right: 5px;"></i>Enabled:</span>
                  <strong>${statusCounts.enabled}</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span><i class="fas fa-times-circle" style="color: #e74c3c; margin-right: 5px;"></i>Disabled:</span>
                  <strong>${statusCounts.disabled}</strong>
                </div>
              </div>
            </div>
            <div class="dashboard-card-icon" style="background: ${colors.bg};">
              <i class="fas fa-camera"></i>
            </div>
          </div>
        </div>
      </div>
    `;
    statsCardsContainer.innerHTML = '';
    statsCardsContainer.appendChild(card);
  }
  
  // Update charts with data from GeoJSON
  createChart('dashChart0', {
    label: 'Cameras by Region',
    type: 'pie',
    data: getCountsByRegion()
  });
  
  createChart('dashChart1', {
    label: 'Cameras by County',
    type: 'pie',
    data: getCountsByCounty()
  });
  
  createChart('dashChart2', {
    label: 'Top 10 Cities',
    type: 'pie',
    data: getCountsByCity(10)
  });
}

/**
 * Get image issue counts from GeoJSON classification field
 */
function getIssuesCounts() {
  if (!geojsonData) return {};
  
  const counts = {
    disabled: 0,
    offline: 0,
    upside_down: 0,
    grayscale: 0,
    old_timestamp: 0,
    poe_error: 0,
    poor_road: 0,
    total: geojsonData.features.length
  };
  
  geojsonData.features.forEach(feature => {
    const classification = feature.properties.classification;
    
    // Count disabled cameras separately (by Status field, not classification)
    if (feature.properties.Status === 'Disabled') {
      counts.disabled++;
    }
    
    // Count other classifications
    if (classification && counts.hasOwnProperty(classification)) {
      counts[classification]++;
    }
    
    // Also handle poe_failure and timestamp_is_stale properties
    if (feature.properties.poe_failure === true) {
      counts.poe_error++;
    }
    if (feature.properties.timestamp_is_stale === true) {
      counts.old_timestamp++;
    }
  });
  
  return counts;
}

/**
 * Get regional breakdown for image issues
 */
function getIssuesByRegion() {
  if (!geojsonData) return {};
  
  // Valid classifications that represent issues
  const validClassifications = ['offline', 'upside_down', 'grayscale', 'poor_road'];
  
  const regions = {};
  
  geojsonData.features.forEach(feature => {
    const classification = feature.properties.classification;
    const poeFailure = feature.properties.poe_failure === true;
    const timestaleStale = feature.properties.timestamp_is_stale === true;
    const isDisabled = feature.properties.Status === 'Disabled';
    const region = feature.properties.UDOT_Region || 'Unknown';
    
    // Count if it has any issue (classification, poe_failure, timestamp_is_stale, or disabled)
    const hasIssue = (classification && validClassifications.includes(classification)) ||
                     poeFailure || timestaleStale || isDisabled;
    
    if (hasIssue) {
      if (!regions[region]) {
        regions[region] = 0;
      }
      regions[region]++;
    }
  });
  
  return regions;
}

/**
 * Get issue type breakdown
 */
function getIssuesByType() {
  const counts = getIssuesCounts();
  const issueTypes = [];
  
  const issueLabels = {
    disabled: 'Disabled',
    offline: 'Offline',
    upside_down: 'Upside Down',
    grayscale: 'Grayscale',
    old_timestamp: 'Old Timestamp',
    poe_error: 'POE Error',
    poor_road: 'Poor Road View'
  };
  
  Object.keys(issueLabels).forEach(key => {
    if (counts[key] > 0) {
      issueTypes.push({
        name: issueLabels[key],
        count: counts[key]
      });
    }
  });
  
  return issueTypes.sort((a, b) => b.count - a.count);
}

/**
 * Update image issues cards
 */
function updateIssuesCards() {
  const container = document.getElementById('dashboardIssuesContainer');
  if (!container) return;
  
  container.innerHTML = '';
  const counts = getIssuesCounts();
  
  DASHBOARD_CONFIG.imageIssueTypes.forEach(config => {
    const value = counts[config.key] || 0;
    const colors = METRIC_COLORS[config.color] || METRIC_COLORS.gray;
    
    const card = document.createElement('div');
    card.className = 'col-lg-3 col-md-4 col-sm-6';
    card.innerHTML = `
      <div class="dashboard-card">
        <div class="liquidGlass-effect"></div>
        <div class="liquidGlass-tint"></div>
        <div class="liquidGlass-shine"></div>
        <div class="liquidGlass-content">
          <div class="dashboard-card-title">
            <h6 class="dashboard-card-label">${config.label}</h6>
          </div>
          <div class="dashboard-card-bottom">
            <div class="dashboard-card-value-wrapper">
              <h2 class="dashboard-card-value">${value}</h2>
            </div>
            <div class="dashboard-card-icon" style="background: ${colors.bg};">
              <i class="fas fa-${config.icon}"></i>
            </div>
          </div>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

/**
 * Update image issues charts
 */
function updateIssuesCharts() {
  // Chart 1: Issues by Type (Pie)
  const issuesByType = getIssuesByType();
  if (issuesByType.length > 0) {
    // Convert array to object format
    const issuesData = {};
    issuesByType.forEach(item => {
      issuesData[item.name] = item.count;
    });
    
    createChart('dashIssuesChart0', {
      label: 'Issues by Type',
      type: 'pie',
      data: issuesData
    });
  }
  
  // Chart 2: Issues by Region (Pie)
  const issuesByRegion = getIssuesByRegion();
  
  if (Object.keys(issuesByRegion).length > 0) {
    // Clean up region names
    const cleanedRegions = {};
    Object.keys(issuesByRegion).forEach(region => {
      const cleanName = region.replace('Region ', '');
      cleanedRegions[cleanName] = issuesByRegion[region];
    });
    
    createChart('dashIssuesChart1', {
      label: 'Issues by Region',
      type: 'pie',
      data: cleanedRegions
    });
  }
}

/**
 * Main update function for Data Issues page (Data Quality)
 */
export async function updateDashboardStats() {
  // Show loading state
  const container = document.getElementById('dashboardMetricsContainer');
  if (container) {
    container.innerHTML = '<div class="text-center text-white p-5"><i class="fas fa-spinner fa-spin fa-3x"></i><p class="mt-3">Loading dashboard data...</p></div>';
  }
  
  // Load GeoJSON data if not already loaded
  if (!geojsonData) {
    const loaded = await loadGeoJSONData();
    if (!loaded) {
      if (container) {
        container.innerHTML = '<div class="text-center text-white p-5"><i class="fas fa-exclamation-triangle fa-3x mb-3"></i><p>Error loading dashboard data</p></div>';
      }
      return;
    }
  }
  
  // Update UI - data quality cards
  updateDataQualityCards();
}

/**
 * Main update function for Image Issues page
 */
async function updateIssuesPage() {
  const container = document.getElementById('dashboardIssuesContainer');
  if (container) {
    container.innerHTML = '<div class="text-center text-white p-5"><i class="fas fa-spinner fa-spin fa-3x"></i><p class="mt-3">Loading camera issues data...</p></div>';
  }
  
  // Load GeoJSON data if not already loaded
  if (!geojsonData) {
    const loaded = await loadGeoJSONData();
    if (!loaded) {
      if (container) {
        container.innerHTML = '<div class="text-center text-white p-5"><i class="fas fa-exclamation-triangle fa-3x mb-3"></i><p>Error loading camera issues data</p></div>';
      }
      return;
    }
  }
  
  // Update UI
  updateIssuesCards();
  updateIssuesCharts();
}

/**
 * Switch between dashboard pages
 */
async function switchDashboardPage(pageName) {
  const qualityPage = document.getElementById('dashPageQuality');
  const issuesPage = document.getElementById('dashPageIssues');
  const statsPage = document.getElementById('dashPageStats');
  const qualityBtn = document.getElementById('dashNavQuality');
  const issuesBtn = document.getElementById('dashNavIssues');
  const statsBtn = document.getElementById('dashNavStats');
  
  // Hide all pages and deactivate all buttons
  qualityPage.style.display = 'none';
  issuesPage.style.display = 'none';
  statsPage.style.display = 'none';
  qualityBtn.classList.remove('active');
  issuesBtn.classList.remove('active');
  statsBtn.classList.remove('active');
  
  if (pageName === 'quality') {
    qualityPage.style.display = 'block';
    qualityBtn.classList.add('active');
    await updateDashboardStats();
  } else if (pageName === 'issues') {
    issuesPage.style.display = 'block';
    issuesBtn.classList.add('active');
    await updateIssuesPage();
  } else if (pageName === 'stats') {
    statsPage.style.display = 'block';
    statsBtn.classList.add('active');
    await updateStatsPage();
  }
}

/**
 * Initialize dashboard listeners
 */
export function initDashboard() {
  const dashboardModal = document.getElementById('cameraIssuesDashboard');
  
  if (dashboardModal) {
    dashboardModal.addEventListener('shown.bs.modal', async () => {
      // Show under-construction overlay if flag is on
      if (window.UNDER_CONSTRUCTION) {
        const el = document.getElementById('ucOverlayDash');
        if (el) el.style.display = 'flex';
      }
      await updateIssuesPage();
    });
  }
  
  // Navigation button listeners
  const qualityBtn = document.getElementById('dashNavQuality');
  const issuesBtn = document.getElementById('dashNavIssues');
  const statsBtn = document.getElementById('dashNavStats');
  
  if (qualityBtn) {
    qualityBtn.addEventListener('click', () => switchDashboardPage('quality'));
  }
  
  if (issuesBtn) {
    issuesBtn.addEventListener('click', () => switchDashboardPage('issues'));
  }
  
  if (statsBtn) {
    statsBtn.addEventListener('click', () => switchDashboardPage('stats'));
  }
}
