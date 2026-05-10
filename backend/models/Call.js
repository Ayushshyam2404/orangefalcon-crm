const mongoose = require('mongoose');

const callSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: '' },
    outcome: {
      type: String,
      enum: ['Connected', 'Voicemail', 'No Answer', 'Interested', 'Not Interested'],
      default: 'Connected',
    },
    notes: { type: String, default: '' },
    category: { type: String, enum: ['sales', 'reputation'], default: 'sales' },
    loggedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Call', callSchema);
