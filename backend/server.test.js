'use strict';

/**
 * server.test.js - Full API Endpoint Test Suite
 * Uses Node.js built-in test runner (node:test) and native fetch.
 * Covers: happy-path, validation, edge cases, and security boundaries.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const app = require('./server');

test('EcoTrack API Integration Tests', async (t) => {
  let server;
  let port;

  // ── Setup: start on ephemeral port ────────────────────────────
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, () => {
      port = server.address().port;
      resolve();
    });
  });

  // ── API Request Helper ─────────────────────────────────────────
  const apiFetch = async (endpoint, options = {}) => {
    const res = await fetch(`http://localhost:${port}${endpoint}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers }
    });
    return { status: res.status, data: await res.json() };
  };

  // ── 1. User Data ───────────────────────────────────────────────
  await t.test('GET /api/user - returns profile & footprint data', async () => {
    const { status, data } = await apiFetch('/api/user');
    assert.equal(status, 200);
    assert.ok(data.user, 'Response should contain user object');
    assert.ok(data.footprint, 'Response should contain footprint object');
    assert.ok(typeof data.user.name === 'string', 'user.name should be a string');
    assert.ok(typeof data.footprint.transport === 'number', 'footprint.transport should be a number');
  });

  // ── 2. Calculate Footprint (Wizard) ───────────────────────────
  await t.test('POST /api/user/calculate - calculates correct footprint', async () => {
    const { status, data } = await apiFetch('/api/user/calculate', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Priya Sharma',
        city: 'delhi',
        drive: 100,
        flights: 4,
        diet: 'veg',
        household: 3,
        elec: 1200
      })
    });
    assert.equal(status, 200);
    assert.equal(data.user.name, 'Priya Sharma');
    assert.equal(data.user.city, 'delhi');
    assert.ok(data.footprint.transport >= 0);
    assert.ok(data.footprint.energy >= 0);
    assert.ok(data.footprint.flights >= 0);
    assert.ok(data.footprint.food >= 0);
    assert.ok(data.total >= 0);
    assert.equal(typeof data.total, 'number', 'total should be a number');
  });

  // ── 3. Activity Validation: Missing fields ─────────────────────
  await t.test('POST /api/activities - rejects missing details with 400', async () => {
    const { status, data } = await apiFetch('/api/activities', {
      method: 'POST',
      body: JSON.stringify({ name: 'Car Trip' }) // missing co2 and category
    });
    assert.equal(status, 400);
    assert.ok(data.error, 'Should return an error message');
  });

  // ── 4. Activity Logging: Valid payload ─────────────────────────
  await t.test('POST /api/activities - logs valid activity with numeric co2', async () => {
    const { status, data } = await apiFetch('/api/activities', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Petrol car trip (25km)',
        category: 'transport',
        co2: 5.25
      })
    });
    assert.equal(status, 200);
    assert.equal(data.name, 'Petrol car trip (25km)');
    assert.equal(data.category, 'transport');
    // co2 must be stored and returned as a NUMBER (not a string)
    assert.equal(typeof data.co2, 'number', 'co2 should be stored as a number');
    assert.equal(data.co2, 5.25, 'co2 value should be preserved');
    assert.ok(data.id, 'Activity should have an id');
    assert.ok(data.date, 'Activity should have a date');
  });

  // ── 5. Activity Logging: co2 = 0 edge case ────────────────────
  await t.test('POST /api/activities - accepts co2 = 0 (walking)', async () => {
    const { status, data } = await apiFetch('/api/activities', {
      method: 'POST',
      body: JSON.stringify({ name: 'Walk to work', category: 'Transport', co2: 0 })
    });
    assert.equal(status, 200);
    assert.equal(data.co2, 0);
    assert.equal(typeof data.co2, 'number');
  });

  // ── 6. Action Toggle: Missing actionId ────────────────────────
  await t.test('POST /api/actions/toggle - rejects missing actionId with 400', async () => {
    const { status, data } = await apiFetch('/api/actions/toggle', {
      method: 'POST',
      body: JSON.stringify({})
    });
    assert.equal(status, 400);
    assert.ok(data.error);
  });

  // ── 7. Action Toggle: Valid actionId ──────────────────────────
  await t.test('POST /api/actions/toggle - toggles action checklist item', async () => {
    const { status, data } = await apiFetch('/api/actions/toggle', {
      method: 'POST',
      body: JSON.stringify({ actionId: 'transit-test' })
    });
    assert.equal(status, 200);
    assert.ok('completed' in data, 'Should return completed flag');
    assert.ok(Array.isArray(data.list), 'Should return actions list');
    assert.ok(typeof data.ecoScore === 'number', 'ecoScore should be numeric');
  });

  // ── 8. Action Toggle: Idempotency (toggle on then off) ────────
  await t.test('POST /api/actions/toggle - second toggle removes item', async () => {
    const id = 'idempotency-test';
    // First toggle — adds
    const first = await apiFetch('/api/actions/toggle', {
      method: 'POST',
      body: JSON.stringify({ actionId: id })
    });
    assert.equal(first.data.completed, true);

    // Second toggle — removes
    const second = await apiFetch('/api/actions/toggle', {
      method: 'POST',
      body: JSON.stringify({ actionId: id })
    });
    assert.equal(second.data.completed, false);
    assert.ok(!second.data.list.includes(id), 'Item should have been removed');
  });

  // ── 9. Community Leaderboard ──────────────────────────────────
  await t.test('GET /api/community/leaderboard - returns sorted leaderboard', async () => {
    const { status, data } = await apiFetch('/api/community/leaderboard?city=delhi');
    assert.equal(status, 200);
    assert.ok(Array.isArray(data));
    assert.ok(data.length > 0, 'Leaderboard should have entries');
    // Verify sorted descending by score
    for (let i = 0; i < data.length - 1; i++) {
      assert.ok(data[i].score >= data[i + 1].score, 'Leaderboard should be sorted descending');
    }
  });

  // ── 10. Community Leaderboard: Unknown city fallback ──────────
  await t.test('GET /api/community/leaderboard - unknown city falls back to delhi', async () => {
    const { status, data } = await apiFetch('/api/community/leaderboard?city=unknown-city');
    assert.equal(status, 200);
    assert.ok(Array.isArray(data));
    assert.ok(data.length > 0);
  });

  // ── 11. Save User & Footprint ─────────────────────────────────
  await t.test('POST /api/user - saves user and footprint data', async () => {
    const { status, data } = await apiFetch('/api/user', {
      method: 'POST',
      body: JSON.stringify({
        user: { name: 'Test User', email: 'test@example.com' },
        footprint: { transport: 1.5, energy: 2.0, flights: 0, food: 1.0 }
      })
    });
    assert.equal(status, 200);
    assert.equal(data.success, true);
    assert.equal(data.user.name, 'Test User');
    assert.equal(data.footprint.transport, 1.5);
  });

  // ── 12. GET Activities ─────────────────────────────────────────
  await t.test('GET /api/activities - returns activities list', async () => {
    const { status, data } = await apiFetch('/api/activities');
    assert.equal(status, 200);
    assert.ok(Array.isArray(data));
  });

  // ── 13. GET Actions ────────────────────────────────────────────
  await t.test('GET /api/actions - returns actions completed list', async () => {
    const { status, data } = await apiFetch('/api/actions');
    assert.equal(status, 200);
    assert.ok(Array.isArray(data));
  });

  // ── 14. DELETE Reset ───────────────────────────────────────────
  await t.test('DELETE /api/activities - resets all activities and actions', async () => {
    const { status, data } = await apiFetch('/api/activities', { method: 'DELETE' });
    assert.equal(status, 200);
    assert.equal(data.success, true);

    // Verify activities cleared
    const { data: acts } = await apiFetch('/api/activities');
    assert.equal(acts.length, 0, 'Activities should be empty after reset');
  });

  // ── 15. XSS Injection Guard ────────────────────────────────────
  await t.test('POST /api/activities - sanitizes XSS in name', async () => {
    const { status, data } = await apiFetch('/api/activities', {
      method: 'POST',
      body: JSON.stringify({
        name: '<script>alert(1)</script>',
        category: 'transport',
        co2: 1.0
      })
    });
    assert.equal(status, 200);
    assert.ok(!data.name.includes('<script>'), 'XSS should be sanitized');
  });

  // ── Teardown ────────────────────────────────────────────────────
  await new Promise((resolve) => server.close(resolve));
});
