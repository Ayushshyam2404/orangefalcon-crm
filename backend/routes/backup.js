'use strict';

const express          = require('express');
const router           = express.Router();
const { protect, adminOnly } = require('../middleware/auth');

const User             = require('../models/User');
const Hotel            = require('../models/Hotel');
const RFP              = require('../models/RFP');
const Call             = require('../models/Call');
const Lead             = require('../models/Lead');
const Task             = require('../models/Task');
const Alert            = require('../models/Alert');
const Group            = require('../models/Group');
const Event            = require('../models/Event');
const HotelScore       = require('../models/HotelScore');
const Announcement     = require('../models/Announcement');
const AttendanceLog    = require('../models/AttendanceLog');
const CorporateProfile = require('../models/CorporateProfile');
const CompanySettings  = require('../models/CompanySettings');
const LeaveRequest     = require('../models/LeaveRequest');
const RoutineItem      = require('../models/RoutineItem');

// All routes require admin auth
router.use(protect, adminOnly);

// ── GET /api/backup/export ──────────────────────────────────────────────────
// Exports every collection as a single human-readable JSON file.
router.get('/export', async (req, res) => {
  try {
    const [
      users, hotels, rfps, calls, leads, tasks, alerts, groups, events,
      hotelScores, announcements, attendanceLogs, corporateProfiles,
      companySettings, leaveRequests, routineItems,
    ] = await Promise.all([
      User.find().lean(),
      Hotel.find().lean(),
      RFP.find().lean(),
      Call.find().lean(),
      Lead.find().lean(),
      Task.find().lean(),
      Alert.find().lean(),
      Group.find().lean(),
      Event.find().lean(),
      HotelScore.find().lean(),
      Announcement.find().lean(),
      AttendanceLog.find().lean(),
      CorporateProfile.find().lean(),
      CompanySettings.find().lean(),
      LeaveRequest.find().lean(),
      RoutineItem.find().lean(),
    ]);

    const now    = new Date();
    const dateTag = now.toISOString().slice(0, 10);

    const backup = {
      _meta: {
        backupVersion:  '1',
        generator:      'Orange Falcon CRM',
        exportedAt:     now.toISOString(),
        exportedAt_IST: now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
        exportedBy:     req.user.username,
        note:           'Upload this file in Admin → Settings → Backup & Restore to recover all data.',
        counts: {
          users:             users.length,
          hotels:            hotels.length,
          rfps:              rfps.length,
          calls:             calls.length,
          leads:             leads.length,
          tasks:             tasks.length,
          alerts:            alerts.length,
          groups:            groups.length,
          events:            events.length,
          hotelScores:       hotelScores.length,
          announcements:     announcements.length,
          attendanceLogs:    attendanceLogs.length,
          corporateProfiles: corporateProfiles.length,
          companySettings:   companySettings.length,
          leaveRequests:     leaveRequests.length,
          routineItems:      routineItems.length,
        },
      },
      users,
      hotels,
      rfps,
      calls,
      leads,
      tasks,
      alerts,
      groups,
      events,
      hotelScores,
      announcements,
      attendanceLogs,
      corporateProfiles,
      companySettings,
      leaveRequests,
      routineItems,
    };

    const json = JSON.stringify(backup, null, 2);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="crm-backup-${dateTag}.json"`);
    res.send(json);

    console.log(`[Backup] ✅ Export by ${req.user.username} — ${json.length} bytes, ${dateTag}`);
  } catch (err) {
    console.error('[Backup] Export error:', err);
    res.status(500).json({ message: 'Export failed: ' + err.message });
  }
});

// ── POST /api/backup/restore ────────────────────────────────────────────────
// Accepts a JSON backup body, wipes all collections, and reinserts the data.
// Uses a higher body limit since backups can be large.
router.post(
  '/restore',
  express.json({ limit: '100mb' }),
  async (req, res) => {
    try {
      const backup = req.body;

      if (!backup?._meta?.backupVersion) {
        return res.status(400).json({
          message: 'Invalid backup file — missing _meta.backupVersion. Make sure you are uploading a file exported by this CRM.',
        });
      }

      const results  = {};
      const warnings = [];

      const restoreCollection = async (Model, key) => {
        if (!Array.isArray(backup[key])) {
          results[key] = 'skipped — not present in backup';
          return;
        }
        await Model.deleteMany({});
        if (backup[key].length > 0) {
          try {
            await Model.insertMany(backup[key], { ordered: false });
          } catch (bulkErr) {
            // ordered:false continues on duplicate-key errors; collect warnings
            if (bulkErr.writeErrors) {
              warnings.push(`${key}: ${bulkErr.writeErrors.length} document(s) skipped due to conflicts`);
            } else {
              throw bulkErr;
            }
          }
        }
        results[key] = `restored ${backup[key].length} document(s)`;
      };

      await restoreCollection(User,             'users');
      await restoreCollection(Hotel,            'hotels');
      await restoreCollection(RFP,              'rfps');
      await restoreCollection(Call,             'calls');
      await restoreCollection(Lead,             'leads');
      await restoreCollection(Task,             'tasks');
      await restoreCollection(Alert,            'alerts');
      await restoreCollection(Group,            'groups');
      await restoreCollection(Event,            'events');
      await restoreCollection(HotelScore,       'hotelScores');
      await restoreCollection(Announcement,     'announcements');
      await restoreCollection(AttendanceLog,    'attendanceLogs');
      await restoreCollection(CorporateProfile, 'corporateProfiles');
      await restoreCollection(CompanySettings,  'companySettings');
      await restoreCollection(LeaveRequest,     'leaveRequests');
      await restoreCollection(RoutineItem,      'routineItems');

      console.log(`[Backup] ✅ Restore by ${req.user.username} from backup dated ${backup._meta.exportedAt}`);

      res.json({ message: 'Restore complete', results, warnings });
    } catch (err) {
      console.error('[Backup] Restore error:', err);
      res.status(500).json({ message: 'Restore failed: ' + err.message });
    }
  }
);

module.exports = router;
