const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const CompanySettings = require('../models/CompanySettings');
const InactivityWarning = require('../models/InactivityWarning');
const ensureMasterUser = require('../services/ensureMasterUser');
const { authHeader, createStaffUser } = require('./helpers');

describe('master account and granular permissions', () => {
  it('provisions the requested master credentials', async () => {
    await ensureMasterUser();
    const res = await request(app).post('/api/auth/login').send({ username: 'master', password: 'admin123' });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ username: 'master', isMaster: true, department: 'management' });
  });

  it('allows a master to create another unrestricted master', async () => {
    const primary = await ensureMasterUser();
    const created = await request(app).post('/api/users/masters').set(authHeader(primary._id)).send({
      name: 'Second Master', username: 'secondmaster', password: 'MasterPass123', mustChangePassword: false,
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ username: 'secondmaster', isMaster: true, department: 'management' });

    const login = await request(app).post('/api/auth/login').send({ username: 'secondmaster', password: 'MasterPass123' });
    expect(login.status).toBe(200);
    expect(login.body.user.isMaster).toBe(true);
    expect(Object.values(login.body.user.permissions).every(permission => permission.read && permission.write)).toBe(true);
  });

  it('returns the complete grouped permission catalog', async () => {
    const primary = await ensureMasterUser();
    const res = await request(app).get('/api/users/permission-options').set(authHeader(primary._id));
    expect(res.status).toBe(200);
    expect(res.body.groups.map(group => group.key)).toEqual(expect.arrayContaining(['shared', 'sales', 'reputation', 'people', 'administration']));
    expect(res.body.modules).toEqual(expect.arrayContaining(['profile', 'leaveRequests', 'leaveApprovals', 'executiveOverview', 'globalSearch', 'appearance', 'companySettings', 'reportRecipients', 'backupRestore', 'dailyReports']));
  });

  it('gives a marketing employee access to marketing tasks but not sales tasks', async () => {
    const user = await createStaffUser({ department: 'marketing' });
    const marketing = await request(app).post('/api/tasks').set(authHeader(user._id)).send({
      taskName: 'Create launch reel', deadline: new Date(Date.now() + 3600000), category: 'marketing',
    });
    expect(marketing.status).toBe(201);

    const sales = await request(app).post('/api/tasks').set(authHeader(user._id)).send({
      taskName: 'Sales follow-up', deadline: new Date(Date.now() + 3600000), category: 'sales',
    });
    expect(sales.status).toBe(403);
  });

  it('enforces a read-only permission override', async () => {
    const user = await createStaffUser({
      department: 'marketing',
      permissions: { marketingTasks: { read: true, write: false } },
    });
    const read = await request(app).get('/api/tasks?category=marketing').set(authHeader(user._id));
    expect(read.status).toBe(200);
    const write = await request(app).post('/api/tasks').set(authHeader(user._id)).send({
      taskName: 'Blocked write', deadline: new Date(Date.now() + 3600000), category: 'marketing',
    });
    expect(write.status).toBe(403);
  });

  it('keeps Company Overview private unless that permission is assigned', async () => {
    const blocked = await createStaffUser({ department: 'operations' });
    const allowed = await createStaffUser({
      department: 'operations',
      permissions: { executiveOverview: { read: true, write: false } },
    });
    expect((await request(app).get('/api/overview/executive').set(authHeader(blocked._id))).status).toBe(403);
    expect((await request(app).get('/api/overview/executive').set(authHeader(allowed._id))).status).toBe(200);
  });

  it('does not let a delegated user manager promote an account to administrator', async () => {
    const manager = await createStaffUser({
      department: 'operations',
      permissions: { userManagement: { read: true, write: true } },
    });
    const res = await request(app).post('/api/users').set(authHeader(manager._id)).send({
      name: 'Unauthorized Admin', username: 'unauthorizedadmin', password: 'Password123', role: 'admin',
    });
    expect(res.status).toBe(403);
    expect(await User.exists({ username: 'unauthorizedadmin' })).toBeNull();

    const management = await request(app).post('/api/users').set(authHeader(manager._id)).send({
      name: 'Unauthorized Manager', username: 'unauthorizedmanager', password: 'Password123', department: 'management',
    });
    expect(management.status).toBe(403);
    expect(await User.exists({ username: 'unauthorizedmanager' })).toBeNull();
  });
});

describe('inactivity warnings', () => {
  it('records a warning and exposes it to employee behaviour reporting', async () => {
    const user = await createStaffUser({ department: 'operations' });
    await CompanySettings.create({ key: 'singleton', inactivityMinutes: 1, inactivityWarningLimit: 2 });
    const warning = await request(app).post('/api/activity/warning').set(authHeader(user._id)).send({ inactiveSeconds: 61 });
    expect(warning.status).toBe(201);
    expect(warning.body.warningCount).toBe(1);
    expect(await InactivityWarning.countDocuments({ user: user._id })).toBe(1);
    expect((await User.findById(user._id)).inactivityWarnings).toBe(1);
  });
});
