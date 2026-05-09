const express = require('express');
const HotelScore = require('../models/HotelScore');
const { protect } = require('../middleware/auth');

const router = express.Router();

// GET /api/hotel-scores
router.get('/', protect, async (req, res) => {
  try {
    const { hotel } = req.query;
    const filter = hotel ? { hotel } : {};
    const scores = await HotelScore.find(filter)
      .populate('hotel', 'name city')
      .populate('createdBy', 'name username')
      .sort({ date: -1 });
    res.json(scores);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/hotel-scores
router.post('/', protect, async (req, res) => {
  try {
    const { hotel, date, score, notes } = req.body;
    if (!hotel || !date || score == null) {
      return res.status(400).json({ message: 'Hotel, date, and score are required' });
    }
    if (typeof score !== 'number' || isNaN(score)) {
      return res.status(400).json({ message: 'Score must be a number' });
    }
    if (score < 0 || score > 100) {
      return res.status(400).json({ message: 'Score must be between 0 and 100' });
    }
    const entry = await HotelScore.create({
      hotel,
      date,
      score,
      notes: notes || '',
      createdBy: req.user._id,
    });
    const populated = await entry.populate([
      { path: 'hotel', select: 'name city' },
      { path: 'createdBy', select: 'name username' },
    ]);
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/hotel-scores/:id
router.put('/:id', protect, async (req, res) => {
  try {
    const { hotel, date, score, notes } = req.body;
    if (score != null && (score < 0 || score > 100)) {
      return res.status(400).json({ message: 'Score must be between 0 and 100' });
    }
    const entry = await HotelScore.findByIdAndUpdate(
      req.params.id,
      { hotel, date, score, notes },
      { new: true, runValidators: true }
    )
      .populate('hotel', 'name city')
      .populate('createdBy', 'name username');
    if (!entry) return res.status(404).json({ message: 'Score not found' });
    res.json(entry);
  } catch (err) {
    if (err.name === 'CastError') return res.status(400).json({ message: 'Invalid ID format' });
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/hotel-scores/:id
router.delete('/:id', protect, async (req, res) => {
  try {
    const entry = await HotelScore.findByIdAndDelete(req.params.id);
    if (!entry) return res.status(404).json({ message: 'Score not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    if (err.name === 'CastError') return res.status(400).json({ message: 'Invalid ID format' });
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
