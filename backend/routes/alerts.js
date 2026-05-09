const express = require('express');
const Alert = require('../models/Alert');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/alerts - admin only
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const alerts = await Alert.find().sort({ createdAt: -1 }).limit(100);
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/alerts - clear all alerts
router.delete('/', protect, adminOnly, async (req, res) => {
  try {
    await Alert.deleteMany({});
    res.json({ message: 'All alerts cleared' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
