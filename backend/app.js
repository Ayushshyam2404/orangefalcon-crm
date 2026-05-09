const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const rfpRoutes = require('./routes/rfps');
const callRoutes = require('./routes/calls');
const userRoutes = require('./routes/users');
const alertRoutes = require('./routes/alerts');
const hotelRoutes = require('./routes/hotels');
const groupRoutes = require('./routes/groups');
const taskRoutes = require('./routes/tasks');
const routineRoutes = require('./routes/routines');
const leadRoutes = require('./routes/leads');
const corporateRoutes = require('./routes/corporateProfiles');
const eventRoutes = require('./routes/events');
const attendanceRoutes = require('./routes/attendance');
const announcementRoutes = require('./routes/announcements');
const companySettingsRoutes = require('./routes/companySettings');
const hotelScoreRoutes = require('./routes/hotelScores');

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '10mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/rfps', rfpRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/users', userRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/hotels', hotelRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/routines', routineRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/corporate', corporateRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/company-settings', companySettingsRoutes);
app.use('/api/hotel-scores', hotelScoreRoutes);

app.get('/api/health', (req, res) =>
  res.json({ status: 'OK', message: 'Orange Falcon CRM API running' })
);

module.exports = app;
