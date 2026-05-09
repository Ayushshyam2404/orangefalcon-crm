/**
 * Model-level unit tests — no HTTP, no server.
 * Validates data integrity at the mongoose layer:
 *   • required fields enforced
 *   • enum constraints enforced
 *   • computed fields (Group room-nights, banquet duration)
 *   • password hashing
 *   • unique constraints
 */
const mongoose = require('mongoose');
const User = require('../models/User');
const Call = require('../models/Call');
const Task = require('../models/Task');
const Lead = require('../models/Lead');
const Group = require('../models/Group');
const RFP = require('../models/RFP');
const Hotel = require('../models/Hotel');
const Event = require('../models/Event');
const CorporateProfile = require('../models/CorporateProfile');
const RoutineItem = require('../models/RoutineItem');

// ─── User model ───────────────────────────────────────────────────────────────

describe('User model — data integrity', () => {
  let userId;

  beforeEach(async () => {
    const user = await User.create({
      name: 'Jane Doe',
      username: 'janedoe',
      password: 'SecurePass1',
      role: 'staff',
    });
    userId = user._id;
  });

  test('required fields enforced — username missing → error', async () => {
    await expect(
      User.create({ name: 'No User', password: 'Pass123' })
    ).rejects.toThrow();
  });

  test('required fields enforced — name missing → error', async () => {
    await expect(
      User.create({ username: 'noname', password: 'Pass123' })
    ).rejects.toThrow();
  });

  test('password is NOT stored in plaintext', async () => {
    const user = await User.findById(userId);
    expect(user.password).not.toBe('SecurePass1');
    expect(user.password).toMatch(/^\$2[ab]\$/); // bcrypt hash prefix
  });

  test('matchPassword returns true for correct password', async () => {
    const user = await User.findById(userId);
    const match = await user.matchPassword('SecurePass1');
    expect(match).toBe(true);
  });

  test('matchPassword returns false for wrong password', async () => {
    const user = await User.findById(userId);
    const match = await user.matchPassword('WrongPass999');
    expect(match).toBe(false);
  });

  test('username uniqueness — duplicate username → error', async () => {
    await expect(
      User.create({ name: 'Duplicate', username: 'janedoe', password: 'AnotherPass1' })
    ).rejects.toThrow();
  });

  test('role enum — invalid role → validation error', async () => {
    await expect(
      User.create({ name: 'X', username: 'xuser', password: 'Pass123', role: 'superuser' })
    ).rejects.toThrow();
  });

  test('all stored user fields survive a round-trip read', async () => {
    const fresh = await User.findById(userId);
    expect(fresh.name).toBe('Jane Doe');
    expect(fresh.username).toBe('janedoe');
    expect(fresh.role).toBe('staff');
    expect(fresh.online).toBe(false);
    expect(fresh.sessionSeconds).toBe(0);
  });
});

// ─── Call model ───────────────────────────────────────────────────────────────

describe('Call model — data integrity', () => {
  let user;
  beforeEach(async () => {
    user = await User.create({ name: 'U', username: `u_${Date.now()}`, password: 'P123456' });
  });

  test('required field name → error when missing', async () => {
    await expect(
      Call.create({ outcome: 'Connected', loggedBy: user._id })
    ).rejects.toThrow();
  });

  test('required field loggedBy → error when missing', async () => {
    await expect(Call.create({ name: 'John' })).rejects.toThrow();
  });

  test('invalid outcome enum → validation error', async () => {
    await expect(
      Call.create({ name: 'Bob', outcome: 'Ignored', loggedBy: user._id })
    ).rejects.toThrow();
  });

  test('valid call stores all fields correctly', async () => {
    const call = await Call.create({
      name: 'Alice Smith',
      phone: '555-1234',
      outcome: 'Interested',
      notes: 'Called about group booking',
      loggedBy: user._id,
    });
    expect(call.name).toBe('Alice Smith');
    expect(call.phone).toBe('555-1234');
    expect(call.outcome).toBe('Interested');
    expect(call.notes).toBe('Called about group booking');
    expect(call.loggedBy.toString()).toBe(user._id.toString());
    expect(call.createdAt).toBeDefined();
  });

  test('data is unchanged after create + fetch', async () => {
    const call = await Call.create({ name: 'Bob Jones', outcome: 'Voicemail', loggedBy: user._id });
    const fetched = await Call.findById(call._id);
    expect(fetched.name).toBe('Bob Jones');
    expect(fetched.outcome).toBe('Voicemail');
  });
});

// ─── Task model ───────────────────────────────────────────────────────────────

describe('Task model — data integrity', () => {
  let user;
  beforeEach(async () => {
    user = await User.create({ name: 'U', username: `u_${Date.now()}`, password: 'P123456' });
  });

  test('taskName required — missing → error', async () => {
    await expect(
      Task.create({ deadline: new Date(), assignedTo: user._id, createdBy: user._id })
    ).rejects.toThrow();
  });

  test('deadline required — missing → error', async () => {
    await expect(
      Task.create({ taskName: 'T', assignedTo: user._id, createdBy: user._id })
    ).rejects.toThrow();
  });

  test('invalid status enum → error', async () => {
    await expect(
      Task.create({
        taskName: 'T', deadline: new Date(),
        status: 'done', assignedTo: user._id, createdBy: user._id,
      })
    ).rejects.toThrow();
  });

  test('default status is pending', async () => {
    const task = await Task.create({
      taskName: 'My Task', deadline: new Date(Date.now() + 86400000),
      assignedTo: user._id, createdBy: user._id,
    });
    expect(task.status).toBe('pending');
  });

  test('all fields stored correctly', async () => {
    const dl = new Date(Date.now() + 86400000);
    const task = await Task.create({
      taskName: 'Finish report',
      deadline: dl,
      status: 'in-progress',
      notes: 'urgent',
      assignedTo: user._id,
      createdBy: user._id,
    });
    const fetched = await Task.findById(task._id);
    expect(fetched.taskName).toBe('Finish report');
    expect(fetched.status).toBe('in-progress');
    expect(fetched.notes).toBe('urgent');
  });
});

// ─── Lead model ───────────────────────────────────────────────────────────────

describe('Lead model — data integrity', () => {
  let user;
  beforeEach(async () => {
    user = await User.create({ name: 'U', username: `u_${Date.now()}`, password: 'P123456' });
  });

  test('contactName required — missing → error', async () => {
    await expect(Lead.create({ loggedBy: user._id })).rejects.toThrow();
  });

  test('invalid status enum → error', async () => {
    await expect(
      Lead.create({ contactName: 'A', status: 'pending', loggedBy: user._id })
    ).rejects.toThrow();
  });

  test('invalid roomType enum → error', async () => {
    await expect(
      Lead.create({ contactName: 'A', roomType: 'suite', loggedBy: user._id })
    ).rejects.toThrow();
  });

  test('partial update preserves untouched fields', async () => {
    const lead = await Lead.create({
      contactName: 'Mark Lee',
      company: 'TechCorp',
      email: 'mark@tech.com',
      status: 'new',
      loggedBy: user._id,
    });
    // Update only status
    await Lead.findByIdAndUpdate(lead._id, { status: 'contacted' }, { runValidators: true });
    const updated = await Lead.findById(lead._id);
    expect(updated.status).toBe('contacted');
    expect(updated.company).toBe('TechCorp');   // not wiped
    expect(updated.email).toBe('mark@tech.com'); // not wiped
  });
});

// ─── Group model — computed fields ───────────────────────────────────────────

describe('Group model — computed fields (room nights, banquet duration)', () => {
  let user, hotel;
  beforeEach(async () => {
    user = await User.create({ name: 'U', username: `u_${Date.now()}`, password: 'P123456', role: 'admin' });
    hotel = await Hotel.create({ name: `Hotel_${Date.now()}`, city: 'NYC', createdBy: user._id });
  });

  test('numRoomNights = rooms × nights (5 rooms × 3 nights = 15)', async () => {
    const checkIn  = new Date('2026-06-01');
    const checkOut = new Date('2026-06-04'); // 3 nights
    const group = await Group.create({
      groupName: 'Biz Trip',
      hotel: hotel._id,
      checkIn, checkOut,
      numRooms: 5,
      rate: 150,
      type: 'guaranteed',
      roomBanquet: 'R',
      loggedBy: user._id,
    });
    expect(group.numRoomNights).toBe(15);
  });

  test('numRoomNights = rooms × nights (1 room × 7 nights = 7)', async () => {
    const group = await Group.create({
      groupName: 'Solo Stay',
      hotel: hotel._id,
      checkIn:  new Date('2026-07-10'),
      checkOut: new Date('2026-07-17'),
      numRooms: 1,
      rate: 200,
      type: 'pickup',
      roomBanquet: 'R',
      loggedBy: user._id,
    });
    expect(group.numRoomNights).toBe(7);
  });

  test('banquet duration calculated correctly (09:00 → 17:00 = 8 hours)', async () => {
    const group = await Group.create({
      groupName: 'Conference',
      hotel: hotel._id,
      checkIn:  new Date('2026-08-01'),
      checkOut: new Date('2026-08-01'),
      type: 'guaranteed',
      roomBanquet: 'B',
      banquetCheckInTime: '09:00',
      banquetCheckOutTime: '17:00',
      loggedBy: user._id,
    });
    expect(group.banquetDurationHours).toBe(8);
  });

  test('overnight banquet duration (22:00 → 02:00 = 4 hours)', async () => {
    const group = await Group.create({
      groupName: 'Late Night Event',
      hotel: hotel._id,
      checkIn:  new Date('2026-09-01'),
      checkOut: new Date('2026-09-02'),
      type: 'pickup',
      roomBanquet: 'B',
      banquetCheckInTime: '22:00',
      banquetCheckOutTime: '02:00',
      loggedBy: user._id,
    });
    expect(group.banquetDurationHours).toBe(4);
  });

  test('required fields enforced — groupName missing → error', async () => {
    await expect(
      Group.create({
        hotel: hotel._id,
        checkIn: new Date(),
        checkOut: new Date(),
        type: 'pickup',
        roomBanquet: 'R',
        loggedBy: user._id,
      })
    ).rejects.toThrow();
  });

  test('invalid type enum → error', async () => {
    await expect(
      Group.create({
        groupName: 'G', hotel: hotel._id,
        checkIn: new Date(), checkOut: new Date(),
        type: 'tentative',  // invalid
        roomBanquet: 'R', loggedBy: user._id,
      })
    ).rejects.toThrow();
  });
});

// ─── RFP model ───────────────────────────────────────────────────────────────

describe('RFP model — data integrity', () => {
  let user, hotel;
  beforeEach(async () => {
    user  = await User.create({ name: 'U', username: `u_${Date.now()}`, password: 'P123456' });
    hotel = await Hotel.create({ name: `H_${Date.now()}`, city: 'LA', createdBy: user._id });
  });

  test('client required → error if missing', async () => {
    await expect(
      RFP.create({ hotel: hotel._id, addedBy: user._id })
    ).rejects.toThrow();
  });

  test('hotel required → error if missing', async () => {
    await expect(
      RFP.create({ client: 'Acme', addedBy: user._id })
    ).rejects.toThrow();
  });

  test('invalid status enum → error', async () => {
    await expect(
      RFP.create({ client: 'Acme', hotel: hotel._id, status: 'Approved', addedBy: user._id })
    ).rejects.toThrow();
  });

  test('valid RFP stores all fields correctly', async () => {
    const rfp = await RFP.create({
      client: 'Acme Corp',
      hotel: hotel._id,
      checkin: '2026-09-01',
      checkout: '2026-09-05',
      price: 2500,
      status: 'Pending',
      notes: 'VIP group',
      priority: true,
      addedBy: user._id,
    });
    const fetched = await RFP.findById(rfp._id);
    expect(fetched.client).toBe('Acme Corp');
    expect(fetched.price).toBe(2500);
    expect(fetched.priority).toBe(true);
    expect(fetched.status).toBe('Pending');
    expect(fetched.notes).toBe('VIP group');
  });
});

// ─── Hotel model ─────────────────────────────────────────────────────────────

describe('Hotel model — data integrity', () => {
  let user;
  beforeEach(async () => {
    user = await User.create({ name: 'U', username: `u_${Date.now()}`, password: 'P123456', role: 'admin' });
  });

  test('name required → error', async () => {
    await expect(Hotel.create({ city: 'NYC', createdBy: user._id })).rejects.toThrow();
  });

  test('city required → error', async () => {
    await expect(Hotel.create({ name: 'Plaza', createdBy: user._id })).rejects.toThrow();
  });

  test('duplicate hotel name → error', async () => {
    await Hotel.create({ name: 'Grand Hotel', city: 'NYC', createdBy: user._id });
    await expect(
      Hotel.create({ name: 'Grand Hotel', city: 'LA', createdBy: user._id })
    ).rejects.toThrow();
  });
});

// ─── Event model ─────────────────────────────────────────────────────────────

describe('Event model — data integrity', () => {
  let user;
  beforeEach(async () => {
    user = await User.create({ name: 'U', username: `u_${Date.now()}`, password: 'P123456' });
  });

  test('name required → error', async () => {
    await expect(
      Event.create({ date: new Date(), createdBy: user._id })
    ).rejects.toThrow();
  });

  test('date required → error', async () => {
    await expect(Event.create({ name: 'Meeting', createdBy: user._id })).rejects.toThrow();
  });

  test('all fields stored correctly', async () => {
    const d = new Date('2026-05-15');
    const ev = await Event.create({ name: 'Board Meeting', date: d, notes: 'Q2 review', createdBy: user._id });
    const fetched = await Event.findById(ev._id);
    expect(fetched.name).toBe('Board Meeting');
    expect(fetched.notes).toBe('Q2 review');
    expect(new Date(fetched.date).toISOString().slice(0, 10)).toBe('2026-05-15');
  });
});

// ─── CorporateProfile model ───────────────────────────────────────────────────

describe('CorporateProfile model — data integrity', () => {
  let user;
  beforeEach(async () => {
    user = await User.create({ name: 'U', username: `u_${Date.now()}`, password: 'P123456' });
  });

  test('name required → error', async () => {
    await expect(
      CorporateProfile.create({ company: 'Corp', loggedBy: user._id })
    ).rejects.toThrow();
  });

  test('company required → error', async () => {
    await expect(
      CorporateProfile.create({ name: 'Alice', loggedBy: user._id })
    ).rejects.toThrow();
  });

  test('CC number stored exactly as entered (no truncation/corruption)', async () => {
    const profile = await CorporateProfile.create({
      name: 'Alice', company: 'Corp',
      ccNumber: '4111111111111111',
      ccExpiry: '12/28',
      loggedBy: user._id,
    });
    const fetched = await CorporateProfile.findById(profile._id);
    expect(fetched.ccNumber).toBe('4111111111111111');
    expect(fetched.ccExpiry).toBe('12/28');
  });

  test('partial update of notes does NOT wipe CC number', async () => {
    const profile = await CorporateProfile.create({
      name: 'Bob', company: 'ABC',
      ccNumber: '5500005555555559',
      ccExpiry: '06/27',
      loggedBy: user._id,
    });
    // Simulate updating only notes (ccNumber omitted → Mongoose strips undefined)
    await CorporateProfile.findByIdAndUpdate(
      profile._id,
      { notes: 'Updated notes' },
      { new: true, runValidators: true }
    );
    const after = await CorporateProfile.findById(profile._id);
    expect(after.ccNumber).toBe('5500005555555559'); // must not be wiped
    expect(after.notes).toBe('Updated notes');
  });
});

// ─── RoutineItem model ───────────────────────────────────────────────────────

describe('RoutineItem model — data integrity', () => {
  let user;
  beforeEach(async () => {
    user = await User.create({ name: 'U', username: `u_${Date.now()}`, password: 'P123456' });
  });

  test('taskName required → error', async () => {
    await expect(RoutineItem.create({ user: user._id })).rejects.toThrow();
  });

  test('user required → error', async () => {
    await expect(RoutineItem.create({ taskName: 'Check emails' })).rejects.toThrow();
  });

  test('stored fields survive round-trip', async () => {
    const item = await RoutineItem.create({
      user: user._id,
      taskName: 'Morning standup',
      defaultNote: 'Review blockers',
      order: 2,
    });
    const fetched = await RoutineItem.findById(item._id);
    expect(fetched.taskName).toBe('Morning standup');
    expect(fetched.defaultNote).toBe('Review blockers');
    expect(fetched.order).toBe(2);
  });
});
