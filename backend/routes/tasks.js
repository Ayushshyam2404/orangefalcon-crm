const express = require('express');
const Task = require('../models/Task');
const { protect } = require('../middleware/auth');

const router = express.Router();

// GET /api/tasks - all tasks for current user
router.get('/', protect, async (req, res) => {
  try {
    const { status, date, category } = req.query;
    let filter = { $or: [{ assignedTo: req.user._id }, { createdBy: req.user._id }] };
    
    if (status && status !== 'all') filter.status = status;
    if (category) filter.category = category;
    
    // If date is provided, filter by that day
    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);
      filter.deadline = { $gte: startDate, $lt: endDate };
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

// GET /api/tasks/day/:date - tasks for a specific day
router.get('/day/:date', protect, async (req, res) => {
  try {
    const date = new Date(req.params.date);
    const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const endDate = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);

    const tasks = await Task.find({
      deadline: { $gte: startDate, $lt: endDate },
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

// POST /api/tasks - create new task
router.post('/', protect, async (req, res) => {
  try {
    const { taskName, deadline, notes, assignedTo, category } = req.body;
    
    if (!taskName || !taskName.trim()) return res.status(400).json({ message: 'Task name is required' });
    if (!deadline) return res.status(400).json({ message: 'Deadline is required' });

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

    // Check if user has permission to update
    if (task.createdBy.toString() !== req.user._id.toString() && task.assignedTo.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this task' });
    }

    // If marking as completed, set completedAt
    if (req.body.status === 'completed' && task.status !== 'completed') {
      req.body.completedAt = new Date();
    }

    const updatedTask = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
      .populate('assignedTo', 'name username')
      .populate('createdBy', 'name username');

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
