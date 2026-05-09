const express = require('express');
const router = express.Router();
const AttendanceLog = require('../models/AttendanceLog');
const LeaveRequest = require('../models/LeaveRequest');
const { protect, adminOnly } = require('../middleware/auth');

router.use(protect);

// GET /api/attendance?year=YYYY&month=M — current user's logs for a given month
router.get('/', async (req, res) => {
  try {
    const { year, month } = req.query;
    const filter = { user: req.user._id };
    if (year && month) {
      const prefix = `${year}-${String(month).padStart(2, '0')}`;
      filter.date = { $regex: `^${prefix}` };
    }
    const logs = await AttendanceLog.find(filter).sort({ date: -1 });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/attendance — manually upsert a log entry (admin only)
router.post('/', adminOnly, async (req, res) => {
  try {
    const { userId, date, clockInTime, clockOutTime, workedSeconds, breakSeconds } = req.body;
    if (!userId || !date) return res.status(400).json({ message: 'userId and date are required' });
    const log = await AttendanceLog.findOneAndUpdate(
      { user: userId, date },
      { user: userId, date, clockInTime, clockOutTime, workedSeconds: workedSeconds || 0, breakSeconds: breakSeconds || 0 },
      { upsert: true, new: true }
    );
    res.status(201).json(log);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/attendance/leaves?year=YYYY&month=M — current user's leave requests
router.get('/leaves', async (req, res) => {
  try {
    const { year, month } = req.query;
    const filter = { user: req.user._id };
    if (year && month) {
      const prefix = `${year}-${String(month).padStart(2, '0')}`;
      filter.date = { $regex: `^${prefix}` };
    }
    const leaves = await LeaveRequest.find(filter).sort({ date: -1 });
    res.json(leaves);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/attendance/leaves — submit a leave request
router.post('/leaves', async (req, res) => {
  try {
    const { date, type, reason } = req.body;
    if (!date || !type) return res.status(400).json({ message: 'Date and type are required' });
    const leave = await LeaveRequest.create({
      user: req.user._id,
      date,
      type,
      reason: reason || '',
    });
    res.status(201).json(leave);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/attendance/leaves/:id — cancel a pending leave request
router.delete('/leaves/:id', async (req, res) => {
  try {
    const leave = await LeaveRequest.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
      status: 'pending',
    });
    if (!leave) return res.status(404).json({ message: 'Leave not found or already processed' });
    res.json({ message: 'Leave cancelled' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/attendance/admin/summary?year=YYYY&month=M — all users' stats (admin only)
router.get('/admin/summary', adminOnly, async (req, res) => {
  try {
    const User = require('../models/User');
    const { year, month } = req.query;

    const dateFilter = {};
    if (year && month) {
      const prefix = `${year}-${String(month).padStart(2, '0')}`;
      dateFilter.date = { $regex: `^${prefix}` };
    }

    // Aggregate logs grouped by user
    const logAgg = await AttendanceLog.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$user',
          daysWorked:    { $sum: 1 },
          workedSeconds: { $sum: '$workedSeconds' },
          breakSeconds:  { $sum: '$breakSeconds' },
        },
      },
    ]);

    // Aggregate leaves grouped by user
    const leaveAgg = await LeaveRequest.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id:    '$user',
          total:  { $sum: 1 },
          approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
          pending:  { $sum: { $cond: [{ $eq: ['$status', 'pending']  }, 1, 0] } },
        },
      },
    ]);

    const logMap   = Object.fromEntries(logAgg.map(l   => [l._id.toString(), l]));
    const leaveMap = Object.fromEntries(leaveAgg.map(l => [l._id.toString(), l]));

    // Today's date string (NY timezone)
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

    // Today's saved logs (already clocked out today)
    const todayLogs = await AttendanceLog.find({ date: todayStr });
    const todayLogMap = Object.fromEntries(todayLogs.map(l => [l.user.toString(), l]));

    const users = await User.find()
      .select('name username role title avatar online clockedIn clockInTime clockOutTime onBreak breakStart breakSeconds')
      .sort({ name: 1 });

    const result = users.map(u => {
      const uid = u._id.toString();
      const log   = logMap[uid]   || { daysWorked: 0, workedSeconds: 0, breakSeconds: 0 };
      const leave = leaveMap[uid] || { total: 0, approved: 0, pending: 0 };
      const todayLog = todayLogMap[uid] || null;

      return {
        user: { _id: u._id, name: u.name, username: u.username, role: u.role, title: u.title, avatar: u.avatar, online: u.online },
        daysWorked:    log.daysWorked,
        workedSeconds: log.workedSeconds,
        breakSeconds:  log.breakSeconds,
        leaves: {
          total:    leave.total,
          approved: leave.approved,
          pending:  leave.pending,
        },
        today: {
          clockedIn:    u.clockedIn || false,
          onBreak:      u.onBreak   || false,
          clockInTime:  u.clockInTime  || null,
          clockOutTime: u.clockOutTime || null,
          breakStart:   u.breakStart   || null,
          breakSeconds: u.breakSeconds || 0,
          // saved log for today (if already clocked out)
          savedWorkedSeconds: todayLog ? todayLog.workedSeconds : null,
          savedBreakSeconds:  todayLog ? todayLog.breakSeconds  : null,
          hasSavedLog: !!todayLog,
        },
      };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
