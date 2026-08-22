const express = require('express');
const RFP = require('../models/RFP');
const Call = require('../models/Call');
const Lead = require('../models/Lead');
const CorporateProfile = require('../models/CorporateProfile');
const HotelScore = require('../models/HotelScore');
const Hotel = require('../models/Hotel');
const Group = require('../models/Group');
const Task = require('../models/Task');
const Announcement = require('../models/Announcement');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

// Escape user input before dropping it into a RegExp
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function searchRfps(re, limit) {
  const rows = await RFP.find({ $or: [{ client: re }, { notes: re }] })
    .populate('hotel', 'name city')
    .sort({ createdAt: -1 })
    .limit(limit);
  return rows.map((r) => ({
    type: 'rfps',
    id: r._id,
    title: r.client,
    subtitle: `${r.hotel?.name || 'No hotel'} · ${r.status}${r.priority ? ' · PRIORITY' : ''}`,
    path: r.inConsideration ? '/rfps-consideration' : '/rfps',
  }));
}

async function searchCalls(re, limit) {
  const rows = await Call.find({ $or: [{ name: re }, { phone: re }, { notes: re }] })
    .populate('hotel', 'name city')
    .sort({ createdAt: -1 })
    .limit(limit);
  return rows.map((c) => ({
    type: 'calls',
    id: c._id,
    title: c.name,
    subtitle: `${c.phone || 'No phone'} · ${c.outcome}`,
    path: c.category === 'reputation' ? '/reputation-calls' : '/calls',
  }));
}

async function searchLeads(re, limit) {
  const rows = await Lead.find({ $or: [{ contactName: re }, { company: re }, { email: re }, { phone: re }] })
    .populate('hotel', 'name')
    .sort({ createdAt: -1 })
    .limit(limit);
  return rows.map((l) => ({
    type: 'leads',
    id: l._id,
    title: l.contactName,
    subtitle: `${l.company || 'No company'} · ${l.status}`,
    path: '/leads',
  }));
}

async function searchCorporate(re, limit) {
  const rows = await CorporateProfile.find({ $or: [{ name: re }, { company: re }, { email: re }, { phone: re }] })
    .sort({ company: 1 })
    .limit(limit);
  return rows.map((p) => ({
    type: 'corporate',
    id: p._id,
    title: p.name,
    subtitle: p.company,
    path: '/corporate',
  }));
}

async function searchScores(re, limit) {
  const hotels = await Hotel.find({ name: re }).select('_id');
  if (hotels.length === 0) return [];
  const rows = await HotelScore.find({ hotel: { $in: hotels.map((h) => h._id) } })
    .populate('hotel', 'name city')
    .sort({ date: -1 })
    .limit(limit);
  return rows.map((s) => ({
    type: 'scores',
    id: s._id,
    title: s.hotel?.name || 'Unknown hotel',
    subtitle: `Score ${s.score} · ${new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
    path: '/hotel-scores',
  }));
}

async function searchGroups(re, limit) {
  const rows = await Group.find({ groupName: re })
    .populate('hotel', 'name city')
    .sort({ checkIn: -1 })
    .limit(limit);
  return rows.map((g) => ({
    type: 'groups',
    id: g._id,
    title: g.groupName,
    subtitle: `${g.hotel?.name || 'No hotel'} · ${g.type}`,
    path: '/groups',
  }));
}

async function searchTasks(re, limit) {
  const rows = await Task.find({ taskName: re }).sort({ deadline: -1 }).limit(limit);
  return rows.map((t) => ({
    type: 'tasks',
    id: t._id,
    title: t.taskName,
    subtitle: t.status,
    path: t.category === 'reputation' ? '/reputation-tasks' : '/tasks',
  }));
}

async function searchAnnouncements(re, limit) {
  const rows = await Announcement.find({ $or: [{ heading: re }, { body: re }] })
    .sort({ noticeDate: -1 })
    .limit(limit);
  return rows.map((a) => ({
    type: 'announcements',
    id: a._id,
    title: a.heading,
    subtitle: a.priority,
    path: '/announcements',
  }));
}

async function searchUsers(re, limit) {
  const rows = await User.find({ $or: [{ name: re }, { username: re }, { email: re }] })
    .select('name username title')
    .limit(limit);
  return rows.map((u) => ({
    type: 'users',
    id: u._id,
    title: u.name,
    subtitle: u.title || u.username,
    path: '/user-management',
  }));
}

const SEARCHERS = {
  rfps: searchRfps,
  calls: searchCalls,
  leads: searchLeads,
  corporate: searchCorporate,
  scores: searchScores,
  groups: searchGroups,
  tasks: searchTasks,
  announcements: searchAnnouncements,
  users: searchUsers,
};

// GET /api/search?q=<term>&mode=<optional type>
router.get('/', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const mode = (req.query.mode || '').trim().toLowerCase();
    if (!q) return res.json({ results: [] });

    const re = new RegExp(escapeRegex(q), 'i');
    const isAdmin = req.user.role === 'admin';

    if (mode) {
      if (mode === 'users' && !isAdmin) return res.json({ results: [] });
      const searcher = SEARCHERS[mode];
      if (!searcher) return res.status(400).json({ message: `Unknown search mode "${mode}"` });
      const results = await searcher(re, 25);
      return res.json({ results });
    }

    const types = Object.keys(SEARCHERS).filter((t) => t !== 'users' || isAdmin);
    const perType = await Promise.all(types.map((t) => SEARCHERS[t](re, 4)));
    const results = perType.flat();
    res.json({ results });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
