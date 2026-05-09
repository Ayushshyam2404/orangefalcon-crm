/**
 * API integration tests — Hotels Routes
 * GET    /api/hotels           — any authenticated user
 * POST   /api/hotels           — admin only
 * PUT    /api/hotels/:id       — admin only
 * DELETE /api/hotels/:id       — admin only
 */
const request = require('supertest');
const app = require('../app');
const Hotel = require('../models/Hotel');
const { createAdminUser, createStaffUser, authHeader } = require('./helpers');

let admin, staff;

beforeEach(async () => {
  admin = await createAdminUser({ username: 'hoteladmin' });
  staff = await createStaffUser({ username: 'hotelstaff' });
});

// ─── GET /api/hotels ──────────────────────────────────────────────────────────

describe('GET /api/hotels', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/hotels');
    expect(res.status).toBe(401);
  });

  it('returns empty array when no hotels exist', async () => {
    const res = await request(app).get('/api/hotels').set(authHeader(staff._id));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns list of hotels for authenticated user', async () => {
    await Hotel.create({ name: 'Grand Hotel', city: 'New York', createdBy: admin._id });
    const res = await request(app).get('/api/hotels').set(authHeader(staff._id));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Grand Hotel');
  });
});

// ─── POST /api/hotels ─────────────────────────────────────────────────────────

describe('POST /api/hotels', () => {
  it('returns 401 without token', async () => {
    const res = await request(app)
      .post('/api/hotels')
      .send({ name: 'Test', city: 'NY' });
    expect(res.status).toBe(401);
  });

  it('returns 403 for staff users', async () => {
    const res = await request(app)
      .post('/api/hotels')
      .set(authHeader(staff._id))
      .send({ name: 'Staff Hotel', city: 'LA' });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/admin/i);
  });

  it('returns 400 when hotel name is missing', async () => {
    const res = await request(app)
      .post('/api/hotels')
      .set(authHeader(admin._id))
      .send({ city: 'NY' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when city is missing', async () => {
    const res = await request(app)
      .post('/api/hotels')
      .set(authHeader(admin._id))
      .send({ name: 'No City Hotel' });
    expect(res.status).toBe(400);
  });

  it('creates hotel successfully as admin', async () => {
    const res = await request(app)
      .post('/api/hotels')
      .set(authHeader(admin._id))
      .send({ name: 'Ocean View', city: 'Miami' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Ocean View', city: 'Miami' });
    expect(res.body._id).toBeDefined();
    expect(res.body.createdBy).toMatchObject({ name: admin.name });
  });

  it('returns 400 when hotel name is not unique', async () => {
    await Hotel.create({ name: 'DupeHotel', city: 'Boston', createdBy: admin._id });
    const res = await request(app)
      .post('/api/hotels')
      .set(authHeader(admin._id))
      .send({ name: 'DupeHotel', city: 'Chicago' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already exists/i);
  });
});

// ─── PUT /api/hotels/:id ──────────────────────────────────────────────────────

describe('PUT /api/hotels/:id', () => {
  it('returns 403 for staff users', async () => {
    const hotel = await Hotel.create({ name: 'EditHotel', city: 'Dallas', createdBy: admin._id });
    const res = await request(app)
      .put(`/api/hotels/${hotel._id}`)
      .set(authHeader(staff._id))
      .send({ city: 'Denver' });
    expect(res.status).toBe(403);
  });

  it('updates hotel city as admin', async () => {
    const hotel = await Hotel.create({ name: 'UpdateMe', city: 'OldCity', createdBy: admin._id });
    const res = await request(app)
      .put(`/api/hotels/${hotel._id}`)
      .set(authHeader(admin._id))
      .send({ city: 'NewCity' });
    expect(res.status).toBe(200);
    expect(res.body.city).toBe('NewCity');
  });

  it('returns 404 for non-existent hotel', async () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await request(app)
      .put(`/api/hotels/${fakeId}`)
      .set(authHeader(admin._id))
      .send({ city: 'X' });
    expect(res.status).toBe(404);
  });
});

// ─── DELETE /api/hotels/:id ───────────────────────────────────────────────────

describe('DELETE /api/hotels/:id', () => {
  it('returns 403 for staff users', async () => {
    const hotel = await Hotel.create({ name: 'DelHotel', city: 'Seattle', createdBy: admin._id });
    const res = await request(app)
      .delete(`/api/hotels/${hotel._id}`)
      .set(authHeader(staff._id));
    expect(res.status).toBe(403);
    // Confirm hotel still exists
    const stillExists = await Hotel.findById(hotel._id);
    expect(stillExists).not.toBeNull();
  });

  it('deletes hotel as admin', async () => {
    const hotel = await Hotel.create({ name: 'GoneHotel', city: 'Phoenix', createdBy: admin._id });
    const res = await request(app)
      .delete(`/api/hotels/${hotel._id}`)
      .set(authHeader(admin._id));
    expect(res.status).toBe(200);
    const deleted = await Hotel.findById(hotel._id);
    expect(deleted).toBeNull();
  });

  it('returns 404 for non-existent hotel', async () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await request(app)
      .delete(`/api/hotels/${fakeId}`)
      .set(authHeader(admin._id));
    expect(res.status).toBe(404);
  });
});
