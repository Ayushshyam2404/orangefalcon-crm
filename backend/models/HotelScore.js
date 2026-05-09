const mongoose = require('mongoose');

const hotelScoreSchema = new mongoose.Schema(
  {
    hotel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true },
    date: { type: Date, required: true },
    score: { type: Number, required: true, min: 0, max: 100 },
    notes: { type: String, trim: true, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('HotelScore', hotelScoreSchema);
