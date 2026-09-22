const mongoose = require('mongoose');

const inactivityWarningSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  inactiveSeconds: { type: Number, required: true },
  date: { type: String, required: true, index: true },
  acknowledgedAt: { type: Date, default: null },
}, { timestamps: true });

inactivityWarningSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('InactivityWarning', inactivityWarningSchema);
