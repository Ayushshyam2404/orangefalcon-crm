/**
 * API integration tests — Groups Routes
 * GET    /api/groups       — filtered list
 * POST   /api/groups       — requires groupName, hotel, checkIn, checkOut, type, roomBanquet
 * PUT    /api/groups/:id   — update; triggers computed numRoomNights on findOneAndUpdate
 * DELETE /api/groups/:id   — delete
 *
 * Also validates that numRoomNights is auto-calculated on creation.
 */
const request = require('supertest');
const app = require('../app');
const Hotel = require('../models/Hotel');
const Group = require('../models/Group');
const { createAdminUser, authHeader } = require('./helpers');

let admin, hotel;

beforeEach(async () => {
  admin = await createAdminUser({ username: 'grpadmin' });
  hotel = await Hotel.create({ name: 'Group Hotel', city: 'Austin', createdBy: admin._id });
});

const baseGroup = () => ({
  groupName: 'Tech Conference',
  hotel: hotel._id.toString(),
  checkIn: '2026-08-01',
  checkOut: '2026-08-04', // 3 nights
  numRooms: 10,
  type: 'guaranteed',
  roomBanquet: 'R',
});

// ─── GET /api/groups ──────────────────────────────────────────────────────────

describe('GET /api/groups', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/groups');
    expect(res.status).toBe(401);
  });

  it('returns empty array when no groups exist', async () => {
    const res = await request(app).get('/api/groups').set(authHeader(admin._id));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns groups with populated hotel and loggedBy', async () => {
    await Group.create({
      groupName: 'Sales Team',
      hotel: hotel._id,
      checkIn: new Date('2026-09-01'),
      checkOut: new Date('2026-09-03'),
      type: 'pickup',
      roomBanquet: 'R',
      loggedBy: admin._id,
    });
    const res = await request(app).get('/api/groups').set(authHeader(admin._id));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].hotel).toMatchObject({ name: 'Group Hotel' });
    expect(res.body[0].loggedBy).toMatchObject({ name: admin.name });
  });

  it('filters by type', async () => {
    await Group.create({
      groupName: 'G1', hotel: hotel._id, checkIn: new Date('2026-09-01'),
      checkOut: new Date('2026-09-02'), type: 'pickup', roomBanquet: 'R', loggedBy: admin._id,
    });
    await Group.create({
      groupName: 'G2', hotel: hotel._id, checkIn: new Date('2026-09-01'),
      checkOut: new Date('2026-09-02'), type: 'guaranteed', roomBanquet: 'B', loggedBy: admin._id,
    });
    const res = await request(app)
      .get('/api/groups?type=pickup')
      .set(authHeader(admin._id));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].groupName).toBe('G1');
  });
});

// ─── POST /api/groups ─────────────────────────────────────────────────────────

describe('POST /api/groups', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).post('/api/groups').send(baseGroup());
    expect(res.status).toBe(401);
  });

  it('returns 400 when groupName is missing', async () => {
    const body = baseGroup();
    delete body.groupName;
    const res = await request(app)
      .post('/api/groups')
      .set(authHeader(admin._id))
      .send(body);
    expect(res.status).toBe(400);
  });

  it('returns 400 when hotel is missing', async () => {
    const body = baseGroup();
    delete body.hotel;
    const res = await request(app)
      .post('/api/groups')
      .set(authHeader(admin._id))
      .send(body);
    expect(res.status).toBe(400);
  });

  it('returns 400 when type is missing', async () => {
    const body = baseGroup();
    delete body.type;
    const res = await request(app)
      .post('/api/groups')
      .set(authHeader(admin._id))
      .send(body);
    expect(res.status).toBe(400);
  });

  it('returns 400 when roomBanquet is missing', async () => {
    const body = baseGroup();
    delete body.roomBanquet;
    const res = await request(app)
      .post('/api/groups')
      .set(authHeader(admin._id))
      .send(body);
    expect(res.status).toBe(400);
  });

  it('creates group with all required fields', async () => {
    const res = await request(app)
      .post('/api/groups')
      .set(authHeader(admin._id))
      .send(baseGroup());
    expect(res.status).toBe(201);
    expect(res.body.groupName).toBe('Tech Conference');
    expect(res.body._id).toBeDefined();
    expect(res.body.hotel).toMatchObject({ name: 'Group Hotel' });
    expect(res.body.loggedBy).toMatchObject({ name: admin.name });
  });

  it('auto-calculates numRoomNights (10 rooms × 3 nights = 30)', async () => {
    const res = await request(app)
      .post('/api/groups')
      .set(authHeader(admin._id))
      .send(baseGroup()); // 10 rooms, checkIn Aug 1, checkOut Aug 4 = 3 nights
    expect(res.status).toBe(201);
    expect(res.body.numRoomNights).toBe(30);
  });

  it('stores group in the database', async () => {
    await request(app)
      .post('/api/groups')
      .set(authHeader(admin._id))
      .send(baseGroup());
    const stored = await Group.findOne({ groupName: 'Tech Conference' });
    expect(stored).not.toBeNull();
    expect(stored.loggedBy.toString()).toBe(admin._id.toString());
  });

  it('calculates banquetDurationHours for banquet-type groups', async () => {
    const body = {
      ...baseGroup(),
      roomBanquet: 'B',
      banquetCheckInTime: '09:00',
      banquetCheckOutTime: '17:00', // 8 hours
    };
    const res = await request(app)
      .post('/api/groups')
      .set(authHeader(admin._id))
      .send(body);
    expect(res.status).toBe(201);
    expect(res.body.banquetDurationHours).toBe(8);
  });
});

// ─── PUT /api/groups/:id ──────────────────────────────────────────────────────

describe('PUT /api/groups/:id', () => {
  it('returns 401 without token', async () => {
    const group = await Group.create({
      groupName: 'X', hotel: hotel._id, checkIn: new Date('2026-09-01'),
      checkOut: new Date('2026-09-02'), type: 'pickup', roomBanquet: 'R', loggedBy: admin._id,
    });
    const res = await request(app).put(`/api/groups/${group._id}`).send({ notes: 'test' });
    expect(res.status).toBe(401);
  });

  it('updates group notes', async () => {
    const group = await Group.create({
      groupName: 'UpdateGrp', hotel: hotel._id, checkIn: new Date('2026-09-01'),
      checkOut: new Date('2026-09-02'), type: 'pickup', roomBanquet: 'R', loggedBy: admin._id,
    });
    const res = await request(app)
      .put(`/api/groups/${group._id}`)
      .set(authHeader(admin._id))
      .send({ notes: 'VIP group, handle with care' });
    expect(res.status).toBe(200);
    expect(res.body.notes).toBe('VIP group, handle with care');
  });

  it('returns 404 for non-existent group', async () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await request(app)
      .put(`/api/groups/${fakeId}`)
      .set(authHeader(admin._id))
      .send({ notes: 'x' });
    expect(res.status).toBe(404);
  });

  it('persists update to database', async () => {
    const group = await Group.create({
      groupName: 'DBGroup', hotel: hotel._id, checkIn: new Date('2026-09-01'),
      checkOut: new Date('2026-09-02'), type: 'guaranteed', roomBanquet: 'R', loggedBy: admin._id,
    });
    await request(app)
      .put(`/api/groups/${group._id}`)
      .set(authHeader(admin._id))
      .send({ rate: 199 });
    const updated = await Group.findById(group._id);
    expect(updated.rate).toBe(199);
  });
});

// ─── DELETE /api/groups/:id ───────────────────────────────────────────────────

describe('DELETE /api/groups/:id', () => {
  it('returns 401 without token', async () => {
    const group = await Group.create({
      groupName: 'X', hotel: hotel._id, checkIn: new Date('2026-09-01'),
      checkOut: new Date('2026-09-02'), type: 'pickup', roomBanquet: 'R', loggedBy: admin._id,
    });
    const res = await request(app).delete(`/api/groups/${group._id}`);
    expect(res.status).toBe(401);
  });

  it('deletes group and confirms removal from DB', async () => {
    const group = await Group.create({
      groupName: 'DeleteGrp', hotel: hotel._id, checkIn: new Date('2026-09-01'),
      checkOut: new Date('2026-09-02'), type: 'pickup', roomBanquet: 'R', loggedBy: admin._id,
    });
    const res = await request(app)
      .delete(`/api/groups/${group._id}`)
      .set(authHeader(admin._id));
    expect(res.status).toBe(200);
    const deleted = await Group.findById(group._id);
    expect(deleted).toBeNull();
  });

  it('returns 404 for non-existent group', async () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await request(app)
      .delete(`/api/groups/${fakeId}`)
      .set(authHeader(admin._id));
    expect(res.status).toBe(404);
  });
});
