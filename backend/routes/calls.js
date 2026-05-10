const express = require('express');
const Call = require('../models/Call');
const { protect } = require('../middleware/auth');

const router = express.Router();

// GET /api/calls
router.get('/', protect, async (req, res) => {
  try {
    const { outcome, search, category } = req.query;
    let filter = {};
    if (outcome && outcome !== 'all') filter.outcome = outcome;
    if (search) filter.name = { $regex: search, $options: 'i' };
    if (category) filter.category = category;

    const calls = await Call.find(filter)
      .populate('loggedBy', 'name username')
      .sort({ createdAt: -1 });
    res.json(calls);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/calls
router.post('/', protect, async (req, res) => {
  try {
    const { name, phone, outcome, notes, category } = req.body;
    if (!name) return res.status(400).json({ message: 'Prospect name is required' });

    const call = await Call.create({ name, phone, outcome, notes, category: category || 'sales', loggedBy: req.user._id });
    const populated = await call.populate('loggedBy', 'name username');
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/calls/:id
router.put('/:id', protect, async (req, res) => {
  try {
    const call = await Call.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
      .populate('loggedBy', 'name username');
    if (!call) return res.status(404).json({ message: 'Call not found' });
    res.json(call);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/calls/:id
router.delete('/:id', protect, async (req, res) => {
  try {
    const call = await Call.findByIdAndDelete(req.params.id);
    if (!call) return res.status(404).json({ message: 'Call not found' });
    res.json({ message: 'Call deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
