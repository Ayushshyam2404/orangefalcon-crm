const mongoose = require('mongoose');

const routineItemSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    taskName: { type: String, required: true, trim: true },
    defaultNote: { type: String, trim: true, default: '' },
    order: { type: Number, default: 0 },
    category: { type: String, enum: ['sales', 'reputation'], default: 'sales' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('RoutineItem', routineItemSchema);
