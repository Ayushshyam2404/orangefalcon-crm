import { useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import { Badge } from '../components/Badge'
import { Button } from '../components/Button'
import { Modal, ModalActions } from '../components/Modal'
import { useAuth } from '../context/AuthContext'
import api from '../utils/api'
import styles from './DataPage.module.css'

function UserForm({ initial = {}, onSave, onCancel }) {
  const [form, setForm] = useState({ name: '', username: '', password: '', role: 'staff', title: '', ...initial })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try { await onSave(form) } finally { setSaving(false) }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className={styles.formGroup}>
        <label>Full Name</label>
        <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Sarah Johnson" required />
      </div>
      <div className={styles.formGroup}>
        <label>Username</label>
        <input value={form.username} onChange={e => set('username', e.target.value)} placeholder="e.g. sarah" required />
      </div>
      <div className={styles.formGroup}>
        <label>Job Title / Position</label>
        <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Director of Sales" />
      </div>
      <div className={styles.formGroup}>
        <label>Password</label>
        <input type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder={initial._id ? 'Leave blank to keep current' : 'Min 6 characters'} minLength={6} required={!initial._id} />
      </div>
      <div className={styles.formGroup}>
        <label>Role</label>
        <select value={form.role} onChange={e => set('role', e.target.value)}>
          <option value="staff">Staff</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <ModalActions>
        <Button variant="secondary" type="button" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" type="submit" disabled={saving}>{saving ? 'Saving...' : initial._id ? 'Update User' : 'Add User'}</Button>
      </ModalActions>
    </form>
  )
}

function formatSecs(s) {
  const h = Math.floor(s / 3600).toString().padStart(2, '0')
  const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0')
  const sec = (s % 60).toString().padStart(2, '0')
  return `${h}:${m}:${sec}`
}

export default function Users() {
  const { user: me } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // null | 'new' | user object
  const [error, setError] = useState('')

  const fetchUsers = async () => {
    const { data } = await api.get('/users')
    setUsers(data)
    setLoading(false)
  }

  useEffect(() => { fetchUsers() }, [])

  const handleSave = async (form) => {
    try {
      setError('')
      if (modal?._id) {
        await api.put(`/users/${modal._id}`, form)
      } else {
        await api.post('/users', form)
      }
      setModal(null)
      fetchUsers()
    } catch (err) {
      setError(err.response?.data?.message || 'Error saving user')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Remove this user?')) return
    await api.delete(`/users/${id}`)
    fetchUsers()
  }

  const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never'

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Users</h1>
          <p className={styles.pageSubtitle}>Manage team access</p>
        </div>
        <Button variant="primary" onClick={() => setModal('new')}>
          <Icon name="useradd" size={14} /> Add User
        </Button>
      </div>

      <div className={styles.card}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th><th>Username</th><th>Title</th><th>Role</th><th>Status</th><th>Session Today</th><th>Last Login</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className={styles.emptyCell}>Loading...</td></tr>
              ) : users.map(u => (
                <tr key={u._id}>
                  <td>
                    <strong>{u.name}</strong>
                    {u._id === me?._id && <span className={styles.youTag}>you</span>}
                  </td>
                  <td className={styles.dimText}>@{u.username}</td>
                  <td className={styles.dimText}>{u.title || '—'}</td>
                  <td><Badge label={u.role} /></td>
                  <td>
                    <span className={u.online ? styles.dotOnline : styles.dotOffline} />
                    {u.online ? 'Online' : 'Offline'}
                  </td>
                  <td className={styles.dimText} style={{ fontVariantNumeric: 'tabular-nums' }}>{formatSecs(u.sessionSeconds || 0)}</td>
                  <td className={styles.mutedText}>{fmtDate(u.lastLogin)}</td>
                  <td className={styles.actions}>
                    <Button variant="secondary" size="sm" onClick={() => { setError(''); setModal(u); }}>
                      <Icon name="pen" size={11} /> Edit
                    </Button>
                    {u._id !== me?._id ? (
                      <Button variant="danger" size="sm" onClick={() => handleDelete(u._id)}>
                        <Icon name="trash" size={11} /> Remove
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <Modal title={modal === 'new' ? 'Add New User' : `Edit — ${modal.name}`} onClose={() => setModal(null)}>
          {error && <div className={styles.formError}>{error}</div>}
          <UserForm initial={modal === 'new' ? {} : modal} onSave={handleSave} onCancel={() => setModal(null)} />
        </Modal>
      )}
    </div>
  )
}
