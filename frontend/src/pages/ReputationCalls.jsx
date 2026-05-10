import { useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import { Badge } from '../components/Badge'
import { Button } from '../components/Button'
import { Modal, ModalActions } from '../components/Modal'
import api from '../utils/api'
import styles from './DataPage.module.css'
import { exportToExcel, formatCalls } from '../utils/exportToExcel'

const OUTCOMES = ['Connected', 'Voicemail', 'No Answer', 'Interested', 'Not Interested']
const CATEGORY = 'reputation'

function CallForm({ initial = {}, onSave, onCancel }) {
  const [form, setForm] = useState({ name: '', phone: '', outcome: 'Connected', notes: '', ...initial })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    try { await onSave(form) } finally { setSaving(false) }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className={styles.formGroup}>
        <label>Prospect Name</label>
        <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. John Smith — GM" required />
      </div>
      <div className={styles.formGroup}>
        <label>Phone Number</label>
        <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="(555) 000-0000" />
      </div>
      <div className={styles.formGroup}>
        <label>Outcome</label>
        <select value={form.outcome} onChange={e => set('outcome', e.target.value)}>
          {OUTCOMES.map(o => <option key={o}>{o}</option>)}
        </select>
      </div>
      <div className={styles.formGroup}>
        <label>Notes</label>
        <textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="What was discussed..." rows={3} />
      </div>
      <ModalActions>
        <Button variant="secondary" type="button" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" type="submit" disabled={saving}>{saving ? 'Saving...' : initial._id ? 'Update Call' : 'Log Call'}</Button>
      </ModalActions>
    </form>
  )
}

export default function ReputationCalls() {
  const [calls, setCalls] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)

  const fetchCalls = async () => {
    const params = { category: CATEGORY }
    if (filter !== 'all') params.outcome = filter
    if (search) params.search = search
    const { data } = await api.get('/calls', { params })
    setCalls(data)
    setLoading(false)
  }

  useEffect(() => { fetchCalls() }, [filter, search])

  const handleSave = async (form) => {
    if (modal?._id) {
      await api.put(`/calls/${modal._id}`, { ...form, category: CATEGORY })
    } else {
      await api.post('/calls', { ...form, category: CATEGORY })
    }
    setModal(null)
    fetchCalls()
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this call log?')) return
    await api.delete(`/calls/${id}`)
    fetchCalls()
  }

  const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

  const filters = ['all', ...OUTCOMES]

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Reputation Call Log</h1>
          <p className={styles.pageSubtitle}>Track all reputation-related prospect calls</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="secondary" onClick={() => exportToExcel('rep-calls-export', 'Reputation Call Log', formatCalls(calls))}>
            <Icon name="doc" size={14} /> Export Excel
          </Button>
          <Button variant="primary" onClick={() => setModal('new')}>
            <Icon name="plus" size={14} /> Log Call
          </Button>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.toolbar}>
          <div className={styles.searchWrap}>
            <Icon name="search" size={13} color="var(--text3)" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
            <input className={styles.searchInput} placeholder="Search calls..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className={styles.filterRow}>
            {filters.map(f => (
              <button key={f} className={`${styles.filterBtn} ${filter === f ? styles.active : ''}`} onClick={() => setFilter(f)}>
                {f === 'all' ? 'All' : f}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Prospect</th>
                <th>Phone</th>
                <th>Outcome</th>
                <th>Notes</th>
                <th>Date</th>
                <th>Logged By</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className={styles.emptyCell}>Loading...</td></tr>
              ) : calls.length === 0 ? (
                <tr><td colSpan={7} className={styles.emptyCell}>No reputation calls logged yet.</td></tr>
              ) : calls.map(c => (
                <tr key={c._id}>
                  <td><strong>{c.name}</strong></td>
                  <td className={styles.dimText}>{c.phone || '—'}</td>
                  <td><Badge label={c.outcome} /></td>
                  <td className={styles.noteCell}>{c.notes || '—'}</td>
                  <td className={styles.mutedText}>{fmtDate(c.createdAt)}</td>
                  <td className={styles.mutedText}>{c.loggedBy?.name || '—'}</td>
                  <td className={styles.actions}>
                    <Button variant="secondary" size="sm" onClick={() => setModal(c)}>
                      <Icon name="pen" size={11} /> Edit
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => handleDelete(c._id)}>
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
        <Modal title={modal === 'new' ? 'Log Reputation Call' : 'Edit Call'} onClose={() => setModal(null)}>
          <CallForm initial={modal === 'new' ? {} : modal} onSave={handleSave} onCancel={() => setModal(null)} />
        </Modal>
      )}
    </div>
  )
}
