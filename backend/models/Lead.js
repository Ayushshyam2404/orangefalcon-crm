const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema(
  {
    contactName: { type: String, required: true, trim: true },
    company: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    roomType: { type: String, enum: ['room', 'banquet', 'both'], default: 'room' },
    numRooms: { type: Number, default: null },
    checkIn: { type: Date, default: null },
    checkOut: { type: Date, default: null },
    rateOffered: { type: Number, default: null },
    status: {
      type: String,
      enum: ['new', 'contacted', 'quoted', 'converted', 'lost'],
      default: 'new',
    },
    source: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },
    loggedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Lead', leadSchema);
