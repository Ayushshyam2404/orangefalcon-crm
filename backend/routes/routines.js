const express = require('express');
const RoutineItem = require('../models/RoutineItem');
const { protect } = require('../middleware/auth');

const router = express.Router();

// GET /api/routines — get current user's routine template
router.get('/', protect, async (req, res) => {
  try {
    const { category } = req.query;
    const filter = { user: req.user._id };
    if (category) filter.category = category;
    const items = await RoutineItem.find(filter).sort({ order: 1, createdAt: 1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/routines — add a new routine item
router.post('/', protect, async (req, res) => {
  try {
    const { taskName, defaultNote, category } = req.body;
    if (!taskName || !taskName.trim()) return res.status(400).json({ message: 'Task name is required' });
    const cat = category || 'sales';
    const count = await RoutineItem.countDocuments({ user: req.user._id, category: cat });
    const item = await RoutineItem.create({
      user: req.user._id,
      taskName: taskName.trim(),
      defaultNote: defaultNote ? defaultNote.trim() : '',
      order: count,
      category: cat,
    });
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/routines/:id — update a routine item
router.put('/:id', protect, async (req, res) => {
  try {
    const { taskName, defaultNote, order } = req.body;
    const item = await RoutineItem.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { taskName, defaultNote, order },
      { new: true, runValidators: true }
    );
    if (!item) return res.status(404).json({ message: 'Routine item not found' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/routines/:id — delete a routine item
router.delete('/:id', protect, async (req, res) => {
  try {
    const item = await RoutineItem.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!item) return res.status(404).json({ message: 'Routine item not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
