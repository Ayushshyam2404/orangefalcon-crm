const express = require('express');
const Task = require('../models/Task');
const { protect } = require('../middleware/auth');
const { getEasternDayRange } = require('../utils/easternTime');
const { permissionFor } = require('../config/permissions');

const router = express.Router();
const TASK_CATEGORIES = ['sales', 'reputation', 'marketing', 'operations', 'internal-sales'];
const taskPermissionModule = category => ({
  reputation: 'reputationTasks', marketing: 'marketingTasks', operations: 'operationsTasks',
  'internal-sales': 'internalSalesTasks', sales: 'tasks',
}[category] || 'tasks');
const canWriteTask = (req, task) => permissionFor(req.user, taskPermissionModule(task.category)).write;

// GET /api/tasks - all tasks for current user
router.get('/', protect, async (req, res) => {
  try {
    const { status, date, category } = req.query;
    let filter = { $or: [{ assignedTo: req.user._id }, { createdBy: req.user._id }] };
    
    if (status && status !== 'all') filter.status = status;
    if (category) filter.category = category;
    
    // If date is provided, filter by that day
    if (date) {
      const range = getEasternDayRange(date);
      if (!range) return res.status(400).json({ message: 'Date must use YYYY-MM-DD format' });
      filter.deadline = { $gte: range.start, $lt: range.end };
    }

    const tasks = await Task.find(filter)
      .populate('assignedTo', 'name username')
      .populate('createdBy', 'name username')
      .sort({ deadline: 1 });
    
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/tasks/history?start=<ISO>&end=<ISO>&category=<category>
// Returns completion events in the requested date range. Admins can review the
// whole team; staff can review tasks they created or were assigned.
router.get('/history', protect, async (req, res) => {
  try {
    const { start, end, category } = req.query;
    const startDate = new Date(start);
    const endDate = new Date(end);

    if (!start || !end || Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) {
      return res.status(400).json({ message: 'A valid start and end date range is required' });
    }
    if ((endDate - startDate) > 1000 * 60 * 60 * 24 * 62) {
      return res.status(400).json({ message: 'Task history range cannot exceed 62 days' });
    }
    if (category && !TASK_CATEGORIES.includes(category)) {
      return res.status(400).json({ message: 'Invalid task category' });
    }

    const accessFilter = req.user.role === 'admin'
      ? {}
      : { $or: [{ assignedTo: req.user._id }, { createdBy: req.user._id }] };
    const filter = {
      ...accessFilter,
      ...(category ? { category } : {}),
      $and: [{
        $or: [
          { 'completionHistory.completedAt': { $gte: startDate, $lt: endDate } },
          { completedAt: { $gte: startDate, $lt: endDate } },
        ],
      }],
    };

    const tasks = await Task.find(filter)
      .populate('completionHistory.completedBy', 'name username avatar title')
      .populate('completedBy', 'name username avatar title')
      .populate('assignedTo', 'name username avatar title')
      .select('taskName notes category assignedTo completedAt completedBy completionHistory');

    const events = [];
    for (const task of tasks) {
      const matchingHistory = (task.completionHistory || []).filter(entry =>
        entry.completedAt >= startDate && entry.completedAt < endDate
      );

      if (matchingHistory.length > 0) {
        matchingHistory.forEach(entry => events.push({
          _id: entry._id,
          taskId: task._id,
          taskName: task.taskName,
          notes: task.notes,
          category: task.category,
          completedAt: entry.completedAt,
          completedBy: entry.completedBy,
          assignedTo: task.assignedTo,
          legacy: false,
        }));
      } else if (task.completedAt >= startDate && task.completedAt < endDate) {
        // Tasks completed before completionHistory was introduced still appear.
        events.push({
          _id: `legacy-${task._id}`,
          taskId: task._id,
          taskName: task.taskName,
          notes: task.notes,
          category: task.category,
          completedAt: task.completedAt,
          completedBy: task.completedBy,
          assignedTo: task.assignedTo,
          legacy: true,
        });
      }
    }

    events.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
    res.json(events);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/tasks/day/:date - tasks for a specific day
router.get('/day/:date', protect, async (req, res) => {
  try {
    const range = getEasternDayRange(req.params.date);
    if (!range) return res.status(400).json({ message: 'Date must use YYYY-MM-DD format' });

    const tasks = await Task.find({
      deadline: { $gte: range.start, $lt: range.end },
      ...(req.query.category ? { category: req.query.category } : {}),
      $or: [{ assignedTo: req.user._id }, { createdBy: req.user._id }]
    })
      .populate('assignedTo', 'name username')
      .populate('createdBy', 'name username')
      .sort({ deadline: 1 });
    
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/tasks/complete-day - mark every open task in one Eastern day complete
router.put('/complete-day', protect, async (req, res) => {
  try {
    const { date, category } = req.body;
    const range = getEasternDayRange(date);
    if (!range) return res.status(400).json({ message: 'Date must use YYYY-MM-DD format' });
    if (category && !TASK_CATEGORIES.includes(category)) {
      return res.status(400).json({ message: 'Invalid task category' });
    }

    const accessFilter = { $or: [{ assignedTo: req.user._id }, { createdBy: req.user._id }] };
    const filter = {
      ...accessFilter,
      deadline: { $gte: range.start, $lt: range.end },
      status: { $ne: 'completed' },
      ...(category ? { category } : {}),
    };
    const completedAt = new Date();
    const result = await Task.updateMany(filter, {
      $set: { status: 'completed', completedAt, completedBy: req.user._id },
      $push: { completionHistory: { completedAt, completedBy: req.user._id } },
    });

    const dayFilter = {
      ...accessFilter,
      deadline: { $gte: range.start, $lt: range.end },
      ...(category ? { category } : {}),
    };
    const tasks = await Task.find(dayFilter)
      .populate('assignedTo', 'name username')
      .populate('createdBy', 'name username')
      .populate('completedBy', 'name username')
      .sort({ deadline: 1 });

    res.json({ updated: result.modifiedCount, tasks });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/tasks - create new task
router.post('/', protect, async (req, res) => {
  try {
    const { taskName, deadline, notes, assignedTo, category } = req.body;
    
    if (!taskName || !taskName.trim()) return res.status(400).json({ message: 'Task name is required' });
    if (!deadline) return res.status(400).json({ message: 'Deadline is required' });
    if (category && !TASK_CATEGORIES.includes(category)) return res.status(400).json({ message: 'Invalid task category' });

    const task = await Task.create({
      taskName,
      deadline,
      notes,
      category: category || 'sales',
      assignedTo: assignedTo || req.user._id,
      createdBy: req.user._id,
    });

    const populated = await task.populate('assignedTo', 'name username');
    await populated.populate('createdBy', 'name username');
    
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/tasks/:id - update task
router.put('/:id', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    if (!canWriteTask(req, task)) return res.status(403).json({ message: 'Write access to this task area is required' });

    // Check if user has permission to update
    if (task.createdBy.toString() !== req.user._id.toString() && task.assignedTo.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this task' });
    }

    // Completion audit fields are server-owned. Only copy editable task fields
    // so a client cannot forge who completed a task or when it happened.
    const editableFields = ['taskName', 'deadline', 'status', 'notes', 'assignedTo', 'category'];
    const editableUpdates = Object.fromEntries(
      editableFields
        .filter(field => Object.prototype.hasOwnProperty.call(req.body, field))
        .map(field => [field, req.body[field]])
    );
    const update = { $set: editableUpdates };

    // Keep an audit entry each time a reopened task is completed.
    if (req.body.status === 'completed' && task.status !== 'completed') {
      const completedAt = new Date();
      update.$set.completedAt = completedAt;
      update.$set.completedBy = req.user._id;
      update.$push = { completionHistory: { completedAt, completedBy: req.user._id } };
    } else if (req.body.status && req.body.status !== 'completed' && task.status === 'completed') {
      update.$set.completedAt = null;
      update.$set.completedBy = null;
    }

    const updatedTask = await Task.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true })
      .populate('assignedTo', 'name username')
      .populate('createdBy', 'name username')
      .populate('completedBy', 'name username');

    res.json(updatedTask);
  } catch (err) {
    if (err.name === 'CastError') return res.status(400).json({ message: 'Invalid ID format' });
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/tasks/:id - delete task
router.delete('/:id', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    if (!canWriteTask(req, task)) return res.status(403).json({ message: 'Write access to this task area is required' });

    // Only creator can delete
    if (task.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only creator can delete this task' });
    }

    await Task.findByIdAndDelete(req.params.id);
    res.json({ message: 'Task deleted' });
  } catch (err) {
    if (err.name === 'CastError') return res.status(400).json({ message: 'Invalid ID format' });
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
