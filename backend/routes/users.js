const express = require('express');
const crypto = require('crypto');
const User = require('../models/User');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

// Cryptographically random temp password, avoids visually ambiguous chars
function generateTempPassword(len = 10) {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(len);
  return Array.from(bytes, b => chars[b % chars.length]).join('');
}

// GET /api/users - admin only
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: 1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/users - admin creates user
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { name, username, password, role, title } = req.body;
    if (!name || !username)
      return res.status(400).json({ message: 'Name and username are required' });

    const exists = await User.findOne({ username: username.toLowerCase() });
    if (exists) return res.status(400).json({ message: 'Username already taken' });

    // Use provided password or auto-generate a temporary one
    const tempPassword = (password && password.trim()) ? password.trim() : generateTempPassword();

    const user = await User.create({
      name,
      username,
      password: tempPassword,
      role: role || 'staff',
      title: title || '',
      mustChangePassword: true,   // always require change on first login
    });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      username: user.username,
      role: user.role,
      title: user.title,
      tempPassword, // plain — only returned at creation, never stored in plain form
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/users/:id - admin updates user
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const { name, username, password, role, title } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (username && username !== user.username) {
      const exists = await User.findOne({ username: username.toLowerCase() });
      if (exists) return res.status(400).json({ message: 'Username already taken' });
      user.username = username.toLowerCase();
    }
    if (name) user.name = name;
    if (role) user.role = role;
    if (title !== undefined) user.title = title;
    if (password && password.trim()) user.password = password;

    await user.save();
    res.json({ _id: user._id, name: user.name, username: user.username, role: user.role, title: user.title });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/users/:id - admin only
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString())
      return res.status(400).json({ message: "You can't delete yourself" });

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
