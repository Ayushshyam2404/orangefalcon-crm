const mongoose = require('mongoose');

const corporateProfileSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    company: { type: String, required: true, trim: true },
    phone: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, default: '' },
    // CC stored as-is; encrypt at rest in production (PCI DSS)
    ccNumber: { type: String, trim: true, default: '' },
    ccExpiry: { type: String, trim: true, default: '' }, // MM/YY
    notes: { type: String, trim: true, default: '' },
    loggedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CorporateProfile', corporateProfileSchema);
