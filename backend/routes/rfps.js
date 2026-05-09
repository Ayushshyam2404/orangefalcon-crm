const express = require('express');
const RFP = require('../models/RFP');
const { protect } = require('../middleware/auth');

const router = express.Router();

// GET /api/rfps - get all RFPs
router.get('/', protect, async (req, res) => {
  try {
    const { status, priority, search, consideration, all } = req.query;
    let filter = {};
    if (status && status !== 'all') filter.status = status;
    if (priority === 'true') filter.priority = true;
    if (search) filter.client = { $regex: search, $options: 'i' };
    // Only apply consideration filter when explicitly requested (not when fetching all for dashboard)
    if (all !== 'true') {
      if (consideration === 'true') filter.inConsideration = true;
      if (consideration === 'false') filter.inConsideration = { $ne: true };
    }

    const rfps = await RFP.find(filter)
      .populate('addedBy', 'name username')
      .populate('hotel', 'name city')
      .sort({ priority: -1, createdAt: -1 });
    res.json(rfps);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/rfps - create RFP
router.post('/', protect, async (req, res) => {
  try {
    const { client, hotel, checkin, checkout, price, status, notes, priority } = req.body;
    if (!client || !hotel) return res.status(400).json({ message: 'Client name and hotel are required' });

    const rfp = await RFP.create({
      client, hotel, checkin, checkout, price, status, notes, priority,
      addedBy: req.user._id,
    });
    const populated = await rfp.populate([
      { path: 'addedBy', select: 'name username' },
      { path: 'hotel', select: 'name city' }
    ]);
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/rfps/:id - update RFP
router.put('/:id', protect, async (req, res) => {
  try {
    const rfp = await RFP.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
      .populate([
        { path: 'addedBy', select: 'name username' },
        { path: 'hotel', select: 'name city' }
      ]);
    if (!rfp) return res.status(404).json({ message: 'RFP not found' });
    res.json(rfp);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/rfps/:id
router.delete('/:id', protect, async (req, res) => {
  try {
    const rfp = await RFP.findByIdAndDelete(req.params.id);
    if (!rfp) return res.status(404).json({ message: 'RFP not found' });
    res.json({ message: 'RFP deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
