/**
 * Shared test helpers — create seed users and generate auth tokens.
 */
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-jwt-for-orange-falcon';

async function createAdminUser(overrides = {}) {
  return User.create({
    name: 'Admin Test',
    username: `admin_${Date.now()}`,
    password: 'AdminPass123',
    role: 'admin',
    ...overrides,
  });
}

async function createStaffUser(overrides = {}) {
  return User.create({
    name: 'Staff Test',
    username: `staff_${Date.now()}`,
    password: 'StaffPass123',
    role: 'staff',
    ...overrides,
  });
}

function getToken(userId) {
  return jwt.sign({ id: userId.toString() }, JWT_SECRET, { expiresIn: '1d' });
}

function authHeader(userId) {
  return { Authorization: `Bearer ${getToken(userId)}` };
}

module.exports = { createAdminUser, createStaffUser, getToken, authHeader };
