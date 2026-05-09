/**
 * Reputation Feature Tests
 * Covers: HotelScore model integrity, Hotel category filtering,
 * HotelScore CRUD API, Task category scoping, Routine category scoping.
 */
const request = require('supertest');
const app = require('../app');
const Hotel = require('../models/Hotel');
const HotelScore = require('../models/HotelScore');
const Task = require('../models/Task');
const RoutineItem = require('../models/RoutineItem');
const { createAdminUser, createStaffUser, authHeader } = require('./helpers');

let admin, staff;
let salesHotel, repHotel;

beforeEach(async () => {
  admin = await createAdminUser({ username: 'repadmin' });
  staff = await createStaffUser({ username: 'repstaff' });

  salesHotel = await Hotel.create({ name: 'Sales Grand', city: 'Chicago', createdBy: admin._id, category: 'sales' });
  repHotel   = await Hotel.create({ name: 'Rep Luxury',  city: 'Miami',   createdBy: admin._id, category: 'reputation' });
});

// ─── Hotel.category field ─────────────────────────────────────────────────────

describe('Hotel model — category field', () => {
  it('defaults to "sales" when category is omitted', async () => {
    const h = await Hotel.create({ name: 'Default Cat', city: 'Austin', createdBy: admin._id });
    expect(h.category).toBe('sales');
  });

  it('accepts "reputation" as a valid category', async () => {
    const h = await Hotel.create({ name: 'Rep Hotel', city: 'Dallas', createdBy: admin._id, category: 'reputation' });
    expect(h.category).toBe('reputation');
  });

  it('rejects an invalid category value', async () => {
    await expect(
      Hotel.create({ name: 'Bad Cat', city: 'LA', createdBy: admin._id, category: 'unknown' })
    ).rejects.toThrow();
  });
});

// ─── GET /api/hotels?category= ────────────────────────────────────────────────

describe('GET /api/hotels — category filter', () => {
  it('returns all hotels when no category param is given', async () => {
    const res = await request(app).get('/api/hotels').set(authHeader(staff._id));
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
  });

  it('returns only sales hotels when ?category=sales', async () => {
    const res = await request(app).get('/api/hotels?category=sales').set(authHeader(staff._id));
    expect(res.status).toBe(200);
    expect(res.body.every(h => h.category === 'sales')).toBe(true);
    expect(res.body.some(h => h.name === 'Sales Grand')).toBe(true);
    expect(res.body.some(h => h.name === 'Rep Luxury')).toBe(false);
  });

  it('returns only reputation hotels when ?category=reputation', async () => {
    const res = await request(app).get('/api/hotels?category=reputation').set(authHeader(staff._id));
    expect(res.status).toBe(200);
    expect(res.body.every(h => h.category === 'reputation')).toBe(true);
    expect(res.body.some(h => h.name === 'Rep Luxury')).toBe(true);
    expect(res.body.some(h => h.name === 'Sales Grand')).toBe(false);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/hotels?category=reputation');
    expect(res.status).toBe(401);
  });
});

// ─── POST /api/hotels — category field ───────────────────────────────────────

describe('POST /api/hotels — category creation', () => {
  it('creates a reputation hotel as admin', async () => {
    const res = await request(app)
      .post('/api/hotels')
      .set(authHeader(admin._id))
      .send({ name: 'NewRepHotel', city: 'Boston', category: 'reputation' });
    expect(res.status).toBe(201);
    expect(res.body.category).toBe('reputation');
  });

  it('defaults to sales category when omitted on create', async () => {
    const res = await request(app)
      .post('/api/hotels')
      .set(authHeader(admin._id))
      .send({ name: 'NoCategory', city: 'Seattle' });
    expect(res.status).toBe(201);
    expect(res.body.category).toBe('sales');
  });
});

// ─── HotelScore model — data integrity ───────────────────────────────────────

describe('HotelScore model — data integrity', () => {
  it('requires hotel field', async () => {
    await expect(
      HotelScore.create({ date: new Date(), score: 80, createdBy: admin._id })
    ).rejects.toThrow();
  });

  it('requires date field', async () => {
    await expect(
      HotelScore.create({ hotel: repHotel._id, score: 80, createdBy: admin._id })
    ).rejects.toThrow();
  });

  it('requires score field', async () => {
    await expect(
      HotelScore.create({ hotel: repHotel._id, date: new Date(), createdBy: admin._id })
    ).rejects.toThrow();
  });

  it('accepts score = 0 (minimum boundary)', async () => {
    const s = await HotelScore.create({ hotel: repHotel._id, date: new Date(), score: 0, createdBy: admin._id });
    expect(s.score).toBe(0);
  });

  it('accepts score = 100 (maximum boundary)', async () => {
    const s = await HotelScore.create({ hotel: repHotel._id, date: new Date(), score: 100, createdBy: admin._id });
    expect(s.score).toBe(100);
  });

  it('accepts decimal score (e.g. 87.5)', async () => {
    const s = await HotelScore.create({ hotel: repHotel._id, date: new Date(), score: 87.5, createdBy: admin._id });
    expect(s.score).toBe(87.5);
  });

  it('rejects score below 0', async () => {
    await expect(
      HotelScore.create({ hotel: repHotel._id, date: new Date(), score: -1, createdBy: admin._id })
    ).rejects.toThrow();
  });

  it('rejects score above 100', async () => {
    await expect(
      HotelScore.create({ hotel: repHotel._id, date: new Date(), score: 101, createdBy: admin._id })
    ).rejects.toThrow();
  });

  it('notes field defaults to empty string', async () => {
    const s = await HotelScore.create({ hotel: repHotel._id, date: new Date(), score: 70, createdBy: admin._id });
    expect(s.notes).toBe('');
  });

  it('stores notes correctly', async () => {
    const s = await HotelScore.create({ hotel: repHotel._id, date: new Date(), score: 70, notes: 'Test note', createdBy: admin._id });
    expect(s.notes).toBe('Test note');
  });
});

// ─── GET /api/hotel-scores ────────────────────────────────────────────────────

describe('GET /api/hotel-scores', () => {
  beforeEach(async () => {
    await HotelScore.create({ hotel: repHotel._id, date: new Date('2026-01-10'), score: 75, createdBy: admin._id });
    await HotelScore.create({ hotel: repHotel._id, date: new Date('2026-01-15'), score: 82, createdBy: admin._id });
    await HotelScore.create({ hotel: salesHotel._id, date: new Date('2026-01-12'), score: 60, createdBy: admin._id });
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/hotel-scores');
    expect(res.status).toBe(401);
  });

  it('returns all scores for authenticated user', async () => {
    const res = await request(app).get('/api/hotel-scores').set(authHeader(staff._id));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
  });

  it('filters by hotel ID via ?hotel=', async () => {
    const res = await request(app)
      .get(`/api/hotel-scores?hotel=${repHotel._id}`)
      .set(authHeader(staff._id));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.every(s => s.hotel._id === repHotel._id.toString() || s.hotel === repHotel._id.toString())).toBe(true);
  });

  it('returns scores sorted by date descending', async () => {
    const res = await request(app)
      .get(`/api/hotel-scores?hotel=${repHotel._id}`)
      .set(authHeader(admin._id));
    expect(res.status).toBe(200);
    const dates = res.body.map(s => new Date(s.date).getTime());
    expect(dates[0]).toBeGreaterThan(dates[1]);
  });

  it('populates hotel name and city', async () => {
    const res = await request(app).get('/api/hotel-scores').set(authHeader(admin._id));
    expect(res.status).toBe(200);
    const score = res.body.find(s => s.hotel?.name === 'Rep Luxury');
    expect(score).toBeDefined();
    expect(score.hotel.city).toBe('Miami');
  });

  it('populates createdBy name', async () => {
    const res = await request(app).get('/api/hotel-scores').set(authHeader(admin._id));
    expect(res.status).toBe(200);
    expect(res.body[0].createdBy).toMatchObject({ name: admin.name });
  });
});

// ─── POST /api/hotel-scores ───────────────────────────────────────────────────

describe('POST /api/hotel-scores', () => {
  it('returns 401 without token', async () => {
    const res = await request(app)
      .post('/api/hotel-scores')
      .send({ hotel: repHotel._id, date: '2026-03-01', score: 80 });
    expect(res.status).toBe(401);
  });

  it('returns 400 when hotel is missing', async () => {
    const res = await request(app)
      .post('/api/hotel-scores')
      .set(authHeader(admin._id))
      .send({ date: '2026-03-01', score: 80 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/hotel|date|score/i);
  });

  it('returns 400 when date is missing', async () => {
    const res = await request(app)
      .post('/api/hotel-scores')
      .set(authHeader(admin._id))
      .send({ hotel: repHotel._id, score: 80 });
    expect(res.status).toBe(400);
  });

  it('returns 400 when score is missing', async () => {
    const res = await request(app)
      .post('/api/hotel-scores')
      .set(authHeader(admin._id))
      .send({ hotel: repHotel._id, date: '2026-03-01' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when score is below 0', async () => {
    const res = await request(app)
      .post('/api/hotel-scores')
      .set(authHeader(admin._id))
      .send({ hotel: repHotel._id, date: '2026-03-01', score: -5 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/0.*100|between/i);
  });

  it('returns 400 when score exceeds 100', async () => {
    const res = await request(app)
      .post('/api/hotel-scores')
      .set(authHeader(admin._id))
      .send({ hotel: repHotel._id, date: '2026-03-01', score: 105 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/0.*100|between/i);
  });

  it('creates a score entry successfully', async () => {
    const res = await request(app)
      .post('/api/hotel-scores')
      .set(authHeader(admin._id))
      .send({ hotel: repHotel._id, date: '2026-03-01', score: 87.5, notes: 'Good week' });
    expect(res.status).toBe(201);
    expect(res.body.score).toBe(87.5);
    expect(res.body.notes).toBe('Good week');
    expect(res.body.hotel).toMatchObject({ name: 'Rep Luxury' });
    expect(res.body.createdBy).toMatchObject({ name: admin.name });
  });

  it('creates a score entry as staff user', async () => {
    const res = await request(app)
      .post('/api/hotel-scores')
      .set(authHeader(staff._id))
      .send({ hotel: repHotel._id, date: '2026-03-02', score: 60 });
    expect(res.status).toBe(201);
    expect(res.body.score).toBe(60);
  });

  it('accepts score at boundary value 0', async () => {
    const res = await request(app)
      .post('/api/hotel-scores')
      .set(authHeader(admin._id))
      .send({ hotel: repHotel._id, date: '2026-03-03', score: 0 });
    expect(res.status).toBe(201);
    expect(res.body.score).toBe(0);
  });

  it('accepts score at boundary value 100', async () => {
    const res = await request(app)
      .post('/api/hotel-scores')
      .set(authHeader(admin._id))
      .send({ hotel: repHotel._id, date: '2026-03-04', score: 100 });
    expect(res.status).toBe(201);
    expect(res.body.score).toBe(100);
  });
});

// ─── PUT /api/hotel-scores/:id ────────────────────────────────────────────────

describe('PUT /api/hotel-scores/:id', () => {
  let scoreEntry;

  beforeEach(async () => {
    scoreEntry = await HotelScore.create({
      hotel: repHotel._id, date: new Date('2026-02-10'), score: 70, notes: 'Original', createdBy: admin._id,
    });
  });

  it('returns 401 without token', async () => {
    const res = await request(app).put(`/api/hotel-scores/${scoreEntry._id}`).send({ score: 80 });
    expect(res.status).toBe(401);
  });

  it('updates score successfully', async () => {
    const res = await request(app)
      .put(`/api/hotel-scores/${scoreEntry._id}`)
      .set(authHeader(admin._id))
      .send({ score: 88 });
    expect(res.status).toBe(200);
    expect(res.body.score).toBe(88);
  });

  it('updates notes successfully', async () => {
    const res = await request(app)
      .put(`/api/hotel-scores/${scoreEntry._id}`)
      .set(authHeader(admin._id))
      .send({ notes: 'Updated notes' });
    expect(res.status).toBe(200);
    expect(res.body.notes).toBe('Updated notes');
  });

  it('returns 400 when updated score is out of range', async () => {
    const res = await request(app)
      .put(`/api/hotel-scores/${scoreEntry._id}`)
      .set(authHeader(admin._id))
      .send({ score: 150 });
    expect(res.status).toBe(400);
  });

  it('returns 404 for a non-existent score ID', async () => {
    const fakeId = '64a123456789012345678901';
    const res = await request(app)
      .put(`/api/hotel-scores/${fakeId}`)
      .set(authHeader(admin._id))
      .send({ score: 80 });
    expect(res.status).toBe(404);
  });
});

// ─── DELETE /api/hotel-scores/:id ────────────────────────────────────────────

describe('DELETE /api/hotel-scores/:id', () => {
  let scoreEntry;

  beforeEach(async () => {
    scoreEntry = await HotelScore.create({
      hotel: repHotel._id, date: new Date('2026-02-20'), score: 65, createdBy: admin._id,
    });
  });

  it('returns 401 without token', async () => {
    const res = await request(app).delete(`/api/hotel-scores/${scoreEntry._id}`);
    expect(res.status).toBe(401);
  });

  it('deletes the score entry', async () => {
    const res = await request(app)
      .delete(`/api/hotel-scores/${scoreEntry._id}`)
      .set(authHeader(admin._id));
    expect(res.status).toBe(200);
    const inDb = await HotelScore.findById(scoreEntry._id);
    expect(inDb).toBeNull();
  });

  it('returns 404 for already-deleted entry', async () => {
    await HotelScore.findByIdAndDelete(scoreEntry._id);
    const res = await request(app)
      .delete(`/api/hotel-scores/${scoreEntry._id}`)
      .set(authHeader(admin._id));
    expect(res.status).toBe(404);
  });
});

// ─── Task category scoping ────────────────────────────────────────────────────

describe('Task — category field', () => {
  const futureDate = () => new Date(Date.now() + 86400000 * 3).toISOString();

  it('defaults to "sales" when category is omitted', async () => {
    const t = await Task.create({ taskName: 'Default', deadline: futureDate(), createdBy: admin._id, assignedTo: admin._id });
    expect(t.category).toBe('sales');
  });

  it('accepts "reputation" as a valid category', async () => {
    const t = await Task.create({ taskName: 'Rep Task', deadline: futureDate(), createdBy: admin._id, assignedTo: admin._id, category: 'reputation' });
    expect(t.category).toBe('reputation');
  });

  it('rejects an invalid category', async () => {
    await expect(
      Task.create({ taskName: 'Bad', deadline: futureDate(), createdBy: admin._id, assignedTo: admin._id, category: 'finance' })
    ).rejects.toThrow();
  });

  it('POST /api/tasks creates with reputation category', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set(authHeader(admin._id))
      .send({ taskName: 'Rep Task API', deadline: futureDate(), category: 'reputation' });
    expect(res.status).toBe(201);
    expect(res.body.category).toBe('reputation');
  });

  it('GET /api/tasks?category=reputation returns only reputation tasks', async () => {
    await Task.create({ taskName: 'SalesT', deadline: futureDate(), createdBy: admin._id, assignedTo: admin._id, category: 'sales' });
    await Task.create({ taskName: 'RepT',   deadline: futureDate(), createdBy: admin._id, assignedTo: admin._id, category: 'reputation' });

    const res = await request(app)
      .get('/api/tasks?category=reputation')
      .set(authHeader(admin._id));
    expect(res.status).toBe(200);
    expect(res.body.every(t => t.category === 'reputation')).toBe(true);
    expect(res.body.some(t => t.taskName === 'RepT')).toBe(true);
    expect(res.body.some(t => t.taskName === 'SalesT')).toBe(false);
  });

  it('GET /api/tasks?category=sales does not include reputation tasks', async () => {
    await Task.create({ taskName: 'SalesOnly', deadline: futureDate(), createdBy: admin._id, assignedTo: admin._id, category: 'sales' });
    await Task.create({ taskName: 'RepOnly',   deadline: futureDate(), createdBy: admin._id, assignedTo: admin._id, category: 'reputation' });

    const res = await request(app)
      .get('/api/tasks?category=sales')
      .set(authHeader(admin._id));
    expect(res.status).toBe(200);
    expect(res.body.every(t => t.category === 'sales')).toBe(true);
    expect(res.body.some(t => t.taskName === 'SalesOnly')).toBe(true);
    expect(res.body.some(t => t.taskName === 'RepOnly')).toBe(false);
  });
});

// ─── Routine category scoping ─────────────────────────────────────────────────

describe('RoutineItem — category field', () => {
  it('defaults to "sales" when category is omitted', async () => {
    const r = await RoutineItem.create({ user: admin._id, taskName: 'Morning check' });
    expect(r.category).toBe('sales');
  });

  it('accepts "reputation" as a valid category', async () => {
    const r = await RoutineItem.create({ user: admin._id, taskName: 'Review scores', category: 'reputation' });
    expect(r.category).toBe('reputation');
  });

  it('rejects an invalid category', async () => {
    await expect(
      RoutineItem.create({ user: admin._id, taskName: 'Bad', category: 'operations' })
    ).rejects.toThrow();
  });

  it('POST /api/routines creates with reputation category', async () => {
    const res = await request(app)
      .post('/api/routines')
      .set(authHeader(admin._id))
      .send({ taskName: 'Check OTA reviews', category: 'reputation' });
    expect(res.status).toBe(201);
    expect(res.body.category).toBe('reputation');
  });

  it('GET /api/routines?category=reputation returns only reputation routines', async () => {
    await RoutineItem.create({ user: admin._id, taskName: 'Sales call', category: 'sales' });
    await RoutineItem.create({ user: admin._id, taskName: 'Review OTA', category: 'reputation' });

    const res = await request(app)
      .get('/api/routines?category=reputation')
      .set(authHeader(admin._id));
    expect(res.status).toBe(200);
    expect(res.body.every(r => r.category === 'reputation')).toBe(true);
    expect(res.body.some(r => r.taskName === 'Review OTA')).toBe(true);
    expect(res.body.some(r => r.taskName === 'Sales call')).toBe(false);
  });

  it('GET /api/routines?category=sales does not include reputation routines', async () => {
    await RoutineItem.create({ user: admin._id, taskName: 'Sales blast', category: 'sales' });
    await RoutineItem.create({ user: admin._id, taskName: 'OTA audit', category: 'reputation' });

    const res = await request(app)
      .get('/api/routines?category=sales')
      .set(authHeader(admin._id));
    expect(res.status).toBe(200);
    expect(res.body.every(r => r.category === 'sales')).toBe(true);
    expect(res.body.some(r => r.taskName === 'Sales blast')).toBe(true);
    expect(res.body.some(r => r.taskName === 'OTA audit')).toBe(false);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/routines');
    expect(res.status).toBe(401);
  });
});
