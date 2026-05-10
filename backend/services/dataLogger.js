'use strict';

const fs   = require('fs');
const path = require('path');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Read at call-time so the env var can be overridden in tests
function getLogDir() {
  return process.env.DATA_LOG_DIR
    || path.join(__dirname, '../../logs/crm-data');
}

/**
 * Writes a full JSON snapshot of the day's CRM data to a local file.
 *
 * This is a VPS-side security layer — even if the database is wiped, every
 * day's data (including CC numbers, expiry dates, groups, corporate profiles,
 * leads, calls, etc.) is persisted as a timestamped file on disk.
 *
 * File path: <LOG_DIR>/YYYY-MM-DD.json
 *
 * @param {string} reportDayStr  - 'YYYY-MM-DD' of the day being reported
 * @param {object} payload       - all CRM data fetched for that day
 */
function logDailyData(reportDayStr, payload) {
  const logDir = getLogDir();
  try {
    ensureDir(logDir);
    const filePath = path.join(logDir, `${reportDayStr}.json`);
    const entry = {
      _meta: {
        reportDay:       reportDayStr,
        generatedAt:     new Date().toISOString(),
        generatedAt_IST: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
        purpose:         'VPS security log — daily CRM data snapshot',
        warning:         'Contains sensitive data including CC numbers and expiry dates. Restrict file permissions.',
      },
      ...payload,
    };
    fs.writeFileSync(filePath, JSON.stringify(entry, null, 2), 'utf8');

    // Restrict permissions to owner-read-write only (0600)
    try { fs.chmodSync(filePath, 0o600); } catch (_) {}

    console.log(`[DataLogger] ✅ Daily snapshot saved → ${filePath}`);
  } catch (err) {
    // Non-fatal — log the error but don't interrupt the email send
    console.error(`[DataLogger] ❌ Failed to write snapshot: ${err.message}`);
  }
}

module.exports = { logDailyData };
