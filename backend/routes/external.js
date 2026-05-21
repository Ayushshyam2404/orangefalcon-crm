/**
 * External Data API  –  /api/external
 *
 * Authentication: x-api-key header  OR  ?apiKey= query param.
 *
 * Endpoints
 * ─────────────────────────────────────────────────────────────
 * GET /snapshot              – full dump of every collection
 * GET /users
 * GET /hotels
 * GET /rfps
 * GET /calls
 * GET /leads
 * GET /groups
 * GET /tasks
 * GET /events
 * GET /announcements
 * GET /alerts
 * GET /hotel-scores
 * GET /corporate-profiles
 * GET /routines
 * GET /attendance
 * GET /leave-requests
 * GET /company-settings
 * GET /stream                – Server-Sent Events (real-time)
 * ─────────────────────────────────────────────────────────────
 *
 * Real-time strategy
 *   1. Try to open a MongoDB Change Stream on each collection.
 *   2. If the DB is a standalone node (no oplog / replica set),
 *      change streams will fail – fall back to a snapshot poll
 *      every POLL_INTERVAL_MS milliseconds.
 *
 * SSE event shapes
 *   event: change   data: { collection, operationType, documentId, document? }
 *   event: snapshot data: { <collectionName>: [...], ... }
 *   event: ping     data: { ts }   (keep-alive, every 30 s)
 */

const router = require('express').Router();
const mongoose = require('mongoose');

const apiKey   = require('../middleware/apiKey');

// ── Models ──────────────────────────────────────────────────────────────────
const User             = require('../models/User');
const Hotel            = require('../models/Hotel');
const RFP              = require('../models/RFP');
const Call             = require('../models/Call');
const Lead             = require('../models/Lead');
const Group            = require('../models/Group');
const Task             = require('../models/Task');
const Event            = require('../models/Event');
const Announcement     = require('../models/Announcement');
const Alert            = require('../models/Alert');
const HotelScore       = require('../models/HotelScore');
const CorporateProfile = require('../models/CorporateProfile');
const RoutineItem      = require('../models/RoutineItem');
const AttendanceLog    = require('../models/AttendanceLog');
const LeaveRequest     = require('../models/LeaveRequest');
const CompanySettings  = require('../models/CompanySettings');

// ── Constants ────────────────────────────────────────────────────────────────
const POLL_INTERVAL_MS = 8000; // fallback polling interval

// Sensitive user fields stripped for external consumers
const USER_PROJECTION = '-password -failedLoginAttempts -lockUntil -__v';

// ── Helpers ──────────────────────────────────────────────────────────────────
async function buildSnapshot() {
  const [
    users, hotels, rfps, calls, leads, groups, tasks, events,
    announcements, alerts, hotelScores, corporateProfiles, routines,
    attendance, leaveRequests, companySettings,
  ] = await Promise.all([
    User.find({}, USER_PROJECTION).lean(),
    Hotel.find({}).lean(),
    RFP.find({}).populate('addedBy', 'name username').lean(),
    Call.find({}).populate('loggedBy', 'name username').lean(),
    Lead.find({}).populate('loggedBy', 'name username').lean(),
    Group.find({}).populate('loggedBy', 'name username').lean(),
    Task.find({}).populate('assignedTo createdBy', 'name username').lean(),
    Event.find({}).populate('createdBy', 'name username').lean(),
    Announcement.find({}).populate('author', 'name username').lean(),
    Alert.find({}).sort({ createdAt: -1 }).limit(200).lean(),
    HotelScore.find({}).populate('hotel createdBy', 'name username city').lean(),
    CorporateProfile.find({}).populate('loggedBy', 'name username').lean(),
    RoutineItem.find({}).populate('user', 'name username').lean(),
    AttendanceLog.find({}).populate('user', 'name username').lean(),
    LeaveRequest.find({}).populate('user', 'name username').lean(),
    CompanySettings.findOne({ key: 'singleton' }).lean(),
  ]);

  return {
    users, hotels, rfps, calls, leads, groups, tasks, events,
    announcements, alerts, hotelScores, corporateProfiles, routines,
    attendance, leaveRequests,
    companySettings: companySettings || {},
    generatedAt: new Date().toISOString(),
  };
}

// ── All routes require API key ───────────────────────────────────────────────
router.use(apiKey);

// ── Individual collection endpoints ─────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const data = await User.find({}, USER_PROJECTION).lean();
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/hotels', async (req, res) => {
  try {
    const filter = {};
    if (req.query.category) filter.category = req.query.category;
    res.json({ data: await Hotel.find(filter).lean() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/rfps', async (req, res) => {
  try {
    const filter = {};
    if (req.query.status)  filter.status  = req.query.status;
    if (req.query.hotel)   filter.hotel   = req.query.hotel;
    const data = await RFP.find(filter).populate('addedBy', 'name username').lean();
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/calls', async (req, res) => {
  try {
    const filter = {};
    if (req.query.category) filter.category = req.query.category;
    if (req.query.outcome)  filter.outcome  = req.query.outcome;
    const data = await Call.find(filter).populate('loggedBy', 'name username').lean();
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/leads', async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const data = await Lead.find(filter).populate('loggedBy', 'name username').lean();
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/groups', async (req, res) => {
  try {
    const filter = {};
    if (req.query.type)  filter.type  = req.query.type;
    if (req.query.hotel) filter.hotel = req.query.hotel;
    const data = await Group.find(filter).populate('loggedBy', 'name username').lean();
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/tasks', async (req, res) => {
  try {
    const filter = {};
    if (req.query.status)   filter.status   = req.query.status;
    if (req.query.category) filter.category = req.query.category;
    const data = await Task.find(filter).populate('assignedTo createdBy', 'name username').lean();
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/events', async (req, res) => {
  try {
    const filter = {};
    if (req.query.month) {
      const [year, month] = req.query.month.split('-').map(Number);
      const start = new Date(year, month - 1, 1);
      const end   = new Date(year, month, 1);
      filter.date = { $gte: start, $lt: end };
    }
    const data = await Event.find(filter).populate('createdBy', 'name username').lean();
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/announcements', async (req, res) => {
  try {
    const data = await Announcement.find({}).sort({ noticeDate: -1 })
      .populate('author', 'name username').lean();
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/alerts', async (req, res) => {
  try {
    const data = await Alert.find({}).sort({ createdAt: -1 }).limit(200).lean();
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/hotel-scores', async (req, res) => {
  try {
    const filter = {};
    if (req.query.hotel) filter.hotel = req.query.hotel;
    const data = await HotelScore.find(filter)
      .populate('hotel', 'name city').populate('createdBy', 'name username').lean();
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/corporate-profiles', async (req, res) => {
  try {
    const data = await CorporateProfile.find({}).populate('loggedBy', 'name username').lean();
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/routines', async (req, res) => {
  try {
    const filter = {};
    if (req.query.category) filter.category = req.query.category;
    const data = await RoutineItem.find(filter).populate('user', 'name username').lean();
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/attendance', async (req, res) => {
  try {
    const filter = {};
    if (req.query.user) filter.user = req.query.user;
    if (req.query.date) filter.date = req.query.date;
    const data = await AttendanceLog.find(filter).populate('user', 'name username').lean();
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/leave-requests', async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.user)   filter.user   = req.query.user;
    const data = await LeaveRequest.find(filter).populate('user', 'name username').lean();
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/company-settings', async (req, res) => {
  try {
    const data = await CompanySettings.findOne({ key: 'singleton' }).lean();
    res.json({ data: data || {} });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Full snapshot ────────────────────────────────────────────────────────────
router.get('/snapshot', async (req, res) => {
  try {
    res.json(await buildSnapshot());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Real-time SSE stream ─────────────────────────────────────────────────────
/**
 * GET /api/external/stream
 *
 * Opens a persistent Server-Sent Events connection.
 * The server attempts MongoDB Change Streams first.
 * If not supported (standalone mongod), falls back to polling.
 *
 * Client usage:
 *   const es = new EventSource(
 *     'https://your-server/api/external/stream?apiKey=YOUR_KEY'
 *   );
 *   es.addEventListener('change',   e => console.log(JSON.parse(e.data)));
 *   es.addEventListener('snapshot', e => console.log(JSON.parse(e.data)));
 *   es.addEventListener('ping',     e => console.log(JSON.parse(e.data)));
 */

// Registry of active SSE response objects
const sseClients = new Set();

// Broadcast a named SSE event to every connected client
function broadcast(eventName, payload) {
  const msg = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of sseClients) {
    try { client.write(msg); } catch (_) { /* ignore closed sockets */ }
  }
}

// Collection → model map (used by change streams & polling)
const WATCHED_MODELS = {
  users:             User,
  hotels:            Hotel,
  rfps:              RFP,
  calls:             Call,
  leads:             Lead,
  groups:            Group,
  tasks:             Task,
  events:            Event,
  announcements:     Announcement,
  alerts:            Alert,
  hotelScores:       HotelScore,
  corporateProfiles: CorporateProfile,
  routines:          RoutineItem,
  attendance:        AttendanceLog,
  leaveRequests:     LeaveRequest,
  companySettings:   CompanySettings,
};

// ── Change Stream watcher (primary strategy) ─────────────────────────────────
let changeStreamsActive = false;
const openStreams = [];

async function startChangeStreams() {
  for (const [collectionName, Model] of Object.entries(WATCHED_MODELS)) {
    try {
      const stream = Model.watch([], { fullDocument: 'updateLookup' });

      stream.on('change', (change) => {
        broadcast('change', {
          collection:    collectionName,
          operationType: change.operationType,
          documentId:    change.documentKey?._id,
          document:      change.fullDocument ?? null,
        });
      });

      stream.on('error', () => {
        // Errors here are expected if this stream fails later; ignore
      });

      openStreams.push(stream);
    } catch (err) {
      throw err; // bubble up so caller knows change streams are unavailable
    }
  }
  changeStreamsActive = true;
}

// ── Polling fallback (if change streams are unavailable) ─────────────────────
let pollTimer = null;

async function startPolling() {
  let prevSnapshot = null;

  async function poll() {
    try {
      const snapshot = await buildSnapshot();

      if (prevSnapshot === null) {
        // First poll: just store, do not broadcast (client gets snapshot on connect)
        prevSnapshot = snapshot;
        return;
      }

      // Detect any collection-level difference and broadcast changed collections
      let changed = false;
      const changedCollections = {};

      for (const key of Object.keys(WATCHED_MODELS)) {
        const prev = JSON.stringify(prevSnapshot[key] || []);
        const curr = JSON.stringify(snapshot[key] || []);
        if (prev !== curr) {
          changed = true;
          changedCollections[key] = snapshot[key];
        }
      }

      if (changed) {
        broadcast('change', {
          source:   'poll',
          collections: changedCollections,
          ts: snapshot.generatedAt,
        });
        prevSnapshot = snapshot;
      }
    } catch (_) {
      // DB might be briefly unavailable; try again next cycle
    }
  }

  await poll(); // prime the snapshot
  pollTimer = setInterval(poll, POLL_INTERVAL_MS);
}

// ── Initialise real-time backend once at startup ─────────────────────────────
let realtimeReady = false;
async function initRealtime() {
  if (realtimeReady) return;
  realtimeReady = true;

  try {
    await startChangeStreams();
    console.log('[external API] Real-time: MongoDB Change Streams active.');
  } catch (err) {
    console.warn(
      '[external API] Change Streams unavailable (standalone mongod?). Falling back to polling every',
      POLL_INTERVAL_MS / 1000,
      's.'
    );
    await startPolling();
  }
}

// ── SSE endpoint ─────────────────────────────────────────────────────────────
router.get('/stream', async (req, res) => {
  // Start the real-time backend if not yet started
  if (!realtimeReady) await initRealtime();

  // SSE headers
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // nginx: disable buffering
  res.flushHeaders();

  // Send full snapshot immediately so the client has current state
  try {
    const snapshot = await buildSnapshot();
    res.write(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`);
  } catch (err) {
    res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
  }

  // Register this client
  sseClients.add(res);

  // Keep-alive ping every 30 seconds
  const pingInterval = setInterval(() => {
    try {
      res.write(`event: ping\ndata: ${JSON.stringify({ ts: new Date().toISOString() })}\n\n`);
    } catch (_) {
      clearInterval(pingInterval);
    }
  }, 30000);

  // Clean up on disconnect
  req.on('close', () => {
    clearInterval(pingInterval);
    sseClients.delete(res);
  });
});

module.exports = router;
