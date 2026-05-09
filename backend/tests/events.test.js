/**
 * API integration tests — Events (Calendar) Routes
 * GET    /api/events              — list + optional ?month= filter
 * GET    /api/events/upcoming     — next 5 events from today
 * POST   /api/events              — requires name + date
 * PUT    /api/events/:id          — update
 * DELETE /api/events/:id          — delete
 */
const request = require('supertest');
const app = require('../app');
const Event = require('../models/Event');
const { createAdminUser, authHeader } = require('./helpers');

let admin;

beforeEach(async () => {
  admin = await createAdminUser({ username: 'eventadmin' });
});

// ─── GET /api/events ──────────────────────────────────────────────────────────

describe('GET /api/events', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/events');
    expect(res.status).toBe(401);
  });

  it('returns empty array when no events exist', async () => {
    const res = await request(app).get('/api/events').set(authHeader(admin._id));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns all events sorted by date', async () => {
    await Event.create({ name: 'Later Event', date: new Date('2026-12-01'), createdBy: admin._id });
    await Event.create({ name: 'Earlier Event', date: new Date('2026-06-01'), createdBy: admin._id });
    const res = await request(app).get('/api/events').set(authHeader(admin._id));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].name).toBe('Earlier Event'); // ascending date order
  });

  it('filters events by month', async () => {
    await Event.create({ name: 'July Event', date: new Date('2026-07-15'), createdBy: admin._id });
    await Event.create({ name: 'Aug Event', date: new Date('2026-08-20'), createdBy: admin._id });
    const res = await request(app)
      .get('/api/events?month=2026-07')
      .set(authHeader(admin._id));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('July Event');
  });
});

// ─── GET /api/events/upcoming ─────────────────────────────────────────────────

describe('GET /api/events/upcoming', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/events/upcoming');
    expect(res.status).toBe(401);
  });

  it('returns up to 5 future events in date order', async () => {
    // Create 6 future events
    for (let i = 1; i <= 6; i++) {
      await Event.create({
        name: `Future ${i}`,
        date: new Date(Date.now() + 86400000 * i),
        createdBy: admin._id,
      });
    }
    const res = await request(app)
      .get('/api/events/upcoming')
      .set(authHeader(admin._id));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(5); // limited to 5
    expect(res.body[0].name).toBe('Future 1'); // sorted ascending
  });

  it('does not include past events', async () => {
    await Event.create({
      name: 'Past Event',
      date: new Date(Date.now() - 86400000 * 2), // 2 days ago
      createdBy: admin._id,
    });
    await Event.create({
      name: 'Future Event',
      date: new Date(Date.now() + 86400000 * 2), // 2 days from now
      createdBy: admin._id,
    });
    const res = await request(app)
      .get('/api/events/upcoming')
      .set(authHeader(admin._id));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Future Event');
  });

  it('returns empty array when no future events exist', async () => {
    const res = await request(app)
      .get('/api/events/upcoming')
      .set(authHeader(admin._id));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// ─── POST /api/events ─────────────────────────────────────────────────────────

describe('POST /api/events', () => {
  it('returns 401 without token', async () => {
    const res = await request(app)
      .post('/api/events')
      .send({ name: 'Test', date: '2026-09-01' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when name is missing', async () => {
    const res = await request(app)
      .post('/api/events')
      .set(authHeader(admin._id))
      .send({ date: '2026-09-01' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/name.*date|date.*name/i);
  });

  it('returns 400 when date is missing', async () => {
    const res = await request(app)
      .post('/api/events')
      .set(authHeader(admin._id))
      .send({ name: 'No Date Event' });
    expect(res.status).toBe(400);
  });

  it('creates event with required fields', async () => {
    const res = await request(app)
      .post('/api/events')
      .set(authHeader(admin._id))
      .send({ name: 'Q4 Sales Event', date: '2026-10-15' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Q4 Sales Event');
    expect(res.body._id).toBeDefined();
    expect(new Date(res.body.date).getFullYear()).toBe(2026);
  });

  it('creates event with notes', async () => {
    const res = await request(app)
      .post('/api/events')
      .set(authHeader(admin._id))
      .send({ name: 'Team Building', date: '2026-11-01', notes: 'Bowling at Lucky Strike' });
    expect(res.status).toBe(201);
    expect(res.body.notes).toBe('Bowling at Lucky Strike');
  });

  it('persists event to database', async () => {
    await request(app)
      .post('/api/events')
      .set(authHeader(admin._id))
      .send({ name: 'Persist Test', date: '2026-09-30' });
    const stored = await Event.findOne({ name: 'Persist Test' });
    expect(stored).not.toBeNull();
    expect(stored.createdBy.toString()).toBe(admin._id.toString());
  });
});

// ─── PUT /api/events/:id ──────────────────────────────────────────────────────

describe('PUT /api/events/:id', () => {
  it('returns 401 without token', async () => {
    const event = await Event.create({ name: 'X', date: new Date(), createdBy: admin._id });
    const res = await request(app).put(`/api/events/${event._id}`).send({ notes: 'test' });
    expect(res.status).toBe(401);
  });

  it('updates event name and notes', async () => {
    const event = await Event.create({ name: 'Old Name', date: new Date('2026-10-01'), createdBy: admin._id });
    const res = await request(app)
      .put(`/api/events/${event._id}`)
      .set(authHeader(admin._id))
      .send({ name: 'New Name', date: '2026-10-01', notes: 'Updated details' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('New Name');
    expect(res.body.notes).toBe('Updated details');
  });

  it('returns 404 for non-existent event', async () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await request(app)
      .put(`/api/events/${fakeId}`)
      .set(authHeader(admin._id))
      .send({ name: 'X', date: '2026-10-01' });
    expect(res.status).toBe(404);
  });

  it('persists update to database', async () => {
    const event = await Event.create({ name: 'DBEvent', date: new Date('2026-10-01'), createdBy: admin._id });
    await request(app)
      .put(`/api/events/${event._id}`)
      .set(authHeader(admin._id))
      .send({ name: 'DBEvent Updated', date: '2026-10-02' });
    const updated = await Event.findById(event._id);
    expect(updated.name).toBe('DBEvent Updated');
  });
});

// ─── DELETE /api/events/:id ───────────────────────────────────────────────────

describe('DELETE /api/events/:id', () => {
  it('returns 401 without token', async () => {
    const event = await Event.create({ name: 'X', date: new Date(), createdBy: admin._id });
    const res = await request(app).delete(`/api/events/${event._id}`);
    expect(res.status).toBe(401);
  });

  it('deletes event and confirms removal from DB', async () => {
    const event = await Event.create({ name: 'DeleteMe', date: new Date('2026-12-25'), createdBy: admin._id });
    const res = await request(app)
      .delete(`/api/events/${event._id}`)
      .set(authHeader(admin._id));
    expect(res.status).toBe(200);
    const deleted = await Event.findById(event._id);
    expect(deleted).toBeNull();
  });

  it('returns 404 for non-existent event', async () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await request(app)
      .delete(`/api/events/${fakeId}`)
      .set(authHeader(admin._id));
    expect(res.status).toBe(404);
  });
});
