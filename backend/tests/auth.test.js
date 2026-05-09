/**
 * API integration tests — Auth Routes
 * POST /api/auth/login
 * GET  /api/auth/me
 * POST /api/auth/logout
 */
const request = require('supertest');
const app = require('../app');
const { createAdminUser, createStaffUser, authHeader } = require('./helpers');

describe('POST /api/auth/login', () => {
  it('returns 400 when both fields are missing', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/required/i);
  });

  it('returns 400 when password is missing', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'someone' });
    expect(res.status).toBe(400);
  });

  it('returns 401 for unknown username', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'no_such_user', password: 'SomePass1' });
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid/i);
  });

  it('returns 401 for correct username but wrong password', async () => {
    await createAdminUser({ username: 'wrongpass_admin' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'wrongpass_admin', password: 'TotallyWrong99' });
    expect(res.status).toBe(401);
  });

  it('returns 200 with token and user on valid admin login', async () => {
    await createAdminUser({ username: 'validadmin', password: 'AdminPass123' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'validadmin', password: 'AdminPass123' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user).toMatchObject({ username: 'validadmin', role: 'admin' });
    // Password must NOT be returned
    expect(res.body.user.password).toBeUndefined();
  });

  it('returns 200 for staff login', async () => {
    await createStaffUser({ username: 'validstaff', password: 'StaffPass123' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'validstaff', password: 'StaffPass123' });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('staff');
  });

  it('is case-insensitive for username', async () => {
    await createAdminUser({ username: 'caseadmin', password: 'AdminPass123' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'CaseAdmin', password: 'AdminPass123' });
    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe('caseadmin');
  });
});

describe('GET /api/auth/me', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 with a malformed token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  it('returns current user profile with valid token', async () => {
    const user = await createAdminUser({ username: 'meadmin' });
    const res = await request(app)
      .get('/api/auth/me')
      .set(authHeader(user._id));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ username: 'meadmin', role: 'admin' });
    expect(res.body.password).toBeUndefined();
  });
});

describe('POST /api/auth/logout', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(401);
  });

  it('logs out successfully and returns confirmation', async () => {
    const user = await createAdminUser({ username: 'logoutadmin' });
    const res = await request(app)
      .post('/api/auth/logout')
      .set(authHeader(user._id));
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');
  });
});
