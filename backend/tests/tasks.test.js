/**
 * API integration tests — Tasks Routes
 * GET    /api/tasks       — returns tasks for the current user only
 * POST   /api/tasks       — requires taskName + deadline
 * PUT    /api/tasks/:id   — requires creator or assignee; sets completedAt when marked done
 * DELETE /api/tasks/:id   — creator-only
 */
const request = require('supertest');
const app = require('../app');
const Task = require('../models/Task');
const { createAdminUser, createStaffUser, authHeader } = require('./helpers');
const { getEasternDayRange } = require('../utils/easternTime');

let admin, staff;

beforeEach(async () => {
  admin = await createAdminUser({ username: 'taskadmin' });
  staff = await createStaffUser({ username: 'taskstaff' });
});

const futureDate = () => new Date(Date.now() + 86400000 * 7).toISOString(); // 7 days from now

// ─── GET /api/tasks ───────────────────────────────────────────────────────────

describe('GET /api/tasks', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/tasks');
    expect(res.status).toBe(401);
  });

  it('returns empty array when user has no tasks', async () => {
    const res = await request(app).get('/api/tasks').set(authHeader(admin._id));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns tasks where user is creator', async () => {
    await Task.create({ taskName: 'My Task', deadline: futureDate(), createdBy: admin._id, assignedTo: admin._id });
    const res = await request(app).get('/api/tasks').set(authHeader(admin._id));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('returns tasks where user is assignee', async () => {
    // Admin creates task, assigns to staff
    await Task.create({ taskName: 'Staff Task', deadline: futureDate(), createdBy: admin._id, assignedTo: staff._id });
    // Staff should see it
    const res = await request(app).get('/api/tasks').set(authHeader(staff._id));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].taskName).toBe('Staff Task');
  });

  it('does NOT return tasks belonging to other users', async () => {
    // Task only for admin — staff should get empty list
    await Task.create({ taskName: 'Admin Only', deadline: futureDate(), createdBy: admin._id, assignedTo: admin._id });
    const res = await request(app).get('/api/tasks').set(authHeader(staff._id));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it('filters by status', async () => {
    await Task.create({ taskName: 'Pending', deadline: futureDate(), createdBy: admin._id, assignedTo: admin._id, status: 'pending' });
    await Task.create({ taskName: 'Done', deadline: futureDate(), createdBy: admin._id, assignedTo: admin._id, status: 'completed' });
    const res = await request(app)
      .get('/api/tasks?status=pending')
      .set(authHeader(admin._id));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].taskName).toBe('Pending');
  });

  it('filters tasks by an Eastern calendar day', async () => {
    const range = getEasternDayRange('2026-09-21');
    await Task.create({ taskName: 'Eastern Today', deadline: new Date(range.start.getTime() + 12 * 60 * 60 * 1000), createdBy: admin._id, assignedTo: admin._id });
    await Task.create({ taskName: 'Eastern Tomorrow', deadline: range.end, createdBy: admin._id, assignedTo: admin._id });

    const res = await request(app)
      .get('/api/tasks?date=2026-09-21&category=sales')
      .set(authHeader(admin._id));

    expect(res.status).toBe(200);
    expect(res.body.map(task => task.taskName)).toEqual(['Eastern Today']);
  });
});

describe('PUT /api/tasks/complete-day', () => {
  it('marks all open tasks for the requested Eastern day and category complete', async () => {
    const range = getEasternDayRange('2026-09-21');
    const deadline = new Date(range.start.getTime() + 12 * 60 * 60 * 1000);
    await Task.create({ taskName: 'First', deadline, createdBy: admin._id, assignedTo: admin._id, category: 'sales' });
    await Task.create({ taskName: 'Second', deadline, createdBy: admin._id, assignedTo: admin._id, category: 'sales', status: 'in-progress' });
    await Task.create({ taskName: 'Reputation', deadline, createdBy: admin._id, assignedTo: admin._id, category: 'reputation' });

    const res = await request(app)
      .put('/api/tasks/complete-day')
      .set(authHeader(admin._id))
      .send({ date: '2026-09-21', category: 'sales' });

    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(2);
    expect(res.body.tasks).toHaveLength(2);
    expect(res.body.tasks.every(task => task.status === 'completed')).toBe(true);

    const completed = await Task.find({ taskName: { $in: ['First', 'Second'] } });
    expect(completed.every(task => task.completedBy.toString() === admin._id.toString())).toBe(true);
    expect(completed.every(task => task.completionHistory.length === 1)).toBe(true);
    expect((await Task.findOne({ taskName: 'Reputation' })).status).toBe('pending');
  });
});

// ─── POST /api/tasks ──────────────────────────────────────────────────────────

describe('POST /api/tasks', () => {
  it('returns 401 without token', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ taskName: 'X', deadline: futureDate() });
    expect(res.status).toBe(401);
  });

  it('returns 400 when taskName is missing', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set(authHeader(admin._id))
      .send({ deadline: futureDate() });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/task name/i);
  });

  it('returns 400 when deadline is missing', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set(authHeader(admin._id))
      .send({ taskName: 'No Deadline' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/deadline/i);
  });

  it('creates task assigned to self when no assignedTo given', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set(authHeader(admin._id))
      .send({ taskName: 'Self Task', deadline: futureDate() });
    expect(res.status).toBe(201);
    expect(res.body.taskName).toBe('Self Task');
    expect(res.body.assignedTo._id).toBe(admin._id.toString());
    expect(res.body.createdBy._id).toBe(admin._id.toString());
    expect(res.body.status).toBe('pending');
  });

  it('creates task assigned to another user', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set(authHeader(admin._id))
      .send({ taskName: 'Delegated', deadline: futureDate(), assignedTo: staff._id.toString() });
    expect(res.status).toBe(201);
    expect(res.body.assignedTo._id).toBe(staff._id.toString());
    expect(res.body.createdBy._id).toBe(admin._id.toString());
  });

  it('persists task to database', async () => {
    await request(app)
      .post('/api/tasks')
      .set(authHeader(admin._id))
      .send({ taskName: 'Persist Test', deadline: futureDate() });
    const stored = await Task.findOne({ taskName: 'Persist Test' });
    expect(stored).not.toBeNull();
    expect(stored.createdBy.toString()).toBe(admin._id.toString());
  });
});

// ─── PUT /api/tasks/:id ───────────────────────────────────────────────────────

describe('PUT /api/tasks/:id', () => {
  it('returns 401 without token', async () => {
    const task = await Task.create({ taskName: 'X', deadline: futureDate(), createdBy: admin._id, assignedTo: admin._id });
    const res = await request(app).put(`/api/tasks/${task._id}`).send({ status: 'completed' });
    expect(res.status).toBe(401);
  });

  it('creator can update the task', async () => {
    const task = await Task.create({ taskName: 'CreatorUpdate', deadline: futureDate(), createdBy: admin._id, assignedTo: staff._id });
    const res = await request(app)
      .put(`/api/tasks/${task._id}`)
      .set(authHeader(admin._id))
      .send({ status: 'in-progress' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('in-progress');
  });

  it('assignee can update the task', async () => {
    const task = await Task.create({ taskName: 'AssigneeUpdate', deadline: futureDate(), createdBy: admin._id, assignedTo: staff._id });
    const res = await request(app)
      .put(`/api/tasks/${task._id}`)
      .set(authHeader(staff._id))
      .send({ status: 'completed' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');
  });

  it('returns 403 for a user who is neither creator nor assignee', async () => {
    const otherStaff = await createStaffUser({ username: 'othertaskstaff' });
    const task = await Task.create({ taskName: 'Owned', deadline: futureDate(), createdBy: admin._id, assignedTo: staff._id });
    const res = await request(app)
      .put(`/api/tasks/${task._id}`)
      .set(authHeader(otherStaff._id))
      .send({ status: 'completed' });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/not authorized/i);
  });

  it('sets completedAt timestamp when status changes to completed', async () => {
    const task = await Task.create({ taskName: 'CompleteMe', deadline: futureDate(), createdBy: admin._id, assignedTo: admin._id });
    const before = new Date();
    await request(app)
      .put(`/api/tasks/${task._id}`)
      .set(authHeader(admin._id))
      .send({ status: 'completed' });
    const updated = await Task.findById(task._id);
    expect(updated.completedAt).toBeDefined();
    expect(new Date(updated.completedAt).getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(updated.completedBy.toString()).toBe(admin._id.toString());
    expect(updated.completionHistory).toHaveLength(1);
    expect(updated.completionHistory[0].completedBy.toString()).toBe(admin._id.toString());
  });

  it('keeps completion history when a task is reopened and completed again', async () => {
    const task = await Task.create({ taskName: 'Repeatable', deadline: futureDate(), createdBy: admin._id, assignedTo: staff._id });

    await request(app).put(`/api/tasks/${task._id}`).set(authHeader(staff._id)).send({ status: 'completed' });
    await request(app).put(`/api/tasks/${task._id}`).set(authHeader(staff._id)).send({ status: 'in-progress' });

    const reopened = await Task.findById(task._id);
    expect(reopened.completedAt).toBeNull();
    expect(reopened.completedBy).toBeNull();
    expect(reopened.completionHistory).toHaveLength(1);

    await request(app).put(`/api/tasks/${task._id}`).set(authHeader(admin._id)).send({ status: 'completed' });
    const completedAgain = await Task.findById(task._id);
    expect(completedAgain.completionHistory).toHaveLength(2);
    expect(completedAgain.completionHistory[0].completedBy.toString()).toBe(staff._id.toString());
    expect(completedAgain.completionHistory[1].completedBy.toString()).toBe(admin._id.toString());
  });

  it('does not allow clients to forge completion audit fields', async () => {
    const task = await Task.create({ taskName: 'Protected audit', deadline: futureDate(), createdBy: admin._id, assignedTo: staff._id });

    const res = await request(app)
      .put(`/api/tasks/${task._id}`)
      .set(authHeader(staff._id))
      .send({
        notes: 'Legitimate edit',
        completedAt: new Date('2020-01-01').toISOString(),
        completedBy: admin._id.toString(),
        completionHistory: [{ completedAt: new Date('2020-01-01').toISOString(), completedBy: admin._id.toString() }],
      });

    expect(res.status).toBe(200);
    const unchanged = await Task.findById(task._id);
    expect(unchanged.notes).toBe('Legitimate edit');
    expect(unchanged.completedAt).toBeNull();
    expect(unchanged.completedBy).toBeNull();
    expect(unchanged.completionHistory).toHaveLength(0);
  });

  it('returns 404 for non-existent task', async () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await request(app)
      .put(`/api/tasks/${fakeId}`)
      .set(authHeader(admin._id))
      .send({ status: 'completed' });
    expect(res.status).toBe(404);
  });
});

// ─── GET /api/tasks/history ──────────────────────────────────────────────────

describe('GET /api/tasks/history', () => {
  const historyRange = () => ({
    start: new Date(Date.now() - 86400000).toISOString(),
    end: new Date(Date.now() + 86400000).toISOString(),
  });

  it('returns who completed each task in the requested department and date range', async () => {
    const salesTask = await Task.create({ taskName: 'Closed sales follow-up', deadline: futureDate(), createdBy: admin._id, assignedTo: staff._id, category: 'sales' });
    const reputationTask = await Task.create({ taskName: 'Replied to review', deadline: futureDate(), createdBy: admin._id, assignedTo: staff._id, category: 'reputation' });
    await request(app).put(`/api/tasks/${salesTask._id}`).set(authHeader(staff._id)).send({ status: 'completed' });
    await request(app).put(`/api/tasks/${reputationTask._id}`).set(authHeader(admin._id)).send({ status: 'completed' });

    const range = historyRange();
    const res = await request(app)
      .get('/api/tasks/history')
      .query({ ...range, category: 'sales' })
      .set(authHeader(admin._id));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].taskName).toBe('Closed sales follow-up');
    expect(res.body[0].completedBy.name).toBe(staff.name);
    expect(res.body[0].assignedTo.name).toBe(staff.name);
    expect(res.body[0].legacy).toBe(false);
  });

  it('limits staff history to tasks they created or were assigned', async () => {
    const visible = await Task.create({ taskName: 'Visible completion', deadline: futureDate(), createdBy: admin._id, assignedTo: staff._id });
    const hidden = await Task.create({ taskName: 'Admin-only completion', deadline: futureDate(), createdBy: admin._id, assignedTo: admin._id });
    await request(app).put(`/api/tasks/${visible._id}`).set(authHeader(staff._id)).send({ status: 'completed' });
    await request(app).put(`/api/tasks/${hidden._id}`).set(authHeader(admin._id)).send({ status: 'completed' });

    const res = await request(app)
      .get('/api/tasks/history')
      .query({ ...historyRange(), category: 'sales' })
      .set(authHeader(staff._id));

    expect(res.status).toBe(200);
    expect(res.body.map(entry => entry.taskName)).toEqual(['Visible completion']);
  });

  it('includes older completed tasks and identifies them as legacy records', async () => {
    await Task.create({
      taskName: 'Older completion',
      deadline: futureDate(),
      createdBy: admin._id,
      assignedTo: staff._id,
      status: 'completed',
      completedAt: new Date(),
    });

    const res = await request(app)
      .get('/api/tasks/history')
      .query({ ...historyRange(), category: 'sales' })
      .set(authHeader(admin._id));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].legacy).toBe(true);
    expect(res.body[0].completedBy).toBeNull();
    expect(res.body[0].assignedTo.name).toBe(staff.name);
  });

  it('rejects a missing or invalid date range', async () => {
    const res = await request(app)
      .get('/api/tasks/history?start=not-a-date&end=also-bad')
      .set(authHeader(admin._id));
    expect(res.status).toBe(400);
  });
});

// ─── DELETE /api/tasks/:id ────────────────────────────────────────────────────

describe('DELETE /api/tasks/:id', () => {
  it('returns 401 without token', async () => {
    const task = await Task.create({ taskName: 'X', deadline: futureDate(), createdBy: admin._id, assignedTo: admin._id });
    const res = await request(app).delete(`/api/tasks/${task._id}`);
    expect(res.status).toBe(401);
  });

  it('creator can delete their task', async () => {
    const task = await Task.create({ taskName: 'DeleteMe', deadline: futureDate(), createdBy: admin._id, assignedTo: admin._id });
    const res = await request(app)
      .delete(`/api/tasks/${task._id}`)
      .set(authHeader(admin._id));
    expect(res.status).toBe(200);
    const deleted = await Task.findById(task._id);
    expect(deleted).toBeNull();
  });

  it('assignee (non-creator) cannot delete the task (403)', async () => {
    const task = await Task.create({ taskName: 'Protected', deadline: futureDate(), createdBy: admin._id, assignedTo: staff._id });
    const res = await request(app)
      .delete(`/api/tasks/${task._id}`)
      .set(authHeader(staff._id));
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/only creator/i);
    // Confirm task still exists
    const stillExists = await Task.findById(task._id);
    expect(stillExists).not.toBeNull();
  });

  it('returns 404 for non-existent task', async () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await request(app)
      .delete(`/api/tasks/${fakeId}`)
      .set(authHeader(admin._id));
    expect(res.status).toBe(404);
  });
});
