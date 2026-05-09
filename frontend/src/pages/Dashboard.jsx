import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Icon } from '../components/Icon'
import { Badge } from '../components/Badge'
import api from '../utils/api'
import { fetchTasksByDay } from '../utils/taskApi'
import styles from './Dashboard.module.css'

function StatCard({ icon, iconColor, iconBg, accentColor, value, label }) {
  return (
    <div className={styles.statCard} style={{ '--sc': accentColor }}>
      <div className={styles.statIcon} style={{ background: iconBg }}>
        <Icon name={icon} size={18} color={iconColor} />
      </div>
      <div className={styles.statValue}>{value}</div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const [rfps, setRfps] = useState([])
  const [calls, setCalls] = useState([])
  const [tasks, setTasks] = useState([])
  const [upcomingEvents, setUpcomingEvents] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    Promise.all([
      api.get('/rfps', { params: { all: true } }),
      api.get('/calls'),
      fetchTasksByDay(today),
      api.get('/events/upcoming'),
      api.get('/announcements'),
    ])
      .then(([r, c, t, e, a]) => {
        setRfps(r.data)
        setCalls(c.data)
        setTasks(t.data)
        setUpcomingEvents(e.data)
        setAnnouncements(a.data.slice(0, 3))
      })
      .catch(err => console.error('Failed to fetch dashboard data:', err))
      .finally(() => setLoading(false))
  }, [])

  const h = new Date().getHours()
  const greeting = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'

  const stats = [
    { icon: 'doc', iconColor: 'var(--accent)', iconBg: 'var(--accent-soft)', accentColor: 'var(--accent)', value: rfps.length, label: 'Total RFPs' },
    { icon: 'trophy', iconColor: 'var(--green)', iconBg: 'var(--green-soft)', accentColor: 'var(--green)', value: rfps.filter(r => r.status === 'Won').length, label: 'RFPs Won' },
    { icon: 'phone', iconColor: 'var(--blue)', iconBg: 'var(--blue-soft)', accentColor: 'var(--blue)', value: calls.length, label: 'Total Calls' },
    { icon: 'star', iconColor: 'var(--purple)', iconBg: 'var(--purple-soft)', accentColor: 'var(--purple)', value: calls.filter(c => c.outcome === 'Interested').length, label: 'Interested Leads' },
    { icon: 'check', iconColor: 'var(--orange)', iconBg: 'var(--orange-soft)', accentColor: 'var(--orange)', value: tasks.filter(t => t.status === 'completed').length, label: 'Tasks Completed' },
  ]

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Dashboard</h1>
          <p className={styles.subtitle}>{greeting}, {user?.name}</p>
        </div>
      </div>

      <div className={styles.statsGrid}>
        {stats.map((s) => <StatCard key={s.label} {...s} />)}
      </div>

      {announcements.length > 0 && (
        <div className={styles.announcementsSection}>
          <div className={styles.announcementsHeader}>
            <div className={styles.announcementsTitle}>
              <Icon name="megaphone" size={16} color="var(--accent)" />
              Announcements
            </div>
            <Link to="/announcements" className={styles.viewAllLink}>View all →</Link>
          </div>
          <div className={styles.announcementsList}>
            {announcements.map((a) => {
              const priorityColor = a.priority === 'urgent' ? 'var(--red)' : a.priority === 'important' ? '#3b82f6' : 'var(--text3)'
              const priorityBg    = a.priority === 'urgent' ? 'var(--red-soft)' : a.priority === 'important' ? 'rgba(59,130,246,0.08)' : 'var(--surface2)'
              return (
                <div key={a._id} className={styles.announcementCard} style={{ borderLeftColor: priorityColor }}>
                  <div className={styles.announcementTop}>
                    <span className={styles.announcementHeading}>{a.heading}</span>
                    <span className={styles.announcementBadge} style={{ color: priorityColor, background: priorityBg }}>{a.priority}</span>
                  </div>
                  <div className={styles.announcementMeta}>
                    <Icon name="calendar" size={10} color="var(--text3)" />
                    {new Date(a.noticeDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    <span className={styles.metaDot}>·</span>
                    {a.author?.name}
                  </div>
                  <p className={styles.announcementBody}>
                    {a.body.length > 160 ? a.body.slice(0, 160) + '…' : a.body}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className={styles.grid}>
        <div className={styles.card}>
          <div className={styles.cardTitle}>Today's Tasks</div>
          <div className={styles.activityList}>
            {loading ? <p className={styles.empty}>Loading...</p>
              : tasks.length === 0 ? <p className={styles.empty}>No tasks for today.</p>
              : tasks.slice(0, 6).map((t) => (
                <div key={t._id} className={styles.activityItem}>
                  <div className={styles.activityIcon} style={{ background: t.status === 'completed' ? 'var(--green-soft)' : t.status === 'in-progress' ? 'var(--blue-soft)' : 'var(--yellow-soft)' }}>
                    <Icon name={t.status === 'completed' ? 'check' : 'clock'} size={14} color={t.status === 'completed' ? 'var(--green)' : t.status === 'in-progress' ? 'var(--blue)' : 'var(--yellow)'} />
                  </div>
                  <div>
                    <div className={styles.activityTitle}>{t.taskName}</div>
                    <div className={styles.activitySub}>
                      {new Date(t.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · <Badge label={t.status} />
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>Recent RFPs</div>
          <div className={styles.activityList}>
            {loading ? <p className={styles.empty}>Loading...</p>
              : rfps.length === 0 ? <p className={styles.empty}>No RFPs yet.</p>
              : rfps.slice(0, 6).map((r) => (
                <div key={r._id} className={styles.activityItem}>
                  <div className={styles.activityIcon} style={{ background: r.priority ? 'var(--yellow-soft)' : 'var(--accent-soft)' }}>
                    <Icon name={r.priority ? 'starFill' : 'doc'} size={14} color={r.priority ? 'var(--yellow)' : 'var(--accent)'} />
                  </div>
                  <div>
                    <div className={styles.activityTitle}>
                      {r.client}
                      {r.priority && <span className={styles.priorityTag}>PRIORITY</span>}
                    </div>
                    <div className={styles.activitySub}>
                      {r.checkin || 'No date'} · <Badge label={r.status} />
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>Recent Calls</div>
          <div className={styles.activityList}>
            {loading ? <p className={styles.empty}>Loading...</p>
              : calls.length === 0 ? <p className={styles.empty}>No calls yet.</p>
              : calls.slice(0, 6).map((c) => (
                <div key={c._id} className={styles.activityItem}>
                  <div className={styles.activityIcon} style={{ background: 'var(--blue-soft)' }}>
                    <Icon name="phone" size={14} color="var(--blue)" />
                  </div>
                  <div>
                    <div className={styles.activityTitle}>{c.name}</div>
                    <div className={styles.activitySub}>
                      {c.phone || 'No phone'} · <Badge label={c.outcome} />
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>Upcoming Events</div>
          <div className={styles.activityList}>
            {loading ? <p className={styles.empty}>Loading...</p>
              : upcomingEvents.length === 0 ? <p className={styles.empty}>No upcoming events.</p>
              : upcomingEvents.map((ev) => {
                const evDate = new Date(ev.date)
                const isToday = evDate.toDateString() === new Date().toDateString()
                return (
                  <div key={ev._id} className={styles.activityItem}>
                    <div className={styles.activityIcon} style={{ background: isToday ? 'var(--accent-soft)' : 'var(--purple-soft)' }}>
                      <Icon name="calendar" size={14} color={isToday ? 'var(--accent)' : 'var(--purple)'} />
                    </div>
                    <div>
                      <div className={styles.activityTitle}>{ev.name}</div>
                      <div className={styles.activitySub}>
                        {isToday ? 'Today' : evDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        {ev.notes && <span> · {ev.notes.slice(0, 40)}{ev.notes.length > 40 ? '…' : ''}</span>}
                      </div>
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      </div>
    </div>
  )
}
