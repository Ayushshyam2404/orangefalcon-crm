export const EASTERN_TIME_ZONE = 'America/New_York'

export function getEasternDateKey(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: EASTERN_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value))
  const part = type => parts.find(item => item.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function formatEasternDate(value, options = {}) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-US', {
    timeZone: EASTERN_TIME_ZONE,
    ...options,
  })
}

export function formatEasternDateTime(value, options = {}) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-US', {
    timeZone: EASTERN_TIME_ZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
    ...options,
  })
}

// Convert a wall-clock time in New York into the correct UTC instant without
// depending on the computer's local timezone.
export function easternDateTimeToISOString(dateKey, hour = 23, minute = 59) {
  const [year, month, day] = dateKey.split('-').map(Number)
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0, 0)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: EASTERN_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(guess))
  const part = type => Number(parts.find(item => item.type === type)?.value)
  const representedAsUtc = Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'), part('second'))
  return new Date(guess - (representedAsUtc - guess)).toISOString()
}
