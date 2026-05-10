const mongoose = require('mongoose');
require('dotenv').config();

const app = require('./app');
const cron = require('node-cron');
const { generateAndSend } = require('./services/dailyReport');

// Connect to MongoDB and start server
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    app.listen(process.env.PORT || 5003, () => {
      console.log(`🚀 Server running on port ${process.env.PORT || 5003}`);
    });

    // ── Schedule daily report at 5 AM IST (configurable via env) ───────────
    const hour = process.env.REPORT_CRON_HOUR || '5';
    const min  = process.env.REPORT_CRON_MIN  || '0';
    cron.schedule(`${min} ${hour} * * *`, async () => {
      console.log('[DailyReport] ⏰ Starting daily report…');
      try {
        await generateAndSend();
      } catch (err) {
        console.error('[DailyReport] ❌ Failed:', err.message);
      }
    }, { timezone: 'Asia/Kolkata' });

    console.log(`📊 Daily report scheduled at ${hour}:${String(min).padStart(2,'0')} IST`);
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });
