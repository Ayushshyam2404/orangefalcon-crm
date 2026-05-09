const mongoose = require('mongoose');

const attendanceLogSchema = new mongoose.Schema(
  {
    user:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date:         { type: String, required: true }, // YYYY-MM-DD (NY timezone)
    clockInTime:  { type: Date },
    clockOutTime: { type: Date },
    workedSeconds:{ type: Number, default: 0 },
    breakSeconds: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// One log per user per day
attendanceLogSchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('AttendanceLog', attendanceLogSchema);
