const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema(
  {
    heading:   { type: String, required: true, trim: true },
    noticeDate: { type: Date, required: true },
    body:      { type: String, required: true, trim: true },
    priority:  { type: String, enum: ['normal', 'important', 'urgent'], default: 'normal' },
    author:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Announcement', announcementSchema);
