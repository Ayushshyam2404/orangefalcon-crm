import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Icon } from '../components/Icon'
import { Button } from '../components/Button'
import { Modal, ModalActions } from '../components/Modal'
import api from '../utils/api'
import styles from './DataPage.module.css'
import own from './Announcements.module.css'

const PRIORITY_META = {
  normal:    { label: 'Normal',    color: 'var(--text3)',   bg: 'var(--surface2)',    border: 'var(--border)' },
  important: { label: 'Important', color: '#3b82f6',        bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.25)' },
  urgent:    { label: 'Urgent',    color: 'var(--red)',     bg: 'var(--red-soft)',    border: 'rgba(231,76,60,0.25)' },
}

const EMPTY_FORM = { heading: '', noticeDate: '', body: '', priority: 'normal' }

function fmtNoticeDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7)  return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export default function Announcements() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState({})

  const fetchAll = async () => {
    try {
      const { data } = await api.get('/announcements')
      setAnnouncements(data)
    } catch {
      /* silent */
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  const openCreate = () => {
    setEditTarget(null)
    setForm({ ...EMPTY_FORM, noticeDate: todayISO() })
    setError('')
    setModalOpen(true)
  }

  const openEdit = (a) => {
    setEditTarget(a)
    setForm({
      heading: a.heading,
      noticeDate: a.noticeDate?.slice(0, 10) || todayISO(),
      body: a.body,
      priority: a.priority,
    })
    setError('')
    setModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.heading.trim() || !form.noticeDate || !form.body.trim()) {
      setError('All fields are required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      if (editTarget) {
        await api.put(`/announcements/${editTarget._id}`, form)
      } else {
        await api.post('/announcements', form)
      }
      await fetchAll()
      setModalOpen(false)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save announcement')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this announcement?')) return
    try {
      await api.delete(`/announcements/${id}`)
      setAnnouncements(prev => prev.filter(a => a._id !== id))
    } catch {
      alert('Failed to delete')
    }
  }

  const toggleExpand = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }))

  return (
    <div>
      {/* ── Page header ── */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Announcements</h1>
          <p className={styles.pageSubtitle}>Important notices &amp; updates for the team</p>
        </div>
        {isAdmin && (
          <Button onClick={openCreate}>
            <Icon name="plus" size={14} color="currentColor" />
            New Announcement
          </Button>
        )}
      </div>

      {/* ── Content ── */}
      {loading ? (
        <p className={styles.emptyCell}>Loading…</p>
      ) : announcements.length === 0 ? (
        <div className={`${styles.card} ${own.emptyWrap}`}>
          <div className={own.emptyIcon}>
            <Icon name="megaphone" size={26} color="var(--text3)" />
          </div>
          <p className={own.emptyText}>No announcements yet.</p>
          {isAdmin && (
            <Button variant="secondary" onClick={openCreate} style={{ marginTop: 8 }}>
              Post the first one
            </Button>
          )}
        </div>
      ) : (
        <div className={own.list}>
          {announcements.map((a) => {
            const meta = PRIORITY_META[a.priority] || PRIORITY_META.normal
            const isExpanded = !!expanded[a._id]
            const PREVIEW_LEN = 240
            const needsTruncate = a.body.length > PREVIEW_LEN

            return (
              <div
                key={a._id}
                className={own.card}
                style={{ borderLeftColor: meta.color }}
              >
                {/* card top row */}
                <div className={own.cardHeader}>
                  <div className={own.cardLeft}>
                    <div
                      className={own.priorityDot}
                      style={{ background: meta.bg, border: `1px solid ${meta.border}` }}
                    >
                      <Icon name="megaphone" size={14} color={meta.color} />
                    </div>
                    <div>
                      <h2 className={own.heading}>{a.heading}</h2>
                      <div className={own.meta}>
                        <span className={own.noticeDate}>
                          <Icon name="calendar" size={11} color="var(--text3)" />
                          {fmtNoticeDate(a.noticeDate)}
                        </span>
                        <span className={own.dot}>·</span>
                        <span className={own.postedBy}>Posted by {a.author?.name ?? 'Admin'}</span>
                        <span className={own.dot}>·</span>
                        <span className={own.ago}>{timeAgo(a.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                  <div className={own.cardRight}>
                    <span
                      className={own.priorityBadge}
                      style={{ color: meta.color, background: meta.bg, border: `1px solid ${meta.border}` }}
                    >
                      {meta.label}
                    </span>
                    {isAdmin && (
                      <>
                        <button className={own.iconBtn} onClick={() => openEdit(a)} title="Edit">
                          <Icon name="pen" size={14} color="var(--text3)" />
                        </button>
                        <button className={`${own.iconBtn} ${own.deleteBtn}`} onClick={() => handleDelete(a._id)} title="Delete">
                          <Icon name="trash" size={14} color="var(--text3)" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Notice body */}
                <div className={own.body}>
                  {isExpanded || !needsTruncate
                    ? a.body
                    : a.body.slice(0, PREVIEW_LEN) + '…'
                  }
                </div>
                {needsTruncate && (
                  <button className={own.readMore} onClick={() => toggleExpand(a._id)}>
                    {isExpanded ? 'Show less' : 'Read more'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Create / Edit Modal ── */}
      {modalOpen && (
        <Modal
          title={editTarget ? 'Edit Announcement' : 'New Announcement'}
          onClose={() => setModalOpen(false)}
        >
          <form onSubmit={handleSubmit}>
            {error && <div className={styles.formError}>{error}</div>}

            <div className={styles.formGroup}>
              <label>Notice Heading</label>
              <input
                type="text"
                placeholder="e.g. Office Closed on Monday"
                value={form.heading}
                onChange={e => setForm(f => ({ ...f, heading: e.target.value }))}
                maxLength={120}
                autoFocus
              />
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Date of Notice</label>
                <input
                  type="date"
                  value={form.noticeDate}
                  onChange={e => setForm(f => ({ ...f, noticeDate: e.target.value }))}
                />
              </div>
              <div className={styles.formGroup}>
                <label>Priority</label>
                <select
                  value={form.priority}
                  onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                >
                  <option value="normal">Normal</option>
                  <option value="important">Important</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>

            <div className={styles.formGroup}>
              <label>Announcement Text</label>
              <textarea
                rows={6}
                placeholder="Write the full announcement here…"
                value={form.body}
                onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
              />
            </div>

            <ModalActions>
              <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : editTarget ? 'Save Changes' : 'Post Announcement'}</Button>
            </ModalActions>
          </form>
        </Modal>
      )}
    </div>
  )
}
