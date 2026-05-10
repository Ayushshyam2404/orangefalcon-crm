const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const { generateAndSend } = require('../services/dailyReport');

router.use(protect);

// POST /api/report/send — manually trigger the daily report (admin only)
router.post('/send', adminOnly, async (req, res) => {
  try {
    const result = await generateAndSend();
    res.json({ message: 'Report sent successfully', ...result });
  } catch (err) {
    console.error('[DailyReport] Manual trigger failed:', err);
    res.status(500).json({ message: err.message || 'Failed to generate or send report' });
  }
});

module.exports = router;
