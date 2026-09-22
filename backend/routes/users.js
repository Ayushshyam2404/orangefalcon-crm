const express = require('express');
const crypto = require('crypto');
const User = require('../models/User');
const { protect, masterOnly, requirePermission } = require('../middleware/auth');
const { PERMISSION_GROUPS, PERMISSION_MODULES, defaultPermissions, fullPermissions } = require('../config/permissions');

const router = express.Router();

// Cryptographically random temp password, avoids visually ambiguous chars
function generateTempPassword(len = 10) {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(len);
  return Array.from(bytes, b => chars[b % chars.length]).join('');
}

// GET /api/users - admin only
router.get('/', protect, requirePermission('userManagement'), async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: 1 });
    res.json(users.map(user => {
      const data = user.toObject();
      const explicit = user.permissions instanceof Map ? Object.fromEntries(user.permissions) : (data.permissions || {});
      data.permissions = { ...defaultPermissions(user.department, user.role), ...explicit };
      return data;
    }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/users/permission-options - metadata for the master access editor
router.get('/permission-options', protect, masterOnly, (req, res) => {
  const departments = ['sales', 'reputation', 'marketing', 'operations', 'internal-sales', 'management'];
  res.json({
    modules: PERMISSION_MODULES,
    groups: PERMISSION_GROUPS,
    departments,
    defaults: Object.fromEntries(departments.map(department => [department, defaultPermissions(department, 'staff')])),
  });
});

// POST /api/users/masters - only a master can create another master account
router.post('/masters', protect, masterOnly, async (req, res) => {
  try {
    const { name, username, password, title, mustChangePassword = true } = req.body;
    if (!name?.trim() || !username?.trim() || !password) {
      return res.status(400).json({ message: 'Name, username, and password are required' });
    }
    if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });
    const normalizedUsername = username.toLowerCase().trim();
    if (await User.exists({ username: normalizedUsername })) return res.status(400).json({ message: 'Username already taken' });

    const user = await User.create({
      name: name.trim(), username: normalizedUsername, password, title: title?.trim() || 'Master Administrator',
      role: 'admin', isMaster: true, department: 'management', permissions: fullPermissions(),
      mustChangePassword: Boolean(mustChangePassword),
    });
    res.status(201).json({
      _id: user._id, name: user.name, username: user.username, role: user.role,
      isMaster: true, department: user.department, title: user.title,
      permissions: fullPermissions(), tempPassword: password,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/users - admin creates user
router.post('/', protect, requirePermission('userManagement', 'write'), async (req, res) => {
  try {
    const { name, username, password, role, title, department, permissions } = req.body;
    if (!name || !username)
      return res.status(400).json({ message: 'Name and username are required' });

    const exists = await User.findOne({ username: username.toLowerCase() });
    if (exists) return res.status(400).json({ message: 'Username already taken' });
    if (role === 'admin' && !req.user.isMaster) {
      return res.status(403).json({ message: 'Only a master can create administrator accounts' });
    }
    if (department === 'management' && !req.user.isMaster) {
      return res.status(403).json({ message: 'Only a master can assign the management department' });
    }

    // Use provided password or auto-generate a temporary one
    const tempPassword = (password && password.trim()) ? password.trim() : generateTempPassword();

    const user = await User.create({
      name,
      username,
      password: tempPassword,
      role: role || 'staff',
      title: title || '',
      department: department || 'sales',
      permissions: req.user.isMaster && permissions ? permissions : {},
      mustChangePassword: true,   // always require change on first login
    });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      username: user.username,
      role: user.role,
      title: user.title,
      department: user.department,
      permissions: user.permissions,
      tempPassword, // plain — only returned at creation, never stored in plain form
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/users/:id - admin updates user
router.put('/:id', protect, requirePermission('userManagement', 'write'), async (req, res) => {
  try {
    const { name, username, password, role, title, department, permissions } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.isMaster && !req.user.isMaster) return res.status(403).json({ message: 'Only the master can modify the master account' });
    if (!req.user.isMaster && (user.role === 'admin' || role === 'admin')) {
      return res.status(403).json({ message: 'Only a master can modify administrator accounts or roles' });
    }
    if (department === 'management' && !req.user.isMaster) {
      return res.status(403).json({ message: 'Only a master can assign the management department' });
    }

    if (user.username === 'master' && username && username !== 'master') {
      return res.status(400).json({ message: 'The primary master username cannot be changed' });
    }
    if (username && username !== user.username) {
      const exists = await User.findOne({ username: username.toLowerCase() });
      if (exists) return res.status(400).json({ message: 'Username already taken' });
      user.username = username.toLowerCase();
    }
    if (name) user.name = name;
    if (role && !user.isMaster && req.user.isMaster) user.role = role;
    if (title !== undefined) user.title = title;
    if (department !== undefined && !user.isMaster) user.department = department;
    if (permissions !== undefined) {
      if (!req.user.isMaster) return res.status(403).json({ message: 'Only the master can change permissions' });
      if (!user.isMaster) user.permissions = permissions;
    }
    if (password && password.trim()) user.password = password;

    await user.save();
    res.json({ _id: user._id, name: user.name, username: user.username, role: user.role, title: user.title, department: user.department, permissions: user.permissions, isMaster: user.isMaster });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/users/:id - admin only
router.delete('/:id', protect, requirePermission('userManagement', 'write'), async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString())
      return res.status(400).json({ message: "You can't delete yourself" });

    const target = await User.findById(req.params.id);
    if (target?.username === 'master') return res.status(400).json({ message: 'The primary master account cannot be deleted' });
    if (target?.isMaster && !req.user.isMaster) return res.status(403).json({ message: 'Only a master can delete another master account' });
    if (target?.role === 'admin' && !req.user.isMaster) return res.status(403).json({ message: 'Only a master can delete administrator accounts' });

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
