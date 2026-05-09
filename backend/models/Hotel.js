const mongoose = require('mongoose');

const hotelSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    city: { type: String, required: true, trim: true },
    category: { type: String, enum: ['sales', 'reputation'], default: 'sales' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Hotel', hotelSchema);
