const mongoose = require('mongoose');

const callSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: '', trim: true },
    status: { type: String, enum: ['pending', 'completed'], default: 'completed' },
    outcome: {
      type: String,
      enum: ['Connected', 'Voicemail', 'No Answer', 'Interested', 'Not Interested'],
      default: 'Connected',
    },
    notes: { type: String, default: '' },
    followUpDone: { type: Boolean, default: null },
    category: { type: String, enum: ['sales', 'reputation'], default: 'sales' },
    hotel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', default: null },
    source: { type: String, enum: ['manual', 'import'], default: 'manual' },
    importBatch: { type: String, default: '' },
    importedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    loggedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      required: function requireCallerForCompletedCall() { return this.status !== 'pending'; },
    },
    calledAt: { type: Date, default: null },
  },
  { timestamps: true }
);

callSchema.index({ category: 1, status: 1, createdAt: -1 });
callSchema.index({ category: 1, hotel: 1, phone: 1, status: 1 });

module.exports = mongoose.model('Call', callSchema);
