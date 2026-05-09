import { useState, useEffect, useCallback } from 'react'
import api from '../utils/api'
import { Modal, ModalActions } from '../components/Modal'
import { Button } from '../components/Button'
import { Icon } from '../components/Icon'
import styles from './Calendar.module.css'
import { exportToExcel, formatEvents } from '../utils/exportToExcel'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

const EMPTY_FORM = { name: '', date: '', notes: '' }

function pad(n) { return String(n).padStart(2, '0') }
function toDateStr(d) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}` }

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay()
}

export default function Calendar() {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [events, setEvents] = useState([]) // events for current month
  const [modal, setModal] = useState(null) // null | 'new' | eventObj
  const [selectedDate, setSelectedDate] = useState(null) // YYYY-MM-DD string
  const [dayEvents, setDayEvents] = useState([]) // events for selected date panel

  const monthKey = `${viewYear}-${pad(viewMonth + 1)}`

  const loadEvents = useCallback(async () => {
    try {
      const { data } = await api.get('/events', { params: { month: monthKey } })
      setEvents(data)
    } catch (err) {
      console.error('Failed to load events', err)
    }
  }, [monthKey])

  useEffect(() => { loadEvents() }, [loadEvents])

  // Update day panel when date selected or events change
  useEffect(() => {
    if (!selectedDate) { setDayEvents([]); return }
    setDayEvents(events.filter(e => e.date.slice(0, 10) === selectedDate))
  }, [selectedDate, events])

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
    setSelectedDate(null)
  }

  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
    setSelectedDate(null)
  }

  const handleDayClick = (dateStr) => {
    setSelectedDate(prev => prev === dateStr ? null : dateStr)
  }

  // Build event map: date string → events[]
  const eventMap = {}
  events.forEach(e => {
    const d = e.date.slice(0, 10)
    if (!eventMap[d]) eventMap[d] = []
    eventMap[d].push(e)
  })

  const handleSave = async (form) => {
    if (modal?._id) {
      await api.put(`/events/${modal._id}`, form)
    } else {
      await api.post('/events', form)
    }
    setModal(null)
    loadEvents()
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this event?')) return
    await api.delete(`/events/${id}`)
    setSelectedDate(null)
    loadEvents()
  }

  // Calendar grid
  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth)
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7
  const cells = Array.from({ length: totalCells }, (_, i) => {
    const dayNum = i - firstDay + 1
    if (dayNum < 1 || dayNum > daysInMonth) return null
    return dayNum
  })

  const todayStr = toDateStr(today)

  return (
    <div style={{ padding: '24px' }}>
      <div className={styles.pageHeader}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '28px', fontWeight: 700, letterSpacing: '-0.5px' }}>Calendar</h1>
          <p style={{ margin: 0, color: 'var(--text2)', fontSize: '13px' }}>Schedule and track events</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="secondary" onClick={() => exportToExcel('calendar-events-export', 'Calendar Events', formatEvents(events))}>
            <Icon name="doc" size={14} /> Export Excel
          </Button>
          <Button variant="primary" onClick={() => setModal({ ...EMPTY_FORM, date: selectedDate || todayStr })}>
            <Icon name="plus" /> New Event
          </Button>
        </div>
      </div>

      <div className={styles.layout}>
        {/* Calendar grid */}
        <div className={styles.calendarPane}>
          {/* Month navigation */}
          <div className={styles.monthNav}>
            <button className={styles.navBtn} onClick={prevMonth}><Icon name="arrowIn" size={16} style={{ transform: 'rotate(90deg)' }} /></button>
            <span className={styles.monthTitle}>{MONTHS[viewMonth]} {viewYear}</span>
            <button className={styles.navBtn} onClick={nextMonth}><Icon name="arrowIn" size={16} style={{ transform: 'rotate(-90deg)' }} /></button>
          </div>

          {/* Day headers */}
          <div className={styles.grid7}>
            {DAYS.map(d => <div key={d} className={styles.dayHeader}>{d}</div>)}
          </div>

          {/* Cells */}
          <div className={styles.grid7}>
            {cells.map((day, i) => {
              if (!day) return <div key={`empty-${i}`} className={styles.emptyCell} />
              const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`
              const isToday = dateStr === todayStr
              const isSelected = dateStr === selectedDate
              const evs = eventMap[dateStr] || []

              return (
                <div
                  key={dateStr}
                  className={`${styles.cell} ${isToday ? styles.cellToday : ''} ${isSelected ? styles.cellSelected : ''}`}
                  onClick={() => handleDayClick(dateStr)}
                >
                  <span className={styles.dayNum}>{day}</span>
                  <div className={styles.dotRow}>
                    {evs.slice(0, 3).map(e => (
                      <span key={e._id} className={styles.eventDot} />
                    ))}
                    {evs.length > 3 && <span className={styles.moreTag}>+{evs.length - 3}</span>}
                  </div>
                  {evs.length > 0 && (
                    <div className={styles.cellEventPills}>
                      {evs.slice(0, 2).map(e => (
                        <div key={e._id} className={styles.cellEventPill} title={e.name}>{e.name}</div>
                      ))}
                      {evs.length > 2 && <div className={styles.cellEventPill} style={{ opacity: 0.6 }}>+{evs.length - 2} more</div>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Side panel */}
        <div className={styles.sidePanel}>
          {!selectedDate ? (
            <div className={styles.sidePlaceholder}>
              <Icon name="calendar" size={28} color="var(--text3)" />
              <p>Click a date to view or add events</p>
            </div>
          ) : (
            <>
              <div className={styles.sidePanelHeader}>
                <div>
                  <div className={styles.sidePanelDate}>
                    {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </div>
                  <div className={styles.sidePanelCount}>
                    {dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}
                  </div>
                </div>
                <Button variant="primary" onClick={() => setModal({ ...EMPTY_FORM, date: selectedDate })}>
                  <Icon name="plus" />
                </Button>
              </div>

              {dayEvents.length === 0 ? (
                <div className={styles.emptyDay}>
                  <p>No events on this day.</p>
                  <button className={styles.addLink} onClick={() => setModal({ ...EMPTY_FORM, date: selectedDate })}>
                    + Add one
                  </button>
                </div>
              ) : (
                <div className={styles.eventList}>
                  {dayEvents.map(ev => (
                    <div key={ev._id} className={styles.eventCard}>
                      <div className={styles.eventCardTop}>
                        <div className={styles.eventName}>{ev.name}</div>
                        <div className={styles.eventActions}>
                          <button className={styles.iconBtn} onClick={() => setModal(ev)} title="Edit">
                            <Icon name="pen" size={13} />
                          </button>
                          <button className={`${styles.iconBtn} ${styles.iconBtnDanger}`} onClick={() => handleDelete(ev._id)} title="Delete">
                            <Icon name="trash" size={13} />
                          </button>
                        </div>
                      </div>
                      {ev.notes && <div className={styles.eventNotes}>{ev.notes}</div>}
                      {ev.createdBy?.name && (
                        <div className={styles.eventMeta}>by {ev.createdBy.name}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {modal !== null && (
        <Modal
          title={modal?._id ? 'Edit Event' : 'New Event'}
          onClose={() => setModal(null)}
        >
          <EventForm
            initial={modal}
            isEdit={!!modal?._id}
            onSave={handleSave}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  )
}

function EventForm({ initial, onSave, onCancel, isEdit }) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    date: initial?.date?.slice(0, 10) || '',
    notes: initial?.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.date) return
    setSaving(true)
    try { await onSave(form) } finally { setSaving(false) }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text2)', marginBottom: '5px', letterSpacing: '0.3px' }}>
            Event Name *
          </label>
          <input
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder="e.g. Team Meeting, Check-In Day"
            required
            autoFocus
            style={inputStyle}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text2)', marginBottom: '5px', letterSpacing: '0.3px' }}>
            Date *
          </label>
          <input
            value={form.date}
            onChange={e => set('date', e.target.value)}
            type="date"
            required
            style={inputStyle}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text2)', marginBottom: '5px', letterSpacing: '0.3px' }}>
            External Notes
          </label>
          <textarea
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            placeholder="Any details, contacts, or reminders…"
            rows={4}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.5' }}
          />
        </div>
      </div>
      <ModalActions>
        <Button variant="secondary" type="button" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" type="submit" disabled={saving}>
          {saving ? 'Saving…' : isEdit ? 'Update Event' : 'Add Event'}
        </Button>
      </ModalActions>
    </form>
  )
}

const inputStyle = {
  width: '100%',
  background: 'var(--surface2)',
  border: '1px solid var(--border2)',
  borderRadius: 'var(--radius-sm)',
  padding: '10px 14px',
  fontSize: '13px',
  color: 'var(--text)',
  outline: 'none',
  boxSizing: 'border-box',
}
