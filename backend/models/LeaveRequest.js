const mongoose = require('mongoose');

const leaveRequestSchema = new mongoose.Schema(
  {
    user:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date:   { type: String, required: true }, // YYYY-MM-DD
    type:   { type: String, enum: ['sick', 'vacation', 'personal', 'other'], required: true },
    reason: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'approved', 'denied'], default: 'pending' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);
