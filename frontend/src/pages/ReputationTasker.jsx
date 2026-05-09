import { useEffect, useState, useRef } from 'react'
import { Icon } from '../components/Icon'
import { Button } from '../components/Button'
import { Modal, ModalActions } from '../components/Modal'
import { fetchTasks, createTask, updateTask, deleteTask, fetchRoutines, createRoutine, updateRoutine, deleteRoutine } from '../utils/taskApi'
import dataPageStyles from './DataPage.module.css'
import styles from './Tasker.module.css'
import { exportToExcel, formatTasks } from '../utils/exportToExcel'

const CATEGORY = 'reputation'

// ─── Helpers ───────────────────────────────────────────────────────────────────

function dateKey(d) {
  return `repDailyChecklist_${d.toISOString().slice(0, 10)}`
}
function loadChecklistForDate(d) {
  try { return JSON.parse(localStorage.getItem(dateKey(d))) || {} } catch { return {} }
}
function saveChecklistForDate(d, data) {
  localStorage.setItem(dateKey(d), JSON.stringify(data))
}
function fmtDate(d) {
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}
function isToday(d) {
  return d.toDateString() === new Date().toDateString()
}
function addDays(d, n) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r
}
function todayEOD() {
  const d = new Date(); d.setHours(23, 59, 0, 0); return d.toISOString()
}
function toLocalDT(dateStr) {
  if (!dateStr) return ''; return new Date(dateStr).toISOString().slice(0, 16)
}

// ─── Task Row ──────────────────────────────────────────────────────────────────

function TaskRow({ task, onEdit, onDelete, onStatusChange }) {
  const [expanded, setExpanded] = useState(false)
  const deadline = new Date(task.deadline)
  const isOverdue = deadline < new Date() && task.status !== 'completed'
  const isDone = task.status === 'completed'
  const sc = {
    pending: { bg: 'rgba(255,107,0,0.08)', color: '#ff6b00', border: 'rgba(255,107,0,0.2)' },
    'in-progress': { bg: 'rgba(59,130,246,0.08)', color: '#3b82f6', border: 'rgba(59,130,246,0.2)' },
    completed: { bg: 'rgba(16,185,129,0.08)', color: '#10b981', border: 'rgba(16,185,129,0.2)' },
  }[task.status]
  const nextStatus = { pending: 'in-progress', 'in-progress': 'completed', completed: 'pending' }

  return (
    <div className={`${styles.taskRow} ${isDone ? styles.taskRowDone : ''}`}>
      <div className={styles.taskRowMain} onClick={() => setExpanded(e => !e)}>
        <button
          className={styles.statusDotBtn}
          style={{ background: sc.bg, border: `2px solid ${sc.border}`, color: sc.color }}
          onClick={e => { e.stopPropagation(); onStatusChange(task._id, nextStatus[task.status]) }}
          title={`${task.status} — click to advance`}
        >
          {isDone && <Icon name="check" size={11} />}
        </button>
        <span className={styles.taskRowName}>{task.taskName}</span>
        <div className={styles.taskRowMeta}>
          <span className={styles.statusPill} style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
            {task.status === 'in-progress' ? 'IN PROGRESS' : task.status.toUpperCase()}
          </span>
          <span className={`${styles.deadlineChip} ${isOverdue ? styles.deadlineOverdue : ''}`}>
            {deadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            {isOverdue && ' · OVERDUE'}
          </span>
        </div>
        <div className={styles.taskRowActions} onClick={e => e.stopPropagation()}>
          <button className={styles.iconBtn} onClick={() => onEdit(task)} title="Edit"><Icon name="pen" size={13} /></button>
          <button className={`${styles.iconBtn} ${styles.iconBtnDanger}`} onClick={() => onDelete(task._id)} title="Delete"><Icon name="trash" size={13} /></button>
        </div>
      </div>
      {expanded && (
        <div className={styles.taskRowExpand}>
          {task.notes
            ? <p style={{ margin: '0 0 6px', fontSize: '13px', color: 'var(--text2)', whiteSpace: 'pre-wrap' }}>{task.notes}</p>
            : <p style={{ margin: '0 0 6px', fontSize: '13px', color: 'var(--text3)', fontStyle: 'italic' }}>No notes.</p>
          }
          <span style={{ fontSize: '12px', color: 'var(--text3)' }}>
            Due {deadline.toLocaleDateString()} {deadline.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            &nbsp;·&nbsp; Added {new Date(task.createdAt).toLocaleDateString()}
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Quick Add ─────────────────────────────────────────────────────────────────

function QuickAddRow({ onAdd }) {
  const [value, setValue] = useState('')
  const [adding, setAdding] = useState(false)
  const submit = async () => {
    if (!value.trim() || adding) return
    setAdding(true)
    try { await onAdd(value.trim()); setValue('') } finally { setAdding(false) }
  }
  return (
    <div className={styles.quickAddRow}>
      <span className={styles.quickAddPlus}>+</span>
      <input
        className={styles.quickAddInput}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submit()}
        placeholder="Add a task... press Enter to save"
        disabled={adding}
      />
      {value.trim() && (
        <button className={styles.quickAddSubmit} onClick={submit} disabled={adding}>{adding ? '…' : '↵'}</button>
      )}
    </div>
  )
}

// ─── Task Edit Modal ───────────────────────────────────────────────────────────

function TaskEditModal({ task, onSave, onClose }) {
  const [form, setForm] = useState({
    taskName: task.taskName || '',
    deadline: toLocalDT(task.deadline) || toLocalDT(todayEOD()),
    status: task.status || 'pending',
    notes: task.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.taskName.trim()) return
    setSaving(true)
    try { await onSave(form) } finally { setSaving(false) }
  }
  return (
    <Modal title="Edit Task" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div><label>Task Name</label><input value={form.taskName} onChange={e => set('taskName', e.target.value)} required autoFocus /></div>
        <div><label>Deadline</label><input type="datetime-local" value={form.deadline} onChange={e => set('deadline', e.target.value)} required /></div>
        <div><label>Status</label>
          <select value={form.status} onChange={e => set('status', e.target.value)}>
            <option value="pending">Pending</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <div><label>Notes</label><textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={4} placeholder="Notes…" /></div>
        <ModalActions>
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</Button>
        </ModalActions>
      </form>
    </Modal>
  )
}

// ─── Daily Routine Panel ───────────────────────────────────────────────────────

function DailyRoutinePanel({ routineItems, setRoutineItems }) {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [checklist, setChecklist] = useState(() => loadChecklistForDate(new Date()))
  const [expandedNote, setExpandedNote] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editNote, setEditNote] = useState('')
  const [newName, setNewName] = useState('')
  const [newNote, setNewNote] = useState('')
  const [adding, setAdding] = useState(false)
  const newNameRef = useRef(null)
  const readonly = !isToday(selectedDate)

  useEffect(() => {
    setChecklist(loadChecklistForDate(selectedDate))
    setExpandedNote(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate.toDateString()])

  const toggle = (id) => {
    if (readonly) return
    const next = { ...checklist, [id]: { ...(checklist[id] || {}), checked: !(checklist[id]?.checked) } }
    setChecklist(next); saveChecklistForDate(selectedDate, next)
  }
  const setNoteVal = (id, note) => {
    if (readonly) return
    const next = { ...checklist, [id]: { ...(checklist[id] || {}), note } }
    setChecklist(next); saveChecklistForDate(selectedDate, next)
  }

  const prevDay = () => setSelectedDate(d => addDays(d, -1))
  const nextDay = () => { const n = addDays(selectedDate, 1); if (n <= new Date()) setSelectedDate(n) }
  const canGoNext = addDays(selectedDate, 1) <= new Date()
  const done = routineItems.filter(i => checklist[i._id]?.checked).length

  const startEdit = (item) => { setEditingId(item._id); setEditName(item.taskName); setEditNote(item.defaultNote || '') }
  const saveEdit = async (id) => {
    if (!editName.trim()) return
    const { data } = await updateRoutine(id, { taskName: editName.trim(), defaultNote: editNote.trim() })
    setRoutineItems(l => l.map(i => i._id === id ? data : i))
    setEditingId(null)
  }
  const handleDeleteRoutine = async (id) => {
    if (!confirm('Remove from daily routine?')) return
    await deleteRoutine(id)
    setRoutineItems(l => l.filter(i => i._id !== id))
  }
  const handleAdd = async () => {
    if (!newName.trim() || adding) return
    setAdding(true)
    try {
      const { data } = await createRoutine({ taskName: newName.trim(), defaultNote: newNote.trim(), category: CATEGORY })
      setRoutineItems(l => [...l, data])
      setNewName(''); setNewNote('')
      newNameRef.current?.focus()
    } finally { setAdding(false) }
  }

  return (
    <div>
      <div className={styles.dateNav}>
        <button className={styles.dateNavBtn} onClick={prevDay}>‹</button>
        <div className={styles.dateNavCenter}>
          <span className={styles.dateNavLabel}>{fmtDate(selectedDate)}</span>
          {isToday(selectedDate)
            ? <span className={styles.todayPill}>TODAY</span>
            : <button className={styles.goTodayBtn} onClick={() => setSelectedDate(new Date())}>← Go to today</button>
          }
        </div>
        <button className={styles.dateNavBtn} onClick={nextDay} disabled={!canGoNext} style={{ opacity: canGoNext ? 1 : 0.25 }}>›</button>
      </div>

      {routineItems.length > 0 && (
        <div className={styles.routineProgressRow}>
          <span className={styles.routineProgressText}>{done} / {routineItems.length} completed</span>
          <div className={styles.progressBar} style={{ flex: 1, maxWidth: '180px' }}>
            <div className={styles.progressFill} style={{ width: `${(done / routineItems.length) * 100}%` }} />
          </div>
          {!readonly && done > 0 && (
            <button className={styles.resetBtn} onClick={() => {
              if (!confirm("Reset today's checklist?")) return
              const c = {}; setChecklist(c); saveChecklistForDate(selectedDate, c)
            }}>Reset</button>
          )}
        </div>
      )}

      {readonly && (
        <div className={styles.readonlyBanner}>
          📅 {selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' })} — past day (read only)
        </div>
      )}

      {routineItems.length === 0 ? (
        <div className={styles.emptyState} style={{ paddingTop: '32px' }}>
          <div className={styles.emptyIcon}><Icon name="doc" size={28} color="var(--text3)" /></div>
          <p>No routine items yet — add one below</p>
        </div>
      ) : (
        <div className={styles.routineChecklist}>
          {routineItems.map(item => {
            const state = checklist[item._id] || {}
            const isOpen = expandedNote === item._id

            if (editingId === item._id) return (
              <div key={item._id} className={styles.checklistItem}>
                <input value={editName} onChange={e => setEditName(e.target.value)} style={{ width: '100%', marginBottom: '6px' }}
                  placeholder="Task name" onKeyDown={e => e.key === 'Enter' && saveEdit(item._id)} autoFocus />
                <input value={editNote} onChange={e => setEditNote(e.target.value)} style={{ width: '100%' }}
                  placeholder="Default note (optional)" onKeyDown={e => e.key === 'Enter' && saveEdit(item._id)} />
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <Button variant="primary" size="sm" onClick={() => saveEdit(item._id)}>Save</Button>
                  <Button variant="secondary" size="sm" onClick={() => setEditingId(null)}>Cancel</Button>
                </div>
              </div>
            )

            return (
              <div key={item._id} className={`${styles.checklistItem} ${state.checked ? styles.checklistDone : ''}`}>
                <div className={styles.checklistRow}>
                  <button
                    className={`${styles.checkbox} ${state.checked ? styles.checkboxChecked : ''} ${readonly ? styles.checkboxReadonly : ''}`}
                    onClick={() => toggle(item._id)}
                  >
                    {state.checked && <Icon name="check" size={12} />}
                  </button>
                  <div style={{ flex: 1 }}>
                    <div className={styles.checklistName}>{item.taskName}</div>
                    {item.defaultNote && !isOpen && !state.note && (
                      <div className={styles.checklistDefaultNote}>{item.defaultNote}</div>
                    )}
                    {state.note && !isOpen && (
                      <div className={styles.checklistUserNote}>{state.note}</div>
                    )}
                  </div>
                  {!readonly && (
                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                      <button className={`${styles.noteToggle} ${isOpen ? styles.noteToggleActive : ''}`}
                        onClick={() => setExpandedNote(isOpen ? null : item._id)} title="Note">
                        <Icon name="doc" size={13} />
                      </button>
                      <button className={styles.noteToggle} onClick={() => startEdit(item)} title="Edit template">
                        <Icon name="pen" size={13} />
                      </button>
                      <button className={styles.noteToggle} onClick={() => handleDeleteRoutine(item._id)} title="Remove"
                        style={{ color: '#ef4444' }}>
                        <Icon name="trash" size={13} />
                      </button>
                    </div>
                  )}
                </div>
                {isOpen && !readonly && (
                  <div className={styles.noteExpanded}>
                    {item.defaultNote && <div className={styles.defaultNoteHint}>Default: {item.defaultNote}</div>}
                    <textarea className={styles.noteTextarea} rows={3} placeholder="Add a note for today…"
                      value={state.note || ''} onChange={e => setNoteVal(item._id, e.target.value)} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {!readonly && (
        <div className={styles.quickAddRow} style={{ marginTop: '12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', borderTop: '1px solid var(--border)' }}>
          <span className={styles.quickAddPlus}>+</span>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <input ref={newNameRef} className={styles.quickAddInput} value={newName}
              onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="Add to reputation daily routine… press Enter" disabled={adding} />
            {newName && (
              <input className={styles.quickAddInput} value={newNote}
                onChange={e => setNewNote(e.target.value)}
                onKeyDown={e => e.key === 'Escape' ? setNewName('') : e.key === 'Enter' && handleAdd()}
                placeholder="Default note (optional)" disabled={adding} />
            )}
          </div>
          {newName.trim() && (
            <button className={styles.quickAddSubmit} onClick={handleAdd} disabled={adding}>{adding ? '…' : '↵'}</button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────────

export default function ReputationTasker() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [editModal, setEditModal] = useState(null)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('tasks')
  const [routineItems, setRoutineItems] = useState([])

  const loadTasks = async () => {
    try {
      const params = { category: CATEGORY }
      if (filter !== 'all') params.status = filter
      const { data } = await fetchTasks(params)
      setTasks(data)
    } catch (err) {
      console.error('Failed to fetch reputation tasks:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadTasks() }, [filter])
  useEffect(() => {
    fetchRoutines(CATEGORY).then(({ data }) => setRoutineItems(data)).catch(() => {})
  }, [])

  const handleQuickAdd = async (name) => {
    await createTask({ taskName: name, deadline: todayEOD(), status: 'pending', notes: '', category: CATEGORY })
    loadTasks()
  }
  const handleSaveEdit = async (form) => {
    await updateTask(editModal._id, form)
    setEditModal(null); loadTasks()
  }
  const handleDelete = async (id) => {
    if (!confirm('Delete this task?')) return
    await deleteTask(id); loadTasks()
  }
  const handleStatusChange = async (id, status) => {
    await updateTask(id, { status }); loadTasks()
  }

  const filteredTasks = (search
    ? tasks.filter(t => t.taskName.toLowerCase().includes(search.toLowerCase()))
    : tasks
  ).sort((a, b) => {
    const o = { pending: 0, 'in-progress': 1, completed: 2 }
    return o[a.status] - o[b.status] || new Date(a.deadline) - new Date(b.deadline)
  })

  const openCount = tasks.filter(t => t.status !== 'completed').length

  return (
    <div style={{ padding: '24px' }}>
      <div className={styles.pageHeader}>
        <div>
          <h1 style={{ margin: '0 0 4px 0', fontSize: '28px', fontWeight: '700', letterSpacing: '-0.5px' }}>Reputation Tasks</h1>
          <p style={{ margin: 0, color: 'var(--text2)', fontSize: '13px' }}>Manage reputation-specific tasks and daily checklists</p>
        </div>
        <Button variant="secondary" onClick={() => exportToExcel('rep-tasks-export', 'Reputation Tasks', formatTasks(tasks))}>
          <Icon name="doc" size={14} /> Export Excel
        </Button>
      </div>

      <div className={styles.tabRow}>
        <button className={`${styles.tabBtn} ${tab === 'tasks' ? styles.tabActive : ''}`} onClick={() => setTab('tasks')}>
          Tasks {openCount > 0 && <span className={styles.tabBadge}>{openCount}</span>}
        </button>
        <button className={`${styles.tabBtn} ${tab === 'routine' ? styles.tabActive : ''}`} onClick={() => setTab('routine')}>
          Daily Routine
          {routineItems.length > 0 && <span className={styles.tabBadge}>{routineItems.length}</span>}
        </button>
      </div>

      {tab === 'tasks' ? (
        <>
          <div className={styles.toolbar}>
            <div className={dataPageStyles.searchWrap}>
              <Icon name="search" size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
              <input type="text" className={dataPageStyles.searchInput} placeholder="Search tasks…"
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select value={filter} onChange={e => setFilter(e.target.value)}
              className={dataPageStyles.searchInput} style={{ width: 'auto', flex: 0, minWidth: '140px' }}>
              <option value="all">All Tasks</option>
              <option value="pending">Pending</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div className={styles.taskList}>
            {loading ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text3)' }}>Loading…</div>
            ) : filteredTasks.length === 0 ? (
              <div className={styles.emptyState} style={{ padding: '32px 0' }}>
                <div className={styles.emptyIcon}><Icon name="doc" size={28} color="var(--text3)" /></div>
                <p>{search ? 'No tasks found' : 'No reputation tasks yet — add one below'}</p>
              </div>
            ) : filteredTasks.map(task => (
              <TaskRow key={task._id} task={task} onEdit={setEditModal} onDelete={handleDelete} onStatusChange={handleStatusChange} />
            ))}
            <QuickAddRow onAdd={handleQuickAdd} />
          </div>
        </>
      ) : (
        <DailyRoutinePanel routineItems={routineItems} setRoutineItems={setRoutineItems} />
      )}

      {editModal && (
        <TaskEditModal task={editModal} onSave={handleSaveEdit} onClose={() => setEditModal(null)} />
      )}
    </div>
  )
}
