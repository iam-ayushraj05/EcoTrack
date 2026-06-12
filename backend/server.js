'use strict';

/**
 * server.js - Express API Server
 * Exposes endpoints for calculating footprints, logging activities, toggling actions,
 * and managing profile settings. Persists data to local database.json.
 *
 * Security: CSP, HSTS, rate limiting, payload size limits, input sanitization.
 * Efficiency: Synchronous DB reads are fast for single-user JSON; async I/O would
 *             be overkill here but writeDB returns success/failure for error handling.
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data', 'database.json');

/* ── Rate Limiting ────────────────────────────────────────────── */
// Simple in-memory rate limiter: max 120 requests per minute per IP
const rateLimitMap = new Map();
const RATE_LIMIT = 120;
const RATE_WINDOW_MS = 60 * 1000;

function rateLimit(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  const record = rateLimitMap.get(ip) || { count: 0, start: now };

  if (now - record.start > RATE_WINDOW_MS) {
    // Reset window
    record.count = 1;
    record.start = now;
  } else {
    record.count += 1;
  }

  rateLimitMap.set(ip, record);

  if (record.count > RATE_LIMIT) {
    return res.status(429).json({ error: 'Too many requests. Please try again in a minute.' });
  }
  next();
}

/* ── CORS ─────────────────────────────────────────────────────── */
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, mobile) or from localhost / 127.0.0.1
    if (!origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

/* ── Body parser with size limit ──────────────────────────────── */
app.use(express.json({ limit: '50kb' }));

/* ── Global middleware: security headers + rate limit ─────────── */
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self' https://maps.googleapis.com https://www.gstatic.com",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com https://www.gstatic.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https://maps.googleapis.com https://maps.gstatic.com",
      "connect-src 'self' http://localhost:3000 http://127.0.0.1:3000 http://localhost:* http://127.0.0.1:*"
    ].join('; ')
  );
  next();
});

app.use(rateLimit);

/* ── Input Sanitization ───────────────────────────────────────── */
/**
 * Sanitize a user-supplied string to prevent XSS / HTML injection.
 * @param {string} str
 * @returns {string}
 */
function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .trim()
    .substring(0, 256); // max 256 chars
}

/**
 * Coerce a value to a finite float, clamped to [min, max].
 * Returns `defaultVal` if coercion fails.
 */
function sanitizeFloat(val, defaultVal = 0, min = 0, max = 1e6) {
  const n = parseFloat(val);
  if (!isFinite(n)) return defaultVal;
  return Math.min(max, Math.max(min, n));
}

/**
 * Coerce a value to a finite integer, clamped to [min, max].
 */
function sanitizeInt(val, defaultVal = 0, min = 0, max = 1e9) {
  const n = parseInt(val, 10);
  if (!isFinite(n)) return defaultVal;
  return Math.min(max, Math.max(min, n));
}

/* ── JSON Malformed Body Handler ──────────────────────────────── */
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }
  next(err);
});

/* ── Database Helpers ─────────────────────────────────────────── */
const DEFAULT_DB = {
  user: { name: 'Priya', city: 'delhi', streak: 14, ecoScore: 60 },
  footprint: { transport: 2.1, energy: 1.8, flights: 1.6, food: 0.9 },
  activities: [],
  actionsCompleted: []
};

function readDB() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
      fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2));
      return JSON.parse(JSON.stringify(DEFAULT_DB)); // deep copy
    }
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch (err) {
    console.error('readDB error:', err.message);
    return JSON.parse(JSON.stringify(DEFAULT_DB));
  }
}

function writeDB(data) {
  try {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('writeDB error:', err.message);
    return false;
  }
}

/* ── API ROUTES ───────────────────────────────────────────────── */

// 1. GET User Data
app.get('/api/user', (req, res) => {
  const db = readDB();
  res.json({ user: db.user || {}, footprint: db.footprint || {} });
});

// 2. POST Save User / Footprint
app.post('/api/user', (req, res) => {
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  const db = readDB();
  const { user, footprint } = req.body;

  if (user && typeof user === 'object') {
    const allowedUserKeys = ['name', 'email', 'city', 'ecoScore', 'streak', 'preferences'];
    const sanitizedUser = {};
    allowedUserKeys.forEach(key => {
      if (user[key] === undefined) return;
      if (key === 'preferences' && typeof user[key] === 'object') {
        sanitizedUser[key] = user[key];
      } else if (key === 'ecoScore' || key === 'streak') {
        sanitizedUser[key] = sanitizeInt(user[key], 0, 0, 100);
      } else {
        sanitizedUser[key] = sanitizeString(user[key]);
      }
    });
    db.user = { ...db.user, ...sanitizedUser };
  }

  if (footprint && typeof footprint === 'object') {
    const allowedFootprintKeys = ['transport', 'energy', 'flights', 'food'];
    const sanitizedFootprint = {};
    allowedFootprintKeys.forEach(key => {
      if (footprint[key] !== undefined) {
        sanitizedFootprint[key] = sanitizeFloat(footprint[key], 0, 0, 100);
      }
    });
    db.footprint = { ...db.footprint, ...sanitizedFootprint };
  }

  writeDB(db);
  res.json({ success: true, user: db.user, footprint: db.footprint });
});

// 3. POST Calculate Initial Footprint (Wizard)
app.post('/api/user/calculate', (req, res) => {
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  const db = readDB();
  const { name, city, diet, household } = req.body;

  const drive    = sanitizeFloat(req.body.drive, 0, 0, 5000);
  const flights  = sanitizeFloat(req.body.flights, 0, 0, 365);
  const elec     = sanitizeFloat(req.body.elec, 1200, 0, 100000);
  const hh       = sanitizeFloat(household, 1, 1, 20);

  const dietFactors = { veg: 0.9, vegan: 0.6, nonveg: 1.8, 'meat-heavy': 2.8 };
  const transport = parseFloat(((drive * 52 * 0.21) / 1000).toFixed(2));
  const aviation  = parseFloat((flights * 0.255 * 900 / 1000).toFixed(2));
  const energy    = parseFloat(((elec * 12 * 0.00082) + 0.76).toFixed(2));
  const food      = parseFloat(((dietFactors[diet] || 1.5) * 12 / hh).toFixed(2));
  const total     = parseFloat((transport + aviation + energy + food).toFixed(1));

  db.footprint = { transport, flights: aviation, energy, food };
  db.user = {
    ...db.user,
    name: sanitizeString(name) || db.user.name || 'Priya',
    city: sanitizeString(city).toLowerCase() || db.user.city || 'delhi',
    ecoScore: 60
  };

  writeDB(db);
  res.json({ total, footprint: db.footprint, user: db.user });
});

// 4. GET Activities List
app.get('/api/activities', (req, res) => {
  const db = readDB();
  res.json(db.activities || []);
});

// 5. POST Log New Activity
app.post('/api/activities', (req, res) => {
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  const { name, category, co2 } = req.body;

  if (!name || !category || co2 === undefined || co2 === null || co2 === '') {
    return res.status(400).json({ error: 'Missing activity log details' });
  }

  const db = readDB();

  const newActivity = {
    id: 'act-' + Date.now(),
    date: new Date().toLocaleDateString('en-IN'),
    name: sanitizeString(String(name)),
    category: sanitizeString(String(category)),
    // Store co2 as a number for type-safe comparisons
    co2: sanitizeFloat(co2, 0, 0, 1e6),
    status: 'Logged'
  };

  if (!db.activities) db.activities = [];
  db.activities.unshift(newActivity);
  writeDB(db);

  res.json(newActivity);
});

// 6. DELETE Reset Activities & Actions
app.delete('/api/activities', (req, res) => {
  const db = readDB();
  db.activities = [];
  db.actionsCompleted = [];
  db.footprint = { transport: 2.1, energy: 1.8, flights: 1.6, food: 0.9 };
  db.user.ecoScore = 60;
  writeDB(db);
  res.json({ success: true, message: 'All activities and checklist items cleared' });
});

// 7. GET Action Checklist
app.get('/api/actions', (req, res) => {
  const db = readDB();
  res.json(db.actionsCompleted || []);
});

// 8. POST Toggle Action Checklist Item
app.post('/api/actions/toggle', (req, res) => {
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  const { actionId } = req.body;
  if (!actionId || typeof actionId !== 'string') {
    return res.status(400).json({ error: 'Missing action ID' });
  }

  const cleanActionId = sanitizeString(actionId);
  if (!cleanActionId) {
    return res.status(400).json({ error: 'Invalid action ID' });
  }

  const db = readDB();
  if (!db.actionsCompleted) db.actionsCompleted = [];

  const index = db.actionsCompleted.indexOf(cleanActionId);
  let completed = false;

  if (index > -1) {
    db.actionsCompleted.splice(index, 1);
    db.user.ecoScore = Math.max(0, (db.user.ecoScore || 60) - 4);
  } else {
    db.actionsCompleted.push(cleanActionId);
    db.user.ecoScore = Math.min(100, (db.user.ecoScore || 60) + 4);
    completed = true;
  }

  writeDB(db);
  res.json({ completed, list: db.actionsCompleted, ecoScore: db.user.ecoScore });
});

// 9. GET City Leaderboard
app.get('/api/community/leaderboard', (req, res) => {
  const city = sanitizeString(req.query.city || 'delhi').toLowerCase();
  const db = readDB();
  const userName   = (db.user && db.user.name) ? db.user.name : 'Priya S.';
  const userScore  = (db.user && db.user.ecoScore !== undefined) ? db.user.ecoScore : 72;
  const userAvatar = userName.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

  const leaderboardData = {
    delhi: [
      { name: 'Rahul M.',   score: 78, avatar: 'RM', color: '#dcfce7', text: '#166534' },
      { name: 'Sneha P.',   score: 74, avatar: 'SP', color: '#dbeafe', text: '#1e40af' },
      { name: userName,     score: userScore, avatar: userAvatar, color: '#fef3c7', text: '#92400e', isUser: true },
      { name: 'Arun K.',    score: 65, avatar: 'AK', color: '#f3e8ff', text: '#6b21a8' },
      { name: 'Divya R.',   score: 61, avatar: 'DR', color: '#fce7f3', text: '#9d174d' },
      { name: 'Vikram S.',  score: 55, avatar: 'VS', color: '#dcfce7', text: '#166534' }
    ],
    mumbai: [
      { name: 'Karan J.',  score: 81, avatar: 'KJ', color: '#dcfce7', text: '#166534' },
      { name: 'Asha P.',   score: 78, avatar: 'AP', color: '#fef3c7', text: '#92400e' },
      { name: userName,    score: userScore, avatar: userAvatar, color: '#fbe7f3', text: '#9d174d', isUser: true },
      { name: 'Rohan N.',  score: 68, avatar: 'RN', color: '#dbeafe', text: '#1e40af' },
      { name: 'Kavya S.',  score: 64, avatar: 'KS', color: '#f3e8ff', text: '#6b21a8' }
    ],
    bengaluru: [
      { name: 'Srinivas R.', score: 85, avatar: 'SR', color: '#dbeafe', text: '#1e40af' },
      { name: 'Neha V.',     score: 80, avatar: 'NV', color: '#dcfce7', text: '#166534' },
      { name: userName,      score: userScore, avatar: userAvatar, color: '#fef3c7', text: '#92400e', isUser: true },
      { name: 'Ananya G.',   score: 70, avatar: 'AG', color: '#f3e8ff', text: '#6b21a8' },
      { name: 'Amit B.',     score: 60, avatar: 'AB', color: '#fde68a', text: '#92400e' }
    ]
  };

  const list = [...(leaderboardData[city] || leaderboardData['delhi'])];
  list.sort((a, b) => b.score - a.score);
  res.json(list);
});

/* ── Global Error Handler ─────────────────────────────────────── */
// Catches unhandled errors and returns a clean JSON response instead of crashing
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error('Unhandled error:', err.message);
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }
  res.status(500).json({ error: 'Internal server error' });
});

/* ── Static Serve (Optional) ──────────────────────────────────── */
app.use(express.static(path.join(__dirname, '..')));

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`EcoTrack Backend running on http://localhost:${PORT}`);
  });
}

module.exports = app;
