'use strict';

const nodemailer    = require('nodemailer');
const { logDailyData } = require('./dataLogger');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * At 5 AM IST this report runs.
 * Returns the PREVIOUS day in IST as 'YYYY-MM-DD' — the day being reported on.
 */
function getReportDay() {
  const istDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  istDate.setDate(istDate.getDate() - 1);
  const yyyy = istDate.getFullYear();
  const mm   = String(istDate.getMonth() + 1).padStart(2, '0');
  const dd   = String(istDate.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Returns UTC Date objects for the start and end of a given IST day. */
function getDayRange(dateStr) {
  return {
    start: new Date(`${dateStr}T00:00:00.000+05:30`),
    end:   new Date(`${dateStr}T23:59:59.999+05:30`),
  };
}

function fmtSecs(s) {
  if (!s || s <= 0) return '0h 0m';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${String(m).padStart(2, '0')}m`;
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : '—'; }
function val(v) { return (v !== null && v !== undefined && v !== '') ? v : '—'; }
function esc(s) {
  if (!s) return '—';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  bg: '#0b0d14', surface: '#1a1d27', surface2: '#22263a', surface3: '#2a2f47',
  border: '#2e3350', accent: '#ff6b00', accentSoft: 'rgba(255,107,0,0.12)',
  green: '#22c55e', greenSoft: 'rgba(34,197,94,0.12)',
  yellow: '#f59e0b', yellowSoft: 'rgba(245,158,11,0.12)',
  red: '#ef4444', redSoft: 'rgba(239,68,68,0.12)',
  blue: '#3b82f6', blueSoft: 'rgba(59,130,246,0.12)',
  purple: '#a855f7', purpleSoft: 'rgba(168,85,247,0.12)',
  teal: '#14b8a6', tealSoft: 'rgba(20,184,166,0.12)',
  pink: '#ec4899', pinkSoft: 'rgba(236,72,153,0.12)',
  text: '#f0f2ff', text2: '#9ba3c4', text3: '#5a6490',
};

// ─── SVG Icons ────────────────────────────────────────────────────────────────

const ICONS = {
  clock:     'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z',
  calendar:  'M20 3h-1V1h-2v2H7V1H5v2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 18H4V8h16v13zM4 6V5h16v1H4z',
  users:     'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
  building:  'M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z',
  briefcase: 'M20 6h-2.18c.07-.44.18-.86.18-1 0-2.21-1.79-4-4-4s-4 1.79-4 4c0 .14.11.56.18 1H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6-3c1.1 0 2 .9 2 2 0 .14-.11.56-.18 1h-3.64C12.11 5.56 12 5.14 12 5c0-1.1.9-2 2-2zm6 17H8V8h12v12z',
  document:  'M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.89 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z',
  phone:     'M6.62 10.79c1.44 2.83 3.76 5.15 6.59 6.59l2.2-2.2c.28-.28.67-.36 1.02-.25 1.12.37 2.32.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z',
  star:      'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z',
  check:     'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
  target:    'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm0-14c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z',
  barChart:  'M5 9.2h3V19H5V9.2zM10.6 5h2.8v14h-2.8V5zm5.6 8H19v6h-2.8v-6z',
  hotel:     'M7 13c1.66 0 3-1.34 3-3S8.66 7 7 7s-3 1.34-3 3 1.34 3 3 3zm12-6h-8v7H3V5H1v15h2v-3h18v3h2v-9c0-2.21-1.79-4-4-4z',
  event:     'M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z',
  campaign:  'M18 11v2h4v-2h-4zm-2 6.61c.96.71 2.21 1.65 3.2 2.39.4-.53.8-1.07 1.2-1.6-.99-.74-2.24-1.68-3.2-2.4-.4.54-.8 1.08-1.2 1.61zM20.4 5.6c-.4-.53-.8-1.07-1.2-1.6-.99.74-2.24 1.68-3.2 2.4.4.53.8 1.07 1.2 1.6.96-.72 2.21-1.65 3.2-2.4zM4 9c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2h1v4h2v-4h1l5 3V6L8 9H4zm11.5 3c0-1.33-.58-2.53-1.5-3.35v6.69c.92-.81 1.5-2.01 1.5-3.34z',
  refresh:   'M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z',
  bell:      'M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5S10.5 3.17 10.5 4v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z',
  send:      'M2.01 21L23 12 2.01 3 2 10l15 2-15 2z',
  shield:    'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z',
};

const icon = (key, color = C.text2, size = 16) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle;display:inline-block;margin-right:7px;flex-shrink:0;"><path d="${ICONS[key] || ''}"/></svg>`;

// ─── Responsive wrapper ───────────────────────────────────────────────────────

const wrap = (content) => `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="x-apple-disable-message-reformatting"/>
<meta name="color-scheme" content="dark"/>
<title>Orange Falcon CRM — Daily Report</title>
<style>
  *{box-sizing:border-box;}
  body{margin:0;padding:0;background:${C.bg};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
  table{border-collapse:collapse;}
  img{border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;}
  .email-wrapper{background:${C.bg};padding:24px 12px;}
  .email-main{width:700px;max-width:100%;}
  .kpi-table{width:100%;}
  .kpi-cell{padding:0 5px;width:16.66%;}
  .data-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;}
  .hide-sm{display:table-cell;}
  @media screen and (max-width:640px){
    .email-wrapper{padding:12px 4px!important;}
    .email-main{width:100%!important;}
    .kpi-cell{width:33.33%!important;display:inline-block!important;padding:3px!important;vertical-align:top!important;}
    .kpi-table{display:block!important;}
    .data-scroll{display:block!important;overflow-x:auto!important;}
    .hide-sm{display:none!important;}
    .hero-stat{display:none!important;}
    h1.report-title{font-size:20px!important;}
    .section-title{font-size:14px!important;}
  }
</style>
</head>
<body>
<table width="100%" cellpadding="0" cellspacing="0" class="email-wrapper">
<tr><td align="center">
<table cellpadding="0" cellspacing="0" class="email-main" style="max-width:700px;width:100%;">
${content}
</table>
</td></tr></table>
</body></html>`;

// ─── HTML micro-components ────────────────────────────────────────────────────

const kpi = (value, label, color, bg) => `
  <td class="kpi-cell" style="padding:0 5px;">
    <div style="background:${bg};border:1px solid ${C.border};border-radius:12px;padding:16px 10px;text-align:center;">
      <div style="font-size:22px;font-weight:800;color:${color};letter-spacing:-1px;font-variant-numeric:tabular-nums;">${value}</div>
      <div style="font-size:9px;color:${C.text2};margin-top:4px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;line-height:1.3;">${label}</div>
    </div>
  </td>`;

const badge = (text, color, bg) =>
  `<span style="display:inline-block;padding:2px 9px;border-radius:20px;font-size:10px;font-weight:700;background:${bg};color:${color};white-space:nowrap;">${esc(text)}</span>`;

const sectionHead = (iconSvg, title, color, count) => `
<tr><td style="padding:28px 0 10px;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td style="border-left:3px solid ${color};padding:5px 0 5px 14px;">
      <div class="section-title" style="font-size:15px;font-weight:800;color:${C.text};display:flex;align-items:center;gap:8px;">
        ${iconSvg}<span>${esc(title)}${count !== undefined ? ` <span style="font-size:12px;font-weight:600;color:${C.text3};">(${count})</span>` : ''}</span>
      </div>
    </td>
  </tr></table>
</td></tr>`;

const th = (cols) =>
  `<tr style="background:${C.surface2};">${cols.map(c =>
    `<th style="padding:9px 11px;text-align:left;font-size:9px;font-weight:700;color:${C.text3};text-transform:uppercase;letter-spacing:0.8px;border-bottom:1px solid ${C.border};white-space:nowrap;">${c}</th>`
  ).join('')}</tr>`;

const tr = (cells, i) => {
  const bg = i % 2 === 0 ? C.surface : C.surface2;
  return `<tr style="background:${bg};">${cells.map(c =>
    `<td style="padding:9px 11px;font-size:12px;color:${C.text};border-bottom:1px solid ${C.border};vertical-align:middle;">${c ?? '—'}</td>`
  ).join('')}</tr>`;
};

const emptyRow = (colspan, msg) =>
  `<tr><td colspan="${colspan}" style="padding:20px 12px;text-align:center;font-size:12px;color:${C.text3};font-style:italic;border-bottom:1px solid ${C.border};">${msg}</td></tr>`;

const tableWrap = (rows) =>
  `<tr><td style="padding:0 0 6px;">
    <div class="data-scroll">
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.border};border-radius:10px;overflow:hidden;min-width:480px;">
        ${rows}
      </table>
    </div>
  </td></tr>`;

const noneToday = (msg = 'Nothing recorded for this day.') =>
  `<tr><td style="padding:0 0 6px;">
    <div style="border:1px solid ${C.border};border-radius:10px;padding:18px;text-align:center;font-size:12px;color:${C.text3};font-style:italic;">
      ${msg}
    </div>
  </td></tr>`;

// ─── Status colour maps ───────────────────────────────────────────────────────

const outcomeColor = (o) => ({ Connected:[C.green,C.greenSoft], Interested:[C.blue,C.blueSoft], Voicemail:[C.yellow,C.yellowSoft], 'No Answer':[C.text3,C.surface3], 'Not Interested':[C.red,C.redSoft] }[o] || [C.text2,C.surface2]);
const taskColor    = (s) => ({ completed:[C.green,C.greenSoft], 'in-progress':[C.yellow,C.yellowSoft], pending:[C.text3,C.surface3] }[s] || [C.text2,C.surface2]);
const rfpColor     = (s) => ({ Won:[C.green,C.greenSoft], Responded:[C.blue,C.blueSoft], 'Follow Up':[C.yellow,C.yellowSoft], Pending:[C.text3,C.surface3], Lost:[C.red,C.redSoft] }[s] || [C.text2,C.surface2]);
const leadColor    = (s) => ({ new:[C.accent,C.accentSoft], contacted:[C.blue,C.blueSoft], quoted:[C.purple,C.purpleSoft], converted:[C.green,C.greenSoft], lost:[C.red,C.redSoft] }[s] || [C.text2,C.surface2]);
const leaveColor   = (s) => ({ approved:[C.green,C.greenSoft], denied:[C.red,C.redSoft], pending:[C.yellow,C.yellowSoft] }[s] || [C.text2,C.surface2]);
const scoreColor   = (n) => n >= 80 ? C.green : n >= 60 ? C.yellow : C.red;

// ─── Mailer ───────────────────────────────────────────────────────────────────

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.REPORT_SMTP_HOST || 'smtp.ionos.com',
    port: parseInt(process.env.REPORT_SMTP_PORT || '587', 10),
    secure: false,
    auth: { user: process.env.REPORT_FROM_EMAIL, pass: process.env.REPORT_FROM_PASS },
    tls: { rejectUnauthorized: false },
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function generateAndSend() {
  const User             = require('../models/User');
  const AttendanceLog    = require('../models/AttendanceLog');
  const LeaveRequest     = require('../models/LeaveRequest');
  const Call             = require('../models/Call');
  const Task             = require('../models/Task');
  const RFP              = require('../models/RFP');
  const HotelScore       = require('../models/HotelScore');
  const Lead             = require('../models/Lead');
  const Announcement     = require('../models/Announcement');
  const Group            = require('../models/Group');
  const CorporateProfile = require('../models/CorporateProfile');
  const Hotel            = require('../models/Hotel');
  const Event            = require('../models/Event');
  const RoutineItem      = require('../models/RoutineItem');
  const Alert            = require('../models/Alert');
  const CompanySettings  = require('../models/CompanySettings');

  // Report covers the PREVIOUS day in IST (runs at 5 AM IST)
  const reportDay = getReportDay();
  const { start: dayStart, end: dayEnd } = getDayRange(reportDay);

  const reportDate = new Date(`${reportDay}T12:00:00+05:30`).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
  const nowTime = new Date().toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata',
  });

  // Fetch today's data + reference data in parallel
  const [
    users, attendanceLogs, todayLeaves,
    salesCalls, repCalls,
    salesTasks, repTasks,
    rfps, hotelScores, leads,
    announcements, groups, todayCorps,
    hotels, todayEvents, routines, alerts,
    totalCorpCount, totalGroupCount,
    companySettings,
  ] = await Promise.all([
    // Reference data (whole collection, for VPS log + team summary)
    User.find().select('-password -loginAttempts -lockUntil').sort({ name: 1 }),

    // Attendance — filter by date string (IST date) OR createdAt range
    AttendanceLog.find({
      $or: [{ date: reportDay }, { createdAt: { $gte: dayStart, $lte: dayEnd } }],
    }).populate('user', 'name title role'),

    // Leaves for this specific date
    LeaveRequest.find({ date: reportDay }).populate('user', 'name title'),

    // Calls logged today
    Call.find({ category: 'sales',      createdAt: { $gte: dayStart, $lte: dayEnd } }).populate('loggedBy', 'name').sort({ createdAt: -1 }),
    Call.find({ category: 'reputation', createdAt: { $gte: dayStart, $lte: dayEnd } }).populate('loggedBy', 'name').sort({ createdAt: -1 }),

    // Tasks created today, due today, or completed today
    Task.find({ category: 'sales',      $or: [{ createdAt: { $gte: dayStart, $lte: dayEnd } }, { deadline: { $gte: dayStart, $lte: dayEnd } }, { completedAt: { $gte: dayStart, $lte: dayEnd } }] }).populate('assignedTo createdBy', 'name').sort({ deadline: 1 }),
    Task.find({ category: 'reputation', $or: [{ createdAt: { $gte: dayStart, $lte: dayEnd } }, { deadline: { $gte: dayStart, $lte: dayEnd } }, { completedAt: { $gte: dayStart, $lte: dayEnd } }] }).populate('assignedTo createdBy', 'name').sort({ deadline: 1 }),

    // New entries created today
    RFP.find({ createdAt: { $gte: dayStart, $lte: dayEnd } }).populate('hotel', 'name city').populate('addedBy', 'name').sort({ createdAt: -1 }),
    HotelScore.find({ createdAt: { $gte: dayStart, $lte: dayEnd } }).populate('hotel', 'name city').populate('createdBy', 'name').sort({ createdAt: -1 }),
    Lead.find({ createdAt: { $gte: dayStart, $lte: dayEnd } }).populate('loggedBy', 'name').sort({ createdAt: -1 }),
    Announcement.find({ createdAt: { $gte: dayStart, $lte: dayEnd } }).populate('author', 'name').sort({ createdAt: -1 }),

    // Groups logged today (includes CC numbers + expiry)
    Group.find({ createdAt: { $gte: dayStart, $lte: dayEnd } }).populate('hotel', 'name city').populate('loggedBy', 'name').sort({ createdAt: -1 }),

    // Corporate profiles logged today (includes CC numbers)
    CorporateProfile.find({ createdAt: { $gte: dayStart, $lte: dayEnd } }).populate('loggedBy', 'name').sort({ name: 1 }),

    // Reference lists
    Hotel.find().sort({ name: 1 }),

    // Events happening today or created today
    Event.find({ $or: [{ date: { $gte: dayStart, $lte: dayEnd } }, { createdAt: { $gte: dayStart, $lte: dayEnd } }] }).populate('createdBy', 'name').sort({ date: 1 }),

    // Routines (static reference — for VPS log only)
    RoutineItem.find().populate('user', 'name').sort({ order: 1 }),

    // Alerts triggered today
    Alert.find({ createdAt: { $gte: dayStart, $lte: dayEnd } }).sort({ createdAt: -1 }),

    // Total DB counts for context
    CorporateProfile.countDocuments(),
    Group.countDocuments(),

    CompanySettings.findOne({ key: 'singleton' }),
  ]);

  const companyName    = companySettings?.companyName || 'Orange Falcon';
  const companyLogo    = companySettings?.logo || '';
  const totalCalls     = salesCalls.length + repCalls.length;
  const presentCount   = attendanceLogs.length;
  const onLeaveToday   = todayLeaves.length;
  const totalWorked    = attendanceLogs.reduce((s, l) => s + (l.workedSeconds || 0), 0);
  const pendingTasks   = [...salesTasks, ...repTasks].filter(t => t.status !== 'completed').length;
  const overdueTasks   = [...salesTasks, ...repTasks].filter(t => t.status !== 'completed' && t.deadline && new Date(t.deadline) < dayEnd).length;
  const completedToday = [...salesTasks, ...repTasks].filter(t => t.status === 'completed').length;

  // Determine recipients
  const dbRecipients  = (companySettings?.reportRecipients || []).filter(Boolean);
  const envRecipient  = process.env.REPORT_TO_EMAIL;
  const allRecipients = dbRecipients.length > 0 ? dbRecipients : (envRecipient ? [envRecipient] : []);
  if (allRecipients.length === 0) throw new Error('No report recipients configured');

  // ── VPS Security Log ─────────────────────────────────────────────────────────
  // Write a full snapshot to disk before sending email, so we never lose data.
  logDailyData(reportDay, {
    reportMeta:        { reportDay, generatedAt_IST: nowTime, recipients: allRecipients },
    attendance:        attendanceLogs,
    leaves:            todayLeaves,
    salesCalls,        repCalls,
    salesTasks,        repTasks,
    rfps,              hotelScores,
    leads,             announcements,
    groups,            // ← includes creditCardNumber, cardExpDate
    corporateProfiles: todayCorps, // ← includes ccNumber, ccExpiry
    allUsers:          users,
    allHotels:         hotels,
    allRoutines:       routines,
    todayEvents,       alerts,
    dbTotals: { users: users.length, hotels: hotels.length, corporates: totalCorpCount, groups: totalGroupCount },
  });

  // ─── Build HTML ──────────────────────────────────────────────────────────────
  let body = '';

  // ── HERO HEADER ──────────────────────────────────────────────────────────────
  body += `
  <tr><td style="padding:0 0 20px;">
    <div style="background:linear-gradient(135deg,${C.surface} 0%,${C.surface2} 100%);border:1px solid ${C.border};border-radius:18px;overflow:hidden;">
      <div style="background:linear-gradient(90deg,${C.accent} 0%,#ff9340 100%);height:4px;"></div>
      <div style="padding:28px 32px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td valign="middle">
            ${companyLogo
              ? `<img src="${companyLogo}" alt="${esc(companyName)}" width="72" height="72" style="border-radius:12px;display:block;margin-bottom:12px;object-fit:contain;background:${C.surface3};"/>`
              : `<div style="width:56px;height:56px;border-radius:12px;background:linear-gradient(135deg,${C.accent},#ff9340);display:flex;align-items:center;justify-content:center;margin-bottom:12px;">
                   <svg width="32" height="32" viewBox="0 0 24 24" fill="white"><path d="${ICONS.send}"/></svg>
                 </div>`
            }
            <div style="font-size:10px;font-weight:700;color:${C.accent};text-transform:uppercase;letter-spacing:2px;margin-bottom:6px;">${esc(companyName)} &nbsp;&bull;&nbsp; Daily Report</div>
            <h1 class="report-title" style="margin:0 0 6px;font-size:24px;font-weight:800;color:${C.text};letter-spacing:-0.5px;">Daily Activity Report</h1>
            <div style="font-size:13px;color:${C.text2};">${reportDate} &nbsp;&middot;&nbsp; Generated at ${nowTime} IST</div>
            <div style="margin-top:8px;font-size:11px;color:${C.text3};">
              ${presentCount} present &bull; ${totalCalls} calls logged &bull; ${groups.length} groups added &bull; ${rfps.length} RFPs added &bull; ${leads.length} leads added
            </div>
          </td>
          <td class="hero-stat" align="right" valign="top" style="padding-left:20px;white-space:nowrap;">
            <div style="background:${C.accentSoft};border:1px solid rgba(255,107,0,0.25);border-radius:14px;padding:18px 24px;text-align:center;">
              <div style="font-size:36px;font-weight:800;color:${C.accent};letter-spacing:-2px;">${totalCalls}</div>
              <div style="font-size:10px;color:${C.text2};font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-top:2px;">Calls Today</div>
            </div>
            <div style="margin-top:10px;background:${C.greenSoft};border:1px solid rgba(34,197,94,0.2);border-radius:14px;padding:14px 24px;text-align:center;">
              <div style="font-size:28px;font-weight:800;color:${C.green};letter-spacing:-1px;">${presentCount}</div>
              <div style="font-size:10px;color:${C.text2};font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-top:2px;">Present</div>
            </div>
          </td>
        </tr></table>
      </div>
    </div>
  </td></tr>`;

  // ── KPI STRIP ────────────────────────────────────────────────────────────────
  body += `
  <tr><td style="padding:0 0 6px;">
    <table class="kpi-table" cellpadding="0" cellspacing="0" width="100%"><tr>
      ${kpi(fmtSecs(totalWorked), "Hours Worked", C.green, C.greenSoft)}
      ${kpi(presentCount, 'Present', C.accent, C.accentSoft)}
      ${kpi(onLeaveToday, 'On Leave', C.yellow, C.yellowSoft)}
      ${kpi(salesCalls.length, 'Sales Calls', C.blue, C.blueSoft)}
      ${kpi(repCalls.length, 'Rep Calls', C.purple, C.purpleSoft)}
      ${kpi(totalCalls, 'Total Calls', C.teal, C.tealSoft)}
    </tr></table>
  </td></tr>
  <tr><td style="padding:4px 0 0;">
    <table class="kpi-table" cellpadding="0" cellspacing="0" width="100%"><tr>
      ${kpi(groups.length, 'Groups Added', C.teal, C.tealSoft)}
      ${kpi(rfps.length, 'RFPs Added', C.pink, C.pinkSoft)}
      ${kpi(leads.length, 'Leads Added', C.green, C.greenSoft)}
      ${kpi(completedToday, 'Tasks Done', C.blue, C.blueSoft)}
      ${kpi(pendingTasks, 'Open Tasks', C.yellow, C.yellowSoft)}
      ${kpi(overdueTasks, 'Overdue', C.red, C.redSoft)}
    </tr></table>
  </td></tr>

  <tr><td>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${C.surface};border:1px solid ${C.border};border-radius:16px;overflow:hidden;border-collapse:separate;padding:0 20px 20px;margin-top:20px;">`;

  // ════════════════════════════════════════════════════════════════════════════
  // 1. ATTENDANCE
  // ════════════════════════════════════════════════════════════════════════════
  body += sectionHead(icon('clock', C.green, 18), "Attendance", C.green, attendanceLogs.length);
  if (attendanceLogs.length === 0 && todayLeaves.length === 0) {
    body += noneToday('No attendance recorded for this day.');
  } else {
    let attRows = th(['Employee', 'Title', 'Role', 'Clock In', 'Clock Out', 'Hours', 'Break']);
    attendanceLogs.forEach((l, i) => {
      attRows += tr([
        `<strong>${esc(l.user?.name)}</strong>`,
        val(l.user?.title),
        badge(cap(l.user?.role), l.user?.role === 'admin' ? C.accent : C.blue, l.user?.role === 'admin' ? C.accentSoft : C.blueSoft),
        fmtDateTime(l.clockInTime),
        l.clockOutTime ? fmtDateTime(l.clockOutTime) : badge('Still In', C.green, C.greenSoft),
        `<strong style="color:${C.green};">${fmtSecs(l.workedSeconds)}</strong>`,
        fmtSecs(l.breakSeconds),
      ], i);
    });
    todayLeaves.forEach((lv, i) => {
      attRows += tr([
        `<strong>${esc(lv.user?.name)}</strong>`,
        val(lv.user?.title), '—',
        badge('On Leave', C.yellow, C.yellowSoft),
        '—', '—',
        badge(cap(lv.type), C.yellow, C.yellowSoft),
      ], attendanceLogs.length + i);
    });
    body += tableWrap(attRows);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 2. LEAVE REQUESTS (this day)
  // ════════════════════════════════════════════════════════════════════════════
  body += sectionHead(icon('calendar', C.yellow, 18), "Leave Requests", C.yellow, todayLeaves.length);
  if (todayLeaves.length === 0) {
    body += noneToday('No leave requests for this day.');
  } else {
    let lvRows = th(['Employee', 'Date', 'Type', 'Reason', 'Status', 'Submitted']);
    todayLeaves.forEach((lv, i) => {
      const [sc, sb] = leaveColor(lv.status);
      lvRows += tr([
        `<strong>${esc(lv.user?.name)}</strong>`,
        lv.date,
        cap(lv.type),
        esc(val(lv.reason)),
        badge(cap(lv.status), sc, sb),
        fmtDateTime(lv.createdAt),
      ], i);
    });
    body += tableWrap(lvRows);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 3. GROUPS ADDED TODAY (with CC info)
  // ════════════════════════════════════════════════════════════════════════════
  body += sectionHead(icon('building', C.teal, 18), "Groups Added", C.teal, groups.length);
  if (groups.length === 0) {
    body += noneToday('No groups logged today.');
  } else {
    let grpRows = th(['Group Name', 'Hotel', 'Type', 'Check-In', 'Check-Out', 'Rooms', 'Nights', 'Rate', 'CC Number', 'CC Expiry', 'Banquet', 'Notes', 'Logged By']);
    groups.forEach((g, i) => {
      const isGuaranteed = g.type === 'guaranteed';
      const hasBanquet   = g.roomBanquet === 'B';
      grpRows += tr([
        `<strong style="color:${C.teal};">${esc(g.groupName)}</strong>`,
        esc(g.hotel?.name || '—'),
        badge(cap(g.type), isGuaranteed ? C.green : C.yellow, isGuaranteed ? C.greenSoft : C.yellowSoft),
        fmtDate(g.checkIn),
        fmtDate(g.checkOut),
        val(g.numRooms),
        val(g.numRoomNights),
        g.rate ? `$${g.rate}` : '—',
        `<strong style="color:${C.pink};font-family:monospace;letter-spacing:1px;">${val(g.creditCardNumber)}</strong>`,
        `<span style="color:${C.pink};">${val(g.cardExpDate)}</span>`,
        hasBanquet
          ? `${fmtDate(g.banquetCheckIn)} ${g.banquetCheckInTime || ''}→${g.banquetCheckOutTime || ''} (${g.banquetDurationHours ?? '?'}h)`
          : '—',
        `<span style="font-size:11px;color:${C.text2};">${esc(val(g.notes))}</span>`,
        esc(val(g.loggedBy?.name)),
      ], i);
    });
    body += tableWrap(grpRows);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 4. CORPORATE PROFILES ADDED TODAY (with CC info)
  // ════════════════════════════════════════════════════════════════════════════
  body += sectionHead(icon('briefcase', C.pink, 18), "Corporate Profiles Added", C.pink, todayCorps.length);
  if (todayCorps.length === 0) {
    body += noneToday('No corporate profiles added today.');
  } else {
    let corpRows = th(['Name', 'Company', 'Phone', 'Email', 'CC Number', 'CC Expiry', 'Notes', 'Logged By', 'Added']);
    todayCorps.forEach((c, i) => {
      corpRows += tr([
        `<strong>${esc(c.name)}</strong>`,
        esc(val(c.company)),
        val(c.phone),
        val(c.email),
        `<strong style="color:${C.pink};font-family:monospace;letter-spacing:1px;">${val(c.ccNumber)}</strong>`,
        `<span style="color:${C.pink};">${val(c.ccExpiry)}</span>`,
        `<span style="font-size:11px;color:${C.text2};">${esc(val(c.notes))}</span>`,
        esc(val(c.loggedBy?.name)),
        fmtDate(c.createdAt),
      ], i);
    });
    body += tableWrap(corpRows);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 5. SALES CALLS
  // ════════════════════════════════════════════════════════════════════════════
  body += sectionHead(icon('phone', C.accent, 18), "Sales Calls", C.accent, salesCalls.length);
  if (salesCalls.length === 0) {
    body += noneToday('No sales calls logged today.');
  } else {
    let scRows = th(['Contact', 'Phone', 'Outcome', 'Notes', 'Logged By', 'Time']);
    salesCalls.forEach((c, i) => {
      const [oc, ob] = outcomeColor(c.outcome);
      scRows += tr([
        `<strong>${esc(c.name)}</strong>`,
        val(c.phone),
        badge(c.outcome, oc, ob),
        `<span style="font-size:11px;color:${C.text2};">${esc(val(c.notes))}</span>`,
        esc(val(c.loggedBy?.name)),
        fmtDateTime(c.createdAt),
      ], i);
    });
    body += tableWrap(scRows);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 6. REPUTATION CALLS
  // ════════════════════════════════════════════════════════════════════════════
  body += sectionHead(icon('star', C.purple, 18), "Reputation Calls", C.purple, repCalls.length);
  if (repCalls.length === 0) {
    body += noneToday('No reputation calls logged today.');
  } else {
    let rcRows = th(['Contact', 'Phone', 'Outcome', 'Notes', 'Logged By', 'Time']);
    repCalls.forEach((c, i) => {
      const [oc, ob] = outcomeColor(c.outcome);
      rcRows += tr([
        `<strong>${esc(c.name)}</strong>`,
        val(c.phone),
        badge(c.outcome, oc, ob),
        `<span style="font-size:11px;color:${C.text2};">${esc(val(c.notes))}</span>`,
        esc(val(c.loggedBy?.name)),
        fmtDateTime(c.createdAt),
      ], i);
    });
    body += tableWrap(rcRows);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 7. SALES TASKS (created / due / completed today)
  // ════════════════════════════════════════════════════════════════════════════
  body += sectionHead(icon('check', C.blue, 18), "Sales Tasks", C.blue, salesTasks.length);
  if (salesTasks.length === 0) {
    body += noneToday('No sales tasks active today.');
  } else {
    let stRows = th(['Task', 'Assigned To', 'Created By', 'Deadline', 'Status', 'Completed At', 'Notes']);
    salesTasks.forEach((t, i) => {
      const [sc, sb] = taskColor(t.status);
      const overdue  = t.status !== 'completed' && t.deadline && new Date(t.deadline) < new Date();
      stRows += tr([
        `<strong${overdue ? ` style="color:${C.red};"` : ''}>${esc(t.taskName)}${overdue ? ' ⚠ OVERDUE' : ''}</strong>`,
        esc(val(t.assignedTo?.name)),
        esc(val(t.createdBy?.name)),
        fmtDate(t.deadline),
        badge(cap(t.status), sc, sb),
        t.completedAt ? fmtDateTime(t.completedAt) : '—',
        `<span style="font-size:11px;color:${C.text2};">${esc(val(t.notes))}</span>`,
      ], i);
    });
    body += tableWrap(stRows);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 8. REPUTATION TASKS
  // ════════════════════════════════════════════════════════════════════════════
  body += sectionHead(icon('star', C.purple, 18), "Reputation Tasks", C.purple, repTasks.length);
  if (repTasks.length === 0) {
    body += noneToday('No reputation tasks active today.');
  } else {
    let rtRows = th(['Task', 'Assigned To', 'Created By', 'Deadline', 'Status', 'Completed At', 'Notes']);
    repTasks.forEach((t, i) => {
      const [sc, sb] = taskColor(t.status);
      const overdue  = t.status !== 'completed' && t.deadline && new Date(t.deadline) < new Date();
      rtRows += tr([
        `<strong${overdue ? ` style="color:${C.red};"` : ''}>${esc(t.taskName)}${overdue ? ' ⚠ OVERDUE' : ''}</strong>`,
        esc(val(t.assignedTo?.name)),
        esc(val(t.createdBy?.name)),
        fmtDate(t.deadline),
        badge(cap(t.status), sc, sb),
        t.completedAt ? fmtDateTime(t.completedAt) : '—',
        `<span style="font-size:11px;color:${C.text2};">${esc(val(t.notes))}</span>`,
      ], i);
    });
    body += tableWrap(rtRows);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 9. RFPs ADDED TODAY
  // ════════════════════════════════════════════════════════════════════════════
  body += sectionHead(icon('document', C.yellow, 18), "RFPs Added", C.yellow, rfps.length);
  if (rfps.length === 0) {
    body += noneToday('No RFPs added today.');
  } else {
    let rfpRows = th(['Client', 'Hotel', 'Check-In', 'Check-Out', 'Rooms', 'Price', 'Status', 'Priority', 'In Consideration', 'Notes', 'Added By']);
    rfps.forEach((r, i) => {
      const [sc, sb] = rfpColor(r.status);
      rfpRows += tr([
        `<strong>${esc(r.client)}</strong>`,
        esc(r.hotel?.name || '—'),
        r.checkin  ? fmtDate(r.checkin)  : '—',
        r.checkout ? fmtDate(r.checkout) : '—',
        val(r.numRooms),
        r.price ? `$${Number(r.price).toLocaleString()}` : '—',
        badge(r.status, sc, sb),
        r.priority        ? badge('Priority', C.yellow, C.yellowSoft) : '—',
        r.inConsideration ? badge('Yes', C.blue, C.blueSoft) : '—',
        `<span style="font-size:11px;color:${C.text2};">${esc(val(r.notes))}</span>`,
        esc(val(r.addedBy?.name)),
      ], i);
    });
    body += tableWrap(rfpRows);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 10. LEADS ADDED TODAY
  // ════════════════════════════════════════════════════════════════════════════
  body += sectionHead(icon('target', C.green, 18), "Leads Added", C.green, leads.length);
  if (leads.length === 0) {
    body += noneToday('No leads added today.');
  } else {
    let ldRows = th(['Contact', 'Company', 'Email', 'Phone', 'Room Type', 'Rooms', 'Check-In', 'Check-Out', 'Rate', 'Status', 'Source', 'Notes', 'Logged By']);
    leads.forEach((l, i) => {
      const [sc, sb] = leadColor(l.status);
      ldRows += tr([
        `<strong>${esc(l.contactName)}</strong>`,
        esc(val(l.company)), val(l.email), val(l.phone),
        cap(l.roomType),
        val(l.numRooms),
        l.checkIn  ? fmtDate(l.checkIn)  : '—',
        l.checkOut ? fmtDate(l.checkOut) : '—',
        l.rateOffered ? `$${l.rateOffered}` : '—',
        badge(cap(l.status), sc, sb),
        esc(val(l.source)),
        `<span style="font-size:11px;color:${C.text2};">${esc(val(l.notes))}</span>`,
        esc(val(l.loggedBy?.name)),
      ], i);
    });
    body += tableWrap(ldRows);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 11. HOTEL SCORES ADDED TODAY
  // ════════════════════════════════════════════════════════════════════════════
  body += sectionHead(icon('barChart', C.blue, 18), "Hotel Scores", C.blue, hotelScores.length);
  if (hotelScores.length === 0) {
    body += noneToday('No hotel scores logged today.');
  } else {
    let hsRows = th(['Hotel', 'City', 'Score', 'Date', 'Logged By', 'Notes']);
    hotelScores.forEach((hs, i) => {
      const sc = scoreColor(hs.score);
      hsRows += tr([
        `<strong>${esc(hs.hotel?.name || '—')}</strong>`,
        esc(val(hs.hotel?.city)),
        `<strong style="color:${sc};font-size:15px;">${hs.score}</strong><span style="color:${C.text3};font-size:10px;">/100</span>`,
        fmtDate(hs.date),
        esc(val(hs.createdBy?.name)),
        `<span style="font-size:11px;color:${C.text2};">${esc(val(hs.notes))}</span>`,
      ], i);
    });
    body += tableWrap(hsRows);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 12. EVENTS TODAY
  // ════════════════════════════════════════════════════════════════════════════
  body += sectionHead(icon('event', C.yellow, 18), "Events", C.yellow, todayEvents.length);
  if (todayEvents.length === 0) {
    body += noneToday('No events today.');
  } else {
    let evRows = th(['Event Name', 'Date', 'Notes', 'Created By', 'Added']);
    todayEvents.forEach((e, i) => {
      evRows += tr([
        `<strong>${esc(e.name)}</strong>`,
        fmtDate(e.date),
        `<span style="font-size:11px;color:${C.text2};">${esc(val(e.notes))}</span>`,
        esc(val(e.createdBy?.name)),
        fmtDate(e.createdAt),
      ], i);
    });
    body += tableWrap(evRows);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 13. ANNOUNCEMENTS TODAY
  // ════════════════════════════════════════════════════════════════════════════
  body += sectionHead(icon('campaign', C.yellow, 18), "Announcements", C.yellow, announcements.length);
  if (announcements.length === 0) {
    body += noneToday('No announcements today.');
  } else {
    announcements.forEach(a => {
      const priColor = a.priority === 'urgent' ? C.red : a.priority === 'important' ? C.yellow : C.blue;
      const priBg    = a.priority === 'urgent' ? C.redSoft : a.priority === 'important' ? C.yellowSoft : C.blueSoft;
      body += `<tr><td style="padding:0 0 8px;">
        <div style="background:${C.surface2};border:1px solid ${C.border};border-radius:10px;padding:14px 16px;">
          <table width="100%" cellpadding="0" cellspacing="0"><tr>
            <td><strong style="font-size:13px;color:${C.text};">${esc(a.heading)}</strong></td>
            <td align="right">${badge(cap(a.priority), priColor, priBg)}</td>
          </tr></table>
          <p style="margin:8px 0 0;font-size:12px;color:${C.text2};line-height:1.6;">${esc(a.body)}</p>
          <div style="margin-top:8px;font-size:10px;color:${C.text3};">— ${esc(a.author?.name || 'Unknown')} &middot; ${fmtDateTime(a.createdAt)}</div>
        </div>
      </td></tr>`;
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 14. ALERTS TODAY
  // ════════════════════════════════════════════════════════════════════════════
  body += sectionHead(icon('bell', C.red, 18), "Alerts", C.red, alerts.length);
  if (alerts.length === 0) {
    body += noneToday('No alerts today.');
  } else {
    let alRows = th(['Message', 'Type', 'Read', 'Time']);
    alerts.forEach((a, i) => {
      alRows += tr([
        esc(val(a.message)),
        badge(cap(a.type), C.yellow, C.yellowSoft),
        a.read ? badge('Read', C.green, C.greenSoft) : badge('Unread', C.red, C.redSoft),
        fmtDateTime(a.createdAt),
      ], i);
    });
    body += tableWrap(alRows);
  }

  // ── TEAM SUMMARY ─────────────────────────────────────────────────────────────
  body += sectionHead(icon('users', C.accent, 18), "Team", C.accent, users.length);
  let userRows = th(['Name', 'Role', 'Title', 'Email', 'Phone']);
  users.forEach((u, i) => {
    userRows += tr([
      `<strong>${esc(u.name)}</strong>`,
      badge(cap(u.role), u.role === 'admin' ? C.accent : C.blue, u.role === 'admin' ? C.accentSoft : C.blueSoft),
      val(u.title), val(u.email), val(u.phone),
    ], i);
  });
  body += tableWrap(userRows);

  // ── FOOTER ───────────────────────────────────────────────────────────────────
  body += `
  </table>
  </td></tr>

  <tr><td style="padding:28px 0 0;">
    <div style="border-top:1px solid ${C.border};padding-top:20px;text-align:center;">
      <div style="margin-bottom:8px;">${icon('shield', C.accent, 20)}</div>
      <div style="font-size:12px;color:${C.text2};font-weight:600;">
        <span style="color:${C.accent};">${esc(companyName)} CRM</span> &nbsp;&bull;&nbsp; Daily Report &nbsp;&bull;&nbsp; ${reportDate}
      </div>
      <div style="font-size:10px;color:${C.text3};margin-top:5px;">
        Generated at ${nowTime} IST &nbsp;&middot;&nbsp; Covers activity from ${reportDay} (IST)
      </div>
      <div style="font-size:10px;color:${C.text3};margin-top:3px;">
        ${allRecipients.length} recipient${allRecipients.length !== 1 ? 's' : ''} &nbsp;&middot;&nbsp;
        DB totals: ${users.length} users &bull; ${totalGroupCount} groups &bull; ${totalCorpCount} corp profiles &bull; ${hotels.length} hotels
      </div>
      <div style="font-size:10px;color:${C.text3};margin-top:3px;font-style:italic;">
        Full data snapshot also saved to VPS log for ${reportDay}
      </div>
    </div>
  </td></tr>`;

  const html = wrap(body);

  // ── Send ──────────────────────────────────────────────────────────────────────
  const transport = createTransport();
  await transport.sendMail({
    from:    `"${companyName} CRM" <${process.env.REPORT_FROM_EMAIL}>`,
    to:      allRecipients.join(', '),
    subject: `[${companyName}] Daily Report — ${reportDate} · ${totalCalls} calls · ${groups.length} groups · ${presentCount} present`,
    html,
    text:    `Daily Report — ${reportDate}\n\nPresent: ${presentCount} | Calls: ${totalCalls} (Sales: ${salesCalls.length}, Rep: ${repCalls.length}) | Groups: ${groups.length} | RFPs: ${rfps.length} | Leads: ${leads.length} | Tasks Done: ${completedToday}\n\nView the HTML version for full details.`,
  });

  console.log(`[DailyReport] ✅ Daily report sent to ${allRecipients.join(', ')} for ${reportDay}`);
  return {
    success: true,
    reportDay,
    recipients: allRecipients,
    counts: {
      present: presentCount, totalCalls, salesCalls: salesCalls.length, repCalls: repCalls.length,
      groups: groups.length, rfps: rfps.length, leads: leads.length, tasksCompleted: completedToday,
    },
  };
}

module.exports = { generateAndSend };
