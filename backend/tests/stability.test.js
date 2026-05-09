/**
 * Stability & Crash Resistance Tests
 *
 * Verifies the app handles every class of bad input gracefully — no uncaught
 * exceptions, no 500s on predictable bad data, and no security regressions.
 *
 * Coverage areas:
 *  1. Unknown routes (404)
 *  2. Auth edge cases — malformed tokens, expired tokens, missing header
 *  3. Invalid MongoDB ObjectId in URL params
 *  4. Oversized payload — app has a 10 MB express.json limit
 *  5. Missing / null required fields across all main resources
 *  6. Type-coercion attacks — strings passed where numbers expected
 *  7. NoSQL injection via login body
 *  8. XSS / HTML injection stored harmlessly (no script execution)
 *  9. Concurrent write safety — parallel inserts with the same unique key
 * 10. Storage round-trip — every saved field is retrievable
 * 11. Cascade safety — deleting a Hotel does NOT delete its scores
 *     (orphaned refs expected; app must not crash on populate)
 * 12. Score boundary fencing (0, 100, -0.1, 100.1)
 * 13. Empty-string vs. whitespace-only text fields
 * 14. Very large text stored and retrieved intact
 * 15. Pagination / list calls never crash on empty DB
 */
const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const app = require('../app');
const Hotel = require('../models/Hotel');
const HotelScore = require('../models/HotelScore');
const Task = require('../models/Task');
const Call = require('../models/Call');
const Lead = require('../models/Lead');
const { createAdminUser, createStaffUser, authHeader, getToken } = require('./helpers');

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-jwt-for-orange-falcon';

let admin, staff;

beforeEach(async () => {
  admin = await createAdminUser({ username: 'stabadmin' });
  staff = await createStaffUser({ username: 'stabstaff' });
});

// ─── 1. Unknown routes ────────────────────────────────────────────────────────

describe('Unknown routes — 404 handling', () => {
  it('GET unknown path returns 404, not 500', async () => {
    const res = await request(app).get('/api/totally-does-not-exist');
    expect(res.status).toBe(404);
  });

  it('POST unknown path returns 404, not 500', async () => {
    const res = await request(app)
      .post('/api/ghost-route')
      .set(authHeader(admin._id))
      .send({ data: 'anything' });
    expect(res.status).toBe(404);
  });

  it('Unknown path does not leak stack trace or internal paths', async () => {
    const res = await request(app).get('/api/completely-unknown');
    const body = JSON.stringify(res.body);
    expect(body).not.toMatch(/node_modules|at Object\.<anonymous>|Error:/);
  });
});

// ─── 2. Auth edge cases ───────────────────────────────────────────────────────

describe('Auth — malformed / invalid tokens', () => {
  it('completely missing Authorization header → 401', async () => {
    const res = await request(app).get('/api/tasks');
    expect(res.status).toBe(401);
  });

  it('Bearer with empty string → 401', async () => {
    const res = await request(app).get('/api/tasks').set('Authorization', 'Bearer ');
    expect(res.status).toBe(401);
  });

  it('Non-Bearer scheme → 401', async () => {
    const res = await request(app).get('/api/tasks').set('Authorization', 'Basic dXNlcjpwYXNz');
    expect(res.status).toBe(401);
  });

  it('Structurally valid JWT signed with wrong secret → 401', async () => {
    const token = jwt.sign({ id: admin._id.toString() }, 'TOTALLY_WRONG_SECRET', { expiresIn: '1h' });
    const res = await request(app).get('/api/tasks').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('Expired token → 401', async () => {
    const token = jwt.sign({ id: admin._id.toString() }, JWT_SECRET, { expiresIn: '-1s' });
    const res = await request(app).get('/api/tasks').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('Token referencing a deleted (non-existent) user → 401', async () => {
    const ghostId = new mongoose.Types.ObjectId();
    const token = jwt.sign({ id: ghostId.toString() }, JWT_SECRET, { expiresIn: '1h' });
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('Token payload missing id field → 401', async () => {
    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('Token injected as query param instead of header → 401', async () => {
    const token = getToken(admin._id);
    const res = await request(app).get(`/api/tasks?token=${token}`);
    expect(res.status).toBe(401);
  });
});

// ─── 3. Invalid MongoDB ObjectId in URL ──────────────────────────────────────

describe('Invalid ObjectId in URL params — no 500', () => {
  const routes = [
    { method: 'get',    path: '/api/tasks/not-an-objectid' },
    { method: 'put',    path: '/api/tasks/not-an-objectid',         body: { status: 'completed' } },
    { method: 'delete', path: '/api/tasks/not-an-objectid' },
    { method: 'get',    path: '/api/hotels/not-an-objectid' },
    { method: 'put',    path: '/api/hotels/not-an-objectid',        body: { city: 'NYC' } },
    { method: 'delete', path: '/api/hotels/not-an-objectid' },
    { method: 'put',    path: '/api/hotel-scores/not-an-objectid',  body: { score: 80 } },
    { method: 'delete', path: '/api/hotel-scores/not-an-objectid' },
  ];

  routes.forEach(({ method, path, body }) => {
    it(`${method.toUpperCase()} ${path} → 4xx not 500`, async () => {
      const req = request(app)[method](path).set(authHeader(admin._id));
      if (body) req.send(body);
      const res = await req;
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });
  });

  it('valid-length but non-existent ObjectId → 404, not 500 (hotel-scores)', async () => {
    const fakeId = '64a123456789012345678901';
    const res = await request(app)
      .put(`/api/hotel-scores/${fakeId}`)
      .set(authHeader(admin._id))
      .send({ score: 80 });
    expect(res.status).toBe(404);
  });
});

// ─── 4. Oversized payload ─────────────────────────────────────────────────────

describe('Oversized payload — express limit enforced', () => {
  it('POST with 11 MB body returns 413, not 500', async () => {
    const giant = 'x'.repeat(11 * 1024 * 1024);
    const res = await request(app)
      .post('/api/hotel-scores')
      .set(authHeader(admin._id))
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ notes: giant }));
    expect(res.status).toBe(413);
  });
});

// ─── 5. Missing required fields — all main resources ─────────────────────────

describe('Missing required fields — no 500, proper 400', () => {
  it('POST /api/calls — missing name → 400', async () => {
    const res = await request(app)
      .post('/api/calls')
      .set(authHeader(admin._id))
      .send({ outcome: 'Interested' });
    expect(res.status).toBe(400);
  });

  it('POST /api/leads — missing name → 400', async () => {
    const res = await request(app)
      .post('/api/leads')
      .set(authHeader(admin._id))
      .send({ source: 'Website' });
    expect(res.status).toBe(400);
  });

  it('POST /api/tasks — empty body → 400', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set(authHeader(admin._id))
      .send({});
    expect(res.status).toBe(400);
  });

  it('POST /api/hotels — missing name → 400', async () => {
    const res = await request(app)
      .post('/api/hotels')
      .set(authHeader(admin._id))
      .send({ city: 'Boston' });
    expect(res.status).toBe(400);
  });

  it('POST /api/hotel-scores — empty body → 400', async () => {
    const res = await request(app)
      .post('/api/hotel-scores')
      .set(authHeader(admin._id))
      .send({});
    expect(res.status).toBe(400);
  });

  it('POST /api/routines — empty body → 400', async () => {
    const res = await request(app)
      .post('/api/routines')
      .set(authHeader(admin._id))
      .send({});
    expect(res.status).toBe(400);
  });

  it('POST /api/rfps — missing hotel → 400', async () => {
    const res = await request(app)
      .post('/api/rfps')
      .set(authHeader(admin._id))
      .send({ client: 'Orphan Client' });
    expect(res.status).toBe(400);
  });
});

// ─── 6. Type-coercion attacks ─────────────────────────────────────────────────

describe('Type-coercion — strings where numbers expected', () => {
  let hotel;
  beforeEach(async () => {
    hotel = await Hotel.create({ name: 'TypeHotel', city: 'Boston', createdBy: admin._id, category: 'reputation' });
  });

  it('score as a non-numeric string → 400 or stored as NaN rejected', async () => {
    const res = await request(app)
      .post('/api/hotel-scores')
      .set(authHeader(admin._id))
      .send({ hotel: hotel._id, date: '2026-04-01', score: 'not-a-number' });
    // Should either 400 or fail Mongoose validation (500 never acceptable)
    expect(res.status).not.toBe(200);
    expect(res.status).not.toBe(201);
    expect(res.status).toBeLessThan(500);
  });

  it('score as empty string → rejected', async () => {
    const res = await request(app)
      .post('/api/hotel-scores')
      .set(authHeader(admin._id))
      .send({ hotel: hotel._id, date: '2026-04-01', score: '' });
    expect(res.status).not.toBe(201);
    expect(res.status).toBeLessThan(500);
  });

  it('score as array → rejected', async () => {
    const res = await request(app)
      .post('/api/hotel-scores')
      .set(authHeader(admin._id))
      .send({ hotel: hotel._id, date: '2026-04-01', score: [80, 90] });
    expect(res.status).not.toBe(201);
    expect(res.status).toBeLessThan(500);
  });

  it('score as object → rejected', async () => {
    const res = await request(app)
      .post('/api/hotel-scores')
      .set(authHeader(admin._id))
      .send({ hotel: hotel._id, date: '2026-04-01', score: { value: 80 } });
    expect(res.status).not.toBe(201);
    expect(res.status).toBeLessThan(500);
  });
});

// ─── 7. NoSQL injection via login ─────────────────────────────────────────────

describe('NoSQL injection — login endpoint', () => {
  beforeEach(async () => {
    await createAdminUser({ username: 'TargetUser', password: 'SecurePass1' });
  });

  it('object payload as username does not bypass auth', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: { $gt: '' }, password: 'anything' });
    expect(res.status).not.toBe(200);
  });

  it('object payload as password does not bypass auth', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'TargetUser', password: { $gte: '' } });
    expect(res.status).not.toBe(200);
  });

  it('$where operator in body does not crash or bypass auth', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ $where: 'sleep(5000)', username: 'x', password: 'y' });
    // Should fail auth (400 or 401), never crash the server
    expect(res.status).not.toBe(200);
    expect(res.status).toBeLessThan(500);
  });
});

// ─── 8. XSS / HTML injection stored harmlessly ───────────────────────────────

describe('XSS / HTML injection — stored but never executed server-side', () => {
  it('script tag stored as plain text in task notes', async () => {
    const xss = '<script>alert("xss")</script>';
    const res = await request(app)
      .post('/api/tasks')
      .set(authHeader(admin._id))
      .send({
        taskName: 'Inject test',
        deadline: new Date(Date.now() + 86400000).toISOString(),
        notes: xss,
      });
    expect(res.status).toBe(201);
    // The raw string is stored as-is; server does NOT evaluate it
    expect(res.body.notes).toBe(xss);
  });

  it('HTML in hotel name stored as plain text', async () => {
    const payload = '<img src=x onerror=alert(1)>';
    const res = await request(app)
      .post('/api/hotels')
      .set(authHeader(admin._id))
      .send({ name: payload, city: 'TestCity' });
    // Created or rejected — either way no 500
    expect(res.status).toBeLessThan(500);
  });
});

// ─── 9. Concurrent write safety ───────────────────────────────────────────────

describe('Concurrent writes — unique constraint integrity', () => {
  it('concurrent inserts of same hotel name → exactly one succeeds', async () => {
    const results = await Promise.allSettled([
      request(app).post('/api/hotels').set(authHeader(admin._id)).send({ name: 'ConflictHotel', city: 'NYC' }),
      request(app).post('/api/hotels').set(authHeader(admin._id)).send({ name: 'ConflictHotel', city: 'LA' }),
      request(app).post('/api/hotels').set(authHeader(admin._id)).send({ name: 'ConflictHotel', city: 'Chicago' }),
    ]);
    const statuses = results.map(r => r.value?.status ?? r.reason?.response?.status);
    const successes = statuses.filter(s => s === 201).length;
    const failures  = statuses.filter(s => s === 400).length;
    expect(successes).toBe(1);
    expect(failures).toBe(2);
  });
});

// ─── 10. Storage round-trip — all fields retrievable ─────────────────────────

describe('Storage round-trip — saved fields are retrievable', () => {
  it('HotelScore fields survive a full DB round-trip', async () => {
    const hotel = await Hotel.create({ name: 'PersistHotel', city: 'Phoenix', createdBy: admin._id, category: 'reputation' });
    const scoreDate = new Date('2026-03-15T12:00:00Z');

    const created = await request(app)
      .post('/api/hotel-scores')
      .set(authHeader(admin._id))
      .send({ hotel: hotel._id, date: scoreDate.toISOString(), score: 93.2, notes: 'Excellent performance' });

    expect(created.status).toBe(201);

    const fetched = await request(app)
      .get(`/api/hotel-scores?hotel=${hotel._id}`)
      .set(authHeader(admin._id));

    expect(fetched.status).toBe(200);
    expect(fetched.body).toHaveLength(1);
    expect(fetched.body[0].score).toBe(93.2);
    expect(fetched.body[0].notes).toBe('Excellent performance');
    expect(fetched.body[0].hotel.name).toBe('PersistHotel');
  });

  it('Task category field survives a round-trip', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set(authHeader(admin._id))
      .send({ taskName: 'Round trip', deadline: new Date(Date.now() + 86400000).toISOString(), category: 'reputation' });

    expect(res.status).toBe(201);
    const id = res.body._id;

    const fetched = await request(app)
      .get('/api/tasks?category=reputation')
      .set(authHeader(admin._id));
    expect(fetched.status).toBe(200);
    expect(fetched.body.some(t => t._id === id && t.category === 'reputation')).toBe(true);
  });

  it('RoutineItem category field survives a round-trip', async () => {
    const created = await request(app)
      .post('/api/routines')
      .set(authHeader(admin._id))
      .send({ taskName: 'OTA check', category: 'reputation' });
    expect(created.status).toBe(201);

    const fetched = await request(app)
      .get('/api/routines?category=reputation')
      .set(authHeader(admin._id));
    expect(fetched.status).toBe(200);
    expect(fetched.body.some(r => r.taskName === 'OTA check' && r.category === 'reputation')).toBe(true);
  });
});

// ─── 11. Cascade safety — orphaned references ─────────────────────────────────

describe('Cascade safety — deleting a Hotel with scores', () => {
  it('app does not crash when fetching scores after hotel deletion', async () => {
    const hotel = await Hotel.create({ name: 'ToDeleteHotel', city: 'Denver', createdBy: admin._id, category: 'reputation' });
    await HotelScore.create({ hotel: hotel._id, date: new Date(), score: 70, createdBy: admin._id });

    // Delete the hotel directly at the model level (no cascade implemented)
    await Hotel.findByIdAndDelete(hotel._id);

    // Fetching all scores must not crash even with orphaned hotel ref
    const res = await request(app)
      .get('/api/hotel-scores')
      .set(authHeader(admin._id));
    expect(res.status).toBe(200);
    // Score exists but hotel populate returns null — that's fine
    const orphaned = res.body.find(s => s.hotel === null || s.hotel?._id === hotel._id.toString());
    // Just ensure no 500 was thrown; the record may or may not still be listed
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ─── 12. Score boundary fencing ───────────────────────────────────────────────

describe('Score boundary fencing', () => {
  let hotel;
  beforeEach(async () => {
    hotel = await Hotel.create({ name: 'BoundaryHotel', city: 'Reno', createdBy: admin._id, category: 'reputation' });
  });

  const cases = [
    { score: 0,     expected: 201, label: 'exactly 0' },
    { score: 50,    expected: 201, label: '50 (mid)' },
    { score: 100,   expected: 201, label: 'exactly 100' },
    { score: 99.9,  expected: 201, label: '99.9 (upper edge decimal)' },
    { score: 0.1,   expected: 201, label: '0.1 (lower edge decimal)' },
    { score: -0.1,  expected: 400, label: '-0.1 (below min)' },
    { score: 100.1, expected: 400, label: '100.1 (above max)' },
    { score: -100,  expected: 400, label: '-100 (very negative)' },
    { score: 999,   expected: 400, label: '999 (way above max)' },
  ];

  cases.forEach(({ score, expected, label }) => {
    it(`score = ${score} (${label}) → ${expected}`, async () => {
      const res = await request(app)
        .post('/api/hotel-scores')
        .set(authHeader(admin._id))
        .send({ hotel: hotel._id, date: '2026-04-01', score });
      expect(res.status).toBe(expected);
    });
  });
});

// ─── 13. Empty-string / whitespace fields ─────────────────────────────────────

describe('Empty-string and whitespace-only required fields', () => {
  it('POST /api/tasks with whitespace-only taskName → 400', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set(authHeader(admin._id))
      .send({ taskName: '   ', deadline: new Date(Date.now() + 86400000).toISOString() });
    expect(res.status).toBe(400);
  });

  it('POST /api/routines with empty taskName → 400', async () => {
    const res = await request(app)
      .post('/api/routines')
      .set(authHeader(admin._id))
      .send({ taskName: '' });
    expect(res.status).toBe(400);
  });

  it('POST /api/hotels with empty name → 400', async () => {
    const res = await request(app)
      .post('/api/hotels')
      .set(authHeader(admin._id))
      .send({ name: '', city: 'NY' });
    expect(res.status).toBe(400);
  });
});

// ─── 14. Large text payload — stored and retrieved intact ─────────────────────

describe('Large text — stored and retrieved intact', () => {
  it('500-char notes field survives a round-trip on hotel score', async () => {
    const hotel = await Hotel.create({ name: 'LargeNoteHotel', city: 'Austin', createdBy: admin._id, category: 'reputation' });
    // No trailing space — Mongoose trim:true will strip it
    const bigNote = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.'.repeat(9); // ~504 chars

    const created = await request(app)
      .post('/api/hotel-scores')
      .set(authHeader(admin._id))
      .send({ hotel: hotel._id, date: '2026-04-10', score: 75, notes: bigNote });
    expect(created.status).toBe(201);
    expect(created.body.notes).toBe(bigNote);
  });
});

// ─── 15. Empty DB — list calls never crash ────────────────────────────────────

describe('Empty DB — list endpoints return empty arrays without crashing', () => {
  const endpoints = [
    '/api/tasks',
    '/api/hotels',
    '/api/hotel-scores',
    '/api/rfps',
    '/api/calls',
    '/api/leads',
    '/api/routines',
    '/api/announcements',
    '/api/events/upcoming',
  ];

  endpoints.forEach(path => {
    it(`GET ${path} with empty DB → 200 []`, async () => {
      const res = await request(app).get(path).set(authHeader(admin._id));
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});
