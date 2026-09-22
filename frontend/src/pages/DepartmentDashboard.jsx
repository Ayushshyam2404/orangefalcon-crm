import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Icon } from '../components/Icon'
import { Badge } from '../components/Badge'
import api from '../utils/api'
import { getEasternDateKey } from '../utils/easternTime'
import styles from './Dashboard.module.css'

const LABELS = {
  marketing: 'Marketing', operations: 'Operations', 'internal-sales': 'Internal Sales',
}

export default function DepartmentDashboard({ category, tasksPath }) {
  const { user } = useAuth()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    api.get('/tasks', { params: { category, date: getEasternDateKey() } })
      .then(r => setTasks(r.data)).catch(() => setTasks([])).finally(() => setLoading(false))
  }, [category])
  const done = tasks.filter(t => t.status === 'completed').length
  const progress = tasks.length ? Math.round(done / tasks.length * 100) : 0
  const label = LABELS[category] || category
  return <div>
    <div className={styles.header}>
      <div><h1 className={styles.title}>{label} Dashboard</h1><p className={styles.subtitle}>Welcome, {user?.name} · today’s work at a glance</p></div>
      <Link to={tasksPath} className={styles.viewAllLink}>Open task manager →</Link>
    </div>
    <div className={styles.statsGrid}>
      {[
        ['doc', tasks.length, 'Tasks Today', 'var(--accent)'],
        ['check', done, 'Completed', 'var(--green)'],
        ['clock', tasks.filter(t => t.status === 'in-progress').length, 'In Progress', 'var(--blue)'],
        ['barChart', `${progress}%`, 'Completion Rate', 'var(--purple)'],
      ].map(([icon, value, text, color]) => <div className={styles.statCard} style={{ '--sc': color }} key={text}>
        <div className={styles.statIcon} style={{ background: 'var(--surface2)' }}><Icon name={icon} size={18} color={color} /></div>
        <div className={styles.statValue}>{value}</div><div className={styles.statLabel}>{text}</div>
      </div>)}
    </div>
    <div className={styles.card}>
      <div className={styles.cardTitle}>Today’s {label} Tasks</div>
      <div className={styles.activityList}>{loading ? <p className={styles.empty}>Loading…</p> : tasks.length === 0 ? <p className={styles.empty}>No tasks added for today.</p> : tasks.map(t => <div className={styles.activityItem} key={t._id}>
        <div className={styles.activityIcon} style={{ background: t.status === 'completed' ? 'var(--green-soft)' : 'var(--accent-soft)' }}><Icon name={t.status === 'completed' ? 'check' : 'clock'} size={14} /></div>
        <div><div className={styles.activityTitle}>{t.taskName}</div><div className={styles.activitySub}><Badge label={t.status} />{t.notes ? ` · ${t.notes.slice(0, 90)}` : ''}</div></div>
      </div>)}</div>
    </div>
  </div>
}
