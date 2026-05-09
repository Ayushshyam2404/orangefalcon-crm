import { useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import { Badge } from '../components/Badge'
import { Button } from '../components/Button'
import { Modal, ModalActions } from '../components/Modal'
import api from '../utils/api'
import styles from './DataPage.module.css'
import { exportToExcel, formatRFPs } from '../utils/exportToExcel'

function RFPConsiderationForm({ initial = {}, onSave, onCancel, allRfps = [] }) {
  const [form, setForm] = useState({
    rfpId: initial._id || '',
    emailsSent: initial.emailsSent || '',
    followUpsDone: initial.followUpsDone || '',
    tradeGiven: initial.tradeGiven || '',
    rank: initial.rank || '',
    numRooms: initial.numRooms || null,
    callDone: initial.callDone || false,
  })
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.rfpId) {
      alert('Please select an RFP')
      return
    }
    setSaving(true)
    try {
      await onSave({
        ...form,
        _id: form.rfpId,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {!initial._id && (
        <div className={styles.formGroup}>
          <label>Select RFP</label>
          <select value={form.rfpId} onChange={e => set('rfpId', e.target.value)} required>
            <option value="">Choose an RFP...</option>
            {allRfps.map(r => (
              <option key={r._id} value={r._id}>
                {r.client} - {r.hotel?.name} ({r.checkin})
              </option>
            ))}
          </select>
        </div>
      )}
      <div className={styles.formGroup}>
        <label>Emails Sent</label>
        <input value={form.emailsSent} onChange={e => set('emailsSent', e.target.value)} placeholder="e.g. 3 emails, sent on 04/06" />
      </div>
      <div className={styles.formGroup}>
        <label>Follow-ups Done</label>
        <input value={form.followUpsDone} onChange={e => set('followUpsDone', e.target.value)} placeholder="e.g. 2 follow-ups completed" />
      </div>
      <div className={styles.formGroup}>
        <label>Trade / Rate Given</label>
        <input value={form.tradeGiven} onChange={e => set('tradeGiven', e.target.value)} placeholder="e.g. 10% discount, Group rate" />
      </div>
      <div className={styles.formGroup}>
        <label>RFP Rank (State)</label>
        <input value={form.rank} onChange={e => set('rank', e.target.value)} placeholder="e.g. #1, High Priority" />
      </div>
      <div className={styles.formGroup}>
        <label>Number of Rooms Needed</label>
        <input type="number" value={form.numRooms || ''} onChange={e => set('numRooms', e.target.value ? Number(e.target.value) : null)} placeholder="e.g. 50" />
      </div>
      <div className={styles.formGroup}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '0' }}>
          <input type="checkbox" checked={form.callDone} onChange={e => set('callDone', e.target.checked)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
          <span>Call Done</span>
        </label>
      </div>
      <ModalActions>
        <Button variant="secondary" type="button" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" type="submit" disabled={saving}>{saving ? 'Saving...' : initial._id ? 'Update' : 'Log RFP'}</Button>
      </ModalActions>
    </form>
  )
}

export default function RFPsInConsideration() {
  const [rfps, setRfps] = useState([])
  const [availableRfps, setAvailableRfps] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)

  const fetchRfps = async () => {
    try {
      const params = {}
      if (search) params.search = search
      // Fetch only RFPs in consideration
      params.consideration = 'true'
      const { data } = await api.get('/rfps', { params })
      setRfps(data)
      setLoading(false)
    } catch (err) {
      console.error('Failed to fetch RFPs:', err)
      setLoading(false)
    }
  }

  const fetchAvailableRfps = async () => {
    try {
      // Fetch RFPs NOT in consideration to show in dropdown
      const { data } = await api.get('/rfps', { params: { consideration: 'false' } })
      setAvailableRfps(data)
    } catch (err) {
      console.error('Failed to fetch available RFPs:', err)
    }
  }

  useEffect(() => { 
    fetchRfps()
    fetchAvailableRfps()
  }, [search])

  const handleSave = async (form) => {
    try {
      await api.put(`/rfps/${form._id}`, {
        ...form,
        inConsideration: true,
      })
      setModal(null)
      fetchRfps()
      fetchAvailableRfps()
    } catch (err) {
      console.error('Failed to update RFP:', err)
    }
  }

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>RFPs in Consideration</h1>
          <p className={styles.pageSubtitle}>Track email, follow-ups, calls, and rates for active proposals</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="secondary" onClick={() => exportToExcel('rfps-consideration-export', 'RFPs in Consideration', formatRFPs(rfps))}>
            <Icon name="doc" size={14} /> Export Excel
          </Button>
          <Button variant="primary" onClick={() => setModal('new')}>
            <Icon name="plus" size={14} /> Log RFP in Consideration
          </Button>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.toolbar}>
          <div className={styles.searchWrap}>
            <Icon name="search" size={13} color="var(--text3)" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
            <input className={styles.searchInput} placeholder="Search RFPs..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Client / Group</th>
                <th>Hotel</th>
                <th>Check-in</th>
                <th>Rooms</th>
                <th>Email</th>
                <th>Follow-ups</th>
                <th>Rate/Trade</th>
                <th>Rank</th>
                <th>Call</th>
                <th>Owner</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} className={styles.emptyCell}>Loading...</td></tr>
              ) : rfps.length === 0 ? (
                <tr><td colSpan={11} className={styles.emptyCell}>No RFPs found.</td></tr>
              ) : rfps.map(r => (
                <tr key={r._id}>
                  <td><strong>{r.client}</strong></td>
                  <td className={styles.dimText}>{r.hotel?.name || '—'}</td>
                  <td className={styles.dimText}>{r.checkin || '—'}</td>
                  <td className={styles.dimText}>{r.numRooms || '—'}</td>
                  <td className={styles.dimText}>{r.emailsSent || '—'}</td>
                  <td className={styles.dimText}>{r.followUpsDone || '—'}</td>
                  <td className={styles.dimText}>{r.tradeGiven || '—'}</td>
                  <td className={styles.dimText}>{r.rank || '—'}</td>
                  <td style={{ textAlign: 'center' }}>
                    {r.callDone ? (
                      <span title="Call done" style={{ color: '#10b981', fontWeight: '700' }}>✓</span>
                    ) : (
                      <span title="Call not done" style={{ color: 'var(--text3)', fontSize: '12px' }}>—</span>
                    )}
                  </td>
                  <td className={styles.mutedText}>{r.addedBy?.name || '—'}</td>
                  <td className={styles.actions}>
                    <Button variant="secondary" size="sm" onClick={() => setModal(r)}>
                      <Icon name="pen" size={11} /> Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <Modal 
          title={modal === 'new' ? 'Log RFP in Consideration' : `Update Consideration - ${modal.client}`} 
          onClose={() => setModal(null)}
        >
          <RFPConsiderationForm 
            initial={modal === 'new' ? {} : modal} 
            allRfps={modal === 'new' ? availableRfps : []}
            onSave={handleSave} 
            onCancel={() => setModal(null)} 
          />
        </Modal>
      )}
    </div>
  )
}
