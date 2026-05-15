const mongoose = require('mongoose');

const hotelSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    category: { type: String, enum: ['sales', 'reputation'], default: 'sales' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

hotelSchema.index({ name: 1, category: 1 }, { unique: true });

module.exports = mongoose.model('Hotel', hotelSchema);
