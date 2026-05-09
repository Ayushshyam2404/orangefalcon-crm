/**
 * API integration tests — Corporate Profiles Routes
 * GET    /api/corporate       — list + search
 * POST   /api/corporate       — requires name + company
 * PUT    /api/corporate/:id   — update
 * DELETE /api/corporate/:id   — delete
 */
const request = require('supertest');
const app = require('../app');
const CorporateProfile = require('../models/CorporateProfile');
const { createAdminUser, createStaffUser, authHeader } = require('./helpers');

let admin, staff;

beforeEach(async () => {
  admin = await createAdminUser({ username: 'corpadmin' });
  staff = await createStaffUser({ username: 'corpstaff' });
});

// ─── GET /api/corporate ───────────────────────────────────────────────────────

describe('GET /api/corporate', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/corporate');
    expect(res.status).toBe(401);
  });

  it('returns empty array when no profiles exist', async () => {
    const res = await request(app).get('/api/corporate').set(authHeader(admin._id));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns all profiles sorted alphabetically', async () => {
    await CorporateProfile.create({ name: 'Zoe', company: 'ZCorp', loggedBy: admin._id });
    await CorporateProfile.create({ name: 'Anna', company: 'ACorp', loggedBy: admin._id });
    const res = await request(app).get('/api/corporate').set(authHeader(admin._id));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].company).toBe('ACorp'); // sorted by company asc
  });

  it('searches by name (case-insensitive)', async () => {
    await CorporateProfile.create({ name: 'Robert Chen', company: 'TechCo', loggedBy: admin._id });
    await CorporateProfile.create({ name: 'Sarah Lee', company: 'SaleCo', loggedBy: admin._id });
    const res = await request(app)
      .get('/api/corporate?search=robert')
      .set(authHeader(admin._id));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Robert Chen');
  });

  it('searches across name, company, email, phone', async () => {
    await CorporateProfile.create({
      name: 'John Doe', company: 'GlobalInc',
      email: 'john@global.com', phone: '555-0001', loggedBy: admin._id,
    });
    // Search by email domain
    const res = await request(app)
      .get('/api/corporate?search=global')
      .set(authHeader(admin._id));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});

// ─── POST /api/corporate ──────────────────────────────────────────────────────

describe('POST /api/corporate', () => {
  it('returns 401 without token', async () => {
    const res = await request(app)
      .post('/api/corporate')
      .send({ name: 'X', company: 'Y' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when name is missing', async () => {
    const res = await request(app)
      .post('/api/corporate')
      .set(authHeader(admin._id))
      .send({ company: 'NoNameCorp' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/name.*company|company.*name/i);
  });

  it('returns 400 when company is missing', async () => {
    const res = await request(app)
      .post('/api/corporate')
      .set(authHeader(admin._id))
      .send({ name: 'NoCompanyPerson' });
    expect(res.status).toBe(400);
  });

  it('creates profile with required fields', async () => {
    const res = await request(app)
      .post('/api/corporate')
      .set(authHeader(admin._id))
      .send({ name: 'Jane Smith', company: 'Acme Corp' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Jane Smith', company: 'Acme Corp' });
    expect(res.body._id).toBeDefined();
  });

  it('creates profile with all optional fields including CC', async () => {
    const res = await request(app)
      .post('/api/corporate')
      .set(authHeader(staff._id))
      .send({
        name: 'Full Profile',
        company: 'BigCo',
        phone: '555-7890',
        email: 'full@bigco.com',
        ccNumber: '4111111111111111',
        ccExpiry: '12/27',
        notes: 'Preferred client — always guaranteed',
      });
    expect(res.status).toBe(201);
    expect(res.body.ccNumber).toBe('4111111111111111');
    expect(res.body.ccExpiry).toBe('12/27');
  });

  it('persists profile to database', async () => {
    await request(app)
      .post('/api/corporate')
      .set(authHeader(admin._id))
      .send({ name: 'DB Test', company: 'DBCorp' });
    const stored = await CorporateProfile.findOne({ company: 'DBCorp' });
    expect(stored).not.toBeNull();
    expect(stored.loggedBy.toString()).toBe(admin._id.toString());
  });
});

// ─── PUT /api/corporate/:id ───────────────────────────────────────────────────

describe('PUT /api/corporate/:id', () => {
  it('returns 401 without token', async () => {
    const profile = await CorporateProfile.create({ name: 'X', company: 'Y', loggedBy: admin._id });
    const res = await request(app)
      .put(`/api/corporate/${profile._id}`)
      .send({ phone: '555-0000' });
    expect(res.status).toBe(401);
  });

  it('updates phone number', async () => {
    const profile = await CorporateProfile.create({ name: 'UpdateMe', company: 'OldCo', loggedBy: admin._id });
    const res = await request(app)
      .put(`/api/corporate/${profile._id}`)
      .set(authHeader(admin._id))
      .send({ name: 'UpdateMe', company: 'NewCo', phone: '555-9999' });
    expect(res.status).toBe(200);
    expect(res.body.phone).toBe('555-9999');
    expect(res.body.company).toBe('NewCo');
  });

  it('returns 404 for non-existent profile', async () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await request(app)
      .put(`/api/corporate/${fakeId}`)
      .set(authHeader(admin._id))
      .send({ name: 'X', company: 'Y' });
    expect(res.status).toBe(404);
  });

  it('persists update to database', async () => {
    const profile = await CorporateProfile.create({ name: 'DBCorp', company: 'OldCo', loggedBy: admin._id });
    await request(app)
      .put(`/api/corporate/${profile._id}`)
      .set(authHeader(admin._id))
      .send({ name: 'DBCorp', company: 'UpdatedCo' });
    const updated = await CorporateProfile.findById(profile._id);
    expect(updated.company).toBe('UpdatedCo');
  });
});

// ─── DELETE /api/corporate/:id ────────────────────────────────────────────────

describe('DELETE /api/corporate/:id', () => {
  it('returns 401 without token', async () => {
    const profile = await CorporateProfile.create({ name: 'X', company: 'Y', loggedBy: admin._id });
    const res = await request(app).delete(`/api/corporate/${profile._id}`);
    expect(res.status).toBe(401);
  });

  it('deletes profile and confirms removal from DB', async () => {
    const profile = await CorporateProfile.create({ name: 'DeleteMe', company: 'GoneCo', loggedBy: admin._id });
    const res = await request(app)
      .delete(`/api/corporate/${profile._id}`)
      .set(authHeader(admin._id));
    expect(res.status).toBe(200);
    const deleted = await CorporateProfile.findById(profile._id);
    expect(deleted).toBeNull();
  });

  it('returns 404 for non-existent profile', async () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await request(app)
      .delete(`/api/corporate/${fakeId}`)
      .set(authHeader(admin._id));
    expect(res.status).toBe(404);
  });
});
