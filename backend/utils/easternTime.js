const EASTERN_TIME_ZONE = 'America/New_York';

function shiftDateKey(dateKey, days) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function easternWallTimeToUtc(dateKey, hour = 0, minute = 0) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const [year, month, day] = dateKey.split('-').map(Number);
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: EASTERN_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(guess));
  const part = (type) => Number(parts.find((item) => item.type === type)?.value);
  const representedAsUtc = Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'), part('second'));
  return new Date(guess - (representedAsUtc - guess));
}

function getEasternDayRange(dateKey) {
  const start = easternWallTimeToUtc(dateKey);
  if (!start || Number.isNaN(start.getTime())) return null;
  const end = easternWallTimeToUtc(shiftDateKey(dateKey, 1));
  return { start, end };
}

module.exports = { EASTERN_TIME_ZONE, getEasternDayRange };
