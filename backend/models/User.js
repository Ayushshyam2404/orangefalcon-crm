const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const LOGIN_ATTEMPT_LIMIT = 5;
const LOCK_DURATION_MS    = 15 * 60 * 1000; // 15 minutes

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: true, minlength: 6 },
    role: { type: String, enum: ['admin', 'staff'], default: 'staff' },
    title: { type: String, default: '', trim: true },
    email: { type: String, default: '', trim: true },
    phone: { type: String, default: '', trim: true },
    bio: { type: String, default: '', trim: true },
    gender: { type: String, enum: ['', 'male', 'female', 'other'], default: '' },
    age: { type: Number, default: null },
    avatar: { type: String, default: '' }, // base64 data URL
    online: { type: Boolean, default: false },
    sessionSeconds: { type: Number, default: 0 },
    lastLogin: { type: Date, default: null },
    sessionStart: { type: Date, default: null },
    // Attendance / time clock
    clockedIn: { type: Boolean, default: false },
    clockInTime: { type: Date, default: null },
    clockOutTime: { type: Date, default: null },
    onBreak: { type: Boolean, default: false },
    breakStart: { type: Date, default: null },
    breakSeconds: { type: Number, default: 0 },
    // Security
    mustChangePassword:   { type: Boolean, default: false },
    failedLoginAttempts:  { type: Number,  default: 0 },
    lockUntil:            { type: Date,    default: null },
  },
  { timestamps: true }
);

// True when account is currently locked out
userSchema.virtual('isLocked').get(function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Increment failed attempts; lock account if limit reached
userSchema.methods.incLoginAttempts = async function () {
  // Previous lock has expired — reset and start fresh
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({ $set: { failedLoginAttempts: 1 }, $unset: { lockUntil: 1 } });
  }
  const update = { $inc: { failedLoginAttempts: 1 } };
  if (this.failedLoginAttempts + 1 >= LOGIN_ATTEMPT_LIMIT && !this.isLocked) {
    update.$set = { lockUntil: new Date(Date.now() + LOCK_DURATION_MS) };
  }
  return this.updateOne(update);
};

// Reset failed attempts on successful login
userSchema.methods.resetLoginAttempts = function () {
  return this.updateOne({ $set: { failedLoginAttempts: 0 }, $unset: { lockUntil: 1 } });
};

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
