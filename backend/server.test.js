/**
 * server.test.js - API Endpoint Tests
 * Uses Node.js built-in test runner (node:test) and native fetch.
 */

const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const app = require('./server');

test('EcoTrack API Integration Tests', async (t) => {
  let server;
  let port;

  // Setup: Start server on random ephemeral port
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, () => {
      port = server.address().port;
      resolve();
    });
  });

  // API Request Helper
  const apiFetch = async (endpoint, options = {}) => {
    const res = await fetch(`http://localhost:${port}${endpoint}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers }
    });
    return {
      status: res.status,
      data: await res.json()
    };
  };

  await t.test('GET /api/user - returns profile & footprint data', async () => {
    const { status, data } = await apiFetch('/api/user');
    assert.strictEqual(status, 200);
    assert.ok(data.user, 'Response should contain user object');
    assert.ok(data.footprint, 'Response should contain footprint object');
  });

  await t.test('POST /api/user/calculate - calculates correct footprint', async () => {
    const payload = {
      name: 'Priya Sharma',
      city: 'delhi',
      drive: 100,
      flights: 4,
      diet: 'veg',
      household: 3,
      elec: 1200
    };
    const { status, data } = await apiFetch('/api/user/calculate', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    assert.strictEqual(status, 200);
    assert.strictEqual(data.user.name, 'Priya Sharma');
    assert.strictEqual(data.user.city, 'delhi');
    assert.ok(data.footprint.transport >= 0);
    assert.ok(data.footprint.energy >= 0);
    assert.ok(data.footprint.flights >= 0);
    assert.ok(data.footprint.food >= 0);
    assert.ok(data.total >= 0);
  });

  await t.test('POST /api/activities - rejects missing details with 400', async () => {
    const { status, data } = await apiFetch('/api/activities', {
      method: 'POST',
      body: JSON.stringify({ name: 'Car Trip' }) // missing co2 and category
    });
    assert.strictEqual(status, 400);
    assert.ok(data.error);
  });

  await t.test('POST /api/activities - logs valid activity', async () => {
    const { status, data } = await apiFetch('/api/activities', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Petrol car trip (25km)',
        category: 'transport',
        co2: 5.25
      })
    });
    assert.strictEqual(status, 200);
    assert.strictEqual(data.name, 'Petrol car trip (25km)');
    assert.strictEqual(data.category, 'transport');
    assert.strictEqual(data.co2, 5.25);
    assert.ok(data.id);
  });

  await t.test('POST /api/actions/toggle - toggles action checklist', async () => {
    const { status, data } = await apiFetch('/api/actions/toggle', {
      method: 'POST',
      body: JSON.stringify({ actionId: 'transit-week' })
    });
    assert.strictEqual(status, 200);
    assert.ok('completed' in data);
    assert.ok(Array.isArray(data.list));
  });

  await t.test('GET /api/community/leaderboard - returns leaderboard data', async () => {
    const { status, data } = await apiFetch('/api/community/leaderboard?city=delhi');
    assert.strictEqual(status, 200);
    assert.ok(Array.isArray(data));
    assert.ok(data.length > 0);
  });

  await t.test('POST /api/user - saves user and footprint data', async () => {
    const payload = {
      user: { name: 'Test User', email: 'test@example.com' },
      footprint: { transport: 1.5, energy: 2.0, flights: 0, food: 1.0 }
    };
    const { status, data } = await apiFetch('/api/user', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    assert.strictEqual(status, 200);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.user.name, 'Test User');
    assert.strictEqual(data.footprint.transport, 1.5);
  });

  await t.test('GET /api/activities - returns activities list', async () => {
    const { status, data } = await apiFetch('/api/activities');
    assert.strictEqual(status, 200);
    assert.ok(Array.isArray(data));
  });

  await t.test('GET /api/actions - returns actions completed', async () => {
    const { status, data } = await apiFetch('/api/actions');
    assert.strictEqual(status, 200);
    assert.ok(Array.isArray(data));
  });

  await t.test('DELETE /api/activities - resets activities and actions', async () => {
    const { status, data } = await apiFetch('/api/activities', {
      method: 'DELETE'
    });
    assert.strictEqual(status, 200);
    assert.strictEqual(data.success, true);
  });

  // Teardown: Stop server
  await new Promise((resolve) => server.close(resolve));
});
