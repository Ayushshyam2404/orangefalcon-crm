const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Alert = require('../models/Alert');
const AttendanceLog = require('../models/AttendanceLog');
const { protect } = require('../middleware/auth');

const router = express.Router();

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ message: 'Username and password required' });

    const user = await User.findOne({ username: username.toLowerCase().trim() });

    // Unknown username — generic message to prevent user-enumeration
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    // Account locked?
    if (user.isLocked) {
      const minutesLeft = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return res.status(423).json({
        message: `Account locked due to too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}.`,
        lockUntil: user.lockUntil,
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      await user.incLoginAttempts();

      // Re-fetch to get updated count for the response message
      const fresh = await User.findById(user._id);
      const attemptsLeft = Math.max(0, 5 - fresh.failedLoginAttempts);

      if (fresh.isLocked) {
        const minutesLeft = Math.ceil((fresh.lockUntil - Date.now()) / 60000);
        return res.status(423).json({
          message: `Account locked due to too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}.`,
          lockUntil: fresh.lockUntil,
        });
      }

      return res.status(401).json({
        message: attemptsLeft > 0
          ? `Invalid credentials. ${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} remaining before lockout.`
          : 'Invalid credentials',
      });
    }

    // ── Successful login ──────────────────────────────────────────────────────
    await user.resetLoginAttempts();

    user.online = true;
    user.lastLogin = new Date();
    user.sessionStart = new Date();
    await user.save();

    if (user.role !== 'admin') {
      await Alert.create({ message: `${user.name} logged in`, type: 'Login Event', iconType: 'login' });
    }

    res.json({
      token: generateToken(user._id),
      mustChangePassword: user.mustChangePassword,
      user: {
        _id: user._id,
        name: user.name,
        username: user.username,
        role: user.role,
        title: user.title,
        avatar: user.avatar,
        lastLogin: user.lastLogin,
        mustChangePassword: user.mustChangePassword,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/logout
router.post('/logout', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const sessionSecs = user.sessionStart
      ? Math.floor((Date.now() - new Date(user.sessionStart).getTime()) / 1000)
      : 0;

    user.online = false;
    user.sessionSeconds += sessionSecs;
    user.sessionStart = null;
    await user.save();

    if (user.role !== 'admin') {
      await Alert.create({
        message: `${user.name} logged out — session ${formatSecs(sessionSecs)}`,
        type: 'Logout Event',
        iconType: 'logout',
      });
    }

    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/auth/me
router.get('/me', protect, async (req, res) => {
  res.json(req.user);
});

// POST /api/auth/change-initial-password — first-login forced password change
router.post('/change-initial-password', protect, async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6)
      return res.status(400).json({ message: 'New password must be at least 6 characters' });

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.password = newPassword; // pre-save hook hashes it
    user.mustChangePassword = false;
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/auth/profile — update own profile
router.put('/profile', protect, async (req, res) => {
  try {
    const { name, email, phone, bio, gender, age, avatar, currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);

    if (name !== undefined) user.name = name.trim();
    if (email !== undefined) user.email = email.trim();
    if (phone !== undefined) user.phone = phone.trim();
    if (bio !== undefined) user.bio = bio.trim();
    if (gender !== undefined) user.gender = gender;
    if (age !== undefined) user.age = age || null;
    if (avatar !== undefined) user.avatar = avatar;

    // Optional password change
    if (newPassword) {
      if (!currentPassword) return res.status(400).json({ message: 'Current password required' });
      const match = await user.matchPassword(currentPassword);
      if (!match) return res.status(401).json({ message: 'Current password is incorrect' });
      if (newPassword.length < 6) return res.status(400).json({ message: 'New password must be at least 6 characters' });
      user.password = newPassword; // pre-save hook will hash it
    }

    await user.save();
    res.json({
      _id: user._id,
      name: user.name,
      username: user.username,
      role: user.role,
      title: user.title,
      email: user.email,
      phone: user.phone,
      bio: user.bio,
      gender: user.gender,
      age: user.age,
      avatar: user.avatar,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/clock-in
router.post('/clock-in', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (user.clockedIn) return res.status(400).json({ message: 'Already clocked in' });
    user.clockedIn = true;
    user.clockInTime = new Date();
    user.clockOutTime = null;
    user.onBreak = false;
    user.breakStart = null;
    user.breakSeconds = 0;
    await user.save();
    res.json({ clockInTime: user.clockInTime, clockedIn: true, onBreak: false, breakSeconds: 0 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/clock-out
router.post('/clock-out', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user.clockedIn) return res.status(400).json({ message: 'Not clocked in' });
    // If on break, end it first
    let breakSecs = user.breakSeconds || 0;
    if (user.onBreak && user.breakStart) {
      breakSecs += Math.floor((Date.now() - new Date(user.breakStart).getTime()) / 1000);
    }
    user.clockedIn = false;
    user.clockOutTime = new Date();
    user.onBreak = false;
    user.breakStart = null;
    user.breakSeconds = breakSecs;
    await user.save();

    // Save daily attendance log
    if (user.clockInTime) {
      const totalSecs = Math.floor((user.clockOutTime.getTime() - new Date(user.clockInTime).getTime()) / 1000);
      const workedSecs = Math.max(0, totalSecs - breakSecs);
      const dateStr = new Date(user.clockInTime).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
      await AttendanceLog.findOneAndUpdate(
        { user: user._id, date: dateStr },
        { user: user._id, date: dateStr, clockInTime: user.clockInTime, clockOutTime: user.clockOutTime, workedSeconds: workedSecs, breakSeconds: breakSecs },
        { upsert: true, new: true }
      );
    }

    res.json({ clockOutTime: user.clockOutTime, clockedIn: false });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/break-start
router.post('/break-start', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user.clockedIn) return res.status(400).json({ message: 'Not clocked in' });
    if (user.onBreak) return res.status(400).json({ message: 'Already on break' });
    user.onBreak = true;
    user.breakStart = new Date();
    await user.save();
    res.json({ onBreak: true, breakStart: user.breakStart });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/break-end
router.post('/break-end', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user.onBreak) return res.status(400).json({ message: 'Not on break' });
    const addedBreakSecs = Math.floor((Date.now() - new Date(user.breakStart).getTime()) / 1000);
    user.breakSeconds = (user.breakSeconds || 0) + addedBreakSecs;
    user.onBreak = false;
    user.breakStart = null;
    await user.save();
    res.json({ onBreak: false, breakSeconds: user.breakSeconds });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

function formatSecs(s) {
  const h = Math.floor(s / 3600).toString().padStart(2, '0');
  const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return `${h}:${m}:${sec}`;
}

module.exports = router;
