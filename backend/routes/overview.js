const express = require('express');
const User = require('../models/User');
const Task = require('../models/Task');
const AttendanceLog = require('../models/AttendanceLog');
const InactivityWarning = require('../models/InactivityWarning');
const { protect, requirePermission } = require('../middleware/auth');
const { getEasternDayRange } = require('../utils/easternTime');

const router = express.Router();
router.get('/executive', protect, requirePermission('executiveOverview'), async (req, res) => {
  try {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const range = getEasternDayRange(today);
    const [users, tasks, todayLogs, warningAgg] = await Promise.all([
      User.find({ isMaster: { $ne: true } }).select('name username title avatar department online clockedIn onBreak clockInTime inactivityWarnings').lean(),
      Task.find({ deadline: { $gte: range.start, $lt: range.end } }).select('category status assignedTo').lean(),
      AttendanceLog.find({ date: today }).lean(),
      InactivityWarning.aggregate([{ $match: { date: today } }, { $group: { _id: '$user', count: { $sum: 1 } } }]),
    ]);
    const logUsers = new Set(todayLogs.map(l => String(l.user)));
    const warningMap = Object.fromEntries(warningAgg.map(w => [String(w._id), w.count]));
    const categories = ['sales', 'reputation', 'marketing', 'operations', 'internal-sales'];
    const departments = categories.map(department => {
      const people = users.filter(u => u.department === department);
      const departmentTasks = tasks.filter(t => t.category === department);
      return {
        department,
        headcount: people.length,
        present: people.filter(u => u.clockedIn || logUsers.has(String(u._id))).length,
        active: people.filter(u => u.clockedIn && !u.onBreak).length,
        tasksTotal: departmentTasks.length,
        tasksCompleted: departmentTasks.filter(t => t.status === 'completed').length,
        warnings: people.reduce((sum, u) => sum + (warningMap[String(u._id)] || 0), 0),
      };
    });
    res.json({
      date: today,
      totals: {
        employees: users.length,
        present: users.filter(u => u.clockedIn || logUsers.has(String(u._id))).length,
        active: users.filter(u => u.clockedIn && !u.onBreak).length,
        completedTasks: tasks.filter(t => t.status === 'completed').length,
        totalTasks: tasks.length,
        warnings: warningAgg.reduce((sum, w) => sum + w.count, 0),
      },
      departments,
      employees: users.map(u => ({ ...u, warningsToday: warningMap[String(u._id)] || 0 })),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
