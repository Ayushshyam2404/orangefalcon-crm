import { useState, useEffect } from 'react'
import api from '../utils/api'
import { Modal, ModalActions } from '../components/Modal'
import { Button } from '../components/Button'
import { Icon } from '../components/Icon'
import dataPageStyles from './DataPage.module.css'
import styles from './InboundLeads.module.css'
import { exportToExcel, formatLeads } from '../utils/exportToExcel'

const STATUS_OPTIONS = ['new', 'contacted', 'quoted', 'converted', 'lost']

const STATUS_META = {
  new:       { label: 'New',       color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.2)' },
  contacted: { label: 'Contacted', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.2)' },
  quoted:    { label: 'Quoted',    color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)',   border: 'rgba(139,92,246,0.2)' },
  converted: { label: 'Converted', color: '#10b981', bg: 'rgba(16,185,129,0.1)',   border: 'rgba(16,185,129,0.2)' },
  lost:      { label: 'Lost',      color: '#ef4444', bg: 'rgba(239,68,68,0.1)',    border: 'rgba(239,68,68,0.2)' },
}

const EMPTY_FORM = {
  contactName: '',
  company: '',
  email: '',
  phone: '',
  roomType: 'room',
  numRooms: '',
  checkIn: '',
  checkOut: '',
  rateOffered: '',
  status: 'new',
  source: '',
  notes: '',
}

function LeadForm({ initial = EMPTY_FORM, onSave, onCancel, isEdit }) {
  const [form, setForm] = useState({ ...EMPTY_FORM, ...initial })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Live estimated revenue
  const nights =
    form.checkIn && form.checkOut && new Date(form.checkOut) > new Date(form.checkIn)
      ? Math.ceil((new Date(form.checkOut) - new Date(form.checkIn)) / 86400000)
      : 0
  const revenue = nights && form.numRooms && form.rateOffered
    ? nights * Number(form.numRooms) * Number(form.rateOffered)
    : null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.contactName.trim()) return
    setSaving(true)
    try { await onSave(form) } finally { setSaving(false) }
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Contact info */}
      <div className={styles.formSection}>
        <div className={styles.formSectionLabel}>Contact Info</div>
        <div className={styles.formRow}>
          <div>
            <label>Full Name *</label>
            <input value={form.contactName} onChange={e => set('contactName', e.target.value)}
              placeholder="e.g. John Smith" required autoFocus />
          </div>
          <div>
            <label>Company / Event Name</label>
            <input value={form.company} onChange={e => set('company', e.target.value)}
              placeholder="e.g. Acme Corp" />
          </div>
        </div>
        <div className={styles.formRow}>
          <div>
            <label>Phone</label>
            <input value={form.phone} onChange={e => set('phone', e.target.value)}
              placeholder="+1 (555) 000-0000" type="tel" />
          </div>
          <div>
            <label>Email</label>
            <input value={form.email} onChange={e => set('email', e.target.value)}
              placeholder="john@example.com" type="email" />
          </div>
        </div>
      </div>

      {/* Room details */}
      <div className={styles.formSection}>
        <div className={styles.formSectionLabel}>Room Details</div>
        <div className={styles.formRow}>
          <div>
            <label>Room Type</label>
            <select value={form.roomType} onChange={e => set('roomType', e.target.value)}>
              <option value="room">Room(s) Only</option>
              <option value="banquet">Banquet Only</option>
              <option value="both">Rooms + Banquet</option>
            </select>
          </div>
          <div>
            <label>Number of Rooms</label>
            <input value={form.numRooms} onChange={e => set('numRooms', e.target.value)}
              placeholder="e.g. 15" type="number" min="1" />
          </div>
        </div>
        <div className={styles.formRow}>
          <div>
            <label>Check-In Date</label>
            <input value={form.checkIn} onChange={e => set('checkIn', e.target.value)} type="date" />
          </div>
          <div>
            <label>Check-Out Date</label>
            <input value={form.checkOut} onChange={e => set('checkOut', e.target.value)} type="date" />
          </div>
        </div>
        <div className={styles.formRow}>
          <div>
            <label>Rate Offered (per night)</label>
            <input value={form.rateOffered} onChange={e => set('rateOffered', e.target.value)}
              placeholder="e.g. 149" type="number" min="0" />
          </div>
          <div>
            <label>Lead Source</label>
            <input value={form.source} onChange={e => set('source', e.target.value)}
              placeholder="e.g. Walk-in, Phone, Website" />
          </div>
        </div>

        {revenue !== null && (
          <div className={styles.revenuePreview}>
            <span className={styles.revenueLabel}>Est. Revenue</span>
            <span className={styles.revenueValue}>
              ${revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className={styles.revenueBreakdown}>
              {nights} night{nights !== 1 ? 's' : ''} × {form.numRooms} room{Number(form.numRooms) !== 1 ? 's' : ''} × ${form.rateOffered}/night
            </span>
          </div>
        )}
      </div>

      {/* Status + Notes */}
      <div className={styles.formSection}>
        <div className={styles.formSectionLabel}>Status &amp; Notes</div>
        <div>
          <label>Lead Status</label>
          <select value={form.status} onChange={e => set('status', e.target.value)}>
            {STATUS_OPTIONS.map(s => (
              <option key={s} value={s}>{STATUS_META[s].label}</option>
            ))}
          </select>
        </div>
        <div style={{ marginTop: '14px' }}>
          <label>Notes</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
            placeholder="Any additional details…" rows={3} />
        </div>
      </div>

      <ModalActions>
        <Button variant="secondary" type="button" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" type="submit" disabled={saving}>
          {saving ? 'Saving…' : isEdit ? 'Update Lead' : 'Add Lead'}
        </Button>
      </ModalActions>
    </form>
  )
}

function StatusPill({ status }) {
  const m = STATUS_META[status] || STATUS_META.new
  return (
    <span style={{
      background: m.bg, color: m.color, border: `1px solid ${m.border}`,
      borderRadius: '5px', padding: '3px 9px', fontSize: '11px', fontWeight: 700,
      letterSpacing: '0.3px', whiteSpace: 'nowrap',
    }}>
      {m.label.toUpperCase()}
    </span>
  )
}

export default function InboundLeads() {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // null | 'new' | leadObject
  const [filterStatus, setFilterStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState(null)

  const loadLeads = async () => {
    try {
      const params = {}
      if (filterStatus !== 'all') params.status = filterStatus
      if (search.trim()) params.search = search.trim()
      const { data } = await api.get('/leads', { params })
      setLeads(data)
    } catch (err) {
      console.error('Failed to load leads', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadLeads() }, [filterStatus])

  const handleSearch = (e) => {
    if (e.key === 'Enter') loadLeads()
  }

  const handleSave = async (form) => {
    if (modal?._id) {
      await api.put(`/leads/${modal._id}`, form)
    } else {
      await api.post('/leads', form)
    }
    setModal(null)
    loadLeads()
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this lead?')) return
    await api.delete(`/leads/${id}`)
    loadLeads()
  }

  const handleStatusCycle = async (lead) => {
    const next = { new: 'contacted', contacted: 'quoted', quoted: 'converted', converted: 'new', lost: 'new' }
    await api.put(`/leads/${lead._id}`, { status: next[lead.status] })
    loadLeads()
  }

  // Summary counts
  const counts = STATUS_OPTIONS.reduce((acc, s) => {
    acc[s] = leads.filter(l => l.status === s).length
    return acc
  }, {})

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '28px', fontWeight: 700, letterSpacing: '-0.5px' }}>
            Inbound Leads
          </h1>
          <p style={{ margin: 0, color: 'var(--text2)', fontSize: '13px' }}>
            Track and follow up on inbound enquiries
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="secondary" onClick={() => exportToExcel('leads-export', 'Inbound Leads', formatLeads(leads))}>
            <Icon name="doc" size={14} /> Export Excel
          </Button>
          <Button variant="primary" onClick={() => setModal('new')}>
            <Icon name="plus" /> New Lead
          </Button>
        </div>
      </div>

      {/* Status summary strips */}
      <div className={styles.statusStrips}>
        {STATUS_OPTIONS.map(s => {
          const m = STATUS_META[s]
          return (
            <button
              key={s}
              className={`${styles.statusStrip} ${filterStatus === s ? styles.statusStripActive : ''}`}
              style={filterStatus === s ? { borderColor: m.color, background: m.bg } : {}}
              onClick={() => setFilterStatus(filterStatus === s ? 'all' : s)}
            >
              <span className={styles.stripCount} style={{ color: m.color }}>{counts[s]}</span>
              <span className={styles.stripLabel}>{m.label}</span>
            </button>
          )
        })}
      </div>

      {/* Search + filter bar */}
      <div className={styles.toolbar}>
        <div className={dataPageStyles.searchWrap}>
          <Icon name="search" size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
          <input
            type="text"
            className={dataPageStyles.searchInput}
            placeholder="Search by name… (Enter)"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={handleSearch}
          />
        </div>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className={dataPageStyles.searchInput}
          style={{ width: 'auto', flex: 0, minWidth: '140px' }}
        >
          <option value="all">All Statuses</option>
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{STATUS_META[s].label}</option>
          ))}
        </select>
      </div>

      {/* Leads list */}
      {loading ? (
        <div className={styles.empty}><p>Loading…</p></div>
      ) : leads.length === 0 ? (
        <div className={styles.empty}>
          <Icon name="funnel" size={32} color="var(--text3)" />
          <p>No leads yet. Add your first one!</p>
        </div>
      ) : (
        <div className={styles.leadsList}>
          {leads.map(lead => {
            const nights = lead.checkIn && lead.checkOut
              ? Math.ceil((new Date(lead.checkOut) - new Date(lead.checkIn)) / 86400000)
              : null
            const revenue = nights && lead.numRooms && lead.rateOffered
              ? nights * lead.numRooms * lead.rateOffered
              : null
            const isOpen = expandedId === lead._id

            return (
              <div key={lead._id} className={styles.leadCard}>
                <div className={styles.leadCardTop} onClick={() => setExpandedId(isOpen ? null : lead._id)}>
                  <div className={styles.leadLeft}>
                    <div className={styles.leadName}>{lead.contactName}</div>
                    {lead.company && <div className={styles.leadCompany}>{lead.company}</div>}
                  </div>

                  <div className={styles.leadMiddle}>
                    {lead.phone && (
                      <a className={styles.contactChip} href={`tel:${lead.phone}`} onClick={e => e.stopPropagation()}>
                        <Icon name="phone" size={12} /> {lead.phone}
                      </a>
                    )}
                    {lead.email && (
                      <a className={styles.contactChip} href={`mailto:${lead.email}`} onClick={e => e.stopPropagation()}>
                        <Icon name="doc" size={12} /> {lead.email}
                      </a>
                    )}
                  </div>

                  <div className={styles.leadRight}>
                    {revenue !== null && (
                      <span className={styles.revenueTag}>
                        ${revenue.toLocaleString('en-US', { minimumFractionDigits: 0 })}
                      </span>
                    )}
                    <button
                      className={styles.statusPillBtn}
                      onClick={e => { e.stopPropagation(); handleStatusCycle(lead) }}
                      title="Click to advance status"
                    >
                      <StatusPill status={lead.status} />
                    </button>
                    <div className={styles.cardActions} onClick={e => e.stopPropagation()}>
                      <button className={styles.iconBtn} onClick={() => setModal(lead)} title="Edit">
                        <Icon name="pen" size={13} />
                      </button>
                      <button className={`${styles.iconBtn} ${styles.iconBtnDanger}`} onClick={() => handleDelete(lead._id)} title="Delete">
                        <Icon name="trash" size={13} />
                      </button>
                    </div>
                  </div>
                </div>

                {isOpen && (
                  <div className={styles.leadCardDetails}>
                    <div className={styles.detailGrid}>
                      <div className={styles.detailItem}>
                        <span className={styles.detailLabel}>Room Type</span>
                        <span className={styles.detailValue}>
                          {{ room: 'Rooms Only', banquet: 'Banquet Only', both: 'Rooms + Banquet' }[lead.roomType] || '—'}
                        </span>
                      </div>
                      <div className={styles.detailItem}>
                        <span className={styles.detailLabel}>Rooms</span>
                        <span className={styles.detailValue}>{lead.numRooms || '—'}</span>
                      </div>
                      <div className={styles.detailItem}>
                        <span className={styles.detailLabel}>Check-In</span>
                        <span className={styles.detailValue}>
                          {lead.checkIn ? new Date(lead.checkIn).toLocaleDateString() : '—'}
                        </span>
                      </div>
                      <div className={styles.detailItem}>
                        <span className={styles.detailLabel}>Check-Out</span>
                        <span className={styles.detailValue}>
                          {lead.checkOut ? new Date(lead.checkOut).toLocaleDateString() : '—'}
                        </span>
                      </div>
                      <div className={styles.detailItem}>
                        <span className={styles.detailLabel}>Nights</span>
                        <span className={styles.detailValue}>{nights ?? '—'}</span>
                      </div>
                      <div className={styles.detailItem}>
                        <span className={styles.detailLabel}>Rate / Night</span>
                        <span className={styles.detailValue}>{lead.rateOffered ? `$${lead.rateOffered}` : '—'}</span>
                      </div>
                      <div className={styles.detailItem}>
                        <span className={styles.detailLabel}>Est. Revenue</span>
                        <span className={styles.detailValue} style={{ color: '#10b981', fontWeight: 700 }}>
                          {revenue !== null ? `$${revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                        </span>
                      </div>
                      <div className={styles.detailItem}>
                        <span className={styles.detailLabel}>Source</span>
                        <span className={styles.detailValue}>{lead.source || '—'}</span>
                      </div>
                      {lead.notes && (
                        <div className={styles.detailItem} style={{ gridColumn: '1 / -1' }}>
                          <span className={styles.detailLabel}>Notes</span>
                          <span className={styles.detailValue} style={{ whiteSpace: 'pre-wrap' }}>{lead.notes}</span>
                        </div>
                      )}
                      <div className={styles.detailItem}>
                        <span className={styles.detailLabel}>Added</span>
                        <span className={styles.detailValue}>{new Date(lead.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {modal !== null && (
        <Modal
          title={modal === 'new' ? 'New Inbound Lead' : 'Edit Lead'}
          onClose={() => setModal(null)}
        >
          <LeadForm
            initial={modal === 'new' ? EMPTY_FORM : {
              ...modal,
              checkIn: modal.checkIn ? modal.checkIn.slice(0, 10) : '',
              checkOut: modal.checkOut ? modal.checkOut.slice(0, 10) : '',
            }}
            isEdit={modal !== 'new'}
            onSave={handleSave}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  )
}
