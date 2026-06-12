'use strict';

/**
 * api.js - Data Access & API Layer
 * Abstracts backend HTTP requests with a transparent fallback to
 * localStorage when the Express backend is offline.
 *
 * All public methods are async and always resolve (never reject),
 * so callers do not need try/catch wrappers.
 */

/** Base URL for the Express API. */
const API_BASE_URL = 'http://localhost:3000/api';

/** Connection timeout for the health-check probe (ms). */
const PROBE_TIMEOUT_MS = 1500;

/** Keys used in localStorage for offline persistence. */
const LS_KEYS = Object.freeze({
  USER:       'ecotrack_user',
  FOOTPRINT:  'ecotrack_footprint',
  ACTIVITIES: 'ecotrack_activities',
  ACTIONS:    'ecotrack_actions'
});

/**
 * Safely parse a JSON string from localStorage.
 * Returns `fallback` on any parse error.
 * @template T
 * @param {string} key
 * @param {T} fallback
 * @returns {T}
 */
function lsGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Safely serialise and store a value in localStorage.
 * Silently discards write errors (e.g. private-mode quota).
 * @param {string} key
 * @param {unknown} value
 */
function lsSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable — continue in-memory only
  }
}

const api = {
  /** Whether the Express backend is reachable. */
  isOffline: true,

  /**
   * Probe the backend and switch the UI badge accordingly.
   * Must be called once during app initialisation.
   */
  async init() {
    try {
      const response = await fetch(`${API_BASE_URL}/user`, {
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS)
      });
      this.isOffline = !response.ok;
    } catch {
      this.isOffline = true;
    }
    this._updateModeUI();
  },

  /** @private */
  _updateModeUI() {
    const header = document.querySelector('.header-tagline');
    if (!header) return;

    const existing = document.getElementById('mode-badge');
    if (existing) existing.remove();

    const badge = document.createElement('span');
    badge.id = 'mode-badge';
    if (this.isOffline) {
      badge.className = 'mode-badge local';
      badge.textContent = 'Local Storage';
      badge.title = 'Express server is offline. Data is stored in your browser.';
    } else {
      badge.className = 'mode-badge server';
      badge.textContent = 'Connected';
      badge.title = 'Connected to local Node.js Express server.';
    }
    header.after(badge);
  },

  /**
   * Fetch the current user profile and footprint data.
   * @returns {Promise<{user: object, footprint: object}>}
   */
  async getUserData() {
    if (!this.isOffline) {
      try {
        const res = await fetch(`${API_BASE_URL}/user`);
        if (res.ok) return res.json();
      } catch { /* fall through to local */ }
    }

    const user = lsGet(LS_KEYS.USER, null);
    if (!user) {
      const defaultUser = {
        name: 'Priya', email: 'priya@example.com', city: 'delhi',
        streak: 14, ecoScore: 72,
        preferences: { dailyReminders: true, weeklySummary: true, aiTips: true, units: 'Metric (kg, km)' }
      };
      const defaultFootprint = { transport: 2.1, energy: 1.8, flights: 1.6, food: 0.9 };
      lsSet(LS_KEYS.USER, defaultUser);
      lsSet(LS_KEYS.FOOTPRINT, defaultFootprint);
      return { user: defaultUser, footprint: defaultFootprint };
    }

    return { user, footprint: lsGet(LS_KEYS.FOOTPRINT, { transport: 2.1, energy: 1.8, flights: 1.6, food: 0.9 }) };
  },

  /**
   * Persist user profile and/or footprint changes.
   * @param {object|null} userData
   * @param {object|null} footprintData
   * @returns {Promise<{success: boolean}>}
   */
  async saveUserData(userData, footprintData) {
    if (!this.isOffline) {
      try {
        const res = await fetch(`${API_BASE_URL}/user`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user: userData, footprint: footprintData })
        });
        if (res.ok) return res.json();
      } catch { /* fall through to local */ }
    }

    if (userData) {
      const current = lsGet(LS_KEYS.USER, {});
      lsSet(LS_KEYS.USER, { ...current, ...userData });
    }
    if (footprintData) lsSet(LS_KEYS.FOOTPRINT, footprintData);
    return { success: true };
  },

  /**
   * Run the onboarding calculation (wizard step 3).
   * @param {object} wizardAnswers
   * @returns {Promise<{total: number, footprint: object, user: object}>}
   */
  async calculateInitialFootprint(wizardAnswers) {
    if (!this.isOffline) {
      try {
        const res = await fetch(`${API_BASE_URL}/user/calculate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(wizardAnswers)
        });
        if (res.ok) return res.json();
      } catch { /* fall through to local */ }
    }

    // Local computation fallback
    const drive     = parseFloat(wizardAnswers.drive)     || 0;
    const flights   = parseFloat(wizardAnswers.flights)   || 0;
    const elec      = parseFloat(wizardAnswers.elec)      || 0;
    const household = parseFloat(wizardAnswers.household) || 1;
    const diet      = wizardAnswers.diet || 'veg';
    const dietFactors = { veg: 0.9, vegan: 0.6, nonveg: 1.8, 'meat-heavy': 2.8 };

    const transport = parseFloat(((drive * 52 * 0.21) / 1000).toFixed(2));
    const aviation  = parseFloat((flights * 0.255 * 900 / 1000).toFixed(2));
    const energy    = parseFloat(((elec * 12 * 0.00082) + 0.76).toFixed(2));
    const food      = parseFloat(((dietFactors[diet] || 1.5) * 12 / household).toFixed(2));
    const total     = parseFloat((transport + aviation + energy + food).toFixed(1));
    const footprint = { transport, flights: aviation, energy, food };

    const currentUser = lsGet(LS_KEYS.USER, {});
    const user = { ...currentUser, name: wizardAnswers.name, city: wizardAnswers.city, ecoScore: 60 };
    lsSet(LS_KEYS.USER, user);
    lsSet(LS_KEYS.FOOTPRINT, footprint);
    return { total, footprint, user };
  },

  /**
   * Retrieve the full activity log.
   * @returns {Promise<Array>}
   */
  async getActivities() {
    if (!this.isOffline) {
      try {
        const res = await fetch(`${API_BASE_URL}/activities`);
        if (res.ok) return res.json();
      } catch { /* fall through to local */ }
    }
    return lsGet(LS_KEYS.ACTIVITIES, []);
  },

  /**
   * Append a new activity entry.
   * @param {object} activity
   * @returns {Promise<object>}
   */
  async logActivity(activity) {
    if (!this.isOffline) {
      try {
        const res = await fetch(`${API_BASE_URL}/activities`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(activity)
        });
        if (res.ok) return res.json();
      } catch { /* fall through to local */ }
    }

    const list = lsGet(LS_KEYS.ACTIVITIES, []);
    const newEntry = { id: 'local-' + Date.now(), date: new Date().toLocaleDateString('en-IN'), ...activity };
    list.unshift(newEntry);
    lsSet(LS_KEYS.ACTIVITIES, list);
    return newEntry;
  },

  /**
   * Clear all activities, actions, and reset the footprint baseline.
   * @returns {Promise<boolean>}
   */
  async resetActivities() {
    if (!this.isOffline) {
      try {
        const res = await fetch(`${API_BASE_URL}/activities`, { method: 'DELETE' });
        if (res.ok) return true;
      } catch { /* fall through to local */ }
    }
    localStorage.removeItem(LS_KEYS.ACTIVITIES);
    return true;
  },

  /**
   * Retrieve the list of completed action IDs.
   * @returns {Promise<string[]>}
   */
  async getActions() {
    if (!this.isOffline) {
      try {
        const res = await fetch(`${API_BASE_URL}/actions`);
        if (res.ok) return res.json();
      } catch { /* fall through to local */ }
    }
    return lsGet(LS_KEYS.ACTIONS, []);
  },

  /**
   * Toggle an action's completed state.
   * @param {string} actionId
   * @returns {Promise<{completed: boolean, list: string[]}>}
   */
  async toggleAction(actionId) {
    if (!this.isOffline) {
      try {
        const res = await fetch(`${API_BASE_URL}/actions/toggle`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ actionId })
        });
        if (res.ok) return res.json();
      } catch { /* fall through to local */ }
    }

    const list     = lsGet(LS_KEYS.ACTIONS, []);
    const index    = list.indexOf(actionId);
    let completed  = false;
    if (index > -1) {
      list.splice(index, 1);
    } else {
      list.push(actionId);
      completed = true;
    }
    lsSet(LS_KEYS.ACTIONS, list);
    return { completed, list };
  },

  /**
   * Fetch city leaderboard, with in-memory cache to avoid repeated requests.
   * @param {string} [city='delhi']
   * @returns {Promise<Array>}
   */
  async getLeaderboard(city = 'delhi') {
    const cacheKey = `lb_${city}`;
    if (this._lbCache && this._lbCache[cacheKey]) return this._lbCache[cacheKey];

    if (!this.isOffline) {
      try {
        const res = await fetch(`${API_BASE_URL}/community/leaderboard?city=${encodeURIComponent(city)}`);
        if (res.ok) {
          const data = await res.json();
          this._lbCache = this._lbCache || {};
          this._lbCache[cacheKey] = data;
          return data;
        }
      } catch { /* fall through to local */ }
    }

    const localUser  = lsGet(LS_KEYS.USER, {});
    const userName   = localUser.name  || 'Priya S.';
    const userScore  = localUser.ecoScore !== undefined ? localUser.ecoScore : 72;
    const userAvatar = userName.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

    const list = [
      { name: 'Rahul M.',  score: 78, avatar: 'RM', color: '#dcfce7', text: '#166534' },
      { name: 'Sneha P.',  score: 74, avatar: 'SP', color: '#dbeafe', text: '#1e40af' },
      { name: userName,   score: userScore, avatar: userAvatar, color: '#fef3c7', text: '#92400e', isUser: true },
      { name: 'Arun K.',  score: 65, avatar: 'AK', color: '#f3e8ff', text: '#6b21a8' },
      { name: 'Divya R.', score: 61, avatar: 'DR', color: '#fce7f3', text: '#9d174d' },
      { name: 'Vikram S.', score: 55, avatar: 'VS', color: '#dcfce7', text: '#166534' }
    ];
    list.sort((a, b) => b.score - a.score);
    return list;
  }
};
