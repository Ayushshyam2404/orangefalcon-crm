const express = require('express');
const Hotel = require('../models/Hotel');
const { protect } = require('../middleware/auth');
const { permissionFor } = require('../config/permissions');

const router = express.Router();

const hotelWrite = async (req, res, next) => {
  try {
    let category = req.body?.category || req.query?.category;
    if (!category && req.params.id) {
      if (!Hotel.db.base.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ message: 'Invalid ID format' });
      category = (await Hotel.findById(req.params.id).select('category').lean())?.category;
    }
    const module = category === 'reputation' ? 'hotelScores' : 'hotels';
    if (!permissionFor(req.user, module).write) {
      return res.status(403).json({ message: 'Admin or configured write access is required' });
    }
    return next();
  } catch (err) {
    return next(err);
  }
};

// GET /api/hotels - get all hotels (optionally filtered by ?category=sales|reputation)
router.get('/', protect, async (req, res) => {
  try {
    const filter = {}
    if (req.query.category) filter.category = req.query.category
    const hotels = await Hotel.find(filter)
      .populate('createdBy', 'name username')
      .sort({ name: 1 });
    res.json(hotels);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/hotels - create hotel (admin only)
router.post('/', protect, hotelWrite, async (req, res) => {
  try {
    const { name, city, category, photo } = req.body;
    if (!name || !city) {
      return res.status(400).json({ message: 'Hotel name and city are required' });
    }

    const hotel = await Hotel.create({
      name,
      city,
      category: category || 'sales',
      photo: photo || '',
      createdBy: req.user._id,
    });
    const populated = await hotel.populate('createdBy', 'name username');
    res.status(201).json(populated);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'A hotel with this name already exists in this category' });
    }
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/hotels/:id - update hotel (admin only)
router.put('/:id', protect, hotelWrite, async (req, res) => {
  try {
    const hotel = await Hotel.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).populate('createdBy', 'name username');
    if (!hotel) return res.status(404).json({ message: 'Hotel not found' });
    res.json(hotel);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Hotel name already exists' });
    }
    if (err.name === 'CastError') return res.status(400).json({ message: 'Invalid ID format' });
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/hotels/:id - delete hotel (admin only)
router.delete('/:id', protect, hotelWrite, async (req, res) => {
  try {
    const hotel = await Hotel.findByIdAndDelete(req.params.id);
    if (!hotel) return res.status(404).json({ message: 'Hotel not found' });
    res.json({ message: 'Hotel deleted' });
  } catch (err) {
    if (err.name === 'CastError') return res.status(400).json({ message: 'Invalid ID format' });
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
