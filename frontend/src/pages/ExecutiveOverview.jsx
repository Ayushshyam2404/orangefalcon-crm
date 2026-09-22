import { useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import api from '../utils/api'
import styles from './Dashboard.module.css'

const names = { sales: 'Sales', reputation: 'Reputation', marketing: 'Marketing', operations: 'Operations', 'internal-sales': 'Internal Sales' }

export default function ExecutiveOverview() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const load = () => api.get('/overview/executive').then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false))
    load(); const id = setInterval(load, 60000); return () => clearInterval(id)
  }, [])
  if (loading) return <p className={styles.empty}>Loading company overview…</p>
  const t = data?.totals || {}
  return <div>
    <div className={styles.header}><div><h1 className={styles.title}>Company Overview</h1><p className={styles.subtitle}>One-screen view of attendance, work and employee behaviour today</p></div><span className={styles.subtitle}>Live · {data?.date}</span></div>
    <div className={styles.statsGrid}>
      {[
        ['users', t.present ?? 0, `Present / ${t.employees ?? 0}`, 'var(--green)'],
        ['clock', t.active ?? 0, 'Actively Working', 'var(--blue)'],
        ['check', `${t.completedTasks ?? 0}/${t.totalTasks ?? 0}`, 'Tasks Completed', 'var(--accent)'],
        ['warn', t.warnings ?? 0, 'Inactivity Warnings', 'var(--red, #ef4444)'],
      ].map(([icon, value, label, color]) => <div className={styles.statCard} style={{ '--sc': color }} key={label}><div className={styles.statIcon} style={{ background: 'var(--surface2)' }}><Icon name={icon} size={18} color={color} /></div><div className={styles.statValue}>{value}</div><div className={styles.statLabel}>{label}</div></div>)}
    </div>
    <div className={styles.card} style={{ marginBottom: 18 }}><div className={styles.cardTitle}>Department Performance Today</div><div style={{ overflowX: 'auto', padding: '0 18px 18px' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}><thead><tr>{['Department','Team','Present','Active','Tasks','Completion','Warnings'].map(h => <th key={h} style={{ textAlign: 'left', color: 'var(--text3)', padding: 10, borderBottom: '1px solid var(--border)' }}>{h}</th>)}</tr></thead><tbody>{data?.departments?.map(d => <tr key={d.department}><td style={{ padding: 12, fontWeight: 700 }}>{names[d.department]}</td><td>{d.headcount}</td><td>{d.present}</td><td>{d.active}</td><td>{d.tasksCompleted}/{d.tasksTotal}</td><td>{d.tasksTotal ? Math.round(d.tasksCompleted / d.tasksTotal * 100) : 0}%</td><td style={{ color: d.warnings ? 'var(--red)' : 'var(--text2)', fontWeight: 700 }}>{d.warnings}</td></tr>)}</tbody></table></div></div>
    <div className={styles.card}><div className={styles.cardTitle}>Employee Status</div><div className={styles.activityList}>{data?.employees?.map(e => <div className={styles.activityItem} key={e._id}><div className={styles.activityIcon} style={{ background: e.clockedIn && !e.onBreak ? 'var(--green-soft)' : 'var(--surface2)' }}><Icon name="users" size={14} color={e.clockedIn && !e.onBreak ? 'var(--green)' : 'var(--text3)'} /></div><div style={{ flex: 1 }}><div className={styles.activityTitle}>{e.name}</div><div className={styles.activitySub}>{names[e.department] || e.department} · {e.onBreak ? 'On break' : e.clockedIn ? 'Working' : 'Not clocked in'}</div></div>{e.warningsToday > 0 && <span style={{ color: 'var(--red)', fontSize: 12, fontWeight: 700 }}>{e.warningsToday} warning{e.warningsToday !== 1 ? 's' : ''}</span>}</div>)}</div></div>
  </div>
}
