import styles from './Badge.module.css'

const variantMap = {
  Pending: 'pending',
  Responded: 'responded',
  Won: 'won',
  Lost: 'lost',
  'Follow Up': 'followup',
  Connected: 'connected',
  Voicemail: 'voicemail',
  'No Answer': 'noanswer',
  Interested: 'interested',
  'Not Interested': 'notinterested',
  'Ready to call': 'ready',
  admin: 'admin',
  staff: 'staff',
}

export function Badge({ label }) {
  const cls = variantMap[label] || 'default'
  return (
    <span className={`${styles.badge} ${styles[cls]}`}>
      <span className={styles.dot} />
      {label}
    </span>
  )
}

// Solid color matching each badge variant — handy for accenting a mobile
// card (left border, icon color, etc.) with the same status color as its badge.
const colorMap = {
  Pending: '#c9a227',
  Responded: 'var(--blue)',
  Won: 'var(--green)',
  Lost: 'var(--red)',
  'Follow Up': 'var(--purple)',
  Connected: 'var(--green)',
  Voicemail: '#c9a227',
  'No Answer': 'var(--text3)',
  Interested: 'var(--blue)',
  'Not Interested': 'var(--red)',
  'Ready to call': 'var(--accent)',
  admin: 'var(--accent)',
  staff: 'var(--green)',
}

export function statusColor(label) {
  return colorMap[label] || 'var(--border2)'
}
