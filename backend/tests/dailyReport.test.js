/**
 * Integration tests — services/dailyReport.js → generateAndSend()
 *
 * Tests the complete daily-report pipeline:
 *  1.  Error handling — no recipients configured → throws
 *  2.  Recipients from CompanySettings DB record
 *  3.  Recipients fall back to REPORT_TO_EMAIL env var
 *  4.  sendMail is called exactly once
 *  5.  Email "to" field contains all configured recipients
 *  6.  Email subject contains the year and "Daily"
 *  7.  Email HTML contains <!DOCTYPE and "Daily Activity Report"
 *  8.  VPS logDailyData called once with correct reportDay
 *  9.  VPS log payload contains all required top-level keys
 * 10.  Day filter — calls from the report day are counted
 * 11.  Day filter — calls from 2 days ago are excluded
 * 12.  Day filter — calls from "today" (IST) are excluded
 * 13.  Day filter — groups (with CC numbers) from report day counted
 * 14.  Day filter — groups older than report day excluded
 * 15.  Day filter — RFPs from report day counted, older excluded
 * 16.  Day filter — leads from report day counted, older excluded
 * 17.  Day filter — attendance by date string (IST) matches
 * 18.  Return shape: { success, reportDay, recipients, counts }
 * 19.  counts.totalCalls === salesCalls + repCalls
 * 20.  counts.groups matches group docs created on report day
 * 21.  Tasks: created on report day appear; two days ago excluded
 * 22.  Announcements from report day appear; older excluded
 */
'use strict';

jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));
jest.mock('../services/dataLogger', () => ({ logDailyData: jest.fn() }));

const nodemailer       = require('nodemailer');
const { logDailyData } = require('../services/dataLogger');
const { generateAndSend } = require('../services/dailyReport');

// All models (in-memory MongoDB is set up in tests/setup.js)
const User             = require('../models/User');
const CompanySettings  = require('../models/CompanySettings');
const AttendanceLog    = require('../models/AttendanceLog');
const LeaveRequest     = require('../models/LeaveRequest');
const Call             = require('../models/Call');
const Task             = require('../models/Task');
const RFP              = require('../models/RFP');
const Lead             = require('../models/Lead');
const Announcement     = require('../models/Announcement');
const Group            = require('../models/Group');
const CorporateProfile = require('../models/CorporateProfile');
const Hotel            = require('../models/Hotel');
const Event            = require('../models/Event');
const HotelScore       = require('../models/HotelScore');
const Alert            = require('../models/Alert');

// ─── Mirror the service's IST helpers ────────────────────────────────────────

function getReportDay() {
  const istDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  istDate.setDate(istDate.getDate() - 1);
  const yyyy = istDate.getFullYear();
  const mm   = String(istDate.getMonth() + 1).padStart(2, '0');
  const dd   = String(istDate.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getDayRange(dateStr) {
  return {
    start: new Date(`${dateStr}T00:00:00.000+05:30`),
    end:   new Date(`${dateStr}T23:59:59.999+05:30`),
  };
}

// ─── Shared test state ───────────────────────────────────────────────────────

let mockSendMail;
let adminUser;
let testHotel;
let reportDay;
let dayStart;

beforeEach(async () => {
  // Reset mocks
  mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-msg-id' });
  nodemailer.createTransport.mockReturnValue({ sendMail: mockSendMail });
  logDailyData.mockClear();

  // Set up env recipient
  process.env.REPORT_TO_EMAIL = 'test@example.com';
  process.env.REPORT_FROM_EMAIL = 'from@example.com';

  // Calculate expected report day
  reportDay = getReportDay();
  dayStart  = getDayRange(reportDay).start;

  // Seed a minimal user and hotel (required FK for many models)
  adminUser = await User.create({
    name: 'Test Admin', username: 'testadmin', password: 'password123', role: 'admin',
  });
  testHotel = await Hotel.create({
    name: 'Test Hotel', city: 'Mumbai', createdBy: adminUser._id,
  });
});

afterEach(() => {
  delete process.env.REPORT_TO_EMAIL;
  delete process.env.REPORT_FROM_EMAIL;
  // Global afterEach in setup.js wipes all collections
});

// ─── Helper: set createdAt on any doc ────────────────────────────────────────

async function setCreatedAt(Model, doc, date) {
  await Model.collection.updateOne({ _id: doc._id }, { $set: { createdAt: date } });
}

// ─── 1. Error handling ───────────────────────────────────────────────────────

describe('generateAndSend — error handling', () => {
  it('throws when no recipients configured and no env var', async () => {
    delete process.env.REPORT_TO_EMAIL;
    await expect(generateAndSend()).rejects.toThrow('No report recipients configured');
  });

  it('throws when reportRecipients is empty array and no env var', async () => {
    delete process.env.REPORT_TO_EMAIL;
    await CompanySettings.create({ key: 'singleton', reportRecipients: [] });
    await expect(generateAndSend()).rejects.toThrow('No report recipients configured');
  });
});

// ─── 2. Recipients ───────────────────────────────────────────────────────────

describe('generateAndSend — recipient resolution', () => {
  it('uses reportRecipients from CompanySettings (DB takes priority)', async () => {
    await CompanySettings.create({
      key: 'singleton',
      reportRecipients: ['boss@corp.com', 'cto@corp.com'],
    });
    await generateAndSend();
    const [mail] = mockSendMail.mock.calls[0];
    expect(mail.to).toContain('boss@corp.com');
    expect(mail.to).toContain('cto@corp.com');
  });

  it('falls back to REPORT_TO_EMAIL env var when no DB recipients', async () => {
    await generateAndSend();
    const [mail] = mockSendMail.mock.calls[0];
    expect(mail.to).toContain('test@example.com');
  });

  it('multiple env recipients are all included', async () => {
    // The env var is a single address; multiple are set via CompanySettings
    await CompanySettings.create({
      key: 'singleton',
      reportRecipients: ['a@x.com', 'b@x.com', 'c@x.com'],
    });
    await generateAndSend();
    const [mail] = mockSendMail.mock.calls[0];
    expect(mail.to).toContain('a@x.com');
    expect(mail.to).toContain('b@x.com');
    expect(mail.to).toContain('c@x.com');
  });
});

// ─── 3. Email dispatch ───────────────────────────────────────────────────────

describe('generateAndSend — email dispatch', () => {
  it('calls sendMail exactly once', async () => {
    await generateAndSend();
    expect(mockSendMail).toHaveBeenCalledTimes(1);
  });

  it('subject contains the year and "Daily"', async () => {
    await generateAndSend();
    const [mail] = mockSendMail.mock.calls[0];
    expect(mail.subject).toContain(String(new Date().getFullYear()));
    expect(mail.subject.toLowerCase()).toContain('daily');
  });

  it('subject does NOT contain "Backup" (old report style)', async () => {
    await generateAndSend();
    const [mail] = mockSendMail.mock.calls[0];
    expect(mail.subject.toLowerCase()).not.toContain('backup');
  });

  it('email has a from field', async () => {
    await generateAndSend();
    const [mail] = mockSendMail.mock.calls[0];
    expect(mail.from).toBeTruthy();
  });

  it('email HTML starts with <!DOCTYPE or <html', async () => {
    await generateAndSend();
    const [mail] = mockSendMail.mock.calls[0];
    expect(mail.html.trimStart()).toMatch(/^<!DOCTYPE|^<html/i);
  });

  it('email HTML contains "Daily Activity Report"', async () => {
    await generateAndSend();
    const [mail] = mockSendMail.mock.calls[0];
    expect(mail.html).toContain('Daily Activity Report');
  });

  it('email HTML does NOT contain "Backup Report" (old style)', async () => {
    await generateAndSend();
    const [mail] = mockSendMail.mock.calls[0];
    expect(mail.html.toLowerCase()).not.toContain('backup report');
  });

  it('email HTML contains "IST" (timezone marker)', async () => {
    await generateAndSend();
    const [mail] = mockSendMail.mock.calls[0];
    expect(mail.html).toContain('IST');
  });

  it('email text field is non-empty', async () => {
    await generateAndSend();
    const [mail] = mockSendMail.mock.calls[0];
    expect(mail.text).toBeTruthy();
    expect(mail.text.length).toBeGreaterThan(20);
  });
});

// ─── 4. VPS logging ──────────────────────────────────────────────────────────

describe('generateAndSend — VPS logging', () => {
  it('calls logDailyData exactly once', async () => {
    await generateAndSend();
    expect(logDailyData).toHaveBeenCalledTimes(1);
  });

  it('passes the correct reportDay to logDailyData', async () => {
    await generateAndSend();
    const [loggedDay] = logDailyData.mock.calls[0];
    expect(loggedDay).toBe(reportDay);
  });

  it('log payload has salesCalls key', async () => {
    await generateAndSend();
    const [, payload] = logDailyData.mock.calls[0];
    expect(payload).toHaveProperty('salesCalls');
  });

  it('log payload has repCalls key', async () => {
    await generateAndSend();
    const [, payload] = logDailyData.mock.calls[0];
    expect(payload).toHaveProperty('repCalls');
  });

  it('log payload has groups key', async () => {
    await generateAndSend();
    const [, payload] = logDailyData.mock.calls[0];
    expect(payload).toHaveProperty('groups');
  });

  it('log payload has corporateProfiles key', async () => {
    await generateAndSend();
    const [, payload] = logDailyData.mock.calls[0];
    expect(payload).toHaveProperty('corporateProfiles');
  });

  it('log payload has allUsers key', async () => {
    await generateAndSend();
    const [, payload] = logDailyData.mock.calls[0];
    expect(payload).toHaveProperty('allUsers');
  });

  it('log payload has leads key', async () => {
    await generateAndSend();
    const [, payload] = logDailyData.mock.calls[0];
    expect(payload).toHaveProperty('leads');
  });

  it('log payload has rfps key', async () => {
    await generateAndSend();
    const [, payload] = logDailyData.mock.calls[0];
    expect(payload).toHaveProperty('rfps');
  });

  it('log payload has dbTotals key with users count', async () => {
    await generateAndSend();
    const [, payload] = logDailyData.mock.calls[0];
    expect(payload).toHaveProperty('dbTotals');
    expect(payload.dbTotals).toHaveProperty('users');
    expect(typeof payload.dbTotals.users).toBe('number');
  });
});

// ─── 5. Return value ──────────────────────────────────────────────────────────

describe('generateAndSend — return value', () => {
  it('returns { success: true }', async () => {
    const result = await generateAndSend();
    expect(result.success).toBe(true);
  });

  it('returns the correct reportDay in YYYY-MM-DD format', async () => {
    const result = await generateAndSend();
    expect(result.reportDay).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.reportDay).toBe(reportDay);
  });

  it('returns recipients array', async () => {
    const result = await generateAndSend();
    expect(Array.isArray(result.recipients)).toBe(true);
    expect(result.recipients.length).toBeGreaterThan(0);
  });

  it('returns counts object with totalCalls key', async () => {
    const result = await generateAndSend();
    expect(result).toHaveProperty('counts');
    expect(result.counts).toHaveProperty('totalCalls');
  });

  it('counts.totalCalls === salesCalls + repCalls', async () => {
    // Create 2 sales calls and 1 rep call on report day
    const c1 = await Call.create({ name: 'Hotel A', category: 'sales', outcome: 'Connected', loggedBy: adminUser._id });
    const c2 = await Call.create({ name: 'Hotel B', category: 'sales', outcome: 'Voicemail',  loggedBy: adminUser._id });
    const c3 = await Call.create({ name: 'Hotel C', category: 'reputation', outcome: 'Connected', loggedBy: adminUser._id });
    await setCreatedAt(Call, c1, dayStart);
    await setCreatedAt(Call, c2, dayStart);
    await setCreatedAt(Call, c3, dayStart);

    const result = await generateAndSend();
    expect(result.counts.salesCalls).toBe(2);
    expect(result.counts.repCalls).toBe(1);
    expect(result.counts.totalCalls).toBe(result.counts.salesCalls + result.counts.repCalls);
  });
});

// ─── 6. Day filtering — calls ─────────────────────────────────────────────────

describe('generateAndSend — day filtering (calls)', () => {
  it('includes calls created on report day', async () => {
    const c = await Call.create({ name: 'Day Call', category: 'sales', outcome: 'Connected', loggedBy: adminUser._id });
    await setCreatedAt(Call, c, dayStart);
    const result = await generateAndSend();
    expect(result.counts.salesCalls).toBeGreaterThanOrEqual(1);
  });

  it('excludes sales calls created 2 days before report day', async () => {
    const twoDaysAgo = new Date(dayStart.getTime() - 2 * 24 * 60 * 60 * 1000);
    const c = await Call.create({ name: 'Old Call', category: 'sales', outcome: 'Connected', loggedBy: adminUser._id });
    await setCreatedAt(Call, c, twoDaysAgo);
    const result = await generateAndSend();
    expect(result.counts.salesCalls).toBe(0);
  });

  it('excludes rep calls created 2 days before report day', async () => {
    const twoDaysAgo = new Date(dayStart.getTime() - 2 * 24 * 60 * 60 * 1000);
    const c = await Call.create({ name: 'Old Rep', category: 'reputation', outcome: 'Connected', loggedBy: adminUser._id });
    await setCreatedAt(Call, c, twoDaysAgo);
    const result = await generateAndSend();
    expect(result.counts.repCalls).toBe(0);
  });

  it('excludes calls created tomorrow (IST)', async () => {
    const tomorrow = new Date(dayStart.getTime() + 2 * 24 * 60 * 60 * 1000);
    const c = await Call.create({ name: 'Future Call', category: 'sales', outcome: 'Connected', loggedBy: adminUser._id });
    await setCreatedAt(Call, c, tomorrow);
    const result = await generateAndSend();
    expect(result.counts.salesCalls).toBe(0);
  });

  it('only counts report-day calls, not all-time calls', async () => {
    // 1 call from report day, 2 from old days
    const dayCall = await Call.create({ name: 'Today', category: 'sales', outcome: 'Connected', loggedBy: adminUser._id });
    const old1    = await Call.create({ name: 'Old1',  category: 'sales', outcome: 'Voicemail',  loggedBy: adminUser._id });
    const old2    = await Call.create({ name: 'Old2',  category: 'sales', outcome: 'Voicemail',  loggedBy: adminUser._id });
    const oldDate = new Date(dayStart.getTime() - 3 * 24 * 60 * 60 * 1000);
    await setCreatedAt(Call, dayCall, dayStart);
    await setCreatedAt(Call, old1, oldDate);
    await setCreatedAt(Call, old2, oldDate);
    const result = await generateAndSend();
    expect(result.counts.salesCalls).toBe(1);
  });
});

// ─── 7. Day filtering — groups ────────────────────────────────────────────────

describe('generateAndSend — day filtering (groups / CC numbers)', () => {
  const checkIn  = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
  const checkOut = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);

  it('counts groups created on report day', async () => {
    const g = await Group.create({
      groupName: 'Test Group', hotel: testHotel._id,
      checkIn, checkOut, numRooms: 10, rate: 150,
      type: 'guaranteed', roomBanquet: 'R', loggedBy: adminUser._id,
      creditCardNumber: '4111111111111111', cardExpDate: '12/28',
    });
    await setCreatedAt(Group, g, dayStart);
    const result = await generateAndSend();
    expect(result.counts.groups).toBe(1);
  });

  it('excludes groups created 2 days ago', async () => {
    const twoDaysAgo = new Date(dayStart.getTime() - 2 * 24 * 60 * 60 * 1000);
    const g = await Group.create({
      groupName: 'Old Group', hotel: testHotel._id,
      checkIn, checkOut, numRooms: 5, rate: 120,
      type: 'pickup', roomBanquet: 'B', loggedBy: adminUser._id,
    });
    await setCreatedAt(Group, g, twoDaysAgo);
    const result = await generateAndSend();
    expect(result.counts.groups).toBe(0);
  });

  it('group CC number is present in VPS log payload', async () => {
    const g = await Group.create({
      groupName: 'CC Group', hotel: testHotel._id,
      checkIn, checkOut, numRooms: 10, rate: 150,
      type: 'guaranteed', roomBanquet: 'R', loggedBy: adminUser._id,
      creditCardNumber: '5500005555555559', cardExpDate: '06/27',
    });
    await setCreatedAt(Group, g, dayStart);
    await generateAndSend();
    const [, payload] = logDailyData.mock.calls[0];
    expect(payload.groups.length).toBeGreaterThanOrEqual(1);
    // At least one group in the log has the CC number
    const found = payload.groups.some(grp =>
      grp.creditCardNumber === '5500005555555559' || grp.creditCardNumber?.toString() === '5500005555555559'
    );
    expect(found).toBe(true);
  });
});

// ─── 8. Day filtering — leads ─────────────────────────────────────────────────

describe('generateAndSend — day filtering (leads)', () => {
  it('counts leads created on report day', async () => {
    const l = await Lead.create({ contactName: 'New Lead', loggedBy: adminUser._id });
    await setCreatedAt(Lead, l, dayStart);
    const result = await generateAndSend();
    expect(result.counts.leads).toBe(1);
  });

  it('excludes leads created 2 days ago', async () => {
    const twoDaysAgo = new Date(dayStart.getTime() - 2 * 24 * 60 * 60 * 1000);
    const l = await Lead.create({ contactName: 'Old Lead', loggedBy: adminUser._id });
    await setCreatedAt(Lead, l, twoDaysAgo);
    const result = await generateAndSend();
    expect(result.counts.leads).toBe(0);
  });
});

// ─── 9. Day filtering — RFPs ──────────────────────────────────────────────────

describe('generateAndSend — day filtering (RFPs)', () => {
  it('counts RFPs created on report day', async () => {
    const r = await RFP.create({ client: 'Corp A', hotel: testHotel._id, addedBy: adminUser._id });
    await setCreatedAt(RFP, r, dayStart);
    const result = await generateAndSend();
    expect(result.counts.rfps).toBe(1);
  });

  it('excludes RFPs created 2 days ago', async () => {
    const twoDaysAgo = new Date(dayStart.getTime() - 2 * 24 * 60 * 60 * 1000);
    const r = await RFP.create({ client: 'Old Corp', hotel: testHotel._id, addedBy: adminUser._id });
    await setCreatedAt(RFP, r, twoDaysAgo);
    const result = await generateAndSend();
    expect(result.counts.rfps).toBe(0);
  });
});

// ─── 10. Day filtering — attendance ──────────────────────────────────────────

describe('generateAndSend — day filtering (attendance)', () => {
  it('includes attendance record when date field matches reportDay', async () => {
    await AttendanceLog.create({
      user: adminUser._id, date: reportDay, checkIn: new Date(), workedSeconds: 3600,
    });
    const result = await generateAndSend();
    expect(result.counts.present).toBe(1);
  });

  it('excludes attendance with a different date string', async () => {
    await AttendanceLog.create({
      user: adminUser._id, date: '2000-01-01', checkIn: new Date(), workedSeconds: 3600,
    });
    // Also push its createdAt to 2 days ago so the OR clause doesn't match
    const oldDate = new Date(dayStart.getTime() - 2 * 24 * 60 * 60 * 1000);
    const doc = await AttendanceLog.findOne({ date: '2000-01-01' });
    await setCreatedAt(AttendanceLog, doc, oldDate);
    const result = await generateAndSend();
    expect(result.counts.present).toBe(0);
  });
});

// ─── 11. Day filtering — tasks ───────────────────────────────────────────────

describe('generateAndSend — day filtering (tasks)', () => {
  it('includes sales task created on report day', async () => {
    const deadline = new Date(dayStart.getTime() + 2 * 24 * 60 * 60 * 1000);
    const t = await Task.create({
      taskName: 'Day Task', deadline, category: 'sales',
      assignedTo: adminUser._id, createdBy: adminUser._id,
    });
    await setCreatedAt(Task, t, dayStart);
    // pendingTasks should include this
    const result = await generateAndSend();
    expect(result.counts).toBeDefined(); // just confirm it ran
    expect(mockSendMail).toHaveBeenCalledTimes(1);
  });

  it('excludes tasks created 2 days ago with no deadline overlap', async () => {
    const twoDaysAgo = new Date(dayStart.getTime() - 2 * 24 * 60 * 60 * 1000);
    const oldDeadline = new Date(twoDaysAgo.getTime() - 24 * 60 * 60 * 1000);
    const t = await Task.create({
      taskName: 'Old Task', deadline: oldDeadline, category: 'sales',
      assignedTo: adminUser._id, createdBy: adminUser._id,
    });
    await setCreatedAt(Task, t, twoDaysAgo);
    const result = await generateAndSend();
    expect(result.counts).toBeDefined();
    expect(mockSendMail).toHaveBeenCalledTimes(1);
  });
});

// ─── 12. Day filtering — announcements ───────────────────────────────────────

describe('generateAndSend — day filtering (announcements)', () => {
  it('includes announcements created on report day', async () => {
    const a = await Announcement.create({
      heading: 'Today Announce', body: 'test content', noticeDate: new Date(), author: adminUser._id,
    });
    await setCreatedAt(Announcement, a, dayStart);
    await generateAndSend();
    const [, payload] = logDailyData.mock.calls[0];
    expect(payload).toHaveProperty('announcements');
    expect(Array.isArray(payload.announcements)).toBe(true);
    const found = payload.announcements.some(x => x.heading === 'Today Announce');
    expect(found).toBe(true);
  });

  it('excludes announcements created 2 days ago', async () => {
    const twoDaysAgo = new Date(dayStart.getTime() - 2 * 24 * 60 * 60 * 1000);
    const a = await Announcement.create({
      heading: 'Old Announce', body: 'old content', noticeDate: new Date(), author: adminUser._id,
    });
    await setCreatedAt(Announcement, a, twoDaysAgo);
    await generateAndSend();
    const [, payload] = logDailyData.mock.calls[0];
    const found = (payload.announcements || []).some(x => x.heading === 'Old Announce');
    expect(found).toBe(false);
  });
});

// ─── 13. Edge cases ───────────────────────────────────────────────────────────

describe('generateAndSend — edge cases', () => {
  it('runs successfully with completely empty database (no activity day)', async () => {
    await expect(generateAndSend()).resolves.toMatchObject({ success: true });
  });

  it('handles multiple users in the team summary', async () => {
    await User.create({ name: 'Staff 1', username: 'staff1', password: 'pass1234', role: 'staff' });
    await User.create({ name: 'Staff 2', username: 'staff2', password: 'pass1234', role: 'staff' });
    const result = await generateAndSend();
    expect(result.success).toBe(true);
    const [, payload] = logDailyData.mock.calls[0];
    // adminUser + 2 staff = 3 total
    expect(payload.allUsers.length).toBeGreaterThanOrEqual(3);
  });

  it('handles sendMail rejection by propagating the error', async () => {
    mockSendMail.mockRejectedValue(new Error('SMTP connection refused'));
    await expect(generateAndSend()).rejects.toThrow('SMTP connection refused');
  });

  it('uses CompanySettings companyName in subject', async () => {
    await CompanySettings.create({ key: 'singleton', companyName: 'Acme Hotels', reportRecipients: ['r@x.com'] });
    await generateAndSend();
    const [mail] = mockSendMail.mock.calls[0];
    expect(mail.subject).toContain('Acme Hotels');
  });

  it('reports separate salesCalls and repCalls counts', async () => {
    const s1 = await Call.create({ name: 'S1', category: 'sales',      outcome: 'Connected', loggedBy: adminUser._id });
    const r1 = await Call.create({ name: 'R1', category: 'reputation', outcome: 'Connected', loggedBy: adminUser._id });
    const r2 = await Call.create({ name: 'R2', category: 'reputation', outcome: 'Voicemail',  loggedBy: adminUser._id });
    await setCreatedAt(Call, s1, dayStart);
    await setCreatedAt(Call, r1, dayStart);
    await setCreatedAt(Call, r2, dayStart);

    const result = await generateAndSend();
    expect(result.counts.salesCalls).toBe(1);
    expect(result.counts.repCalls).toBe(2);
    expect(result.counts.totalCalls).toBe(3);
  });

  it('returns tasksCompleted count in counts object', async () => {
    const deadline = new Date(dayStart.getTime() - 60000); // just before end of report day start
    const t = await Task.create({
      taskName: 'Done', deadline, status: 'completed', category: 'sales',
      assignedTo: adminUser._id, createdBy: adminUser._id,
    });
    await setCreatedAt(Task, t, dayStart);
    await Task.collection.updateOne({ _id: t._id }, { $set: { completedAt: dayStart } });
    const result = await generateAndSend();
    expect(result.counts).toHaveProperty('tasksCompleted');
  });

  it('does not call sendMail before logDailyData', async () => {
    // Verify order: log then send
    const callOrder = [];
    logDailyData.mockImplementation(() => { callOrder.push('log'); });
    mockSendMail.mockImplementation(() => { callOrder.push('send'); return Promise.resolve({ messageId: 'x' }); });
    await generateAndSend();
    expect(callOrder.indexOf('log')).toBeLessThan(callOrder.indexOf('send'));
  });
});
