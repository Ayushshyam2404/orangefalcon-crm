const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const { protect } = require('../middleware/auth');

router.use(protect);

// GET /api/events?month=YYYY-MM  — fetch all events (or filter by month)
router.get('/', async (req, res) => {
  try {
    const { month } = req.query; // e.g. "2026-04"
    const filter = {};
    if (month) {
      const [y, m] = month.split('-').map(Number);
      filter.date = {
        $gte: new Date(y, m - 1, 1),
        $lt: new Date(y, m, 1),
      };
    }
    const events = await Event.find(filter)
      .populate('createdBy', 'name')
      .sort({ date: 1 });
    res.json(events);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/events/upcoming — next 5 events from today
router.get('/upcoming', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const events = await Event.find({ date: { $gte: today } })
      .populate('createdBy', 'name')
      .sort({ date: 1 })
      .limit(5);
    res.json(events);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/events
router.post('/', async (req, res) => {
  try {
    const { name, date, notes } = req.body;
    if (!name || !date) return res.status(400).json({ message: 'Name and date are required' });
    const event = await Event.create({ name, date, notes, createdBy: req.user._id });
    res.status(201).json(event);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/events/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, date, notes } = req.body;
    const event = await Event.findByIdAndUpdate(
      req.params.id,
      { name, date, notes },
      { new: true, runValidators: true }
    ).populate('createdBy', 'name');
    if (!event) return res.status(404).json({ message: 'Event not found' });
    res.json(event);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/events/:id
router.delete('/:id', async (req, res) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
