import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Icon } from './Icon'
import api from '../utils/api'
import styles from './GlobalSearch.module.css'

const MODES = [
  { cmd: 'calls', mode: 'calls', label: 'Calls', icon: 'phone', hint: 'Search calls by name, phone or notes', modules: ['calls', 'reputationCalls'] },
  { cmd: 'rfps', mode: 'rfps', label: 'RFPs', icon: 'doc', hint: 'Search RFPs by client or notes', modules: ['rfps', 'rfpConsideration'] },
  { cmd: 'leads', mode: 'leads', label: 'Inbound Leads', icon: 'funnel', hint: 'Search leads by contact, company, email or phone', modules: ['leads'] },
  { cmd: 'corporate', mode: 'corporate', label: 'Corporate Profiles', icon: 'building', hint: 'Search corporate profiles', modules: ['corporate'] },
  { cmd: 'scores', mode: 'scores', label: 'Hotel Scores', icon: 'star', hint: 'Search reputation scores by hotel name', modules: ['hotelScores'] },
  { cmd: 'groups', mode: 'groups', label: 'Groups', icon: 'users', hint: 'Search groups by name', modules: ['groups'] },
  { cmd: 'tasks', mode: 'tasks', label: 'Tasks', icon: 'check', hint: 'Search tasks by name', modules: ['tasks', 'reputationTasks', 'marketingTasks', 'operationsTasks', 'internalSalesTasks'] },
  { cmd: 'announcements', mode: 'announcements', label: 'Announcements', icon: 'megaphone', hint: 'Search announcements', modules: ['announcements'] },
  { cmd: 'users', mode: 'users', label: 'Users', icon: 'users', hint: 'Search team members', modules: ['employeeBehaviour', 'userManagement'] },
]

// Aliases → canonical command
const ALIASES = {
  call: 'calls', calls: 'calls',
  rfp: 'rfps', rfps: 'rfps',
  lead: 'leads', leads: 'leads',
  corp: 'corporate', corporate: 'corporate',
  score: 'scores', scores: 'scores',
  group: 'groups', groups: 'groups',
  task: 'tasks', tasks: 'tasks',
  announcement: 'announcements', announcements: 'announcements',
  user: 'users', users: 'users',
}

function parseInput(raw) {
  const trimmed = raw.trim()
  if (trimmed.startsWith('/')) {
    const m = trimmed.slice(1).match(/^(\S*)(?:\s+([\s\S]*))?$/)
    const cmdRaw = (m?.[1] || '').toLowerCase()
    const term = (m?.[2] || '').trim()
    return { isSlash: true, cmdRaw, mode: ALIASES[cmdRaw] || null, term }
  }
  return { isSlash: false, cmdRaw: '', mode: null, term: trimmed }
}

export function GlobalSearch() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef(null)

  const modes = useMemo(() => MODES.filter(m => user?.isMaster || m.modules.some(key => user?.permissions?.[key]?.read)), [user])
  const parsed = useMemo(() => parseInput(query), [query])

  // Open with Cmd/Ctrl+K, close with Escape
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(true)
      } else if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setActiveIndex(0)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  const modeMatch = parsed.mode ? modes.find(m => m.mode === parsed.mode) : null
  const showModePicker = parsed.isSlash && !modeMatch
  const modeSuggestions = showModePicker
    ? modes.filter(m => m.cmd.startsWith(parsed.cmdRaw))
    : []

  const searchable = modeMatch ? parsed.term.length > 0 : parsed.term.length >= 2

  useEffect(() => {
    if (!open || !searchable) {
      setResults([])
      return
    }
    setLoading(true)
    const term = modeMatch ? parsed.term : parsed.term
    const t = setTimeout(() => {
      api.get('/search', { params: { q: term, mode: modeMatch?.mode } })
        .then(({ data }) => { setResults(data.results || []); setActiveIndex(0) })
        .catch(() => setResults([]))
        .finally(() => setLoading(false))
    }, 200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, searchable, parsed.term, modeMatch?.mode])

  const goTo = (result) => {
    const term = modeMatch ? parsed.term : parsed.term
    navigate(`${result.path}?q=${encodeURIComponent(term)}`)
    setOpen(false)
  }

  const pickMode = (m) => {
    setQuery(`/${m.cmd} `)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e) => {
    if (showModePicker) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, modeSuggestions.length - 1)) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)) }
      else if (e.key === 'Enter' && modeSuggestions[activeIndex]) { e.preventDefault(); pickMode(modeSuggestions[activeIndex]) }
      return
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && results[activeIndex]) { e.preventDefault(); goTo(results[activeIndex]) }
  }

  return (
    <>
      <button className={styles.trigger} onClick={() => setOpen(true)}>
        <Icon name="search" size={14} color="var(--text3)" />
        <span>Search anything…</span>
        <span className={styles.kbd}>⌘K</span>
      </button>

      {open && (
        <div className={styles.overlay} onClick={() => setOpen(false)}>
          <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
            <div className={styles.inputRow}>
              <Icon name="search" size={15} color="var(--text3)" />
              <input
                ref={inputRef}
                className={styles.input}
                placeholder="Search anything, or try /calls, /scores hilton…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              {modeMatch && <span className={styles.modeTag}>{modeMatch.label}</span>}
            </div>

            <div className={styles.body}>
              {showModePicker ? (
                modeSuggestions.length === 0 ? (
                  <div className={styles.empty}>No matching search mode.</div>
                ) : (
                  <div className={styles.list}>
                    {modeSuggestions.map((m, i) => (
                      <button
                        key={m.cmd}
                        className={`${styles.item} ${i === activeIndex ? styles.active : ''}`}
                        onClick={() => pickMode(m)}
                        onMouseEnter={() => setActiveIndex(i)}
                      >
                        <div className={styles.itemIcon}><Icon name={m.icon} size={14} color="var(--accent)" /></div>
                        <div className={styles.itemText}>
                          <div className={styles.itemTitle}>/{m.cmd}</div>
                          <div className={styles.itemSub}>{m.hint}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )
              ) : !searchable ? (
                <div className={styles.empty}>
                  {modeMatch ? modeMatch.hint : 'Type at least 2 characters to search, or start with / to pick a mode.'}
                </div>
              ) : loading ? (
                <div className={styles.empty}>Searching…</div>
              ) : results.length === 0 ? (
                <div className={styles.empty}>No results.</div>
              ) : (
                <div className={styles.list}>
                  {results.map((r, i) => (
                    <button
                      key={`${r.type}-${r.id}`}
                      className={`${styles.item} ${i === activeIndex ? styles.active : ''}`}
                      onClick={() => goTo(r)}
                      onMouseEnter={() => setActiveIndex(i)}
                    >
                      <div className={styles.itemIcon}>
                        <Icon name={modes.find(m => m.mode === r.type)?.icon || 'search'} size={14} color="var(--accent)" />
                      </div>
                      <div className={styles.itemText}>
                        <div className={styles.itemTitle}>{r.title}</div>
                        <div className={styles.itemSub}>{r.subtitle}</div>
                      </div>
                      <div className={styles.itemType}>{modes.find(m => m.mode === r.type)?.label || r.type}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.footer}>
              <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
              <span><kbd>↵</kbd> open</span>
              <span><kbd>esc</kbd> close</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
