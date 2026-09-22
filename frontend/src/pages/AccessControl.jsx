import { useEffect, useMemo, useState } from 'react'
import api from '../utils/api'
import { Button } from '../components/Button'
import { Icon } from '../components/Icon'
import { Modal, ModalActions } from '../components/Modal'
import styles from './AccessControl.module.css'

const departmentLabels = {
  sales: 'Sales', reputation: 'Reputation', marketing: 'Marketing', operations: 'Operations',
  'internal-sales': 'Internal Sales', management: 'Management',
}

const emptyMaster = { name: '', username: '', password: '', title: 'Master Administrator', mustChangePassword: true }

function levelFor(permission) {
  if (permission?.write) return 'manage'
  if (permission?.read) return 'view'
  return 'none'
}

function permissionsForLevel(modules, level) {
  return Object.fromEntries(modules.map(key => [key, {
    read: level !== 'none', write: level === 'manage',
  }]))
}

export default function AccessControl() {
  const [users, setUsers] = useState([])
  const [groups, setGroups] = useState([])
  const [modules, setModules] = useState([])
  const [departments, setDepartments] = useState([])
  const [defaults, setDefaults] = useState({})
  const [selectedId, setSelectedId] = useState('')
  const [draft, setDraft] = useState(null)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [masterModal, setMasterModal] = useState(false)
  const [masterForm, setMasterForm] = useState(emptyMaster)
  const [masterError, setMasterError] = useState('')
  const [creatingMaster, setCreatingMaster] = useState(false)
  const [credentials, setCredentials] = useState(null)

  const selected = useMemo(() => users.find(user => user._id === selectedId), [users, selectedId])
  const visibleUsers = useMemo(() => {
    const query = search.trim().toLowerCase()
    return users.filter(user => !query || [user.name, user.username, user.department, user.title].some(value => String(value || '').toLowerCase().includes(query)))
  }, [users, search])

  useEffect(() => {
    Promise.all([api.get('/users'), api.get('/users/permission-options')])
      .then(([userResponse, optionResponse]) => {
        setUsers(userResponse.data)
        setGroups(optionResponse.data.groups || [])
        setModules(optionResponse.data.modules || [])
        setDepartments(optionResponse.data.departments || [])
        setDefaults(optionResponse.data.defaults || {})
        const first = userResponse.data.find(user => !user.isMaster) || userResponse.data[0]
        if (first) setSelectedId(first._id)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selected || !modules.length) return
    setSaved(false)
    setDraft({
      department: selected.department || 'sales',
      permissions: Object.fromEntries(modules.map(key => [key, {
        read: selected.isMaster || selected.permissions?.[key]?.read === true,
        write: selected.isMaster || selected.permissions?.[key]?.write === true,
      }])),
    })
  }, [selected, modules])

  const setLevel = (key, level) => setDraft(current => ({
    ...current,
    permissions: {
      ...current.permissions,
      [key]: { read: level !== 'none', write: level === 'manage' },
    },
  }))

  const applyLevelToAll = level => setDraft(current => ({ ...current, permissions: permissionsForLevel(modules, level) }))
  const applyDepartmentDefaults = () => setDraft(current => ({
    ...current,
    permissions: Object.fromEntries(modules.map(key => [key, { ...(defaults[current.department]?.[key] || { read: false, write: false }) }])),
  }))

  const save = async () => {
    if (!draft || selected?.isMaster) return
    setSaving(true); setSaved(false)
    try {
      const { data } = await api.put(`/users/${selectedId}`, draft)
      setUsers(list => list.map(user => user._id === data._id ? { ...user, ...data } : user))
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally { setSaving(false) }
  }

  const createMaster = async event => {
    event.preventDefault(); setMasterError(''); setCreatingMaster(true)
    try {
      const { data } = await api.post('/users/masters', masterForm)
      setUsers(list => [...list, data])
      setSelectedId(data._id)
      setMasterModal(false)
      setCredentials({ username: data.username, password: data.tempPassword })
      setMasterForm(emptyMaster)
    } catch (error) {
      setMasterError(error.response?.data?.message || 'Could not create master user')
    } finally { setCreatingMaster(false) }
  }

  const granted = draft ? modules.filter(key => draft.permissions[key]?.read).length : 0
  const managed = draft ? modules.filter(key => draft.permissions[key]?.write).length : 0

  if (loading) return <div className={styles.loading}>Loading access control…</div>

  return <div className={styles.page}>
    <div className={styles.pageHeader}>
      <div><h1>Access Control</h1><p>Manage departments and access levels without dealing with individual checkboxes.</p></div>
      <Button variant="primary" onClick={() => setMasterModal(true)}><Icon name="useradd" size={14} /> Create Master User</Button>
    </div>

    <div className={styles.layout}>
      <aside className={styles.userPanel}>
        <div className={styles.panelTitle}>People <span>{users.length}</span></div>
        <div className={styles.searchWrap}>
          <Icon name="search" size={14} />
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Find a user…" />
        </div>
        <div className={styles.userList}>
          {visibleUsers.map(user => <button key={user._id} className={`${styles.userRow} ${selectedId === user._id ? styles.userRowActive : ''}`} onClick={() => setSelectedId(user._id)}>
            <span className={styles.avatar}>{user.avatar ? <img src={user.avatar} alt="" /> : user.name?.[0]?.toUpperCase()}</span>
            <span className={styles.userText}><strong>{user.name}</strong><small>@{user.username} · {departmentLabels[user.department] || user.department}</small></span>
            {user.isMaster && <span className={styles.masterBadge}>Master</span>}
          </button>)}
          {!visibleUsers.length && <div className={styles.noUsers}>No users found.</div>}
        </div>
      </aside>

      <main className={styles.permissionPanel}>
        {!selected || !draft ? <div className={styles.empty}>Select a user to manage access.</div> : <>
          <div className={styles.selectedHeader}>
            <div className={styles.selectedIdentity}>
              <span className={styles.largeAvatar}>{selected.avatar ? <img src={selected.avatar} alt="" /> : selected.name?.[0]?.toUpperCase()}</span>
              <div><div className={styles.selectedName}>{selected.name}</div><div className={styles.selectedMeta}>@{selected.username} · {selected.title || selected.role}</div></div>
            </div>
            <div className={styles.summary}><span><strong>{granted}</strong> visible</span><span><strong>{managed}</strong> manageable</span></div>
          </div>

          {selected.isMaster ? <div className={styles.masterNotice}>
            <Icon name="info" size={18} /><div><strong>Master account</strong><p>Master users always have complete CRM access. Their permissions cannot be reduced.</p></div>
          </div> : <>
            <div className={styles.controls}>
              <div className={styles.departmentControl}><label>Department</label><select value={draft.department} onChange={event => setDraft(current => ({ ...current, department: event.target.value }))}>{departments.map(department => <option value={department} key={department}>{departmentLabels[department]}</option>)}</select></div>
              <div className={styles.presets}><span>Quick presets</span><button onClick={applyDepartmentDefaults}>Department default</button><button onClick={() => applyLevelToAll('view')}>View everything</button><button onClick={() => applyLevelToAll('manage')}>Manage everything</button><button className={styles.clearPreset} onClick={() => applyLevelToAll('none')}>Remove all</button></div>
            </div>

            <div className={styles.legend}><span><i className={styles.noneDot} /> No access</span><span><i className={styles.viewDot} /> View only</span><span><i className={styles.manageDot} /> View &amp; manage</span></div>

            <div className={styles.groups}>
              {groups.map(group => <section className={styles.groupCard} key={group.key}>
                <div className={styles.groupHeader}><div><h2>{group.label}</h2><p>{group.description}</p></div><span>{group.items.filter(item => draft.permissions[item.key]?.read).length}/{group.items.length}</span></div>
                <div className={styles.permissionList}>{group.items.map(item => {
                  const level = levelFor(draft.permissions[item.key])
                  return <div className={styles.permissionRow} key={item.key}>
                    <div className={styles.permissionText}><strong>{item.label}</strong><small>{item.description}</small></div>
                    <div className={styles.segmented} aria-label={`${item.label} access`}>
                      {[['none', 'None'], ['view', 'View'], ['manage', 'Manage']].map(([value, label]) => <button key={value} className={level === value ? styles[`level_${value}`] : ''} onClick={() => setLevel(item.key, value)}>{label}</button>)}
                    </div>
                  </div>
                })}</div>
              </section>)}
            </div>

            <div className={styles.saveBar}><div>{saved ? <span className={styles.saved}>✓ Access saved</span> : <span>Changes apply the next time this user loads the CRM.</span>}</div><Button variant="primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</Button></div>
          </>}
        </>}
      </main>
    </div>

    {masterModal && <Modal title="Create Master User" onClose={() => setMasterModal(false)}>
      <form onSubmit={createMaster} className={styles.masterForm}>
        <p>Master users receive unrestricted access to the entire CRM and can create other masters.</p>
        <div className={styles.formGrid}><div><label>Full Name</label><input value={masterForm.name} onChange={e => setMasterForm(f => ({ ...f, name: e.target.value }))} required /></div><div><label>Username</label><input value={masterForm.username} onChange={e => setMasterForm(f => ({ ...f, username: e.target.value }))} required /></div></div>
        <div className={styles.formGrid}><div><label>Title</label><input value={masterForm.title} onChange={e => setMasterForm(f => ({ ...f, title: e.target.value }))} /></div><div><label>Temporary Password</label><input type="password" minLength={6} value={masterForm.password} onChange={e => setMasterForm(f => ({ ...f, password: e.target.value }))} required /></div></div>
        <label className={styles.checkLabel}><input type="checkbox" checked={masterForm.mustChangePassword} onChange={e => setMasterForm(f => ({ ...f, mustChangePassword: e.target.checked }))} /> Require a password change on first login</label>
        {masterError && <div className={styles.error}>{masterError}</div>}
        <ModalActions><Button variant="secondary" type="button" onClick={() => setMasterModal(false)}>Cancel</Button><Button variant="primary" type="submit" disabled={creatingMaster}>{creatingMaster ? 'Creating…' : 'Create Master'}</Button></ModalActions>
      </form>
    </Modal>}

    {credentials && <Modal title="Master User Created" onClose={() => setCredentials(null)}>
      <div className={styles.credentials}><p>Share these credentials securely. The password is only shown once.</p><div><span>Username</span><strong>{credentials.username}</strong></div><div><span>Password</span><strong>{credentials.password}</strong></div><button onClick={() => navigator.clipboard.writeText(`Username: ${credentials.username}\nPassword: ${credentials.password}`)}>Copy credentials</button></div>
    </Modal>}
  </div>
}
