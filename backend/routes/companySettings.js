const express = require('express');
const router = express.Router();
const CompanySettings = require('../models/CompanySettings');
const { protect, requireAnyPermission } = require('../middleware/auth');
const { permissionFor } = require('../config/permissions');

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
router.get('/', requireAnyPermission(['companySettings', 'reportRecipients', 'employeeBehaviour', 'dailyReports']), async (req, res) => {
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
router.put('/', async (req, res) => {
  try {
    const { companyName, logo, expectedClockIn, expectedHoursPerDay, expectedDaysPerWeek, reportRecipients, inactivityMinutes, inactivityWarningLimit } = req.body;
    const update = {};
    const updatesRecipients = Array.isArray(reportRecipients);
    const updatesCompany = [companyName, logo, expectedClockIn, expectedHoursPerDay, expectedDaysPerWeek, inactivityMinutes, inactivityWarningLimit].some(value => value !== undefined);
    if (updatesRecipients && !permissionFor(req.user, 'reportRecipients').write) return res.status(403).json({ message: 'Write access to report recipients is required' });
    if (updatesCompany && !permissionFor(req.user, 'companySettings').write) return res.status(403).json({ message: 'Write access to company settings is required' });
    if (!updatesRecipients && !updatesCompany) return res.status(400).json({ message: 'No supported settings were provided' });
    if (companyName !== undefined)         update.companyName         = companyName;
    if (logo !== undefined)                update.logo                = logo;
    if (expectedClockIn !== undefined)     update.expectedClockIn     = expectedClockIn;
    if (expectedHoursPerDay !== undefined) update.expectedHoursPerDay = expectedHoursPerDay;
    if (expectedDaysPerWeek !== undefined) update.expectedDaysPerWeek = expectedDaysPerWeek;
    if (Array.isArray(reportRecipients))   update.reportRecipients    = reportRecipients;
    if (inactivityMinutes !== undefined || inactivityWarningLimit !== undefined) {
      if (!req.user.isMaster) return res.status(403).json({ message: 'Only the master can change inactivity settings' });
      if (inactivityMinutes !== undefined) update.inactivityMinutes = inactivityMinutes;
      if (inactivityWarningLimit !== undefined) update.inactivityWarningLimit = inactivityWarningLimit;
    }

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
