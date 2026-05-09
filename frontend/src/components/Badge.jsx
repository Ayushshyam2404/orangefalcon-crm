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
