import { useEffect, useMemo, useState } from 'react'
import { Icon } from './Icon'
import { fetchTaskHistory } from '../utils/taskApi'
import styles from './TaskHistoryCalendar.module.css'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function pad(number) {
  return String(number).padStart(2, '0')
}

function dateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function initials(name) {
  return (name || '?').split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()
}

export function TaskHistoryCalendar({ category }) {
  const today = new Date()
  const todayKey = dateKey(today)
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState(todayKey)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const start = new Date(viewYear, viewMonth, 1)
    const end = new Date(viewYear, viewMonth + 1, 1)

    setLoading(true)
    setError('')
    fetchTaskHistory({ start: start.toISOString(), end: end.toISOString(), category })
      .then(({ data }) => { if (active) setHistory(data) })
      .catch(err => {
        if (!active) return
        console.error('Failed to load task history:', err)
        setError('Could not load task history. Please try again.')
      })
      .finally(() => { if (active) setLoading(false) })

    return () => { active = false }
  }, [category, viewMonth, viewYear])

  const historyByDate = useMemo(() => history.reduce((map, entry) => {
    const key = dateKey(new Date(entry.completedAt))
    if (!map[key]) map[key] = []
    map[key].push(entry)
    return map
  }, {}), [history])

  const selectedHistory = selectedDate ? historyByDate[selectedDate] || [] : []
  const firstDay = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7
  const cells = Array.from({ length: totalCells }, (_, index) => {
    const day = index - firstDay + 1
    return day >= 1 && day <= daysInMonth ? day : null
  })

  const changeMonth = (amount) => {
    const next = new Date(viewYear, viewMonth + amount, 1)
    setViewYear(next.getFullYear())
    setViewMonth(next.getMonth())
    setSelectedDate(null)
  }

  return (
    <div className={styles.historyLayout}>
      <section className={styles.calendarPane} aria-label="Task completion calendar">
        <div className={styles.monthNav}>
          <button className={styles.navButton} onClick={() => changeMonth(-1)} aria-label="Previous month">‹</button>
          <div className={styles.monthHeading}>
            <strong>{MONTHS[viewMonth]} {viewYear}</strong>
            <span>{history.length} task{history.length !== 1 ? 's' : ''} completed</span>
          </div>
          <button className={styles.navButton} onClick={() => changeMonth(1)} aria-label="Next month">›</button>
        </div>

        <div className={styles.calendarGrid}>
          {DAYS.map(day => <div key={day} className={styles.dayHeading}>{day}</div>)}
          {cells.map((day, index) => {
            if (!day) return <div key={`empty-${index}`} className={styles.emptyCell} />
            const key = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`
            const entries = historyByDate[key] || []
            return (
              <button
                key={key}
                className={`${styles.dayCell} ${key === todayKey ? styles.today : ''} ${key === selectedDate ? styles.selected : ''}`}
                onClick={() => setSelectedDate(key)}
                aria-label={`${key}: ${entries.length} completed task${entries.length !== 1 ? 's' : ''}`}
              >
                <span className={styles.dayNumber}>{day}</span>
                {entries.length > 0 && (
                  <>
                    <span className={styles.completionCount}>{entries.length}</span>
                    <div className={styles.taskPreviews}>
                      {entries.slice(0, 2).map(entry => <span key={entry._id}>{entry.taskName}</span>)}
                      {entries.length > 2 && <span>+{entries.length - 2} more</span>}
                    </div>
                  </>
                )}
              </button>
            )
          })}
        </div>
      </section>

      <aside className={styles.detailsPane}>
        {!selectedDate ? (
          <div className={styles.placeholder}>
            <Icon name="calendar" size={28} />
            <p>Select a date to see completed tasks.</p>
          </div>
        ) : (
          <>
            <div className={styles.detailsHeader}>
              <div>
                <strong>{new Date(`${selectedDate}T12:00:00`).toLocaleDateString('en-US', {
                  weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
                })}</strong>
                <span>{selectedHistory.length} completion{selectedHistory.length !== 1 ? 's' : ''}</span>
              </div>
            </div>

            {loading ? (
              <div className={styles.message}>Loading history…</div>
            ) : error ? (
              <div className={`${styles.message} ${styles.error}`}>{error}</div>
            ) : selectedHistory.length === 0 ? (
              <div className={styles.placeholder}>
                <Icon name="check" size={26} />
                <p>No tasks were completed on this date.</p>
              </div>
            ) : (
              <div className={styles.historyList}>
                {selectedHistory.map(entry => {
                  const person = entry.completedBy || entry.assignedTo
                  return (
                    <article key={entry._id} className={styles.historyCard}>
                      <div className={styles.taskName}>{entry.taskName}</div>
                      <div className={styles.personRow}>
                        <span className={styles.avatar}>{initials(person?.name)}</span>
                        <div>
                          <strong>{person?.name || 'Unknown user'}</strong>
                          <span>{entry.completedBy ? 'Completed by' : 'Assigned to (older record)'}</span>
                        </div>
                        <time>{new Date(entry.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
                      </div>
                      {entry.notes && <p className={styles.notes}>{entry.notes}</p>}
                    </article>
                  )
                })}
              </div>
            )}
          </>
        )}
      </aside>
    </div>
  )
}
