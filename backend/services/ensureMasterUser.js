const User = require('../models/User');
const { fullPermissions } = require('../config/permissions');

async function ensureMasterUser() {
  const existing = await User.findOne({ username: 'master' });
  if (existing) {
    let changed = false;
    if (!existing.isMaster) { existing.isMaster = true; changed = true; }
    if (existing.role !== 'admin') { existing.role = 'admin'; changed = true; }
    if (existing.department !== 'management') { existing.department = 'management'; changed = true; }
    if (!(await existing.matchPassword('admin123'))) { existing.password = 'admin123'; changed = true; }
    if (changed) await existing.save();
    return existing;
  }
  return User.create({
    name: 'Master Administrator',
    username: 'master',
    password: 'admin123',
    role: 'admin',
    isMaster: true,
    department: 'management',
    permissions: fullPermissions(),
    mustChangePassword: false,
  });
}

module.exports = ensureMasterUser;
