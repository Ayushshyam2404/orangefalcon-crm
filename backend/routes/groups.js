const express = require('express');
const Group = require('../models/Group');
const { protect } = require('../middleware/auth');

const router = express.Router();

// GET /api/groups
router.get('/', protect, async (req, res) => {
  try {
    const { hotel, search, type } = req.query;
    let filter = {};
    if (hotel && hotel !== 'all') filter.hotel = hotel;
    if (type && type !== 'all') filter.type = type;
    if (search) filter.groupName = { $regex: search, $options: 'i' };

    const groups = await Group.find(filter)
      .populate('hotel', 'name city')
      .populate('loggedBy', 'name username')
      .sort({ checkIn: -1 });
    res.json(groups);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/groups
router.post('/', protect, async (req, res) => {
  try {
    const {
      groupName,
      hotel,
      checkIn,
      checkOut,
      rate,
      numRooms,
      type,
      creditCardNumber,
      cardExpDate,
      roomBanquet,
      banquetCheckInTime,
      banquetCheckOutTime,
      notes,
    } = req.body;

    if (!groupName || !hotel || !checkIn || !checkOut || !type || !roomBanquet) {
      return res.status(400).json({
        message: 'Group name, hotel, check-in, check-out, type, and room/banquet selection are required',
      });
    }

    const group = await Group.create({
      groupName,
      hotel,
      checkIn,
      checkOut,
      rate: rate || null,
      numRooms: numRooms || null,
      type,
      creditCardNumber: creditCardNumber || 'Not available',
      cardExpDate: cardExpDate || 'Not available',
      roomBanquet,
      banquetCheckIn: checkIn,
      banquetCheckOut: checkOut,
      banquetCheckInTime: banquetCheckInTime || 'Not available',
      banquetCheckOutTime: banquetCheckOutTime || 'Not available',
      notes: notes || '',
      loggedBy: req.user._id,
    });

    const populated = await group.populate([
      { path: 'hotel', select: 'name city' },
      { path: 'loggedBy', select: 'name username' },
    ]);

    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/groups/:id
router.put('/:id', protect, async (req, res) => {
  try {
    const group = await Group.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
      .populate([
        { path: 'hotel', select: 'name city' },
        { path: 'loggedBy', select: 'name username' },
      ]);

    if (!group) return res.status(404).json({ message: 'Group not found' });
    res.json(group);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/groups/:id
router.delete('/:id', protect, async (req, res) => {
  try {
    const group = await Group.findByIdAndDelete(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    res.json({ message: 'Group deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
