const mongoose = require('mongoose');

const companySettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'singleton', unique: true },
    companyName:         { type: String, default: 'Orange Falcon' },
    logo:                { type: String, default: '' }, // base64 data URL
    expectedClockIn:     { type: String, default: '09:00' }, // HH:MM
    expectedHoursPerDay: { type: Number, default: 8, min: 1, max: 24 },
    expectedDaysPerWeek: { type: Number, default: 5, min: 1, max: 7 },
    reportRecipients: { type: [String], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CompanySettings', companySettingsSchema);
