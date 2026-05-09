const mongoose = require('mongoose');

const rfpSchema = new mongoose.Schema(
  {
    client: { type: String, required: true, trim: true },
    hotel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true },
    checkin: { type: String, default: '' },
    checkout: { type: String, default: '' },
    price: { type: Number, default: null },
    status: {
      type: String,
      enum: ['Pending', 'Responded', 'Won', 'Lost', 'Follow Up'],
      default: 'Pending',
    },
    notes: { type: String, default: '' },
    priority: { type: Boolean, default: false },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // RFPs in Consideration fields
    inConsideration: { type: Boolean, default: false },
    emailsSent: { type: String, default: '' },
    followUpsDone: { type: String, default: '' },
    tradeGiven: { type: String, default: '' },
    rank: { type: String, default: '' },
    numRooms: { type: Number, default: null },
    callDone: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('RFP', rfpSchema);
