const express = require('express');
const Lead = require('../models/Lead');
const { protect } = require('../middleware/auth');

const router = express.Router();

// GET /api/leads
router.get('/', protect, async (req, res) => {
  try {
    const { status, search } = req.query;
    const filter = {};
    if (status && status !== 'all') filter.status = status;
    if (search) filter.contactName = { $regex: search, $options: 'i' };

    const leads = await Lead.find(filter)
      .populate('loggedBy', 'name')
      .sort({ createdAt: -1 });
    res.json(leads);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/leads
router.post('/', protect, async (req, res) => {
  try {
    const {
      contactName, company, email, phone,
      roomType, numRooms, checkIn, checkOut,
      rateOffered, status, source, notes,
    } = req.body;

    if (!contactName) return res.status(400).json({ message: 'Contact name is required' });

    const lead = await Lead.create({
      contactName, company, email, phone,
      roomType, numRooms,
      checkIn: checkIn || null,
      checkOut: checkOut || null,
      rateOffered: rateOffered || null,
      status: status || 'new',
      source, notes,
      loggedBy: req.user._id,
    });

    res.status(201).json(lead);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/leads/:id
router.put('/:id', protect, async (req, res) => {
  try {
    const lead = await Lead.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    res.json(lead);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/leads/:id
router.delete('/:id', protect, async (req, res) => {
  try {
    const lead = await Lead.findByIdAndDelete(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
