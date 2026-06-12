/**
 * app.js - UI Controller & Event Handlers
 * Orchestrates rendering, wizard actions, charts rendering, and navigation.
 */

'use strict';

/* ── Indian States List & Search Auto-complete ─────────────────── */
const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
  "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"
];

function initStateSearch(inputId, dropdownId, buttonId, onSelectCallback) {
  const input = document.getElementById(inputId);
  const dropdown = document.getElementById(dropdownId);
  const button = document.getElementById(buttonId);
  
  if (!input || !dropdown || !button) return;
  
  const renderList = (filterText = '') => {
    dropdown.innerHTML = '';
    const filtered = INDIAN_STATES.filter(state => 
      state.toLowerCase().includes(filterText.toLowerCase())
    );
    
    const fragment = document.createDocumentFragment();
    if (filtered.length === 0) {
      const emptyItem = document.createElement('div');
      emptyItem.className = 'state-search-item';
      emptyItem.style.color = 'var(--gray-400)';
      emptyItem.style.cursor = 'default';
      emptyItem.textContent = 'No states found';
      fragment.appendChild(emptyItem);
    } else {
      filtered.forEach(stateName => {
        const item = document.createElement('div');
        item.className = 'state-search-item';
        item.textContent = stateName;
        item.addEventListener('click', () => {
          input.value = stateName;
          dropdown.classList.add('hidden');
          if (onSelectCallback) onSelectCallback(stateName);
        });
        fragment.appendChild(item);
      });
    }
    dropdown.appendChild(fragment);
  };

  input.addEventListener('focus', () => {
    renderList(input.value);
    dropdown.classList.remove('hidden');
  });

  input.addEventListener('input', () => {
    renderList(input.value);
    dropdown.classList.remove('hidden');
  });

  button.addEventListener('click', (e) => {
    e.stopPropagation();
    const isHidden = dropdown.classList.contains('hidden');
    if (isHidden) {
      renderList(input.value);
      dropdown.classList.remove('hidden');
      input.focus();
    } else {
      dropdown.classList.add('hidden');
    }
  });

  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !dropdown.contains(e.target) && !button.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  });
}

/* ── Global State ─────────────────────────────────────────────── */
const state = {
  user: { name: 'Priya', city: 'delhi', streak: 14, ecoScore: 60 },
  footprint: { transport: 2.1, energy: 1.8, flights: 1.6, food: 0.9 },
  activities: [],
  actionsChecked: new Set(),
  wizardData: {
    drive: 100,
    flights: 4,
    diet: 'veg',
    household: 3,
    elec: 1200,
    transport: 'car'
  }
};

/* ── Initialization ───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Initialize API mode detection (Local vs Server)
  await api.init();

  // 2. Fetch data from storage/API
  await loadStateData();

  // 3. Render page elements
  updateDashboardUI();
  renderHistory();
  renderActions();
  renderLeaderboard();
  loadSettingsFields();

  // 4. Initialize charts (if google charts loaded)
  if (typeof google !== 'undefined') {
    google.charts.load('current', { packages: ['corechart', 'bar'] });
    google.charts.setOnLoadCallback(initCharts);
  }

  // 5. Initialize dates
  initDates();

  // 6. Graceful Google Maps Fallback Timeout
  setTimeout(() => {
    const el = document.getElementById('emission-map');
    if (el && (el.innerHTML.includes('Loading Google Maps') || el.textContent.includes('Loading Google Maps'))) {
      el.innerHTML = `
        <div style="text-align:center; padding:1.5rem;">
          <div style="font-size:2.5rem; margin-bottom:0.5rem;">🌍</div>
          <p style="font-size:0.95rem; font-weight:700; color:var(--green-700); margin-bottom:0.25rem;">Interactive Emission Map</p>
          <p style="font-size:0.78rem; color:var(--gray-500); max-width:320px; margin:0 auto 1.25rem;">Hotspot visualization based on user density and local emission databases.</p>
          <div style="display:flex; justify-content:center; gap:0.5rem; flex-wrap:wrap; max-width:340px; margin:0 auto;">
            <span style="background:var(--green-50); border:1px solid var(--green-200); padding:4px 10px; border-radius:9999px; font-size:0.72rem; font-weight:600; color:var(--green-800);">Delhi: Hotspot (2.1t)</span>
            <span style="background:var(--green-50); border:1px solid var(--green-200); padding:4px 10px; border-radius:9999px; font-size:0.72rem; font-weight:600; color:var(--green-800);">Mumbai: Moderate (1.8t)</span>
            <span style="background:var(--green-50); border:1px solid var(--green-200); padding:4px 10px; border-radius:9999px; font-size:0.72rem; font-weight:600; color:var(--green-800);">Bengaluru: High (2.3t)</span>
          </div>
        </div>
      `;
    }
  }, 3000);

  // 7. Initialize Indian State Search Auto-complete
  initStateSearch('wiz-state-search', 'wiz-state-dropdown', 'wiz-state-search-btn');
  initStateSearch('set-state-search', 'set-state-dropdown', 'set-state-search-btn');
});

async function loadStateData() {
  const data = await api.getUserData();
  state.user = data.user;
  state.footprint = data.footprint;
  
  state.activities = await api.getActivities();
  
  const actionList = await api.getActions();
  state.actionsChecked = new Set(actionList);
}

function initDates() {
  const now = new Date();
  const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const el = document.getElementById('dash-date');
  if (el) {
    el.textContent = now.toLocaleDateString('en-IN', opts);
    el.setAttribute('datetime', now.toISOString().substring(0, 10));
  }
  const tripDate = document.getElementById('trip-date');
  if (tripDate) tripDate.value = now.toISOString().substring(0, 10);
}

/* ── Navigation ───────────────────────────────────────────────── */
window.navigate = function(page) {
  document.querySelectorAll('.section').forEach(s => {
    s.classList.remove('active');
    s.setAttribute('aria-hidden', 'true');
  });
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.remove('active');
    n.removeAttribute('aria-current');
  });
  const sec = document.getElementById('section-' + page);
  if (sec) {
    sec.classList.add('active');
    sec.removeAttribute('aria-hidden');
    sec.focus();
  }
  const navEl = document.getElementById('nav-' + page);
  if (navEl) {
    navEl.classList.add('active');
    navEl.setAttribute('aria-current', 'page');
  }
  if (page === 'map') { 
    setTimeout(initMap, 100); 
  }
  if (typeof window._announceNav === 'function') {
    window._announceNav(page);
  }
};

/* ── Tab switcher ─────────────────────────────────────────────── */
window.switchTab = function(name) {
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.remove('active');
    b.setAttribute('aria-selected', 'false');
  });
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  const btn = document.getElementById('tab-btn-' + name);
  const panel = document.getElementById('tab-' + name);
  if (btn) { btn.classList.add('active'); btn.setAttribute('aria-selected', 'true'); }
  if (panel) panel.classList.add('active');
};

/* ── Toast Notifications ──────────────────────────────────────── */
window.showToast = function(msg, type = '') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.textContent = msg;
  // 'status' for success (polite), 'alert' for errors (assertive)
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
  toast.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
};

/* ── Google Charts Integration ────────────────────────────────── */
function initCharts() {
  drawTrendChart();
  drawPieChart();
  drawComparisonChart();
}

function drawTrendChart() {
  const el = document.getElementById('chart-emission-trend');
  if (!el) return;
  const data = google.visualization.arrayToDataTable([
    ['Month', 'CO₂e (tonnes)', { role: 'style' }],
    ['Jul', 0.62, '#4ade80'],
    ['Aug', 0.58, '#4ade80'],
    ['Sep', 0.55, '#4ade80'],
    ['Oct', 0.52, '#22c55e'],
    ['Nov', 0.54, '#22c55e'],
    ['Dec', 0.60, '#f59e0b'],
    ['Jan', 0.58, '#f59e0b'],
    ['Feb', 0.51, '#22c55e'],
    ['Mar', 0.49, '#22c55e'],
    ['Apr', 0.53, '#f59e0b'],
    ['May', 0.56, '#f59e0b'],
    ['Jun', 0.53, '#22c55e'],
  ]);
  const options = {
    legend: 'none',
    chartArea: { left: 40, right: 10, top: 10, bottom: 40, width: '100%' },
    hAxis: { textStyle: { fontSize: 11, color: '#6b7280' } },
    vAxis: { textStyle: { fontSize: 11, color: '#6b7280' }, minValue: 0, format: '#.## t' },
    bar: { groupWidth: '70%' },
    backgroundColor: 'transparent',
    tooltip: { textStyle: { fontSize: 12 } },
  };
  new google.visualization.ColumnChart(el).draw(data, options);
}

function drawPieChart() {
  const el = document.getElementById('chart-category-pie');
  if (!el) return;
  const totalT = state.footprint.transport;
  const totalE = state.footprint.energy;
  const totalFl = state.footprint.flights;
  const totalFo = state.footprint.food;

  const data = google.visualization.arrayToDataTable([
    ['Category', 'Emissions (tCO₂e)'],
    ['Transport', totalT],
    ['Home energy', totalE],
    ['Flights', totalFl],
    ['Food & diet', totalFo],
  ]);
  const options = {
    legend: { position: 'right', textStyle: { fontSize: 12, color: '#374151' } },
    chartArea: { left: 10, right: 120, top: 10, bottom: 10, width: '100%' },
    colors: ['#f59e0b', '#0ea5e9', '#ef4444', '#22c55e'],
    backgroundColor: 'transparent',
    pieHole: 0.45,
    tooltip: { textStyle: { fontSize: 12 } },
  };
  new google.visualization.PieChart(el).draw(data, options);
}

function drawComparisonChart() {
  const el = document.getElementById('chart-comparison-bar');
  if (!el) return;
  const data = google.visualization.arrayToDataTable([
    ['Day', 'Car', 'Transit', 'Walk/Cycle'],
    ['Mon', 3.2, 0.4, 0],
    ['Tue', 0, 0.9, 0],
    ['Wed', 3.2, 0, 0],
    ['Thu', 0, 0.8, 0],
    ['Fri', 3.2, 0, 0],
    ['Sat', 1.2, 0, 0.5],
    ['Sun', 0, 0, 1.0],
  ]);
  const options = {
    legend: { position: 'top', textStyle: { fontSize: 11 } },
    chartArea: { left: 40, right: 10, top: 40, bottom: 40, width: '100%' },
    hAxis: { textStyle: { fontSize: 11, color: '#6b7280' } },
    vAxis: { textStyle: { fontSize: 11, color: '#6b7280' }, minValue: 0, format: '# kg' },
    colors: ['#f59e0b', '#0ea5e9', '#22c55e'],
    isStacked: true,
    backgroundColor: 'transparent',
    bar: { groupWidth: '70%' },
  };
  new google.visualization.ColumnChart(el).draw(data, options);
}

/* ── Dashboard UI Updater ──────────────────────────────────────── */
function updateDashboardUI() {
  // Set User Name
  document.getElementById('dash-name').textContent = state.user.name || 'User';
  document.getElementById('user-avatar-btn').textContent =
    (state.user.name || 'User').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

  // Compute Footprint Totals
  const total = Object.values(state.footprint).reduce((a, b) => a + b, 0);
  document.getElementById('dash-co2').textContent = total.toFixed(1) + 't';
  document.getElementById('dash-score').textContent = state.user.ecoScore || 60;
  document.getElementById('dash-streak').textContent = state.user.streak || 0;
  
  // Set saved amount and rank dynamically
  const saved = (6.4 - total);
  document.getElementById('dash-saved').textContent = (saved > 0 ? saved.toFixed(1) : '0.0') + 't';
  
  // Update details panel values
  const transportVal = state.footprint.transport.toFixed(1) + 't';
  const energyVal = state.footprint.energy.toFixed(1) + 't';
  const flightsVal = state.footprint.flights.toFixed(1) + 't';
  const foodVal = state.footprint.food.toFixed(1) + 't';

  document.querySelector('.progress-item:nth-child(1) .progress-val').textContent = transportVal;
  document.querySelector('.progress-item:nth-child(2) .progress-val').textContent = energyVal;
  document.querySelector('.progress-item:nth-child(3) .progress-val').textContent = flightsVal;
  document.querySelector('.progress-item:nth-child(4) .progress-val').textContent = foodVal;

  // Update metric cards — use a helper that avoids repeated child node creation
  const setMetricCard = (id, val) => {
    const valEl = document.getElementById(id);
    if (!valEl) return;
    // Only update text nodes; the unit <span> is already in HTML
    const firstChild = valEl.firstChild;
    if (firstChild && firstChild.nodeType === Node.TEXT_NODE) {
      firstChild.nodeValue = val.toFixed(1) + '\u00a0';
    } else {
      // Fallback: clear and rebuild once
      valEl.textContent = val.toFixed(1) + ' ';
      const unit = document.createElement('span');
      unit.className = 'metric-card-unit';
      unit.textContent = 'tCO\u2082e';
      valEl.appendChild(unit);
    }
  };
  setMetricCard('card-transport-val', state.footprint.transport);
  setMetricCard('card-energy-val', state.footprint.energy);
  setMetricCard('card-flights-val', state.footprint.flights);
  setMetricCard('card-food-val', state.footprint.food);

  // Update Progress Bars (Aria values and width)
  const max = Math.max(3.0, total);
  updateProgressBar('cat-transport-label', (state.footprint.transport / max) * 100);
  updateProgressBar('cat-energy-label', (state.footprint.energy / max) * 100);
  updateProgressBar('cat-flights-label', (state.footprint.flights / max) * 100);
  updateProgressBar('cat-food-label', (state.footprint.food / max) * 100);

  // Update EcoScore Progress circle
  const arc = document.getElementById('score-circle-arc');
  if (arc) {
    const circumference = 2 * Math.PI * 52;
    const score = state.user.ecoScore || 60;
    const target = circumference * (1 - score / 100);
    arc.style.strokeDashoffset = target;
  }

  // Update nav score pill
  const score = state.user.ecoScore || 60;
  const navPill = document.getElementById('nav-score-pill');
  if (navPill) {
    navPill.textContent = score;
    navPill.setAttribute('aria-label', `Score: ${score}`);
  }
}

function updateProgressBar(labelId, pct) {
  const label = document.getElementById(labelId);
  if (label) {
    const barWrap = label.nextElementSibling;
    if (barWrap) {
      barWrap.setAttribute('aria-valuenow', Math.round(pct));
      const bar = barWrap.querySelector('.progress-bar');
      if (bar) bar.style.width = pct.toFixed(0) + '%';
    }
  }
}

/* ── Onboarding Wizard ────────────────────────────────────────── */
let wizStep = 1;

window.wizNext = async function(current) {
  if (current === 1) {
    const name = document.getElementById('wiz-name').value.trim();
    const city = document.getElementById('wiz-state-search').value.trim();
    if (!name) { showToast('Please enter your name', 'error'); return; }
    if (!city) { showToast('Please search and select your State / UT', 'error'); return; }
    state.wizardData.name = name;
    state.wizardData.city = city.toLowerCase();
  }
  
  if (current === 2) {
    state.wizardData.drive = parseInt(document.getElementById('wiz-drive').value, 10);
    state.wizardData.flights = parseInt(document.getElementById('wiz-flights').value, 10);
    state.wizardData.transport = document.getElementById('wiz-transport').value;
  }

  if (current === 3) {
    state.wizardData.elec = parseInt(document.getElementById('wiz-elec').value, 10);
    state.wizardData.diet = document.getElementById('wiz-diet').value;
    state.wizardData.household = parseInt(document.getElementById('wiz-household').value, 10);
    
    // Call server/local calculator
    const result = await api.calculateInitialFootprint(state.wizardData);
    state.footprint = result.footprint;
    state.user.name = result.user.name;
    state.user.city = result.user.city;
    state.user.ecoScore = result.user.ecoScore;

    // Render step 4 contents
    renderWizardResults(result.total);
  }

  document.getElementById('wiz-step-' + current).classList.add('hidden');
  wizStep = current + 1;
  document.getElementById('wiz-step-' + wizStep).classList.remove('hidden');
  const dot = document.getElementById('ws' + wizStep);
  if (dot) {
    dot.classList.add('done');
    dot.setAttribute('aria-label', `Step ${wizStep} of 4, completed`);
  }
};

window.wizBack = function(current) {
  document.getElementById('wiz-step-' + current).classList.add('hidden');
  wizStep = current - 1;
  document.getElementById('wiz-step-' + wizStep).classList.remove('hidden');
};

function renderWizardResults(total) {
  document.getElementById('wiz-result-co2').textContent = total;
  
  let badgeColor, badgeText, badgeLabel;
  if (total < 2.5) { 
    badgeColor = '#dcfce7'; badgeText = '#166534'; badgeLabel = '🌟 Below 1.5°C target!'; 
  } else if (total < 4.8) { 
    badgeColor = '#fef3c7'; badgeText = '#92400e'; badgeLabel = '🌿 Near world average'; 
  } else { 
    badgeColor = '#fee2e2'; badgeText = '#991b1b'; badgeLabel = '⚠️ Above world average'; 
  }
  
  const badge = document.getElementById('wiz-result-badge');
  if (badge) {
    badge.innerHTML = '';
    const span = document.createElement('span');
    span.style.background = badgeColor;
    span.style.color = badgeText;
    span.style.fontWeight = '600';
    span.style.fontSize = '0.8rem';
    span.style.padding = '4px 12px';
    span.style.borderRadius = '9999px';
    span.textContent = badgeLabel;
    badge.appendChild(span);
  }

  const breakdown = document.getElementById('wiz-breakdown');
  if (breakdown) {
    breakdown.innerHTML = '';
    const categories = [
      { label: '🚗 Transport', val: state.footprint.transport + 't' },
      { label: '✈️ Flights', val: state.footprint.flights + 't' },
      { label: '⚡ Energy', val: state.footprint.energy + 't' },
      { label: '🥗 Food', val: state.footprint.food + 't' },
    ];
    categories.forEach(b => {
      const item = document.createElement('div');
      item.style.background = 'var(--green-50)';
      item.style.borderRadius = '8px';
      item.style.padding = '0.625rem';
      item.style.textAlign = 'center';
      item.style.border = '1px solid var(--green-200)';
      
      const label = document.createElement('div');
      label.style.fontSize = '0.72rem';
      label.style.color = 'var(--gray-500)';
      label.textContent = b.label;
      
      const val = document.createElement('div');
      val.style.fontWeight = '700';
      val.style.color = 'var(--green-800)';
      val.style.fontSize = '0.95rem';
      val.textContent = b.val;
      
      item.appendChild(label);
      item.appendChild(val);
      breakdown.appendChild(item);
    });
  }
}

window.finishWizard = async function() {
  const overlay = document.getElementById('onboarding-overlay');
  if (overlay) overlay.remove();

  // Save baseline metrics to persistence
  await api.saveUserData(state.user, state.footprint);

  updateDashboardUI();
  renderLeaderboard();
  loadSettingsFields();
  showToast('Welcome to EcoTrack, ' + state.user.name + '! 🌱', 'success');
  
  if (typeof google !== 'undefined' && google.visualization) {
    initCharts();
  }
};

/* ── Track Activity Logs ──────────────────────────────────────── */

// Trip calculations
window.updateTripFactor = function() { calcTrip(); };
window.calcTrip = function() {
  const dist = parseFloat(document.getElementById('trip-dist').value) || 0;
  const factor = parseFloat(document.getElementById('trip-mode').value) || 0;
  const co2 = (dist * factor).toFixed(2);
  document.getElementById('trip-co2-est').textContent = co2 + ' kg';
  const transit = dist * 0.041;
  const saving = Math.max(0, dist * factor - transit).toFixed(2);
  const alt = document.getElementById('trip-alt-msg');
  if (factor > 0.041) {
    alt.textContent = ` Taking the metro instead would save ${saving} kg CO₂e.`;
  } else {
    alt.textContent = ` Great choice for low-emission travel!`;
  }
};

window.logTrip = async function() {
  const mode = document.getElementById('trip-mode');
  const dist = parseInt(document.getElementById('trip-dist').value, 10);
  const factor = parseFloat(mode.value);
  const co2 = parseFloat((dist * factor).toFixed(3));
  const label = mode.options[mode.selectedIndex].text;

  const activity = {
    name: `${label} - ${dist}km`,
    category: 'Transport',
    co2: co2 + ' kg CO₂e',
    status: 'Logged'
  };

  const savedActivity = await api.logActivity(activity);
  state.activities.unshift(savedActivity);

  // Update state metrics dynamically
  state.footprint.transport = parseFloat((state.footprint.transport + (co2 / 1000)).toFixed(2));
  await api.saveUserData(null, state.footprint);

  updateDashboardUI();
  renderHistory();
  showToast('Trip logged: ' + co2 + ' kg CO₂e', 'success');
  if (typeof google !== 'undefined') initCharts();
};

// Energy usage
window.calcEnergy = function() {
  const elec = parseFloat(document.getElementById('en-elec').value) || 0;
  const gas = parseFloat(document.getElementById('en-gas').value) || 0;
  const ac = parseFloat(document.getElementById('en-ac').value) || 0;
  const total = (elec * 0.00082 + gas * 0.0634 + ac * 0.002).toFixed(3);
  document.getElementById('energy-total-co2').textContent = total + ' tCO₂e';
};

window.saveEnergy = async function() {
  const totalCO2Str = document.getElementById('energy-total-co2').textContent;
  const co2Val = parseFloat(totalCO2Str);

  const activity = {
    name: 'Monthly Energy Log Update',
    category: 'Home energy',
    co2: totalCO2Str,
    status: 'Logged'
  };

  const savedActivity = await api.logActivity(activity);
  state.activities.unshift(savedActivity);

  // Update Home energy footprint
  state.footprint.energy = co2Val;
  await api.saveUserData(null, state.footprint);

  updateDashboardUI();
  renderHistory();
  showToast('Energy usage saved!', 'success');
  if (typeof google !== 'undefined') initCharts();
};

// Food meals logging
window.logFood = async function() {
  const b = parseFloat(document.getElementById('food-breakfast').value);
  const l = parseFloat(document.getElementById('food-lunch').value);
  const d = parseFloat(document.getElementById('food-dinner').value);
  const w = parseFloat(document.getElementById('food-waste').value);
  const total = ((b + l + d) * w).toFixed(2);
  document.getElementById('food-total-co2').textContent = total + ' kg CO₂e';

  const activity = {
    name: "Today's Meals Log",
    category: 'Food',
    co2: total + ' kg CO₂e',
    status: 'Logged'
  };

  const savedActivity = await api.logActivity(activity);
  state.activities.unshift(savedActivity);

  // Update Food footprint
  state.footprint.food = parseFloat((state.footprint.food + (parseFloat(total) / 1000)).toFixed(2));
  await api.saveUserData(null, state.footprint);

  updateDashboardUI();
  renderHistory();
  showToast('Meals logged: ' + total + ' kg CO₂e', 'success');
  if (typeof google !== 'undefined') initCharts();
};

// Shopping items logging
window.logShopping = async function() {
  const cat = document.getElementById('shop-category');
  const qty = parseInt(document.getElementById('shop-qty').value, 10) || 1;
  const factor = parseFloat(cat.value);
  const total = (factor * qty).toFixed(3);
  const label = cat.options[cat.selectedIndex].text;

  const activity = {
    name: `${label} (x${qty})`,
    category: 'Shopping',
    co2: total + ' t CO₂e',
    status: 'Logged'
  };

  const savedActivity = await api.logActivity(activity);
  state.activities.unshift(savedActivity);

  // Update Shopping footprint (adds to transport/other category or counts as carbon debit)
  state.footprint.transport = parseFloat((state.footprint.transport + parseFloat(total)).toFixed(2));
  await api.saveUserData(null, state.footprint);

  updateDashboardUI();
  renderHistory();
  showToast('Purchase logged: ' + total + ' t CO₂e', 'success');
  if (typeof google !== 'undefined') initCharts();
};

// Render Activity Log Table
function renderHistory() {
  const tbody = document.getElementById('history-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';
  const colorMap = { 
    Transport: 'badge-amber', 
    'Home energy': 'badge-sky', 
    Food: 'badge-green', 
    Shopping: 'badge-red' 
  };
  
  const activitiesToShow = state.activities.slice(0, 20);
  if (activitiesToShow.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 5;
    td.style.textAlign = 'center';
    td.style.color = 'var(--gray-400)';
    td.style.padding = '2rem';
    td.textContent = 'No activities logged yet. Start by logging a trip!';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }
  
  const fragment = document.createDocumentFragment();
  activitiesToShow.forEach(a => {
    const tr = document.createElement('tr');
    
    const tdDate = document.createElement('td');
    tdDate.textContent = a.date;
    
    const tdName = document.createElement('td');
    tdName.textContent = a.name;
    
    const tdCat = document.createElement('td');
    const spanCat = document.createElement('span');
    spanCat.className = `badge ${colorMap[a.category] || 'badge-green'}`;
    spanCat.textContent = a.category;
    tdCat.appendChild(spanCat);
    
    const tdCo2 = document.createElement('td');
    tdCo2.style.fontWeight = '600';
    // co2 may be a number (from server) or a display string (legacy local storage)
    tdCo2.textContent = typeof a.co2 === 'number'
      ? a.co2.toFixed(3) + ' kg CO\u2082e'
      : String(a.co2);
    
    const tdStatus = document.createElement('td');
    const spanStatus = document.createElement('span');
    spanStatus.className = 'badge badge-green';
    spanStatus.textContent = '✓ Logged';
    tdStatus.appendChild(spanStatus);
    
    tr.appendChild(tdDate);
    tr.appendChild(tdName);
    tr.appendChild(tdCat);
    tr.appendChild(tdCo2);
    tr.appendChild(tdStatus);
    
    fragment.appendChild(tr);
  });
  tbody.appendChild(fragment);
}

/* ── Export Data (CSV) ────────────────────────────────────────── */
window.exportCSV = function() {
  const rows = [['Date', 'Activity', 'Category', 'CO2e']];
  state.activities.forEach(a => rows.push([a.date, a.name, a.category, a.co2]));
  const csv = rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'ecotrack_data.csv';
  link.click();
  URL.revokeObjectURL(url);
  showToast('CSV exported!', 'success');
};

/* ── Actions List Checklist ───────────────────────────────────── */
const ACTIONS = [
  { emoji: '🚇', title: 'Take public transit this week', desc: 'Replace your car for work commute 5 days', impact: '−8.5 kg CO₂e', id: 'transit' },
  { emoji: '🥗', title: 'Go meat-free 2 days this week', desc: 'Plant-based meals reduce food footprint', impact: '−3.1 kg CO₂e', id: 'meatfree' },
  { emoji: '💡', title: 'Switch to LED bulbs', desc: 'Replace remaining incandescent bulbs', impact: '−0.4 kg/day', id: 'led' },
  { emoji: '🌡️', title: 'Set AC to 26°C or higher', desc: 'Each degree saves ~6% energy', impact: '−0.15 t/mo', id: 'actemp' },
  { emoji: '🛁', title: 'Take shorter showers (5 min)', desc: 'Reduce hot water heating emissions', impact: '−0.06 kg/day', id: 'shower' },
  { emoji: '🛍️', title: 'Buy nothing new this month', desc: 'Reduce consumption footprint', impact: '−0.3 t/mo', id: 'nowaste' },
  { emoji: '☀️', title: 'Research rooftop solar', desc: 'Get 3 quotes for solar panels', impact: '−1.2 t/yr', id: 'solar' },
  { emoji: '🌱', title: 'Plant a tree this weekend', desc: 'Offset 25 kg CO₂e per year', impact: '−25 kg/yr', id: 'tree' },
  { emoji: '♻️', title: 'Segregate waste this week', desc: 'Reduce landfill methane emissions', impact: '−0.1 kg/day', id: 'recycle' },
  { emoji: '✈️', title: 'Choose train over flight', desc: 'For trips under 600km use rail', impact: '−45 kg CO₂e', id: 'train' },
  { emoji: '🥕', title: 'Buy local produce', desc: 'Reduce food transport emissions', impact: '−0.05 kg/meal', id: 'local' },
  { emoji: '🔋', title: 'Unplug standby devices', desc: 'Cut phantom load electricity waste', impact: '−0.08 t/yr', id: 'standby' },
];

function renderActions() {
  const grid = document.getElementById('actions-grid');
  if (!grid) return;
  grid.innerHTML = '';
  
  const fragment = document.createDocumentFragment();
  ACTIONS.forEach(a => {
    const card = document.createElement('div');
    card.className = `action-card ${state.actionsChecked.has(a.id) ? 'checked' : ''}`;
    card.setAttribute('role', 'listitem');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-pressed', state.actionsChecked.has(a.id) ? 'true' : 'false');
    card.setAttribute('aria-label', `${a.title}: ${a.desc}. Impact: ${a.impact}. ${state.actionsChecked.has(a.id) ? 'Completed' : 'Not yet done'}`);
    
    card.onclick = (e) => toggleAction(a.id, card);
    card.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleAction(a.id, card);
      }
    };
    
    const iconWrap = document.createElement('div');
    iconWrap.className = 'action-icon-wrap';
    iconWrap.setAttribute('aria-hidden', 'true');
    iconWrap.textContent = a.emoji;
    
    const contentWrap = document.createElement('div');
    contentWrap.style.flex = '1';
    
    const title = document.createElement('div');
    title.className = 'action-title';
    title.textContent = a.title;
    
    const desc = document.createElement('div');
    desc.className = 'action-desc';
    desc.textContent = a.desc;
    
    const impact = document.createElement('div');
    impact.className = 'action-impact';
    impact.setAttribute('aria-label', 'Impact');
    impact.textContent = a.impact;
    
    contentWrap.appendChild(title);
    contentWrap.appendChild(desc);
    contentWrap.appendChild(impact);
    
    const check = document.createElement('div');
    check.className = 'action-check';
    check.setAttribute('aria-hidden', 'true');
    if (state.actionsChecked.has(a.id)) {
      check.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>';
    }
    
    card.appendChild(iconWrap);
    card.appendChild(contentWrap);
    card.appendChild(check);
    fragment.appendChild(card);
  });
  grid.appendChild(fragment);
  
  document.getElementById('actions-done-count').textContent = state.actionsChecked.size;
}

window.toggleAction = async function(id, el) {
  const response = await api.toggleAction(id);
  
  if (response.completed) {
    state.actionsChecked.add(id);
    el.classList.add('checked');
    el.setAttribute('aria-pressed', 'true');
    // Earn 10 points on completion
    state.user.ecoScore = Math.min(100, (state.user.ecoScore || 60) + 4);
    showToast('Action completed! +4 EcoScore 🎉', 'success');
  } else {
    state.actionsChecked.delete(id);
    el.classList.remove('checked');
    el.setAttribute('aria-pressed', 'false');
    state.user.ecoScore = Math.max(0, (state.user.ecoScore || 60) - 4);
  }
  
  // Save EcoScore changes
  await api.saveUserData(state.user, null);
  updateDashboardUI();
  renderActions();
};

/* ── Leaderboard Rendering ────────────────────────────────────── */
const RANK_CLASSES = ['gold', 'silver', 'bronze', 'other', 'other', 'other'];

async function renderLeaderboard() {
  const el = document.getElementById('leaderboard-list');
  if (!el) return;
  const board = await api.getLeaderboard(state.user.city);
  el.innerHTML = '';
  
  let userRank = 3;
  const fragment = document.createDocumentFragment();
  board.forEach((u, i) => {
    if (u.isUser) {
      userRank = i + 1;
    }
    const item = document.createElement('div');
    item.className = 'leaderboard-item';
    item.setAttribute('role', 'listitem');
    
    const rank = document.createElement('div');
    rank.className = `lb-rank ${RANK_CLASSES[i] || 'other'}`;
    rank.setAttribute('aria-label', `Rank ${i + 1}`);
    rank.textContent = i + 1;
    
    const avatar = document.createElement('div');
    avatar.className = 'lb-avatar';
    avatar.style.background = u.color;
    avatar.style.color = u.text;
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = u.avatar;
    
    const name = document.createElement('span');
    name.className = 'lb-name';
    name.textContent = u.name;
    
    const barWrap = document.createElement('div');
    barWrap.className = 'lb-bar-wrap';
    barWrap.setAttribute('role', 'progressbar');
    barWrap.setAttribute('aria-valuenow', u.score);
    barWrap.setAttribute('aria-valuemin', '0');
    barWrap.setAttribute('aria-valuemax', '100');
    barWrap.setAttribute('aria-label', `${u.score} EcoScore`);
    
    const bar = document.createElement('div');
    bar.className = 'lb-bar';
    bar.style.width = `${u.score}%`;
    barWrap.appendChild(bar);
    
    const score = document.createElement('span');
    score.className = 'lb-score';
    score.textContent = u.score;
    
    item.appendChild(rank);
    item.appendChild(avatar);
    item.appendChild(name);
    item.appendChild(barWrap);
    item.appendChild(score);
    fragment.appendChild(item);
  });
  el.appendChild(fragment);

  const rankEl = document.getElementById('dash-rank');
  if (rankEl) {
    rankEl.textContent = '#' + userRank;
  }
}

/* ── Settings Save ────────────────────────────────────────────── */
function loadSettingsFields() {
  const nameEl = document.getElementById('set-name');
  const emailEl = document.getElementById('set-email');
  const stateSearchEl = document.getElementById('set-state-search');
  
  if (nameEl) nameEl.value = state.user.name || '';
  if (emailEl) emailEl.value = state.user.email || '';
  if (stateSearchEl) {
    const savedStateVal = state.user.city || '';
    stateSearchEl.value = savedStateVal.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  }
}

window.saveSettings = async function() {
  const name = document.getElementById('set-name').value.trim();
  const email = document.getElementById('set-email').value.trim();
  const stateSearchEl = document.getElementById('set-state-search');
  const city = stateSearchEl ? stateSearchEl.value.trim().toLowerCase() : 'delhi';
  
  if (!name) { showToast('Name cannot be empty', 'error'); return; }
  if (!city) { showToast('Please select a State / UT', 'error'); return; }
  
  state.user.name = name;
  state.user.email = email;
  state.user.city = city;
  
  await api.saveUserData(state.user, null);
  updateDashboardUI();
  renderLeaderboard();
  showToast('Settings saved successfully!', 'success');
};

/* ── Delete Confirmation ──────────────────────────────────────── */
window.confirmDelete = async function() {
  if (window.confirm('Are you sure you want to permanently delete your account and all data? This cannot be undone.')) {
    await api.resetActivities();
    localStorage.clear();
    showToast('All local and server records reset. Reloading app.', 'success');
    setTimeout(() => window.location.reload(), 1500);
  }
};

window.initMap = function() {
  const mapDiv = document.getElementById('emission-map');
  if (!mapDiv || typeof google === 'undefined') return;
  const map = new google.maps.Map(mapDiv, {
    center: { lat: 20.5937, lng: 78.9629 },
    zoom: 4,
    mapTypeControl: false,
    streetViewControl: false,
    styles: [
      { elementType: 'geometry', stylers: [{ color: '#f5f5f0' }] },
      { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9e8d0' }] },
      { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#d4edda' }] }
    ]
  });
  const cities = [
    { lat: 28.6139, lng: 77.2090, label: 'Delhi', co2: 9.2 },
    { lat: 19.0760, lng: 72.8777, label: 'Mumbai', co2: 7.8 },
    { lat: 13.0827, lng: 80.2707, label: 'Chennai', co2: 6.1 },
    { lat: 22.5726, lng: 88.3639, label: 'Kolkata', co2: 8.4 },
    { lat: 12.9716, lng: 77.5946, label: 'Bengaluru', co2: 5.9 },
  ];
  cities.forEach(city => {
    const radius = city.co2 * 8000;
    new google.maps.Circle({
      map,
      center: { lat: city.lat, lng: city.lng },
      radius,
      fillColor: '#16a34a',
      fillOpacity: 0.25,
      strokeColor: '#15803d',
      strokeWeight: 1,
    });
    new google.maps.Marker({
      position: { lat: city.lat, lng: city.lng },
      map,
      title: `${city.label}: ${city.co2} tCO₂e/year`,
      label: { text: city.label, fontSize: '11px', fontWeight: '600' }
    });
  });
};

