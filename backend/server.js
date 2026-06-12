/**
 * server.js - Express API Server
 * Exposes endpoints for calculating footprints, logging activities, toggling actions,
 * and managing profile settings. Persists data to local database.json.
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data', 'database.json');

// Middleware
app.use(cors());
app.use(express.json());

// Security Headers Middleware
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Content-Security-Policy', "default-src 'self' https://maps.googleapis.com https://www.gstatic.com; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com https://www.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://maps.googleapis.com https://maps.gstatic.com; connect-src 'self' http://localhost:3000 http://127.0.0.1:3000 http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*;");
  next();
});

// Helper function to read database safely
function readDB() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      // Ensure folder exists and write default structure
      fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
      const defaultDB = { user: { name: "Priya", city: "delhi", streak: 14, ecoScore: 60 }, footprint: { transport: 2.1, energy: 1.8, flights: 1.6, food: 0.9 }, activities: [], actionsCompleted: [] };
      fs.writeFileSync(DB_PATH, JSON.stringify(defaultDB, null, 2));
      return defaultDB;
    }
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading JSON database:', error);
    return {};
  }
}

// Helper function to write to database
function writeDB(data) {
  try {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error writing to JSON database:', error);
    return false;
  }
}

/* ── API ROUTES ────────────────────────────────────────────────── */

// 1. GET User Data (Profile, preferences, footprints)
app.get('/api/user', (req, res) => {
  const db = readDB();
  res.json({
    user: db.user || {},
    footprint: db.footprint || {}
  });
});

// 2. POST Save User/Footprint Data
app.post('/api/user', (req, res) => {
  const db = readDB();
  const { user, footprint } = req.body;
  
  if (user) {
    db.user = { ...db.user, ...user };
  }
  if (footprint) {
    db.footprint = { ...db.footprint, ...footprint };
  }
  
  writeDB(db);
  res.json({ success: true, user: db.user, footprint: db.footprint });
});

// 3. POST Calculate Initial Footprint (Wizard)
app.post('/api/user/calculate', (req, res) => {
  const db = readDB();
  const { name, city, drive, flights, diet, household } = req.body;

  const dietFactors = { veg: 0.9, vegan: 0.6, nonveg: 1.8, 'meat-heavy': 2.8 };
  const transport = parseFloat(((drive * 52 * 0.21) / 1000).toFixed(2));
  const aviation = parseFloat((flights * 0.255 * 900 / 1000).toFixed(2));
  // Get elec from req.body if sent, fallback otherwise
  const elecInput = parseFloat(req.body.elec) || 1200;
  const energyCalculated = parseFloat(((elecInput * 12 * 0.00082) + 0.76).toFixed(2));
  
  const food = parseFloat(((dietFactors[diet] || 1.5) * 12 / household).toFixed(2));
  const total = parseFloat((transport + aviation + energyCalculated + food).toFixed(1));

  db.footprint = {
    transport,
    flights: aviation,
    energy: energyCalculated,
    food
  };
  
  db.user = {
    ...db.user,
    name: name || db.user.name || 'Priya',
    city: city || db.user.city || 'delhi',
    ecoScore: 60
  };

  writeDB(db);

  res.json({
    total,
    footprint: db.footprint,
    user: db.user
  });
});

// 4. GET Activities List
app.get('/api/activities', (req, res) => {
  const db = readDB();
  res.json(db.activities || []);
});

// 5. POST Log new activity
app.post('/api/activities', (req, res) => {
  const db = readDB();
  const { name, category, co2 } = req.body;

  if (!name || !category || !co2) {
    return res.status(400).json({ error: 'Missing activity log details' });
  }

  const newActivity = {
    id: 'act-' + Date.now(),
    date: new Date().toLocaleDateString('en-IN'),
    name,
    category,
    co2,
    status: 'Logged'
  };

  if (!db.activities) db.activities = [];
  db.activities.unshift(newActivity);
  
  writeDB(db);
  res.json(newActivity);
});

// 6. DELETE Reset/Clear all activities
app.delete('/api/activities', (req, res) => {
  const db = readDB();
  db.activities = [];
  db.actionsCompleted = [];
  db.footprint = { transport: 2.1, energy: 1.8, flights: 1.6, food: 0.9 };
  db.user.ecoScore = 60;
  
  writeDB(db);
  res.json({ success: true, message: 'All activities and checklist items cleared' });
});

// 7. GET Action Checklist completion list
app.get('/api/actions', (req, res) => {
  const db = readDB();
  res.json(db.actionsCompleted || []);
});

// 8. POST Toggle Action Checklist item
app.post('/api/actions/toggle', (req, res) => {
  const db = readDB();
  const { actionId } = req.body;

  if (!actionId) {
    return res.status(400).json({ error: 'Missing action ID' });
  }

  if (!db.actionsCompleted) db.actionsCompleted = [];
  
  const index = db.actionsCompleted.indexOf(actionId);
  let completed = false;

  if (index > -1) {
    db.actionsCompleted.splice(index, 1);
    db.user.ecoScore = Math.max(0, (db.user.ecoScore || 60) - 4);
  } else {
    db.actionsCompleted.push(actionId);
    db.user.ecoScore = Math.min(100, (db.user.ecoScore || 60) + 4);
    completed = true;
  }

  writeDB(db);
  res.json({ completed, list: db.actionsCompleted, ecoScore: db.user.ecoScore });
});

// 9. GET City Leaderboard
app.get('/api/community/leaderboard', (req, res) => {
  const city = req.query.city || 'delhi';
  const db = readDB();
  const userName = (db.user && db.user.name) ? db.user.name : 'Priya S.';
  const userScore = (db.user && db.user.ecoScore !== undefined) ? db.user.ecoScore : 72;
  const userAvatar = userName.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  
  // Mock dataset that responds to Delhi, Mumbai, Bengaluru
  const leaderboardData = {
    delhi: [
      { name: 'Rahul M.', score: 78, avatar: 'RM', color: '#dcfce7', text: '#166534' },
      { name: 'Sneha P.', score: 74, avatar: 'SP', color: '#dbeafe', text: '#1e40af' },
      { name: userName, score: userScore, avatar: userAvatar, color: '#fef3c7', text: '#92400e', isUser: true },
      { name: 'Arun K.', score: 65, avatar: 'AK', color: '#f3e8ff', text: '#6b21a8' },
      { name: 'Divya R.', score: 61, avatar: 'DR', color: '#fce7f3', text: '#9d174d' },
      { name: 'Vikram S.', score: 55, avatar: 'VS', color: '#dcfce7', text: '#166534' }
    ],
    mumbai: [
      { name: 'Karan J.', score: 81, avatar: 'KJ', color: '#dcfce7', text: '#166534' },
      { name: 'Asha P.', score: 78, avatar: 'AP', color: '#fef3c7', text: '#92400e' },
      { name: userName, score: userScore, avatar: userAvatar, color: '#fbe7f3', text: '#9d174d', isUser: true },
      { name: 'Rohan N.', score: 68, avatar: 'RN', color: '#dbeafe', text: '#1e40af' },
      { name: 'Kavya S.', score: 64, avatar: 'KS', color: '#f3e8ff', text: '#6b21a8' }
    ],
    bengaluru: [
      { name: 'Srinivas R.', score: 85, avatar: 'SR', color: '#dbeafe', text: '#1e40af' },
      { name: 'Neha V.', score: 80, avatar: 'NV', color: '#dcfce7', text: '#166534' },
      { name: userName, score: userScore, avatar: userAvatar, color: '#fef3c7', text: '#92400e', isUser: true },
      { name: 'Ananya G.', score: 70, avatar: 'AG', color: '#f3e8ff', text: '#6b21a8' },
      { name: 'Amit B.', score: 60, avatar: 'AB', color: '#fde68a', text: '#92400e' }
    ]
  };

  const list = leaderboardData[city.toLowerCase()] || leaderboardData['delhi'];
  list.sort((a, b) => b.score - a.score);
  res.json(list);
});

// Serve frontend client statically (Optional helper if root execution is desired)
app.use(express.static(path.join(__dirname, '..')));

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`EcoTrack Backend Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
