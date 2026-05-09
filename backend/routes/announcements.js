const express = require('express');
const router = express.Router();
const Announcement = require('../models/Announcement');
const { protect, adminOnly } = require('../middleware/auth');

// All routes require auth
router.use(protect);

// GET /api/announcements — all announcements, newest first (all authenticated users)
router.get('/', async (req, res) => {
  try {
    const announcements = await Announcement.find()
      .populate('author', 'name role')
      .sort({ noticeDate: -1, createdAt: -1 });
    res.json(announcements);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/announcements — create (admin only)
router.post('/', adminOnly, async (req, res) => {
  try {
    const { heading, noticeDate, body, priority } = req.body;
    if (!heading || !noticeDate || !body)
      return res.status(400).json({ message: 'Heading, date, and body are required' });

    const announcement = await Announcement.create({
      heading: heading.trim(),
      noticeDate: new Date(noticeDate),
      body: body.trim(),
      priority: priority || 'normal',
      author: req.user._id,
    });
    const populated = await announcement.populate('author', 'name role');
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/announcements/:id — edit (admin only)
router.put('/:id', adminOnly, async (req, res) => {
  try {
    const { heading, noticeDate, body, priority } = req.body;
    const announcement = await Announcement.findByIdAndUpdate(
      req.params.id,
      {
        ...(heading     && { heading: heading.trim() }),
        ...(noticeDate  && { noticeDate: new Date(noticeDate) }),
        ...(body        && { body: body.trim() }),
        ...(priority    && { priority }),
      },
      { new: true }
    ).populate('author', 'name role');
    if (!announcement) return res.status(404).json({ message: 'Announcement not found' });
    res.json(announcement);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/announcements/:id — delete (admin only)
router.delete('/:id', adminOnly, async (req, res) => {
  try {
    const a = await Announcement.findByIdAndDelete(req.params.id);
    if (!a) return res.status(404).json({ message: 'Announcement not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
