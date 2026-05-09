import { useState, useEffect } from 'react'
import api from '../utils/api'
import { Modal, ModalActions } from '../components/Modal'
import { Button } from '../components/Button'
import { Icon } from '../components/Icon'
import dataPageStyles from './DataPage.module.css'
import styles from './CorporateProfiles.module.css'
import { exportToExcel, formatCorporateProfiles } from '../utils/exportToExcel'

const EMPTY_FORM = {
  name: '',
  company: '',
  phone: '',
  email: '',
  ccNumber: '',
  ccExpiry: '',
  notes: '',
}

// Mask all but last 4 digits of CC
function maskCC(num) {
  if (!num) return '—'
  const clean = num.replace(/\s/g, '')
  if (clean.length < 4) return '****'
  return '•••• •••• •••• ' + clean.slice(-4)
}

// Format CC number with spaces as user types
function formatCCInput(val) {
  const digits = val.replace(/\D/g, '').slice(0, 16)
  return digits.replace(/(.{4})/g, '$1 ').trim()
}

// Format CC expiry MM/YY
function formatExpiry(val) {
  const digits = val.replace(/\D/g, '').slice(0, 4)
  if (digits.length >= 3) return digits.slice(0, 2) + '/' + digits.slice(2)
  return digits
}

function ProfileForm({ initial = EMPTY_FORM, onSave, onCancel, isEdit }) {
  const [form, setForm] = useState({ ...EMPTY_FORM, ...initial })
  const [saving, setSaving] = useState(false)
  const [showCC, setShowCC] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.company.trim()) return
    setSaving(true)
    // Strip spaces from CC before saving
    const payload = { ...form, ccNumber: form.ccNumber.replace(/\s/g, '') }
    try { await onSave(payload) } finally { setSaving(false) }
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Contact info */}
      <div className={styles.formSection}>
        <div className={styles.formSectionLabel}>Contact Info</div>
        <div className={styles.formRow}>
          <div>
            <label>Full Name *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)}
              placeholder="e.g. John Smith" required autoFocus />
          </div>
          <div>
            <label>Company *</label>
            <input value={form.company} onChange={e => set('company', e.target.value)}
              placeholder="e.g. Acme Corp" required />
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

      {/* CC Details */}
      <div className={styles.formSection}>
        <div className={styles.formSectionLabel}>
          <span>Card on File</span>
          <span className={styles.sensitiveTag}>Sensitive</span>
        </div>
        <div className={styles.ccWarning}>
          <Icon name="bell" size={12} /> Handle with care — only store with guest consent.
        </div>
        <div className={styles.formRow}>
          <div>
            <label>Card Number</label>
            <div className={styles.ccInputWrap}>
              <input
                value={form.ccNumber}
                onChange={e => set('ccNumber', formatCCInput(e.target.value))}
                placeholder={showCC ? '1234 5678 9012 3456' : '•••• •••• •••• ••••'}
                type={showCC ? 'text' : 'password'}
                autoComplete="off"
                inputMode="numeric"
                maxLength={19}
              />
              <button type="button" className={styles.toggleCC} onClick={() => setShowCC(v => !v)}>
                {showCC ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          <div>
            <label>Expiry (MM/YY)</label>
            <input
              value={form.ccExpiry}
              onChange={e => set('ccExpiry', formatExpiry(e.target.value))}
              placeholder="MM/YY"
              maxLength={5}
              inputMode="numeric"
            />
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className={styles.formSection}>
        <div className={styles.formSectionLabel}>Notes</div>
        <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
          placeholder="Preferences, special requests, loyalty tier…" rows={3} />
      </div>

      <ModalActions>
        <Button variant="secondary" type="button" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" type="submit" disabled={saving}>
          {saving ? 'Saving…' : isEdit ? 'Update Profile' : 'Add Profile'}
        </Button>
      </ModalActions>
    </form>
  )
}

export default function CorporateProfiles() {
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // null | 'new' | profileObject
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [revealCC, setRevealCC] = useState({}) // id → bool

  const loadProfiles = async (q = '') => {
    try {
      const params = q.trim() ? { search: q.trim() } : {}
      const { data } = await api.get('/corporate', { params })
      setProfiles(data)
    } catch (err) {
      console.error('Failed to load corporate profiles', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadProfiles() }, [])

  const handleSearch = (e) => {
    if (e.key === 'Enter') loadProfiles(search)
  }

  const handleSave = async (form) => {
    if (modal?._id) {
      await api.put(`/corporate/${modal._id}`, form)
    } else {
      await api.post('/corporate', form)
    }
    setModal(null)
    loadProfiles(search)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this corporate profile?')) return
    await api.delete(`/corporate/${id}`)
    loadProfiles(search)
  }

  // Group by first letter of company
  const grouped = profiles.reduce((acc, p) => {
    const letter = p.company[0].toUpperCase()
    if (!acc[letter]) acc[letter] = []
    acc[letter].push(p)
    return acc
  }, {})
  const letters = Object.keys(grouped).sort()

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '28px', fontWeight: 700, letterSpacing: '-0.5px' }}>
            Corporate Profiles
          </h1>
          <p style={{ margin: 0, color: 'var(--text2)', fontSize: '13px' }}>
            Corporate contacts &amp; cards on file — {profiles.length} profile{profiles.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="secondary" onClick={() => exportToExcel('corporate-profiles-export', 'Corporate Profiles', formatCorporateProfiles(profiles))}>
            <Icon name="doc" size={14} /> Export Excel
          </Button>
          <Button variant="primary" onClick={() => setModal('new')}>
            <Icon name="plus" /> New Profile
          </Button>
        </div>
      </div>

      {/* Search bar */}
      <div className={styles.toolbar}>
        <div className={dataPageStyles.searchWrap} style={{ flex: 1 }}>
          <Icon name="search" size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
          <input
            type="text"
            className={dataPageStyles.searchInput}
            placeholder="Search by name, company, email, phone… (Enter)"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={handleSearch}
          />
        </div>
        {search && (
          <Button variant="secondary" onClick={() => { setSearch(''); loadProfiles('') }}>Clear</Button>
        )}
      </div>

      {/* Profiles list */}
      {loading ? (
        <div className={styles.empty}><p>Loading…</p></div>
      ) : profiles.length === 0 ? (
        <div className={styles.empty}>
          <Icon name="building" size={32} color="var(--text3)" />
          <p>No corporate profiles yet. Add your first one!</p>
        </div>
      ) : (
        <div className={styles.profilesList}>
          {letters.map(letter => (
            <div key={letter}>
              <div className={styles.groupLetter}>{letter}</div>
              {grouped[letter].map(profile => {
                const isOpen = expandedId === profile._id
                const ccRevealed = revealCC[profile._id]

                return (
                  <div key={profile._id} className={styles.profileCard}>
                    <div
                      className={styles.profileCardTop}
                      onClick={() => setExpandedId(isOpen ? null : profile._id)}
                    >
                      {/* Avatar */}
                      <div className={styles.avatar}>
                        {profile.name[0].toUpperCase()}
                      </div>

                      {/* Name + Company */}
                      <div className={styles.profileInfo}>
                        <div className={styles.profileName}>{profile.name}</div>
                        <div className={styles.profileCompany}>{profile.company}</div>
                      </div>

                      {/* Contact chips */}
                      <div className={styles.contactChips}>
                        {profile.phone && (
                          <a className={styles.chip} href={`tel:${profile.phone}`} onClick={e => e.stopPropagation()}>
                            <Icon name="phone" size={11} /> {profile.phone}
                          </a>
                        )}
                        {profile.email && (
                          <a className={styles.chip} href={`mailto:${profile.email}`} onClick={e => e.stopPropagation()}>
                            <Icon name="doc" size={11} /> {profile.email}
                          </a>
                        )}
                      </div>

                      {/* CC indicator */}
                      <div className={styles.ccIndicator}>
                        {profile.ccNumber ? (
                          <span className={styles.ccBadge}>
                            <Icon name="clipboard" size={11} /> Card on file
                          </span>
                        ) : (
                          <span className={styles.ccBadgeEmpty}>No card</span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className={styles.cardActions} onClick={e => e.stopPropagation()}>
                        <button className={styles.iconBtn} onClick={() => setModal(profile)} title="Edit">
                          <Icon name="pen" size={13} />
                        </button>
                        <button className={`${styles.iconBtn} ${styles.iconBtnDanger}`} onClick={() => handleDelete(profile._id)} title="Delete">
                          <Icon name="trash" size={13} />
                        </button>
                      </div>
                    </div>

                    {isOpen && (
                      <div className={styles.profileDetails}>
                        {profile.notes && (
                          <div className={styles.notesRow}>
                            <span className={styles.detailLabel}>Notes</span>
                            <span className={styles.detailValue} style={{ whiteSpace: 'pre-wrap' }}>{profile.notes}</span>
                          </div>
                        )}

                        {profile.ccNumber && (
                          <div className={styles.ccSection}>
                            <div className={styles.ccSectionHeader}>
                              <span className={styles.detailLabel}>Card on File</span>
                              <button
                                className={styles.revealBtn}
                                onClick={() => setRevealCC(r => ({ ...r, [profile._id]: !ccRevealed }))}
                              >
                                {ccRevealed ? 'Hide' : 'Reveal'}
                              </button>
                            </div>
                            <div className={styles.ccCard}>
                              <div className={styles.ccNumber}>
                                {ccRevealed
                                  ? profile.ccNumber.replace(/(.{4})/g, '$1 ').trim()
                                  : maskCC(profile.ccNumber)
                                }
                              </div>
                              <div className={styles.ccExpiry}>
                                {profile.ccExpiry ? `Exp ${profile.ccExpiry}` : ''}
                              </div>
                            </div>
                          </div>
                        )}

                        {!profile.notes && !profile.ccNumber && (
                          <p style={{ margin: 0, color: 'var(--text3)', fontSize: '12px' }}>No additional details.</p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {modal !== null && (
        <Modal
          title={modal === 'new' ? 'New Corporate Profile' : 'Edit Profile'}
          onClose={() => setModal(null)}
        >
          <ProfileForm
            initial={modal === 'new' ? EMPTY_FORM : {
              name: modal.name,
              company: modal.company,
              phone: modal.phone,
              email: modal.email,
              ccNumber: modal.ccNumber
                ? modal.ccNumber.replace(/(.{4})/g, '$1 ').trim()
                : '',
              ccExpiry: modal.ccExpiry,
              notes: modal.notes,
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
