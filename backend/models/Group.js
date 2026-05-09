const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema(
  {
    groupName: { type: String, required: true, trim: true },
    hotel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true },
    checkIn: { type: Date, required: true },
    checkOut: { type: Date, required: true },
    rate: { type: Number, default: null },
    numRooms: { type: Number, default: null },
    numRoomNights: { type: Number, default: null }, // Auto-calculated
    type: { type: String, enum: ['pickup', 'guaranteed'], required: true },
    // Guaranteed payment info
    creditCardNumber: { type: String, default: 'Not available' },
    cardExpDate: { type: String, default: 'Not available' },
    // Room/Banquet selection
    roomBanquet: { type: String, enum: ['R', 'B'], required: true },
    // Banquet details (if applicable)
    banquetCheckIn: { type: Date, default: null },
    banquetCheckOut: { type: Date, default: null },
    banquetCheckInTime: { type: String, default: 'Not available' }, // HH:mm format
    banquetCheckOutTime: { type: String, default: 'Not available' }, // HH:mm format
    banquetDurationHours: { type: Number, default: null }, // Auto-calculated
    notes: { type: String, default: '' },
    loggedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// Pre-save hook to auto-calculate room nights
groupSchema.pre('save', function (next) {
  if (this.numRooms && this.checkIn && this.checkOut) {
    const days = Math.ceil((new Date(this.checkOut) - new Date(this.checkIn)) / (1000 * 60 * 60 * 24));
    this.numRoomNights = days * this.numRooms;
  }
  
  // Auto-calculate banquet duration in hours
  if (this.banquetCheckInTime && this.banquetCheckOutTime) {
    const [inHour, inMin] = this.banquetCheckInTime.split(':').map(Number);
    const [outHour, outMin] = this.banquetCheckOutTime.split(':').map(Number);
    const inMinutes = inHour * 60 + inMin;
    const outMinutes = outHour * 60 + outMin;
    let duration = outMinutes - inMinutes;
    if (duration < 0) duration += 24 * 60; // Handle overnight events
    this.banquetDurationHours = parseFloat((duration / 60).toFixed(2));
  }
  
  next();
});

// Also run calculations on findOneAndUpdate
groupSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate();
  if (update.numRooms !== undefined || update.checkIn !== undefined || update.checkOut !== undefined) {
    const numRooms = update.numRooms;
    const checkIn = update.checkIn;
    const checkOut = update.checkOut;
    if (numRooms && checkIn && checkOut) {
      const days = Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24));
      update.numRoomNights = days * numRooms;
    }
  }
  if (update.banquetCheckInTime && update.banquetCheckOutTime) {
    const [inHour, inMin] = update.banquetCheckInTime.split(':').map(Number);
    const [outHour, outMin] = update.banquetCheckOutTime.split(':').map(Number);
    const inMinutes = inHour * 60 + inMin;
    const outMinutes = outHour * 60 + outMin;
    let duration = outMinutes - inMinutes;
    if (duration < 0) duration += 24 * 60;
    update.banquetDurationHours = parseFloat((duration / 60).toFixed(2));
  }
  next();
});

module.exports = mongoose.model('Group', groupSchema);
