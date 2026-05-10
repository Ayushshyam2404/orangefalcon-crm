/**
 * Unit tests — services/dataLogger.js
 *
 * Verifies the VPS security log writer:
 *  1. Creates directories on demand
 *  2. Writes the correct YYYY-MM-DD.json file
 *  3. Output is valid, parseable JSON
 *  4. _meta block is present and correct
 *  5. All payload data (including CC numbers) is written verbatim
 *  6. File permissions are set to 0600 (owner-only)
 *  7. Write failures are non-fatal — logDailyData never throws
 *  8. Multiple calls for the same date overwrite (idempotent)
 *  9. Different dates produce separate files
 * 10. Large payloads are handled without truncation
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { logDailyData } = require('../services/dataLogger');

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-log-test-'));
  process.env.DATA_LOG_DIR = tmpDir;
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.DATA_LOG_DIR;
});

// ─── 1. Directory creation ─────────────────────────────────────────────────────

describe('dataLogger — directory handling', () => {
  it('creates the target directory if it does not exist', () => {
    const nestedDir = path.join(tmpDir, 'deep', 'nested', 'logs');
    process.env.DATA_LOG_DIR = nestedDir;
    logDailyData('2026-05-10', { test: true });
    expect(fs.existsSync(nestedDir)).toBe(true);
  });

  it('does not crash when directory already exists', () => {
    // Call twice — second call should not throw on existing dir
    logDailyData('2026-05-10', { a: 1 });
    expect(() => logDailyData('2026-05-10', { a: 2 })).not.toThrow();
  });
});

// ─── 2. File naming ───────────────────────────────────────────────────────────

describe('dataLogger — file naming', () => {
  it('writes a file named exactly YYYY-MM-DD.json', () => {
    logDailyData('2026-05-10', {});
    expect(fs.existsSync(path.join(tmpDir, '2026-05-10.json'))).toBe(true);
  });

  it('uses the exact date string passed as the filename', () => {
    logDailyData('2024-12-31', {});
    expect(fs.existsSync(path.join(tmpDir, '2024-12-31.json'))).toBe(true);
  });

  it('different dates produce separate files', () => {
    logDailyData('2026-05-09', { day: 'day1' });
    logDailyData('2026-05-10', { day: 'day2' });
    expect(fs.existsSync(path.join(tmpDir, '2026-05-09.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '2026-05-10.json'))).toBe(true);
    // Each file has its own data
    const d1 = JSON.parse(fs.readFileSync(path.join(tmpDir, '2026-05-09.json'), 'utf8'));
    const d2 = JSON.parse(fs.readFileSync(path.join(tmpDir, '2026-05-10.json'), 'utf8'));
    expect(d1.day).toBe('day1');
    expect(d2.day).toBe('day2');
  });
});

// ─── 3. JSON validity ─────────────────────────────────────────────────────────

describe('dataLogger — JSON validity', () => {
  it('file contains valid, parseable JSON', () => {
    logDailyData('2026-05-10', { calls: [{ name: 'Alice' }] });
    const raw = fs.readFileSync(path.join(tmpDir, '2026-05-10.json'), 'utf8');
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  it('file is pretty-printed (human-readable)', () => {
    logDailyData('2026-05-10', { calls: [] });
    const raw = fs.readFileSync(path.join(tmpDir, '2026-05-10.json'), 'utf8');
    // Pretty-printed JSON has newlines
    expect(raw).toContain('\n');
  });
});

// ─── 4. _meta block ───────────────────────────────────────────────────────────

describe('dataLogger — _meta block', () => {
  let data;
  beforeEach(() => {
    logDailyData('2026-05-10', {});
    data = JSON.parse(fs.readFileSync(path.join(tmpDir, '2026-05-10.json'), 'utf8'));
  });

  it('_meta.reportDay matches the date string passed in', () => {
    expect(data._meta.reportDay).toBe('2026-05-10');
  });

  it('_meta.generatedAt is a valid ISO-8601 UTC timestamp', () => {
    expect(data._meta.generatedAt).toBeDefined();
    expect(() => new Date(data._meta.generatedAt)).not.toThrow();
    expect(new Date(data._meta.generatedAt).toISOString()).toBe(data._meta.generatedAt);
  });

  it('_meta.generatedAt_IST is a human-readable IST string', () => {
    expect(typeof data._meta.generatedAt_IST).toBe('string');
    expect(data._meta.generatedAt_IST.length).toBeGreaterThan(5);
  });

  it('_meta.purpose mentions "security log"', () => {
    expect(data._meta.purpose).toMatch(/security log/i);
  });

  it('_meta.warning mentions sensitive data', () => {
    expect(data._meta.warning).toBeDefined();
    expect(data._meta.warning.length).toBeGreaterThan(10);
  });
});

// ─── 5. Payload integrity (including sensitive data) ──────────────────────────

describe('dataLogger — payload preservation', () => {
  it('all top-level payload keys are present in the output', () => {
    logDailyData('2026-05-10', { salesCalls: [], repCalls: [], groups: [], leads: [] });
    const data = JSON.parse(fs.readFileSync(path.join(tmpDir, '2026-05-10.json'), 'utf8'));
    expect(data).toHaveProperty('salesCalls');
    expect(data).toHaveProperty('repCalls');
    expect(data).toHaveProperty('groups');
    expect(data).toHaveProperty('leads');
  });

  it('CC number stored verbatim — no truncation or masking', () => {
    const ccNumber = '4111111111111111';
    logDailyData('2026-05-10', { groups: [{ creditCardNumber: ccNumber }] });
    const data = JSON.parse(fs.readFileSync(path.join(tmpDir, '2026-05-10.json'), 'utf8'));
    expect(data.groups[0].creditCardNumber).toBe(ccNumber);
  });

  it('CC expiry date stored verbatim', () => {
    logDailyData('2026-05-10', { groups: [{ cardExpDate: '12/28' }] });
    const data = JSON.parse(fs.readFileSync(path.join(tmpDir, '2026-05-10.json'), 'utf8'));
    expect(data.groups[0].cardExpDate).toBe('12/28');
  });

  it('corporate profile CC number stored verbatim', () => {
    logDailyData('2026-05-10', { corporateProfiles: [{ ccNumber: '5500005555555559', ccExpiry: '06/27' }] });
    const data = JSON.parse(fs.readFileSync(path.join(tmpDir, '2026-05-10.json'), 'utf8'));
    expect(data.corporateProfiles[0].ccNumber).toBe('5500005555555559');
    expect(data.corporateProfiles[0].ccExpiry).toBe('06/27');
  });

  it('multiple groups with different CC numbers are all preserved', () => {
    const groups = [
      { groupName: 'G1', creditCardNumber: '4111111111111111', cardExpDate: '12/28' },
      { groupName: 'G2', creditCardNumber: '5500005555555559', cardExpDate: '06/27' },
    ];
    logDailyData('2026-05-10', { groups });
    const data = JSON.parse(fs.readFileSync(path.join(tmpDir, '2026-05-10.json'), 'utf8'));
    expect(data.groups).toHaveLength(2);
    expect(data.groups[0].creditCardNumber).toBe('4111111111111111');
    expect(data.groups[1].creditCardNumber).toBe('5500005555555559');
  });

  it('nested objects survive round-trip intact', () => {
    const payload = {
      attendance: [{ user: { name: 'Alice', role: 'admin' }, workedSeconds: 28800 }],
    };
    logDailyData('2026-05-10', payload);
    const data = JSON.parse(fs.readFileSync(path.join(tmpDir, '2026-05-10.json'), 'utf8'));
    expect(data.attendance[0].user.name).toBe('Alice');
    expect(data.attendance[0].workedSeconds).toBe(28800);
  });

  it('handles empty arrays without dropping keys', () => {
    logDailyData('2026-05-10', { groups: [], leads: [], rfps: [] });
    const data = JSON.parse(fs.readFileSync(path.join(tmpDir, '2026-05-10.json'), 'utf8'));
    expect(data.groups).toEqual([]);
    expect(data.leads).toEqual([]);
    expect(data.rfps).toEqual([]);
  });

  it('handles large text payloads without truncation', () => {
    const bigNote = 'A'.repeat(50000);
    logDailyData('2026-05-10', { groups: [{ notes: bigNote }] });
    const data = JSON.parse(fs.readFileSync(path.join(tmpDir, '2026-05-10.json'), 'utf8'));
    expect(data.groups[0].notes).toHaveLength(50000);
  });

  it('numeric zeros are preserved (not dropped)', () => {
    logDailyData('2026-05-10', { groups: [{ rate: 0, numRooms: 0 }] });
    const data = JSON.parse(fs.readFileSync(path.join(tmpDir, '2026-05-10.json'), 'utf8'));
    expect(data.groups[0].rate).toBe(0);
    expect(data.groups[0].numRooms).toBe(0);
  });
});

// ─── 6. File permissions ──────────────────────────────────────────────────────

describe('dataLogger — file permissions', () => {
  it('sets 0600 permissions (owner read-write only)', () => {
    logDailyData('2026-05-10', {});
    const stat = fs.statSync(path.join(tmpDir, '2026-05-10.json'));
    expect(stat.mode & 0o777).toBe(0o600);
  });
});

// ─── 7. Error resilience ──────────────────────────────────────────────────────

describe('dataLogger — error resilience (non-fatal)', () => {
  it('does NOT throw when directory is not writable', () => {
    process.env.DATA_LOG_DIR = '/root/no-permission-crm-test-dir';
    expect(() => logDailyData('2026-05-10', { test: true })).not.toThrow();
    delete process.env.DATA_LOG_DIR;
  });

  it('does NOT throw when payload is an empty object', () => {
    expect(() => logDailyData('2026-05-10', {})).not.toThrow();
  });

  it('does NOT throw when payload contains undefined values', () => {
    expect(() => logDailyData('2026-05-10', { x: undefined, y: null })).not.toThrow();
  });
});

// ─── 8. Idempotency ───────────────────────────────────────────────────────────

describe('dataLogger — idempotency', () => {
  it('calling twice for the same date overwrites with latest data', () => {
    logDailyData('2026-05-10', { version: 1 });
    logDailyData('2026-05-10', { version: 2 });
    const data = JSON.parse(fs.readFileSync(path.join(tmpDir, '2026-05-10.json'), 'utf8'));
    expect(data.version).toBe(2);
  });

  it('previous day file is not modified when new date is logged', () => {
    logDailyData('2026-05-09', { day: 'prev' });
    logDailyData('2026-05-10', { day: 'curr' });
    const prev = JSON.parse(fs.readFileSync(path.join(tmpDir, '2026-05-09.json'), 'utf8'));
    expect(prev.day).toBe('prev');
  });
});
