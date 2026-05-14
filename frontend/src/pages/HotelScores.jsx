import { useEffect, useState, useMemo } from 'react'
import { Icon } from '../components/Icon'
import { Button } from '../components/Button'
import { Modal, ModalActions } from '../components/Modal'
import api from '../utils/api'
import styles from './DataPage.module.css'
import calStyles from './Calendar.module.css'
import { exportToExcel, formatHotelScores } from '../utils/exportToExcel'

function ScoreForm({ initial = {}, hotels, onSave, onCancel }) {
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    hotel: initial.hotel?._id || initial.hotel || '',
    date: initial.date ? new Date(initial.date).toISOString().split('T')[0] : today,
    score: initial.score ?? '',
    notes: initial.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.hotel || !form.date || form.score === '') return
    setSaving(true)
    try { await onSave(form) } finally { setSaving(false) }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className={styles.formGroup}>
        <label>Hotel</label>
        <select value={form.hotel} onChange={e => set('hotel', e.target.value)} required>
          <option value="">— Select a hotel —</option>
          {hotels.map(h => (
            <option key={h._id} value={h._id}>{h.name} ({h.city})</option>
          ))}
        </select>
      </div>
      <div className={styles.formGroup}>
        <label>Date of Score</label>
        <input
          type="date"
          value={form.date}
          onChange={e => set('date', e.target.value)}
          required
        />
      </div>
      <div className={styles.formGroup}>
        <label>Score (0–100)</label>
        <input
          type="number"
          min={0}
          max={100}
          step={0.1}
          value={form.score}
          onChange={e => set('score', e.target.value)}
          placeholder="e.g. 87.5"
          required
        />
      </div>
      <div className={styles.formGroup}>
        <label>Additional Notes</label>
        <textarea
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
          placeholder="Any observations or context..."
          rows={3}
        />
      </div>
      <ModalActions>
        <Button variant="secondary" type="button" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" type="submit" disabled={saving}>
          {saving ? 'Saving...' : initial._id ? 'Update Score' : 'Add Score'}
        </Button>
      </ModalActions>
    </form>
  )
}

function ScoreDot({ score }) {
  const n = parseFloat(score)
  const color = n >= 80 ? 'var(--green)' : n >= 50 ? 'var(--accent)' : 'var(--red)'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 36, height: 36, borderRadius: '50%', fontWeight: 700, fontSize: 13,
      background: color + '22', color, border: `1.5px solid ${color}`,
    }}>
      {n}
    </span>
  )
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function pad(n) { return String(n).padStart(2, '0') }
function getDaysInMonth(yr, mo) { return new Date(yr, mo + 1, 0).getDate() }
function getFirstDay(yr, mo) { return new Date(yr, mo, 1).getDay() }

function scoreColor(n) {
  return n >= 80 ? 'var(--green)' : n >= 50 ? 'var(--accent)' : 'var(--red)'
}

function CalendarMonthView({ scores, viewYear, viewMonth, onPrev, onNext, onYearView }) {
  const today = new Date()
  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstDay = getFirstDay(viewYear, viewMonth)

  const scoreMap = {}
  scores.forEach(s => {
    const d = new Date(s.date).toISOString().split('T')[0]
    if (!scoreMap[d]) scoreMap[d] = []
    scoreMap[d].push(s)
  })

  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const isToday = (d) =>
    today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === d

  return (
    <div className={styles.card} style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <button className={calStyles.navBtn} onClick={onPrev}>‹</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className={calStyles.monthTitle}>{MONTHS[viewMonth]} {viewYear}</span>
          <button
            className={styles.filterBtn}
            onClick={onYearView}
            style={{ fontSize: 11 }}
          >
            Year View
          </button>
        </div>
        <button className={calStyles.navBtn} onClick={onNext}>›</button>
      </div>

      <div className={calStyles.grid7}>
        {DAYS.map(d => <div key={d} className={calStyles.dayHeader}>{d}</div>)}
        {cells.map((day, i) => {
          if (!day) return <div key={`e-${i}`} style={{ minHeight: 74 }} />
          const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`
          const dayScores = scoreMap[dateStr] || []
          return (
            <div key={dateStr} className={`${calStyles.cell} ${isToday(day) ? calStyles.cellToday : ''}`}>
              <span className={calStyles.dayNum}>{day}</span>
              {dayScores.map(s => {
                const n = parseFloat(s.score)
                const color = scoreColor(n)
                return (
                  <div key={s._id} style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    background: color + '18', borderRadius: 4, padding: '2px 5px',
                  }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color }}>{n}</span>
                    <span style={{ fontSize: 9, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 64 }}>
                      {s.hotel?.name}
                    </span>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CalendarYearView({ scores, viewYear, onPrevYear, onNextYear, onMonthClick }) {
  const monthMap = {}
  scores.forEach(s => {
    const d = new Date(s.date)
    if (d.getFullYear() === viewYear) {
      const m = d.getMonth()
      if (!monthMap[m]) monthMap[m] = []
      monthMap[m].push(s)
    }
  })

  return (
    <div className={styles.card} style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <button className={calStyles.navBtn} onClick={onPrevYear}>‹</button>
        <span className={calStyles.monthTitle}>{viewYear}</span>
        <button className={calStyles.navBtn} onClick={onNextYear}>›</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {MONTHS_SHORT.map((month, i) => {
          const ms = monthMap[i] || []
          const avg = ms.length
            ? (ms.reduce((a, s) => a + parseFloat(s.score), 0) / ms.length).toFixed(1)
            : null
          const color = avg ? scoreColor(parseFloat(avg)) : 'var(--text3)'
          return (
            <div
              key={month}
              onClick={() => onMonthClick(i)}
              style={{
                background: 'var(--surface2)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '14px 12px', cursor: 'pointer',
                transition: 'border-color 0.15s', textAlign: 'center',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 8 }}>{month}</div>
              {avg
                ? <div style={{ fontSize: 24, fontWeight: 800, color }}>{avg}</div>
                : <div style={{ fontSize: 12, color: 'var(--text3)' }}>—</div>
              }
              {ms.length > 0 && (
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>
                  {ms.length} {ms.length === 1 ? 'entry' : 'entries'}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function HotelScores() {
  const [scores, setScores] = useState([])
  const [hotels, setHotels] = useState([])
  const [loading, setLoading] = useState(true)
  const [hotelFilter, setHotelFilter] = useState('all')
  const [modal, setModal] = useState(null)
  const [saveError, setSaveError] = useState('')
  const [view, setView] = useState('table') // 'table' | 'month' | 'year'

  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  const fetchScores = async () => {
    const params = hotelFilter !== 'all' ? { hotel: hotelFilter } : {}
    const { data } = await api.get('/hotel-scores', { params })
    setScores(data)
    setLoading(false)
  }

  useEffect(() => {
    api.get('/hotels', { params: { category: 'reputation' } }).then(({ data }) => setHotels(data)).catch(() => {})
  }, [])

  useEffect(() => { fetchScores() }, [hotelFilter])

  const handleSave = async (form) => {
    setSaveError('')
    const payload = { ...form, score: parseFloat(form.score) }
    try {
      if (modal?._id) {
        await api.put(`/hotel-scores/${modal._id}`, payload)
      } else {
        await api.post('/hotel-scores', payload)
      }
      setModal(null)
      fetchScores()
    } catch (err) {
      setSaveError(err.response?.data?.message || 'Failed to save score')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this score entry?')) return
    await api.delete(`/hotel-scores/${id}`)
    fetchScores()
  }

  const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const calScores = useMemo(() =>
    view === 'month'
      ? scores.filter(s => {
          const d = new Date(s.date)
          return d.getFullYear() === viewYear && d.getMonth() === viewMonth
        })
      : scores
  , [scores, view, viewYear, viewMonth])

  const viewBtns = [
    { key: 'table', icon: 'check', label: 'Table' },
    { key: 'month', icon: 'calendar', label: 'Month' },
    { key: 'year', icon: 'grid', label: 'Year' },
  ]

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Hotel Scores</h1>
          <p className={styles.pageSubtitle}>Track daily score entries per hotel</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* View toggle */}
          <div style={{ display: 'flex', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: 3, gap: 2 }}>
            {viewBtns.map(b => (
              <button
                key={b.key}
                onClick={() => setView(b.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
                  background: view === b.key ? 'var(--accent)' : 'transparent',
                  color: view === b.key ? 'white' : 'var(--text2)',
                }}
              >
                <Icon name={b.icon} size={13} />
                {b.label}
              </button>
            ))}
          </div>
          <Button variant="secondary" onClick={() => exportToExcel('hotel-scores-export', 'Hotel Scores', formatHotelScores(scores))}>
            <Icon name="doc" size={14} /> Export Excel
          </Button>
          <Button variant="primary" onClick={() => setModal('new')}>
            <Icon name="plus" size={14} /> Add Score
          </Button>
        </div>
      </div>

      {/* Hotel filter */}
      <div className={styles.card} style={{ marginBottom: 16 }}>
        <div className={styles.toolbar}>
          <div className={styles.filterRow}>
            <button
              className={`${styles.filterBtn} ${hotelFilter === 'all' ? styles.active : ''}`}
              onClick={() => setHotelFilter('all')}
            >
              All Hotels
            </button>
            {hotels.map(h => (
              <button
                key={h._id}
                className={`${styles.filterBtn} ${hotelFilter === h._id ? styles.active : ''}`}
                onClick={() => setHotelFilter(h._id)}
              >
                {h.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table view */}
      {view === 'table' && (
        <div className={styles.card}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Hotel</th>
                  <th>City</th>
                  <th>Date</th>
                  <th>Score</th>
                  <th>Notes</th>
                  <th>Logged By</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className={styles.emptyCell}>Loading...</td></tr>
                ) : scores.length === 0 ? (
                  <tr><td colSpan={7} className={styles.emptyCell}>No scores logged yet.</td></tr>
                ) : scores.map(s => (
                  <tr key={s._id}>
                    <td><strong>{s.hotel?.name || '—'}</strong></td>
                    <td className={styles.dimText}>{s.hotel?.city || '—'}</td>
                    <td className={styles.dimText}>{fmtDate(s.date)}</td>
                    <td><ScoreDot score={s.score} /></td>
                    <td className={styles.noteCell}>{s.notes || '—'}</td>
                    <td className={styles.mutedText}>{s.createdBy?.name || '—'}</td>
                    <td className={styles.actions}>
                      <Button variant="secondary" size="sm" onClick={() => setModal(s)}>
                        <Icon name="pen" size={11} /> Edit
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => handleDelete(s._id)}>
                        <Icon name="trash" size={11} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Month calendar view */}
      {view === 'month' && (
        <CalendarMonthView
          scores={calScores}
          viewYear={viewYear}
          viewMonth={viewMonth}
          onPrev={prevMonth}
          onNext={nextMonth}
          onYearView={() => setView('year')}
        />
      )}

      {/* Year calendar view */}
      {view === 'year' && (
        <CalendarYearView
          scores={scores}
          viewYear={viewYear}
          onPrevYear={() => setViewYear(y => y - 1)}
          onNextYear={() => setViewYear(y => y + 1)}
          onMonthClick={(m) => { setViewMonth(m); setView('month') }}
        />
      )}

      {modal && (
        <Modal
          title={modal === 'new' ? 'Add Hotel Score' : 'Edit Hotel Score'}
          onClose={() => { setModal(null); setSaveError('') }}
        >
          {saveError && (
            <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 10 }}>{saveError}</p>
          )}
          <ScoreForm
            initial={modal === 'new' ? {} : modal}
            hotels={hotels}
            onSave={handleSave}
            onCancel={() => { setModal(null); setSaveError('') }}
          />
        </Modal>
      )}
    </div>
  )
}
