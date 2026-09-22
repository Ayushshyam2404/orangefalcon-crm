const express = require('express');
const CompanySettings = require('../models/CompanySettings');
const InactivityWarning = require('../models/InactivityWarning');
const User = require('../models/User');
const Alert = require('../models/Alert');
const { protect, masterOnly } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

router.get('/config', async (req, res) => {
  const settings = await CompanySettings.findOne({ key: 'singleton' }).lean();
  res.json({
    inactivityMinutes: settings?.inactivityMinutes || 5,
    inactivityWarningLimit: settings?.inactivityWarningLimit || 3,
  });
});

router.post('/heartbeat', async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, { lastActivityAt: new Date() });
  res.json({ ok: true });
});

router.post('/warning', async (req, res) => {
  const settings = await CompanySettings.findOne({ key: 'singleton' }).lean();
  const minimum = (settings?.inactivityMinutes || 5) * 60;
  const inactiveSeconds = Math.max(0, Number(req.body.inactiveSeconds) || 0);
  if (inactiveSeconds < minimum) return res.status(400).json({ message: 'Inactivity threshold has not been reached' });

  const date = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const warning = await InactivityWarning.create({ user: req.user._id, inactiveSeconds, date });
  const user = await User.findByIdAndUpdate(req.user._id, { $inc: { inactivityWarnings: 1 } }, { new: true });
  await Alert.create({
    message: `${user.name} was inactive for ${Math.floor(inactiveSeconds / 60)} minutes`,
    type: 'Inactivity Warning',
    iconType: 'warn',
  });
  res.status(201).json({
    warning,
    warningCount: user.inactivityWarnings,
    warningLimit: settings?.inactivityWarningLimit || 3,
  });
});

router.patch('/:id/acknowledge', async (req, res) => {
  const warning = await InactivityWarning.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    { acknowledgedAt: new Date() },
    { new: true }
  );
  if (!warning) return res.status(404).json({ message: 'Warning not found' });
  res.json(warning);
});

router.get('/admin', masterOnly, async (req, res) => {
  const warnings = await InactivityWarning.find()
    .populate('user', 'name username department title avatar')
    .sort({ createdAt: -1 })
    .limit(500);
  res.json(warnings);
});

module.exports = router;
