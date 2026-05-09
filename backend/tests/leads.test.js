/**
 * API integration tests — Leads (Inbound Leads) Routes
 * GET    /api/leads       — filtered list
 * POST   /api/leads       — requires contactName
 * PUT    /api/leads/:id   — update
 * DELETE /api/leads/:id   — delete
 */
const request = require('supertest');
const app = require('../app');
const Lead = require('../models/Lead');
const { createAdminUser, createStaffUser, authHeader } = require('./helpers');

let admin, staff;

beforeEach(async () => {
  admin = await createAdminUser({ username: 'leadadmin' });
  staff = await createStaffUser({ username: 'leadstaff' });
});

// ─── GET /api/leads ───────────────────────────────────────────────────────────

describe('GET /api/leads', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/leads');
    expect(res.status).toBe(401);
  });

  it('returns empty array when no leads exist', async () => {
    const res = await request(app).get('/api/leads').set(authHeader(admin._id));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns all leads', async () => {
    await Lead.create({ contactName: 'Alice', loggedBy: admin._id });
    await Lead.create({ contactName: 'Bob', loggedBy: staff._id });
    const res = await request(app).get('/api/leads').set(authHeader(admin._id));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it('filters by status', async () => {
    await Lead.create({ contactName: 'New Lead', status: 'new', loggedBy: admin._id });
    await Lead.create({ contactName: 'Converted', status: 'converted', loggedBy: admin._id });
    const res = await request(app)
      .get('/api/leads?status=new')
      .set(authHeader(admin._id));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].contactName).toBe('New Lead');
  });

  it('searches by contactName (case-insensitive)', async () => {
    await Lead.create({ contactName: 'Michael Scott', loggedBy: admin._id });
    await Lead.create({ contactName: 'Dwight Schrute', loggedBy: admin._id });
    const res = await request(app)
      .get('/api/leads?search=michael')
      .set(authHeader(admin._id));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].contactName).toBe('Michael Scott');
  });
});

// ─── POST /api/leads ──────────────────────────────────────────────────────────

describe('POST /api/leads', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).post('/api/leads').send({ contactName: 'X' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when contactName is missing', async () => {
    const res = await request(app)
      .post('/api/leads')
      .set(authHeader(admin._id))
      .send({ company: 'Nameless Corp' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/contact name/i);
  });

  it('creates lead with required contactName', async () => {
    const res = await request(app)
      .post('/api/leads')
      .set(authHeader(admin._id))
      .send({ contactName: 'James Kirk' });
    expect(res.status).toBe(201);
    expect(res.body.contactName).toBe('James Kirk');
    expect(res.body._id).toBeDefined();
    expect(res.body.status).toBe('new'); // default status
  });

  it('creates lead with all optional fields', async () => {
    const res = await request(app)
      .post('/api/leads')
      .set(authHeader(staff._id))
      .send({
        contactName: 'Full Lead',
        company: 'StarFleet Inc',
        email: 'kirk@starfleet.com',
        phone: '555-1701',
        numRooms: 50,
        rateOffered: 149,
        status: 'contacted',
        source: 'referral',
        notes: 'Interested in annual block',
      });
    expect(res.status).toBe(201);
    expect(res.body.company).toBe('StarFleet Inc');
    expect(res.body.status).toBe('contacted');
    expect(res.body.rateOffered).toBe(149);
  });

  it('persists lead to database', async () => {
    await request(app)
      .post('/api/leads')
      .set(authHeader(admin._id))
      .send({ contactName: 'DB Persist' });
    const stored = await Lead.findOne({ contactName: 'DB Persist' });
    expect(stored).not.toBeNull();
    expect(stored.loggedBy.toString()).toBe(admin._id.toString());
  });
});

// ─── PUT /api/leads/:id ───────────────────────────────────────────────────────

describe('PUT /api/leads/:id', () => {
  it('returns 401 without token', async () => {
    const lead = await Lead.create({ contactName: 'X', loggedBy: admin._id });
    const res = await request(app).put(`/api/leads/${lead._id}`).send({ status: 'contacted' });
    expect(res.status).toBe(401);
  });

  it('updates lead status and notes', async () => {
    const lead = await Lead.create({ contactName: 'UpdateMe', loggedBy: admin._id });
    const res = await request(app)
      .put(`/api/leads/${lead._id}`)
      .set(authHeader(admin._id))
      .send({ status: 'quoted', notes: 'Sent proposal' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('quoted');
    expect(res.body.notes).toBe('Sent proposal');
  });

  it('any authenticated user can update a lead', async () => {
    const lead = await Lead.create({ contactName: 'AnyUser', loggedBy: admin._id });
    const res = await request(app)
      .put(`/api/leads/${lead._id}`)
      .set(authHeader(staff._id))
      .send({ status: 'converted' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('converted');
  });

  it('returns 404 for non-existent lead', async () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await request(app)
      .put(`/api/leads/${fakeId}`)
      .set(authHeader(admin._id))
      .send({ status: 'lost' });
    expect(res.status).toBe(404);
  });

  it('persists update to database', async () => {
    const lead = await Lead.create({ contactName: 'DBLead', loggedBy: admin._id });
    await request(app)
      .put(`/api/leads/${lead._id}`)
      .set(authHeader(admin._id))
      .send({ company: 'Updated Corp' });
    const updated = await Lead.findById(lead._id);
    expect(updated.company).toBe('Updated Corp');
  });
});

// ─── DELETE /api/leads/:id ────────────────────────────────────────────────────

describe('DELETE /api/leads/:id', () => {
  it('returns 401 without token', async () => {
    const lead = await Lead.create({ contactName: 'X', loggedBy: admin._id });
    const res = await request(app).delete(`/api/leads/${lead._id}`);
    expect(res.status).toBe(401);
  });

  it('deletes lead and confirms removal from DB', async () => {
    const lead = await Lead.create({ contactName: 'DeleteMe', loggedBy: admin._id });
    const res = await request(app)
      .delete(`/api/leads/${lead._id}`)
      .set(authHeader(admin._id));
    expect(res.status).toBe(200);
    const deleted = await Lead.findById(lead._id);
    expect(deleted).toBeNull();
  });

  it('returns 404 for non-existent lead', async () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await request(app)
      .delete(`/api/leads/${fakeId}`)
      .set(authHeader(admin._id));
    expect(res.status).toBe(404);
  });
});
