/**
 * api.js - Data Access & API Layer
 * Abstracts backend HTTP requests with a fallback to localStorage if the backend is offline.
 */

'use strict';

const API_BASE_URL = 'http://localhost:3000/api';

const api = {
  isOffline: true, // Default to offline/local mode

  // Detect server availability
  async init() {
    try {
      const response = await fetch(`${API_BASE_URL}/user`, { signal: AbortSignal.timeout(1500) });
      if (response.ok) {
        this.isOffline = false;
        console.log('EcoTrack running in Full-Stack Server Mode');
      } else {
        throw new Error('Server returned error status');
      }
    } catch (err) {
      this.isOffline = true;
      console.warn('EcoTrack running in Local Storage Fallback Mode:', err.message);
    }
    this.updateModeUI();
  },

  updateModeUI() {
    const header = document.querySelector('.header-tagline');
    if (header) {
      // Remove any existing badge
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
    }
  },

  // GET User Data (includes profile, footprint, streak, ecoScore, preferences)
  async getUserData() {
    if (!this.isOffline) {
      try {
        const res = await fetch(`${API_BASE_URL}/user`);
        if (res.ok) return await res.json();
      } catch (e) {
        console.error('API Error: getUserData', e);
      }
    }

    // Local Storage Fallback
    let localUser = localStorage.getItem('ecotrack_user');
    let localFootprint = localStorage.getItem('ecotrack_footprint');
    
    if (!localUser) {
      // Default initial state matching original app
      const defaultUser = {
        name: 'Priya',
        email: 'priya@example.com',
        city: 'delhi',
        streak: 14,
        ecoScore: 72,
        preferences: {
          dailyReminders: true,
          weeklySummary: true,
          aiTips: true,
          units: 'Metric (kg, km)'
        }
      };
      const defaultFootprint = { transport: 2.1, energy: 1.8, flights: 1.6, food: 0.9 };
      localStorage.setItem('ecotrack_user', JSON.stringify(defaultUser));
      localStorage.setItem('ecotrack_footprint', JSON.stringify(defaultFootprint));
      return { user: defaultUser, footprint: defaultFootprint };
    }

    return {
      user: JSON.parse(localUser),
      footprint: JSON.parse(localFootprint)
    };
  },

  // POST Update User Data
  async saveUserData(userData, footprintData) {
    if (!this.isOffline) {
      try {
        const res = await fetch(`${API_BASE_URL}/user`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user: userData, footprint: footprintData })
        });
        if (res.ok) return await res.json();
      } catch (e) {
        console.error('API Error: saveUserData', e);
      }
    }

    // Local Storage Fallback
    if (userData) {
      const current = JSON.parse(localStorage.getItem('ecotrack_user') || '{}');
      localStorage.setItem('ecotrack_user', JSON.stringify({ ...current, ...userData }));
    }
    if (footprintData) {
      localStorage.setItem('ecotrack_footprint', JSON.stringify(footprintData));
    }
    return { success: true };
  },

  // POST Calculate footprint from onboarding wizard
  async calculateInitialFootprint(wizardAnswers) {
    if (!this.isOffline) {
      try {
        const res = await fetch(`${API_BASE_URL}/user/calculate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(wizardAnswers)
        });
        if (res.ok) return await res.json();
      } catch (e) {
        console.error('API Error: calculateInitialFootprint', e);
      }
    }

    // Local Logic Fallback
    const drive = parseFloat(wizardAnswers.drive) || 0;
    const flights = parseFloat(wizardAnswers.flights) || 0;
    const elec = parseFloat(wizardAnswers.elec) || 0;
    const diet = wizardAnswers.diet || 'veg';
    const household = parseFloat(wizardAnswers.household) || 1;

    const dietFactors = { veg: 0.9, vegan: 0.6, nonveg: 1.8, 'meat-heavy': 2.8 };
    const transport = parseFloat(((drive * 52 * 0.21) / 1000).toFixed(2));
    const aviation = parseFloat((flights * 0.255 * 900 / 1000).toFixed(2));
    const energy = parseFloat(((elec * 12 * 0.00082) + 0.76).toFixed(2));
    const food = parseFloat(((dietFactors[diet] || 1.5) * 12 / household).toFixed(2));
    const total = parseFloat((transport + aviation + energy + food).toFixed(1));

    const footprint = { transport, flights: aviation, energy, food };
    const currentUser = JSON.parse(localStorage.getItem('ecotrack_user') || '{}');
    const user = { ...currentUser, name: wizardAnswers.name, city: wizardAnswers.city, ecoScore: 60 };

    localStorage.setItem('ecotrack_user', JSON.stringify(user));
    localStorage.setItem('ecotrack_footprint', JSON.stringify(footprint));

    return { total, footprint, user };
  },

  // GET Logged Activities
  async getActivities() {
    if (!this.isOffline) {
      try {
        const res = await fetch(`${API_BASE_URL}/activities`);
        if (res.ok) return await res.json();
      } catch (e) {
        console.error('API Error: getActivities', e);
      }
    }

    // Local Storage Fallback
    return JSON.parse(localStorage.getItem('ecotrack_activities') || '[]');
  },

  // POST Log new activity
  async logActivity(activity) {
    if (!this.isOffline) {
      try {
        const res = await fetch(`${API_BASE_URL}/activities`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(activity)
        });
        if (res.ok) return await res.json();
      } catch (e) {
        console.error('API Error: logActivity', e);
      }
    }

    // Local Storage Fallback
    const list = JSON.parse(localStorage.getItem('ecotrack_activities') || '[]');
    const newEntry = {
      id: 'local-' + Date.now(),
      date: new Date().toLocaleDateString('en-IN'),
      ...activity
    };
    list.unshift(newEntry);
    localStorage.setItem('ecotrack_activities', JSON.stringify(list));
    return newEntry;
  },

  // DELETE Reset all activities
  async resetActivities() {
    if (!this.isOffline) {
      try {
        const res = await fetch(`${API_BASE_URL}/activities`, { method: 'DELETE' });
        if (res.ok) return true;
      } catch (e) {
        console.error('API Error: resetActivities', e);
      }
    }

    // Local Storage Fallback
    localStorage.removeItem('ecotrack_activities');
    return true;
  },

  // GET Completed Action IDs
  async getActions() {
    if (!this.isOffline) {
      try {
        const res = await fetch(`${API_BASE_URL}/actions`);
        if (res.ok) return await res.json();
      } catch (e) {
        console.error('API Error: getActions', e);
      }
    }

    // Local Storage Fallback
    return JSON.parse(localStorage.getItem('ecotrack_actions') || '[]');
  },

  // POST Toggle Action Completion
  async toggleAction(actionId) {
    if (!this.isOffline) {
      try {
        const res = await fetch(`${API_BASE_URL}/actions/toggle`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ actionId })
        });
        if (res.ok) return await res.json();
      } catch (e) {
        console.error('API Error: toggleAction', e);
      }
    }

    // Local Storage Fallback
    let list = JSON.parse(localStorage.getItem('ecotrack_actions') || '[]');
    const index = list.indexOf(actionId);
    let completed = false;

    if (index > -1) {
      list.splice(index, 1);
    } else {
      list.push(actionId);
      completed = true;
    }
    
    localStorage.setItem('ecotrack_actions', JSON.stringify(list));
    return { completed, list };
  },

  // GET City Leaderboard
  async getLeaderboard(city = 'delhi') {
    if (!this.isOffline) {
      try {
        const res = await fetch(`${API_BASE_URL}/community/leaderboard?city=${city}`);
        if (res.ok) return await res.json();
      } catch (e) {
        console.error('API Error: getLeaderboard', e);
      }
    }

    // Local Fallback Data
    const localUser = JSON.parse(localStorage.getItem('ecotrack_user') || '{}');
    const userName = localUser.name || 'Priya S.';
    const userScore = localUser.ecoScore !== undefined ? localUser.ecoScore : 72;
    const userAvatar = userName.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

    const list = [
      { name: 'Rahul M.', score: 78, avatar: 'RM', color: '#dcfce7', text: '#166534' },
      { name: 'Sneha P.', score: 74, avatar: 'SP', color: '#dbeafe', text: '#1e40af' },
      { name: userName, score: userScore, avatar: userAvatar, color: '#fef3c7', text: '#92400e', isUser: true },
      { name: 'Arun K.', score: 65, avatar: 'AK', color: '#f3e8ff', text: '#6b21a8' },
      { name: 'Divya R.', score: 61, avatar: 'DR', color: '#fce7f3', text: '#9d174d' },
      { name: 'Vikram S.', score: 55, avatar: 'VS', color: '#dcfce7', text: '#166534' }
    ];
    list.sort((a, b) => b.score - a.score);
    return list;
  }
};
