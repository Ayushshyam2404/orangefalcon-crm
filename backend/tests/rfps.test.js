/**
 * API integration tests — RFPs Routes
 * GET    /api/rfps       — filtered list
 * POST   /api/rfps       — requires client + hotel
 * PUT    /api/rfps/:id   — update
 * DELETE /api/rfps/:id   — delete
 */
const request = require('supertest');
const app = require('../app');
const Hotel = require('../models/Hotel');
const RFP = require('../models/RFP');
const { createAdminUser, authHeader } = require('./helpers');

let admin, hotel;

beforeEach(async () => {
  admin = await createAdminUser({ username: 'rfpadmin' });
  hotel = await Hotel.create({ name: 'RFP Hotel', city: 'Chicago', createdBy: admin._id });
});

// ─── GET /api/rfps ────────────────────────────────────────────────────────────

describe('GET /api/rfps', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/rfps');
    expect(res.status).toBe(401);
  });

  it('returns empty array when no RFPs exist', async () => {
    const res = await request(app)
      .get('/api/rfps')
      .set(authHeader(admin._id));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns all RFPs for authenticated user', async () => {
    await RFP.create({ client: 'Acme Corp', hotel: hotel._id, addedBy: admin._id });
    await RFP.create({ client: 'Beta LLC', hotel: hotel._id, addedBy: admin._id });
    const res = await request(app)
      .get('/api/rfps')
      .set(authHeader(admin._id));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it('filters by consideration=true', async () => {
    await RFP.create({ client: 'A', hotel: hotel._id, addedBy: admin._id, inConsideration: true });
    await RFP.create({ client: 'B', hotel: hotel._id, addedBy: admin._id, inConsideration: false });
    const res = await request(app)
      .get('/api/rfps?consideration=true')
      .set(authHeader(admin._id));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].client).toBe('A');
  });

  it('filters by status', async () => {
    await RFP.create({ client: 'Won One', hotel: hotel._id, addedBy: admin._id, status: 'Won' });
    await RFP.create({ client: 'Lost One', hotel: hotel._id, addedBy: admin._id, status: 'Lost' });
    const res = await request(app)
      .get('/api/rfps?status=Won')
      .set(authHeader(admin._id));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].client).toBe('Won One');
  });
});

// ─── POST /api/rfps ───────────────────────────────────────────────────────────

describe('POST /api/rfps', () => {
  it('returns 401 without token', async () => {
    const res = await request(app)
      .post('/api/rfps')
      .send({ client: 'Test', hotel: hotel._id });
    expect(res.status).toBe(401);
  });

  it('returns 400 when client is missing', async () => {
    const res = await request(app)
      .post('/api/rfps')
      .set(authHeader(admin._id))
      .send({ hotel: hotel._id });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/client|hotel/i);
  });

  it('returns 400 when hotel is missing', async () => {
    const res = await request(app)
      .post('/api/rfps')
      .set(authHeader(admin._id))
      .send({ client: 'Orphan Client' });
    expect(res.status).toBe(400);
  });

  it('creates RFP with required fields', async () => {
    const res = await request(app)
      .post('/api/rfps')
      .set(authHeader(admin._id))
      .send({ client: 'GlobalCorp', hotel: hotel._id.toString() });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ client: 'GlobalCorp' });
    expect(res.body._id).toBeDefined();
    expect(res.body.addedBy).toMatchObject({ name: admin.name });
    expect(res.body.hotel).toMatchObject({ name: 'RFP Hotel' });
  });

  it('creates RFP with all optional fields populated', async () => {
    const res = await request(app)
      .post('/api/rfps')
      .set(authHeader(admin._id))
      .send({
        client: 'FullCorp',
        hotel: hotel._id.toString(),
        checkin: '2026-07-01',
        checkout: '2026-07-05',
        price: 200,
        status: 'Pending',
        notes: 'Annual conference',
        priority: true,
      });
    expect(res.status).toBe(201);
    expect(res.body.price).toBe(200);
    expect(res.body.priority).toBe(true);
    expect(res.body.status).toBe('Pending');
  });

  it('persists RFP data to database', async () => {
    await request(app)
      .post('/api/rfps')
      .set(authHeader(admin._id))
      .send({ client: 'PersistCo', hotel: hotel._id.toString() });
    const stored = await RFP.findOne({ client: 'PersistCo' });
    expect(stored).not.toBeNull();
    expect(stored.addedBy.toString()).toBe(admin._id.toString());
  });
});

// ─── PUT /api/rfps/:id ────────────────────────────────────────────────────────

describe('PUT /api/rfps/:id', () => {
  it('returns 401 without token', async () => {
    const rfp = await RFP.create({ client: 'X', hotel: hotel._id, addedBy: admin._id });
    const res = await request(app).put(`/api/rfps/${rfp._id}`).send({ status: 'Won' });
    expect(res.status).toBe(401);
  });

  it('updates status and returns updated RFP', async () => {
    const rfp = await RFP.create({ client: 'UpdateMe', hotel: hotel._id, addedBy: admin._id });
    const res = await request(app)
      .put(`/api/rfps/${rfp._id}`)
      .set(authHeader(admin._id))
      .send({ status: 'Won', notes: 'Closed deal' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('Won');
    expect(res.body.notes).toBe('Closed deal');
  });

  it('returns 404 for non-existent RFP', async () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await request(app)
      .put(`/api/rfps/${fakeId}`)
      .set(authHeader(admin._id))
      .send({ status: 'Won' });
    expect(res.status).toBe(404);
  });

  it('persists update to database', async () => {
    const rfp = await RFP.create({ client: 'DBUpdate', hotel: hotel._id, addedBy: admin._id });
    await request(app)
      .put(`/api/rfps/${rfp._id}`)
      .set(authHeader(admin._id))
      .send({ status: 'Lost' });
    const updated = await RFP.findById(rfp._id);
    expect(updated.status).toBe('Lost');
  });
});

// ─── DELETE /api/rfps/:id ─────────────────────────────────────────────────────

describe('DELETE /api/rfps/:id', () => {
  it('returns 401 without token', async () => {
    const rfp = await RFP.create({ client: 'X', hotel: hotel._id, addedBy: admin._id });
    const res = await request(app).delete(`/api/rfps/${rfp._id}`);
    expect(res.status).toBe(401);
  });

  it('deletes RFP and confirms removal from DB', async () => {
    const rfp = await RFP.create({ client: 'DeleteMe', hotel: hotel._id, addedBy: admin._id });
    const res = await request(app)
      .delete(`/api/rfps/${rfp._id}`)
      .set(authHeader(admin._id));
    expect(res.status).toBe(200);
    const deleted = await RFP.findById(rfp._id);
    expect(deleted).toBeNull();
  });

  it('returns 404 for non-existent RFP', async () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await request(app)
      .delete(`/api/rfps/${fakeId}`)
      .set(authHeader(admin._id));
    expect(res.status).toBe(404);
  });
});
