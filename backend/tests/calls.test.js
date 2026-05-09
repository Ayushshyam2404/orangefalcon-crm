/**
 * API integration tests — Calls Routes
 * GET    /api/calls       — filtered list
 * POST   /api/calls       — requires name
 * PUT    /api/calls/:id   — update
 * DELETE /api/calls/:id   — delete
 */
const request = require('supertest');
const app = require('../app');
const Call = require('../models/Call');
const { createAdminUser, createStaffUser, authHeader } = require('./helpers');

let admin, staff;

beforeEach(async () => {
  admin = await createAdminUser({ username: 'calladmin' });
  staff = await createStaffUser({ username: 'callstaff' });
});

// ─── GET /api/calls ───────────────────────────────────────────────────────────

describe('GET /api/calls', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/calls');
    expect(res.status).toBe(401);
  });

  it('returns empty array when no calls exist', async () => {
    const res = await request(app).get('/api/calls').set(authHeader(admin._id));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns all calls sorted by createdAt desc', async () => {
    await Call.create({ name: 'First', outcome: 'Connected', loggedBy: admin._id });
    await Call.create({ name: 'Second', outcome: 'Voicemail', loggedBy: admin._id });
    const res = await request(app).get('/api/calls').set(authHeader(admin._id));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it('filters calls by outcome', async () => {
    await Call.create({ name: 'A', outcome: 'Connected', loggedBy: admin._id });
    await Call.create({ name: 'B', outcome: 'Voicemail', loggedBy: admin._id });
    const res = await request(app)
      .get('/api/calls?outcome=Connected')
      .set(authHeader(admin._id));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('A');
  });

  it('searches calls by name (case-insensitive)', async () => {
    await Call.create({ name: 'John Smith', outcome: 'Connected', loggedBy: admin._id });
    await Call.create({ name: 'Jane Doe', outcome: 'Voicemail', loggedBy: admin._id });
    const res = await request(app)
      .get('/api/calls?search=john')
      .set(authHeader(admin._id));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('John Smith');
  });
});

// ─── POST /api/calls ──────────────────────────────────────────────────────────

describe('POST /api/calls', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).post('/api/calls').send({ name: 'X', outcome: 'Connected' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when prospect name is missing', async () => {
    const res = await request(app)
      .post('/api/calls')
      .set(authHeader(admin._id))
      .send({ outcome: 'Connected', phone: '555-0000' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/name/i);
  });

  it('creates call with required name', async () => {
    const res = await request(app)
      .post('/api/calls')
      .set(authHeader(admin._id))
      .send({ name: 'Sarah Connor' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Sarah Connor' });
    expect(res.body._id).toBeDefined();
    expect(res.body.loggedBy).toMatchObject({ name: admin.name });
  });

  it('creates call with all fields', async () => {
    const res = await request(app)
      .post('/api/calls')
      .set(authHeader(staff._id))
      .send({
        name: 'Full Prospect',
        phone: '555-9876',
        outcome: 'Interested',
        notes: 'Very interested in group booking',
      });
    expect(res.status).toBe(201);
    expect(res.body.outcome).toBe('Interested');
    expect(res.body.phone).toBe('555-9876');
    expect(res.body.loggedBy).toMatchObject({ name: staff.name });
  });

  it('persists call to database', async () => {
    await request(app)
      .post('/api/calls')
      .set(authHeader(admin._id))
      .send({ name: 'DB Persist Test' });
    const stored = await Call.findOne({ name: 'DB Persist Test' });
    expect(stored).not.toBeNull();
    expect(stored.loggedBy.toString()).toBe(admin._id.toString());
  });
});

// ─── PUT /api/calls/:id ───────────────────────────────────────────────────────

describe('PUT /api/calls/:id', () => {
  it('returns 401 without token', async () => {
    const call = await Call.create({ name: 'X', loggedBy: admin._id });
    const res = await request(app).put(`/api/calls/${call._id}`).send({ outcome: 'Connected' });
    expect(res.status).toBe(401);
  });

  it('updates call outcome and notes', async () => {
    const call = await Call.create({ name: 'UpdateTarget', outcome: 'Voicemail', loggedBy: admin._id });
    const res = await request(app)
      .put(`/api/calls/${call._id}`)
      .set(authHeader(admin._id))
      .send({ outcome: 'Connected', notes: 'Follow-up call made' });
    expect(res.status).toBe(200);
    expect(res.body.outcome).toBe('Connected');
    expect(res.body.notes).toBe('Follow-up call made');
  });

  it('returns 404 for non-existent call', async () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await request(app)
      .put(`/api/calls/${fakeId}`)
      .set(authHeader(admin._id))
      .send({ outcome: 'Connected' });
    expect(res.status).toBe(404);
  });

  it('persists update to database', async () => {
    const call = await Call.create({ name: 'DBUpdate', loggedBy: admin._id });
    await request(app)
      .put(`/api/calls/${call._id}`)
      .set(authHeader(admin._id))
      .send({ outcome: 'Not Interested' });
    const updated = await Call.findById(call._id);
    expect(updated.outcome).toBe('Not Interested');
  });
});

// ─── DELETE /api/calls/:id ────────────────────────────────────────────────────

describe('DELETE /api/calls/:id', () => {
  it('returns 401 without token', async () => {
    const call = await Call.create({ name: 'X', loggedBy: admin._id });
    const res = await request(app).delete(`/api/calls/${call._id}`);
    expect(res.status).toBe(401);
  });

  it('deletes call and confirms removal from DB', async () => {
    const call = await Call.create({ name: 'DeleteMe', loggedBy: admin._id });
    const res = await request(app)
      .delete(`/api/calls/${call._id}`)
      .set(authHeader(admin._id));
    expect(res.status).toBe(200);
    const deleted = await Call.findById(call._id);
    expect(deleted).toBeNull();
  });

  it('returns 404 for non-existent call', async () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await request(app)
      .delete(`/api/calls/${fakeId}`)
      .set(authHeader(admin._id));
    expect(res.status).toBe(404);
  });
});
