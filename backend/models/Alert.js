const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema(
  {
    message: { type: String, required: true },
    type: { type: String, required: true },
    iconType: { type: String, default: 'info' },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Alert', alertSchema);
