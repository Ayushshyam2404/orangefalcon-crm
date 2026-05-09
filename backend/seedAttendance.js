/**
 * Seed demo attendance history for all users.
 * Run: node seedAttendance.js
 *
 * Creates ~20 workdays (Mon–Fri) of realistic clock-in/out data
 * plus a few leave requests, going back 4 weeks from today.
 */
const mongoose = require('mongoose');
const User = require('./models/User');
const AttendanceLog = require('./models/AttendanceLog');
const LeaveRequest = require('./models/LeaveRequest');
require('dotenv').config();

function nyDateStr(date) {
  return date.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

function randBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB');

  const users = await User.find({});
  if (!users.length) {
    console.log('❌ No users found. Run seed.js first.');
    process.exit(1);
  }

  // Build list of weekdays over the past 28 days (exclude today)
  const workdays = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 1; i <= 28; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) workdays.push(new Date(d)); // Mon–Fri only
  }

  let logsCreated = 0;
  let leavesCreated = 0;

  for (const user of users) {
    console.log(`\nSeeding attendance for: ${user.name} (${user.username})`);

    // 80% attendance rate — skip ~20% of days
    const userWorkdays = workdays.filter(() => Math.random() > 0.18);

    // Pick 1–2 random non-workdays as leave requests
    const skipDays = workdays.filter(d => !userWorkdays.includes(d)).slice(0, 2);

    for (const day of userWorkdays) {
      const dateStr = nyDateStr(day);

      // Clock in between 8:00–9:30 AM
      const clockIn = new Date(day);
      clockIn.setHours(randBetween(8, 9), randBetween(0, 59), randBetween(0, 59), 0);

      // Work 7.5–9.5 hours
      const workHours = randBetween(75, 95) / 10; // 7.5 – 9.5
      const totalSec = Math.round(workHours * 3600);

      // Break 20–45 min
      const breakSec = randBetween(20, 45) * 60;
      const workedSec = totalSec - breakSec;

      const clockOut = new Date(clockIn.getTime() + totalSec * 1000);

      try {
        await AttendanceLog.findOneAndUpdate(
          { user: user._id, date: dateStr },
          {
            user: user._id,
            date: dateStr,
            clockInTime: clockIn,
            clockOutTime: clockOut,
            workedSeconds: workedSec,
            breakSeconds: breakSec,
          },
          { upsert: true, new: true }
        );
        logsCreated++;
      } catch (e) {
        console.warn(`  Skip ${dateStr}: ${e.message}`);
      }
    }

    // Leave requests for skip days
    const leaveTypes = ['sick', 'vacation', 'personal', 'other'];
    const leaveReasons = {
      sick: 'Not feeling well',
      vacation: 'Pre-planned vacation',
      personal: 'Personal appointment',
      other: 'Family emergency',
    };
    for (const day of skipDays) {
      const dateStr = nyDateStr(day);
      const type = leaveTypes[randBetween(0, 3)];
      const statuses = ['approved', 'approved', 'pending'];
      const status = statuses[randBetween(0, 2)];
      try {
        const existing = await LeaveRequest.findOne({ user: user._id, date: dateStr });
        if (!existing) {
          await LeaveRequest.create({
            user: user._id,
            date: dateStr,
            type,
            reason: leaveReasons[type],
            status,
          });
          leavesCreated++;
        }
      } catch (e) {
        console.warn(`  Skip leave ${dateStr}: ${e.message}`);
      }
    }
  }

  console.log(`\n✅ Done! Created ${logsCreated} attendance logs and ${leavesCreated} leave requests.`);
  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
