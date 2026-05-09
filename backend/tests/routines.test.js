/**
 * API integration tests — Routines Routes
 * GET    /api/routines       — returns only current user's items
 * POST   /api/routines       — requires taskName
 * PUT    /api/routines/:id   — user-scoped: can't modify another user's items
 * DELETE /api/routines/:id   — user-scoped: can't delete another user's items
 */
const request = require('supertest');
const app = require('../app');
const RoutineItem = require('../models/RoutineItem');
const { createAdminUser, createStaffUser, authHeader } = require('./helpers');

let admin, staff;

beforeEach(async () => {
  admin = await createAdminUser({ username: 'routineadmin' });
  staff = await createStaffUser({ username: 'routinestaff' });
});

// ─── GET /api/routines ────────────────────────────────────────────────────────

describe('GET /api/routines', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/routines');
    expect(res.status).toBe(401);
  });

  it('returns empty array when user has no routines', async () => {
    const res = await request(app).get('/api/routines').set(authHeader(admin._id));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns only the current user\'s routine items', async () => {
    await RoutineItem.create({ user: admin._id, taskName: 'Admin Task', order: 0 });
    await RoutineItem.create({ user: staff._id, taskName: 'Staff Task', order: 0 });

    const adminRes = await request(app).get('/api/routines').set(authHeader(admin._id));
    expect(adminRes.status).toBe(200);
    expect(adminRes.body).toHaveLength(1);
    expect(adminRes.body[0].taskName).toBe('Admin Task');

    const staffRes = await request(app).get('/api/routines').set(authHeader(staff._id));
    expect(staffRes.status).toBe(200);
    expect(staffRes.body).toHaveLength(1);
    expect(staffRes.body[0].taskName).toBe('Staff Task');
  });

  it('returns items sorted by order', async () => {
    await RoutineItem.create({ user: admin._id, taskName: 'Third', order: 2 });
    await RoutineItem.create({ user: admin._id, taskName: 'First', order: 0 });
    await RoutineItem.create({ user: admin._id, taskName: 'Second', order: 1 });
    const res = await request(app).get('/api/routines').set(authHeader(admin._id));
    expect(res.status).toBe(200);
    expect(res.body[0].taskName).toBe('First');
    expect(res.body[1].taskName).toBe('Second');
    expect(res.body[2].taskName).toBe('Third');
  });
});

// ─── POST /api/routines ───────────────────────────────────────────────────────

describe('POST /api/routines', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).post('/api/routines').send({ taskName: 'Morning standup' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when taskName is empty or missing', async () => {
    const res1 = await request(app)
      .post('/api/routines')
      .set(authHeader(admin._id))
      .send({});
    expect(res1.status).toBe(400);

    const res2 = await request(app)
      .post('/api/routines')
      .set(authHeader(admin._id))
      .send({ taskName: '   ' }); // whitespace-only
    expect(res2.status).toBe(400);
  });

  it('creates routine item for the current user', async () => {
    const res = await request(app)
      .post('/api/routines')
      .set(authHeader(admin._id))
      .send({ taskName: 'Check emails' });
    expect(res.status).toBe(201);
    expect(res.body.taskName).toBe('Check emails');
    expect(res.body.user.toString()).toBe(admin._id.toString());
    expect(res.body.order).toBe(0); // first item
  });

  it('auto-increments order based on existing item count', async () => {
    await RoutineItem.create({ user: admin._id, taskName: 'Existing', order: 0 });
    const res = await request(app)
      .post('/api/routines')
      .set(authHeader(admin._id))
      .send({ taskName: 'New Item' });
    expect(res.status).toBe(201);
    expect(res.body.order).toBe(1); // second item
  });

  it('creates routine with defaultNote', async () => {
    const res = await request(app)
      .post('/api/routines')
      .set(authHeader(admin._id))
      .send({ taskName: 'Daily report', defaultNote: 'Attach the spreadsheet' });
    expect(res.status).toBe(201);
    expect(res.body.defaultNote).toBe('Attach the spreadsheet');
  });

  it('persists routine item to database', async () => {
    await request(app)
      .post('/api/routines')
      .set(authHeader(admin._id))
      .send({ taskName: 'Persist Routine' });
    const stored = await RoutineItem.findOne({ taskName: 'Persist Routine' });
    expect(stored).not.toBeNull();
    expect(stored.user.toString()).toBe(admin._id.toString());
  });
});

// ─── PUT /api/routines/:id ────────────────────────────────────────────────────

describe('PUT /api/routines/:id', () => {
  it('returns 401 without token', async () => {
    const item = await RoutineItem.create({ user: admin._id, taskName: 'X', order: 0 });
    const res = await request(app).put(`/api/routines/${item._id}`).send({ taskName: 'Y' });
    expect(res.status).toBe(401);
  });

  it('owner can update their routine item', async () => {
    const item = await RoutineItem.create({ user: admin._id, taskName: 'Old Name', order: 0 });
    const res = await request(app)
      .put(`/api/routines/${item._id}`)
      .set(authHeader(admin._id))
      .send({ taskName: 'New Name', order: 0 });
    expect(res.status).toBe(200);
    expect(res.body.taskName).toBe('New Name');
  });

  it('user cannot update another user\'s routine item (returns 404)', async () => {
    const item = await RoutineItem.create({ user: admin._id, taskName: 'AdminItem', order: 0 });
    // Staff tries to update admin's item — should return 404 (not found for this user)
    const res = await request(app)
      .put(`/api/routines/${item._id}`)
      .set(authHeader(staff._id))
      .send({ taskName: 'HackedName', order: 0 });
    expect(res.status).toBe(404);
    // Confirm item was NOT changed
    const unchanged = await RoutineItem.findById(item._id);
    expect(unchanged.taskName).toBe('AdminItem');
  });

  it('updates order for reordering', async () => {
    const item = await RoutineItem.create({ user: admin._id, taskName: 'Reorder Me', order: 0 });
    const res = await request(app)
      .put(`/api/routines/${item._id}`)
      .set(authHeader(admin._id))
      .send({ taskName: 'Reorder Me', order: 5 });
    expect(res.status).toBe(200);
    expect(res.body.order).toBe(5);
  });
});

// ─── DELETE /api/routines/:id ─────────────────────────────────────────────────

describe('DELETE /api/routines/:id', () => {
  it('returns 401 without token', async () => {
    const item = await RoutineItem.create({ user: admin._id, taskName: 'X', order: 0 });
    const res = await request(app).delete(`/api/routines/${item._id}`);
    expect(res.status).toBe(401);
  });

  it('owner can delete their routine item', async () => {
    const item = await RoutineItem.create({ user: admin._id, taskName: 'DeleteMe', order: 0 });
    const res = await request(app)
      .delete(`/api/routines/${item._id}`)
      .set(authHeader(admin._id));
    expect(res.status).toBe(200);
    const deleted = await RoutineItem.findById(item._id);
    expect(deleted).toBeNull();
  });

  it('user cannot delete another user\'s routine item (returns 404)', async () => {
    const item = await RoutineItem.create({ user: admin._id, taskName: 'AdminOnly', order: 0 });
    const res = await request(app)
      .delete(`/api/routines/${item._id}`)
      .set(authHeader(staff._id));
    expect(res.status).toBe(404);
    // Confirm item still exists
    const stillExists = await RoutineItem.findById(item._id);
    expect(stillExists).not.toBeNull();
  });

  it('returns 404 for non-existent routine item', async () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await request(app)
      .delete(`/api/routines/${fakeId}`)
      .set(authHeader(admin._id));
    expect(res.status).toBe(404);
  });
});
