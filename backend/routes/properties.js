const express = require('express');
const Hotel = require('../models/Hotel');
const RFP = require('../models/RFP');
const Group = require('../models/Group');
const Call = require('../models/Call');
const HotelScore = require('../models/HotelScore');
const { protect } = require('../middleware/auth');

const router = express.Router();

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// GET /api/properties - one row per physical property, merging the sales-category
// and reputation-category Hotel records that share a name (they're separate
// documents — see Hotel.js's { name, category } unique index).
router.get('/', protect, async (req, res) => {
  try {
    const hotels = await Hotel.find().sort({ name: 1 });
    const byKey = new Map();

    for (const h of hotels) {
      const key = h.name.trim().toLowerCase();
      if (!byKey.has(key)) {
        byKey.set(key, {
          name: h.name,
          city: h.city,
          photo: h.photo || '',
          hasSales: false,
          hasReputation: false,
        });
      }
      const entry = byKey.get(key);
      if (h.category === 'sales') entry.hasSales = true;
      if (h.category === 'reputation') entry.hasReputation = true;
      if (!entry.photo && h.photo) entry.photo = h.photo;
      if (!entry.city && h.city) entry.city = h.city;
    }

    const properties = Array.from(byKey.values()).sort((a, b) => a.name.localeCompare(b.name));
    res.json(properties);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/properties/detail?name=... - full sales + reputation snapshot for one property
router.get('/detail', protect, async (req, res) => {
  try {
    const { name } = req.query;
    if (!name) return res.status(400).json({ message: 'name is required' });

    const hotels = await Hotel.find({ name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' } });
    if (hotels.length === 0) return res.status(404).json({ message: 'Property not found' });

    const salesHotel = hotels.find((h) => h.category === 'sales');
    const repHotel = hotels.find((h) => h.category === 'reputation');
    const photo = salesHotel?.photo || repHotel?.photo || '';
    const city = salesHotel?.city || repHotel?.city || '';

    let sales = null;
    if (salesHotel) {
      const [rfps, groups, calls] = await Promise.all([
        RFP.find({ hotel: salesHotel._id }).populate('addedBy', 'name').sort({ createdAt: -1 }),
        Group.find({ hotel: salesHotel._id }).populate('loggedBy', 'name').sort({ checkIn: -1 }),
        Call.find({ hotel: salesHotel._id, category: 'sales' }).sort({ createdAt: -1 }),
      ]);

      const rfpsByStatus = {};
      let wonRevenue = 0;
      for (const r of rfps) {
        rfpsByStatus[r.status] = (rfpsByStatus[r.status] || 0) + 1;
        if (r.status === 'Won' && r.price) wonRevenue += r.price;
      }

      const totalGroupRevenue = groups.reduce(
        (s, g) => s + (g.numRoomNights && g.rate ? g.numRoomNights * g.rate : 0), 0
      );
      const totalRoomNights = groups.reduce((s, g) => s + (g.numRoomNights || 0), 0);

      const callsByOutcome = {};
      for (const c of calls) callsByOutcome[c.outcome] = (callsByOutcome[c.outcome] || 0) + 1;

      sales = {
        hotelId: salesHotel._id,
        totalRFPs: rfps.length,
        rfpsByStatus,
        wonRevenue,
        totalGroups: groups.length,
        totalGroupRevenue,
        totalRoomNights,
        totalCalls: calls.length,
        callsByOutcome,
        recentRfps: rfps.slice(0, 6).map((r) => ({
          _id: r._id, client: r.client, status: r.status, checkin: r.checkin,
          checkout: r.checkout, price: r.price, addedBy: r.addedBy?.name,
        })),
        recentGroups: groups.slice(0, 6).map((g) => ({
          _id: g._id, groupName: g.groupName, checkIn: g.checkIn, checkOut: g.checkOut,
          numRooms: g.numRooms, type: g.type, loggedBy: g.loggedBy?.name,
        })),
      };
    }

    let reputation = null;
    if (repHotel) {
      const scores = await HotelScore.find({ hotel: repHotel._id }).populate('createdBy', 'name').sort({ date: -1 });
      const avgScore = scores.length
        ? Math.round((scores.reduce((s, x) => s + x.score, 0) / scores.length) * 10) / 10
        : null;

      reputation = {
        hotelId: repHotel._id,
        totalEntries: scores.length,
        avgScore,
        latestScore: scores[0]?.score ?? null,
        latestDate: scores[0]?.date ?? null,
        recentScores: scores.slice(0, 10).map((s) => ({
          _id: s._id, date: s.date, score: s.score, notes: s.notes, createdBy: s.createdBy?.name,
        })),
      };
    }

    res.json({
      name: salesHotel?.name || repHotel?.name,
      city,
      photo,
      hasSales: !!salesHotel,
      hasReputation: !!repHotel,
      sales,
      reputation,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
