import { useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import { Badge } from '../components/Badge'
import { Button } from '../components/Button'
import { Modal, ModalActions } from '../components/Modal'
import api from '../utils/api'
import styles from './DataPage.module.css'
import { exportToExcel, formatRFPs } from '../utils/exportToExcel'

const STATUSES = ['Pending', 'Responded', 'Won', 'Lost', 'Follow Up']

function HotelForm({ initial = {}, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: '', city: '',
    ...initial,
  })
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.city.trim()) return
    setSaving(true)
    try { await onSave(form) } finally { setSaving(false) }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className={styles.formGroup}>
        <label>Hotel Name</label>
        <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Grand Plaza Hotel" required />
      </div>
      <div className={styles.formGroup}>
        <label>City</label>
        <input value={form.city} onChange={e => set('city', e.target.value)} placeholder="e.g. New York" required />
      </div>
      <ModalActions>
        <Button variant="secondary" type="button" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" type="submit" disabled={saving}>{saving ? 'Saving...' : initial._id ? 'Update Hotel' : 'Add Hotel'}</Button>
      </ModalActions>
    </form>
  )
}

function RFPForm({ initial = {}, onSave, onCancel, hotels = [] }) {
  const [form, setForm] = useState({
    client: '', hotel: '', checkin: '', checkout: '', price: '', status: 'Pending', notes: '', priority: false, numRooms: null,
    ...initial,
    hotel: initial.hotel?._id || initial.hotel || '',
  })
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const getDayOfWeek = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString + 'T00:00:00')
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    return days[date.getDay()]
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.client.trim() || !form.hotel) return
    setSaving(true)
    try { await onSave(form) } finally { setSaving(false) }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className={styles.formGroup}>
        <label>Client / Group Name</label>
        <input value={form.client} onChange={e => set('client', e.target.value)} placeholder="e.g. ABC Corporation" required />
      </div>
      <div className={styles.formGroup}>
        <label>Hotel</label>
        <select value={form.hotel} onChange={e => set('hotel', e.target.value)} required>
          <option value="">Select a hotel...</option>
          {hotels.map(h => <option key={h._id} value={h._id}>{h.name} ({h.city})</option>)}
        </select>
      </div>
      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label>Check-in Date</label>
          <input type="date" value={form.checkin} onChange={e => set('checkin', e.target.value)} />
          {form.checkin && <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '4px' }}>{getDayOfWeek(form.checkin)}</div>}
        </div>
        <div className={styles.formGroup}>
          <label>Check-out Date</label>
          <input type="date" value={form.checkout} onChange={e => set('checkout', e.target.value)} />
          {form.checkout && <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '4px' }}>{getDayOfWeek(form.checkout)}</div>}
        </div>
      </div>
      <div className={styles.formGroup}>
        <label>Number of Rooms Needed</label>
        <input type="number" value={form.numRooms || ''} onChange={e => set('numRooms', e.target.value ? Number(e.target.value) : null)} placeholder="e.g. 50" />
      </div>
      <div className={styles.formGroup}>
        <label>Price / Rate</label>
        <div className={styles.inputWithIcon}>
          <Icon name="dollar" size={14} color="var(--text3)" />
          <input type="number" value={form.price} onChange={e => set('price', e.target.value)} placeholder="0.00" style={{ paddingLeft: 34 }} />
        </div>
      </div>
      <div className={styles.formGroup}>
        <label>Status</label>
        <select value={form.status} onChange={e => set('status', e.target.value)}>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div className={styles.formGroup}>
        <label>Additional Requests / Notes</label>
        <textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Special requests, room type, meal plan, AV needs..." rows={3} />
      </div>
      <div className={styles.formGroup}>
        <label>Priority</label>
        <div className={`${styles.starToggle} ${form.priority ? styles.starred : ''}`} onClick={() => set('priority', !form.priority)}>
          <Icon name={form.priority ? 'starFill' : 'star'} size={16} color={form.priority ? 'var(--yellow)' : 'var(--text3)'} />
          <span>{form.priority ? 'Marked as Priority' : 'Mark as Priority'}</span>
        </div>
      </div>
      <ModalActions>
        <Button variant="secondary" type="button" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" type="submit" disabled={saving}>{saving ? 'Saving...' : initial._id ? 'Update RFP' : 'Save RFP'}</Button>
      </ModalActions>
    </form>
  )
}

export default function RFPs() {
  const [rfps, setRfps] = useState([])
  const [hotels, setHotels] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null) // null | 'new' | rfp object
  const [hotelModal, setHotelModal] = useState(null) // null | 'new' | hotel object
  const [user, setUser] = useState(null)

  const fetchRfps = async () => {
    const params = {}
    if (filter !== 'all' && filter !== 'priority') params.status = filter
    if (filter === 'priority') params.priority = true
    if (search) params.search = search
    // Only show RFPs that are NOT in consideration
    params.consideration = 'false'
    const { data } = await api.get('/rfps', { params })
    setRfps(data)
  }

  const fetchHotels = async () => {
    const { data } = await api.get('/hotels', { params: { category: 'sales' } })
    setHotels(data)
    setLoading(false)
  }

  const fetchUser = async () => {
    const { data } = await api.get('/auth/me')
    setUser(data)
  }

  useEffect(() => { fetchUser(); fetchHotels(); fetchRfps() }, [])
  useEffect(() => { fetchRfps() }, [filter, search])

  const handleSave = async (form) => {
    if (modal?._id) {
      await api.put(`/rfps/${modal._id}`, form)
    } else {
      await api.post('/rfps', form)
    }
    setModal(null)
    fetchRfps()
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this RFP?')) return
    await api.delete(`/rfps/${id}`)
    fetchRfps()
  }

  const handleHotelSave = async (hotelForm) => {
    if (hotelModal?._id) {
      await api.put(`/hotels/${hotelModal._id}`, hotelForm)
    } else {
      await api.post('/hotels', hotelForm)
    }
    setHotelModal(null)
    fetchHotels()
  }

  const handleHotelDelete = async (id) => {
    if (!confirm('Delete this hotel?')) return
    await api.delete(`/hotels/${id}`)
    fetchHotels()
  }

  const togglePriority = async (rfp) => {
    await api.put(`/rfps/${rfp._id}`, { ...rfp, priority: !rfp.priority })
    fetchRfps()
  }

  const filters = ['all', 'Pending', 'Responded', 'Won', 'Lost', 'Follow Up', 'priority']

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>RFP Tracker</h1>
          <p className={styles.pageSubtitle}>Manage all hotel RFPs</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {user?.role === 'admin' && (
            <Button variant="secondary" onClick={() => setHotelModal('list')}>
              <Icon name="plus" size={14} /> Manage Hotels
            </Button>
          )}
          <Button variant="secondary" onClick={() => exportToExcel('rfps-export', 'RFPs', formatRFPs(rfps))}>
            <Icon name="doc" size={14} /> Export Excel
          </Button>
          <Button variant="primary" onClick={() => setModal('new')}>
            <Icon name="plus" size={14} /> New RFP
          </Button>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.toolbar}>
          <div className={styles.searchWrap}>
            <Icon name="search" size={13} color="var(--text3)" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
            <input className={styles.searchInput} placeholder="Search RFPs..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className={styles.filterRow}>
            {filters.map(f => (
              <button key={f} className={`${styles.filterBtn} ${filter === f ? styles.active : ''}`} onClick={() => setFilter(f)}>
                {f === 'priority' ? <><Icon name="starFill" size={11} color="var(--yellow)" /> Priority</> : f === 'all' ? 'All' : f}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th></th>
                <th>Client / Group</th>
                <th>Hotel</th>
                <th>Check-in</th>
                <th>Check-out</th>
                <th>Price</th>
                <th>Status</th>
                <th>Added By</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className={styles.emptyCell}>Loading...</td></tr>
              ) : rfps.length === 0 ? (
                <tr><td colSpan={9} className={styles.emptyCell}>No RFPs found.</td></tr>
              ) : rfps.map(r => (
                <tr key={r._id} style={r.priority ? { background: 'rgba(241,196,15,0.03)' } : {}}>
                  <td>
                    <button className={`${styles.starBtn} ${r.priority ? styles.starActive : ''}`} onClick={() => togglePriority(r)} title={r.priority ? 'Remove priority' : 'Mark priority'}>
                      <Icon name={r.priority ? 'starFill' : 'star'} size={14} />
                    </button>
                  </td>
                  <td><strong>{r.client}</strong></td>
                  <td className={styles.dimText}>{r.hotel?.name || '—'}</td>
                  <td className={styles.dimText}>{r.checkin || '—'}</td>
                  <td className={styles.dimText}>{r.checkout || '—'}</td>
                  <td className={styles.dimText}>{r.price ? `$${Number(r.price).toLocaleString()}` : '—'}</td>
                  <td><Badge label={r.status} /></td>
                  <td className={styles.mutedText}>{r.addedBy?.name || '—'}</td>
                  <td className={styles.actions}>
                    <Button variant="secondary" size="sm" onClick={() => setModal(r)}>
                      <Icon name="pen" size={11} /> Edit
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => handleDelete(r._id)}>
                      <Icon name="trash" size={11} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <Modal title={modal === 'new' ? 'New RFP' : 'Edit RFP'} onClose={() => setModal(null)}>
          <RFPForm initial={modal === 'new' ? {} : modal} hotels={hotels} onSave={handleSave} onCancel={() => setModal(null)} />
        </Modal>
      )}

      {hotelModal && (
        <Modal title={hotelModal === 'new' ? 'Add Hotel' : hotelModal === 'list' ? 'Manage Hotels' : 'Edit Hotel'} onClose={() => setHotelModal(null)}>
          {hotelModal === 'list' ? (
            <div>
              <div style={{ marginBottom: '16px' }}>
                <Button variant="primary" onClick={() => setHotelModal('new')}>
                  <Icon name="plus" size={14} /> Add Hotel
                </Button>
              </div>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Hotel Name</th>
                    <th>City</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {hotels.length === 0 ? (
                    <tr><td colSpan={3} className={styles.emptyCell}>No hotels added yet.</td></tr>
                  ) : hotels.map(h => (
                    <tr key={h._id}>
                      <td><strong>{h.name}</strong></td>
                      <td className={styles.dimText}>{h.city}</td>
                      <td className={styles.actions}>
                        <Button variant="secondary" size="sm" onClick={() => setHotelModal(h)}>
                          <Icon name="pen" size={11} /> Edit
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => handleHotelDelete(h._id)}>
                          <Icon name="trash" size={11} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <HotelForm initial={hotelModal === 'new' ? {} : hotelModal} onSave={handleHotelSave} onCancel={() => setHotelModal('list')} />
          )}
        </Modal>
      )}
    </div>
  )
}
