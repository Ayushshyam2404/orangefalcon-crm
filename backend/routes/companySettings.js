const express = require('express');
const router = express.Router();
const CompanySettings = require('../models/CompanySettings');
const { protect, adminOnly } = require('../middleware/auth');

// GET /api/company-settings/public — unauthenticated, returns only companyName and logo for login page
router.get('/public', async (req, res) => {
  try {
    let settings = await CompanySettings.findOne({ key: 'singleton' });
    if (!settings) settings = { companyName: 'Orange Falcon', logo: '' };
    res.json({ companyName: settings.companyName || 'Orange Falcon', logo: settings.logo || '' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.use(protect);

// GET /api/company-settings — all authenticated users can read (for logo in sidebar, benchmark in report)
router.get('/', async (req, res) => {
  try {
    let settings = await CompanySettings.findOne({ key: 'singleton' });
    if (!settings) {
      settings = await CompanySettings.create({ key: 'singleton' });
    }
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/company-settings — admin only
router.put('/', adminOnly, async (req, res) => {
  try {
    const { companyName, logo, expectedClockIn, expectedHoursPerDay, expectedDaysPerWeek } = req.body;
    const update = {};
    if (companyName !== undefined)         update.companyName         = companyName;
    if (logo !== undefined)                update.logo                = logo;
    if (expectedClockIn !== undefined)     update.expectedClockIn     = expectedClockIn;
    if (expectedHoursPerDay !== undefined) update.expectedHoursPerDay = expectedHoursPerDay;
    if (expectedDaysPerWeek !== undefined) update.expectedDaysPerWeek = expectedDaysPerWeek;

    const settings = await CompanySettings.findOneAndUpdate(
      { key: 'singleton' },
      { $set: update },
      { upsert: true, new: true }
    );
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
