const express = require('express');
const Call = require('../models/Call');
const Hotel = require('../models/Hotel');
const { protect } = require('../middleware/auth');
const { permissionFor } = require('../config/permissions');

const router = express.Router();
const canWriteCall = (req, call) => permissionFor(req.user, call.category === 'reputation' ? 'reputationCalls' : 'calls').write;

// GET /api/calls
router.get('/', protect, async (req, res) => {
  try {
    const { outcome, search, category, status } = req.query;
    let filter = {};
    if (outcome && outcome !== 'all') filter.outcome = outcome;
    if (status && status !== 'all') filter.status = status;
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(escaped, 'i');
      filter.$or = [{ name: re }, { phone: re }, { notes: re }];
    }
    if (category) filter.category = category;

    const calls = await Call.find(filter)
      .populate('loggedBy', 'name username')
      .populate('importedBy', 'name username')
      .populate('hotel', 'name city')
      .sort({ createdAt: -1 });
    res.json(calls);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/calls
router.post('/', protect, async (req, res) => {
  try {
    const { name, phone, outcome, notes, category, hotel } = req.body;
    if (!name) return res.status(400).json({ message: 'Prospect name is required' });

    const call = await Call.create({
      name,
      phone,
      outcome,
      notes,
      category: category || 'sales',
      hotel: hotel || null,
      status: 'completed',
      loggedBy: req.user._id,
      calledAt: new Date(),
    });
    const populated = await call.populate([
      { path: 'loggedBy', select: 'name username' },
      { path: 'hotel', select: 'name city' },
    ]);
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/calls/leads - add one lead to the ready-to-call queue
router.post('/leads', protect, async (req, res) => {
  try {
    const { name, phone, category = 'sales', hotel } = req.body;
    const leadName = String(name || '').trim();
    const leadPhone = String(phone || '').trim();
    if (!leadName || !leadPhone || !hotel) {
      return res.status(400).json({ message: 'Lead name, phone number, and hotel are required' });
    }

    if (!Hotel.db.base.Types.ObjectId.isValid(hotel)) {
      return res.status(400).json({ message: 'Select a valid hotel for this call type' });
    }
    const matchingHotel = await Hotel.findOne({ _id: hotel, category });
    if (!matchingHotel) return res.status(400).json({ message: 'Select a valid hotel for this call type' });

    const pendingAtHotel = await Call.find({ category, hotel: matchingHotel._id, status: 'pending' }).select('phone').lean();
    const phoneKey = leadPhone.replace(/\D/g, '') || leadPhone.toLowerCase();
    const duplicate = pendingAtHotel.some((item) => {
      const existingKey = String(item.phone || '').replace(/\D/g, '') || String(item.phone || '').trim().toLowerCase();
      return existingKey === phoneKey;
    });
    if (duplicate) return res.status(409).json({ message: 'This phone number is already waiting in the queue for that hotel' });

    const lead = await Call.create({
      name: leadName,
      phone: leadPhone,
      category,
      hotel: matchingHotel._id,
      status: 'pending',
      outcome: null,
      source: 'manual',
      importedBy: req.user._id,
    });
    const populated = await lead.populate([
      { path: 'importedBy', select: 'name username' },
      { path: 'hotel', select: 'name city' },
    ]);
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/calls/import - validate and import spreadsheet rows in one batch
router.post('/import', protect, async (req, res) => {
  try {
    const { rows, category = 'sales' } = req.body;
    if (!['sales', 'reputation'].includes(category)) {
      return res.status(400).json({ message: 'Invalid call category' });
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ message: 'No lead rows were provided' });
    }
    if (rows.length > 5000) {
      return res.status(400).json({ message: 'Import up to 5,000 leads at a time' });
    }

    const hotels = await Hotel.find({ category }).select('_id name city').lean();
    const hotelByName = new Map(hotels.map((hotel) => [hotel.name.trim().toLowerCase(), hotel]));
    const errors = [];
    const candidates = [];
    const seenInFile = new Set();

    rows.forEach((row, index) => {
      const rowNumber = Number(row.rowNumber) || index + 2;
      const name = String(row.name || '').trim();
      const phone = String(row.phone || '').trim();
      const hotelName = String(row.hotel || '').trim();
      const hotel = hotelByName.get(hotelName.toLowerCase());
      const missing = [!name && 'lead name', !phone && 'phone number', !hotelName && 'hotel'].filter(Boolean);

      if (missing.length) {
        errors.push({ row: rowNumber, reason: `Missing ${missing.join(', ')}` });
        return;
      }
      if (!hotel) {
        errors.push({ row: rowNumber, reason: `Hotel “${hotelName}” is not in the ${category} hotel list` });
        return;
      }

      const phoneKey = phone.replace(/\D/g, '') || phone.toLowerCase();
      const key = `${hotel._id}:${phoneKey}`;
      if (seenInFile.has(key)) {
        errors.push({ row: rowNumber, reason: 'Duplicate phone and hotel in this file' });
        return;
      }
      seenInFile.add(key);
      candidates.push({ rowNumber, name, phone, phoneKey, hotel });
    });

    const hotelIds = [...new Set(candidates.map((item) => String(item.hotel._id)))];
    const existing = candidates.length
      ? await Call.find({ category, status: 'pending', hotel: { $in: hotelIds } }).select('phone hotel').lean()
      : [];
    const existingKeys = new Set(existing.map((item) => {
      const phoneKey = String(item.phone || '').replace(/\D/g, '') || String(item.phone || '').toLowerCase();
      return `${item.hotel}:${phoneKey}`;
    }));

    const batchId = `IMP-${Date.now().toString(36).toUpperCase()}`;
    const documents = [];
    let duplicates = 0;
    candidates.forEach((item) => {
      const key = `${item.hotel._id}:${item.phoneKey}`;
      if (existingKeys.has(key)) {
        duplicates += 1;
        return;
      }
      documents.push({
        name: item.name,
        phone: item.phone,
        hotel: item.hotel._id,
        category,
        status: 'pending',
        outcome: null,
        source: 'import',
        importBatch: batchId,
        importedBy: req.user._id,
      });
    });

    if (documents.length) await Call.insertMany(documents);
    res.status(201).json({
      imported: documents.length,
      duplicates,
      rejected: errors.length,
      errors: errors.slice(0, 100),
      batchId: documents.length ? batchId : null,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/calls/:id/outcome - the fast path employees use after a call
router.patch('/:id/outcome', protect, async (req, res) => {
  try {
    const { outcome, notes = '', followUpDone = false } = req.body;
    const allowedOutcomes = ['Connected', 'Voicemail', 'No Answer', 'Interested', 'Not Interested'];
    if (!allowedOutcomes.includes(outcome)) {
      return res.status(400).json({ message: 'Select a valid call outcome' });
    }

    const call = await Call.findById(req.params.id);
    if (!call) return res.status(404).json({ message: 'Call lead not found' });
    if (!canWriteCall(req, call)) return res.status(403).json({ message: 'Write access to this call area is required' });
    const wasPending = call.status === 'pending';
    call.outcome = outcome;
    call.notes = String(notes || '').trim();
    call.followUpDone = Boolean(followUpDone);
    call.status = 'completed';
    if (wasPending || !call.loggedBy) call.loggedBy = req.user._id;
    if (wasPending || !call.calledAt) call.calledAt = new Date();
    await call.save();

    await call.populate([
      { path: 'loggedBy', select: 'name username' },
      { path: 'importedBy', select: 'name username' },
      { path: 'hotel', select: 'name city' },
    ]);
    res.json(call);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/calls/:id
router.put('/:id', protect, async (req, res) => {
  try {
    const existing = await Call.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Call not found' });
    if (!canWriteCall(req, existing)) return res.status(403).json({ message: 'Write access to this call area is required' });
    const call = await Call.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
      .populate('loggedBy', 'name username')
      .populate('importedBy', 'name username')
      .populate('hotel', 'name city');
    if (!call) return res.status(404).json({ message: 'Call not found' });
    res.json(call);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/calls/:id
router.delete('/:id', protect, async (req, res) => {
  try {
    const existing = await Call.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Call not found' });
    if (!canWriteCall(req, existing)) return res.status(403).json({ message: 'Write access to this call area is required' });
    const call = await Call.findByIdAndDelete(req.params.id);
    if (!call) return res.status(404).json({ message: 'Call not found' });
    res.json({ message: 'Call deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
