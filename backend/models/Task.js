const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    taskName: { type: String, required: true, trim: true },
    deadline: { type: Date, required: true },
    status: { type: String, enum: ['pending', 'in-progress', 'completed'], default: 'pending' },
    notes: { type: String, trim: true, default: '' },
    category: { type: String, enum: ['sales', 'reputation'], default: 'sales' },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Index for efficient date-based queries
taskSchema.index({ deadline: 1, status: 1 });

module.exports = mongoose.model('Task', taskSchema);
