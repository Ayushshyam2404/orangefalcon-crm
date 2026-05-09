const express = require('express');
const router = express.Router();
const CorporateProfile = require('../models/CorporateProfile');
const { protect } = require('../middleware/auth');

// All routes require auth
router.use(protect);

// GET /api/corporate  — list with optional search
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    const filter = {};
    if (search) {
      const re = new RegExp(search, 'i');
      filter.$or = [{ name: re }, { company: re }, { email: re }, { phone: re }];
    }
    const profiles = await CorporateProfile.find(filter)
      .populate('loggedBy', 'name')
      .sort({ company: 1, name: 1 });
    res.json(profiles);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/corporate
router.post('/', async (req, res) => {
  try {
    const { name, company, phone, email, ccNumber, ccExpiry, notes } = req.body;
    if (!name || !company) return res.status(400).json({ message: 'Name and company are required' });
    const profile = await CorporateProfile.create({
      name, company, phone, email, ccNumber, ccExpiry, notes,
      loggedBy: req.user._id,
    });
    res.status(201).json(profile);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/corporate/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, company, phone, email, ccNumber, ccExpiry, notes } = req.body;
    const profile = await CorporateProfile.findByIdAndUpdate(
      req.params.id,
      { name, company, phone, email, ccNumber, ccExpiry, notes },
      { new: true, runValidators: true }
    ).populate('loggedBy', 'name');
    if (!profile) return res.status(404).json({ message: 'Profile not found' });
    res.json(profile);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/corporate/:id
router.delete('/:id', async (req, res) => {
  try {
    const profile = await CorporateProfile.findByIdAndDelete(req.params.id);
    if (!profile) return res.status(404).json({ message: 'Profile not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
