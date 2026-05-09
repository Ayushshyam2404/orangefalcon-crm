import { useEffect, useState, useCallback, useRef } from 'react'
import api from '../utils/api'
import { Icon } from '../components/Icon'
import { Badge } from '../components/Badge'
import styles from './DataPage.module.css'
import own from './UserManagement.module.css'

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

function fmtHours(secs) {
  if (!secs || secs <= 0) return '0h 0m'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  return `${h}h ${String(m).padStart(2, '0')}m`
}

function fmtTimeLong(secs) {
  if (!secs || secs <= 0) return '00:00:00'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

function fmtTime12(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
}

// Calculate live worked seconds from clock-in state
function calcLive(today) {
  if (today.hasSavedLog) {
    return { secs: today.savedWorkedSeconds || 0, breakSecs: today.savedBreakSeconds || 0, live: false }
  }
  if (!today.clockedIn || !today.clockInTime) {
    return { secs: 0, breakSecs: 0, live: false }
  }
  const elapsed = Math.floor((Date.now() - new Date(today.clockInTime).getTime()) / 1000)
  let breakSecs = today.breakSeconds || 0
  if (today.onBreak && today.breakStart) {
    breakSecs += Math.floor((Date.now() - new Date(today.breakStart).getTime()) / 1000)
  }
  return { secs: Math.max(0, elapsed - breakSecs), breakSecs, live: true }
}

function Avatar({ user }) {
  if (user.avatar) {
    return <img src={user.avatar} alt="" className={own.avatar} />
  }
  return (
    <div className={own.avatarInitial}>
      {user.name?.[0]?.toUpperCase() || '?'}
    </div>
  )
}

// ─── Helper: weeks in a given month ────────────────────────────────────────────
function weeksInMonth(year, month) {
  const days = new Date(year, month, 0).getDate()
  return days / 7
}

// ─── Tier helper ───────────────────────────────────────────────────────────────
function getTier(score) {
  if (score >= 90) return { label: 'Excellent',          color: 'var(--green)',          bg: 'var(--green-soft)' }
  if (score >= 70) return { label: 'Good',               color: 'var(--accent)',         bg: 'var(--accent-soft)' }
  if (score >= 50) return { label: 'Needs Improvement',  color: 'var(--yellow)',         bg: 'var(--yellow-soft)' }
  return                  { label: 'Underperforming',    color: 'var(--red, #e53e3e)',   bg: 'rgba(229,62,62,0.1)' }
}

// ─── CSS Bar chart section ──────────────────────────────────────────────────────
function BarChart({ title, subtitle, bars, unit }) {
  const max = Math.max(...bars.map(b => b.value), 1)
  return (
    <div className={own.chartSection}>
      <div className={own.chartTitle}>{title}</div>
      {subtitle && <div className={own.chartSubtitle}>{subtitle}</div>}
      <div className={own.chartBars}>
        {bars.map(b => {
          const pct = Math.min(100, (b.value / max) * 100)
          return (
            <div key={b.name} className={own.barRow}>
              <div className={own.barName} title={b.name}>{b.name}</div>
              <div className={own.barTrack}>
                <div
                  className={own.barFill}
                  style={{
                    width: `${pct}%`,
                    background: b.color || 'linear-gradient(90deg, var(--accent), #ff8822)',
                  }}
                />
              </div>
              <div className={own.barValue}>{b.display ?? `${b.value}${unit || ''}`}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Report Modal ───────────────────────────────────────────────────────────────
function ReportModal({ onClose, year, month, monthLabel }) {
  const [data, setData]           = useState([])
  const [benchmarks, setBenchmarks] = useState(null)
  const [loading, setLoading]     = useState(true)
  const printRef = useRef(null)

  useEffect(() => {
    Promise.all([
      api.get('/attendance/admin/summary', { params: { year, month } }),
      api.get('/company-settings'),
    ]).then(([attRes, csRes]) => {
      setData(attRes.data)
      setBenchmarks(csRes.data)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [year, month])

  const handlePrint = () => {
    window.print()
  }

  if (loading) {
    return (
      <div className={own.reportOverlay}>
        <div className={own.reportModal}>
          <p style={{ padding: '40px', textAlign: 'center', color: 'var(--text3)' }}>Generating report…</p>
        </div>
      </div>
    )
  }

  const expHours = benchmarks?.expectedHoursPerDay ?? 8
  const expDays  = benchmarks?.expectedDaysPerWeek ?? 5
  const weeks    = weeksInMonth(year, month)
  const expWorkingDays = expDays * weeks

  // Compute per-employee scores
  const employees = data.map(({ user, daysWorked, workedSeconds, breakSeconds, leaves }) => {
    const avgHoursRaw  = daysWorked > 0 ? workedSeconds / daysWorked / 3600 : 0
    const attendanceRate  = expWorkingDays > 0 ? Math.min(100, (daysWorked / expWorkingDays) * 100) : 0
    const efficiencyRate  = expHours > 0 && daysWorked > 0 ? Math.min(100, (avgHoursRaw / expHours) * 100) : 0
    const overallScore    = Math.round((attendanceRate * 0.5) + (efficiencyRate * 0.5))
    const tier            = getTier(overallScore)
    return {
      user, daysWorked, workedSeconds, breakSeconds, leaves,
      avgHoursRaw, attendanceRate, efficiencyRate, overallScore, tier,
    }
  }).sort((a, b) => b.overallScore - a.overallScore)

  const staffCount   = employees.length
  const topPerformer = employees[0]
  const avgAttendance = staffCount > 0
    ? Math.round(employees.reduce((s, e) => s + e.attendanceRate, 0) / staffCount)
    : 0
  const tiers = { Excellent: 0, Good: 0, 'Needs Improvement': 0, Underperforming: 0 }
  employees.forEach(e => { tiers[e.tier.label] = (tiers[e.tier.label] || 0) + 1 })

  const hoursMax = Math.max(...employees.map(e => e.workedSeconds), 1)

  return (
    <div className={own.reportOverlay} onClick={(ev) => { if (ev.target === ev.currentTarget) onClose() }}>
      <div className={own.reportModal} ref={printRef}>

        {/* ── Modal header ── */}
        <div className={own.reportHeader}>
          <div>
            <div className={own.reportTitle}>Employee Behaviour & Attendance Report</div>
            <div className={own.reportSub}>{monthLabel} {year} · Generated {new Date().toLocaleDateString()}</div>
          </div>
          <div className={own.reportHeaderActions}>
            <button className={own.reportPrintBtn} onClick={handlePrint} title="Print / Save as PDF">
              <Icon name="doc" size={14} /> Print / PDF
            </button>
            <button className={own.reportCloseBtn} onClick={onClose} aria-label="Close report">✕</button>
          </div>
        </div>

        <div className={own.reportBody}>
          {/* ── KPI cards ── */}
          <div className={own.reportKpis}>
            <div className={own.kpiCard}>
              <div className={own.kpiVal}>{staffCount}</div>
              <div className={own.kpiLbl}>Total Staff</div>
            </div>
            <div className={own.kpiCard}>
              <div className={own.kpiVal} style={{ color: 'var(--accent)' }}>{avgAttendance}%</div>
              <div className={own.kpiLbl}>Avg Attendance Rate</div>
            </div>
            <div className={own.kpiCard}>
              <div className={own.kpiVal} style={{ color: 'var(--green)' }}>{tiers.Excellent}</div>
              <div className={own.kpiLbl}>Excellent Performers</div>
            </div>
            <div className={own.kpiCard}>
              <div className={own.kpiVal} style={{ color: 'var(--yellow)' }}>{tiers['Needs Improvement'] + (tiers.Underperforming || 0)}</div>
              <div className={own.kpiLbl}>Need Attention</div>
            </div>
            {topPerformer && (
              <div className={own.kpiCard} style={{ gridColumn: 'span 1' }}>
                <div className={own.kpiVal} style={{ fontSize: 14, color: 'var(--green)' }}>
                  {topPerformer.user.name.split(' ')[0]}
                </div>
                <div className={own.kpiLbl}>Top Performer</div>
              </div>
            )}
          </div>

          {/* ── Bar charts ── */}
          <div className={own.chartsGrid}>
            <BarChart
              title="Hours Worked"
              subtitle={`Expected: ${expHours}h/day`}
              unit=""
              bars={[...employees].sort((a,b) => b.workedSeconds - a.workedSeconds).map(e => ({
                name: e.user.name,
                value: Math.round(e.workedSeconds / 3600 * 10) / 10,
                display: `${Math.round(e.workedSeconds / 3600 * 10) / 10}h`,
                color: e.workedSeconds / hoursMax >= 0.8
                  ? 'linear-gradient(90deg, var(--green), #22c55e)'
                  : e.workedSeconds / hoursMax >= 0.5
                    ? 'linear-gradient(90deg, var(--accent), #ff8822)'
                    : 'linear-gradient(90deg, var(--yellow, #eab308), #f59e0b)',
              }))}
            />
            <BarChart
              title="Days Present"
              subtitle={`Expected ~${Math.round(expWorkingDays)} working days`}
              unit=" days"
              bars={[...employees].sort((a,b) => b.daysWorked - a.daysWorked).map(e => ({
                name: e.user.name,
                value: e.daysWorked,
                color: e.daysWorked / expWorkingDays >= 0.9
                  ? 'linear-gradient(90deg, var(--green), #22c55e)'
                  : e.daysWorked / expWorkingDays >= 0.6
                    ? 'linear-gradient(90deg, var(--accent), #ff8822)'
                    : 'linear-gradient(90deg, var(--yellow, #eab308), #f59e0b)',
              }))}
            />
            <BarChart
              title="Overall Performance Score"
              subtitle="Blend of attendance (50%) + efficiency (50%)"
              unit="%"
              bars={employees.map(e => ({
                name: e.user.name,
                value: e.overallScore,
                color: e.tier.label === 'Excellent'
                  ? 'linear-gradient(90deg, var(--green), #22c55e)'
                  : e.tier.label === 'Good'
                    ? 'linear-gradient(90deg, var(--accent), #ff8822)'
                    : e.tier.label === 'Needs Improvement'
                      ? 'linear-gradient(90deg, var(--yellow, #eab308), #f59e0b)'
                      : 'linear-gradient(90deg, #e53e3e, #fc8181)',
              }))}
            />
          </div>

          {/* ── Detailed table ── */}
          <div className={own.reportTableWrap}>
            <div className={own.chartTitle} style={{ marginBottom: 12 }}>Detailed Breakdown</div>
            <table className={own.reportTable}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Employee</th>
                  <th>Days Present</th>
                  <th>Total Hours</th>
                  <th>Avg Hrs/Day</th>
                  <th>Attendance</th>
                  <th>Efficiency</th>
                  <th>Score</th>
                  <th>Tier</th>
                  <th>Leaves</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((e, i) => (
                  <tr key={e.user._id}>
                    <td className={own.rankCell}>{i + 1}</td>
                    <td>
                      <div className={own.tableEmployee}>
                        <div className={own.tableAvatar}>
                          {e.user.avatar
                            ? <img src={e.user.avatar} alt="" />
                            : e.user.name?.[0]?.toUpperCase() || '?'
                          }
                        </div>
                        <div>
                          <div className={own.tableEmpName}>{e.user.name}</div>
                          <div className={own.tableEmpTitle}>{e.user.title || e.user.username}</div>
                        </div>
                      </div>
                    </td>
                    <td>{e.daysWorked}</td>
                    <td>{(e.workedSeconds / 3600).toFixed(1)}h</td>
                    <td>{e.daysWorked > 0 ? e.avgHoursRaw.toFixed(1) + 'h' : '—'}</td>
                    <td>
                      <div className={own.scoreBar}>
                        <div className={own.scoreBarFill} style={{ width: `${e.attendanceRate}%`, background: 'var(--accent)' }} />
                        <span>{Math.round(e.attendanceRate)}%</span>
                      </div>
                    </td>
                    <td>
                      <div className={own.scoreBar}>
                        <div className={own.scoreBarFill} style={{ width: `${e.efficiencyRate}%`, background: 'var(--green)' }} />
                        <span>{Math.round(e.efficiencyRate)}%</span>
                      </div>
                    </td>
                    <td><strong>{e.overallScore}%</strong></td>
                    <td>
                      <span className={own.tierBadge} style={{ color: e.tier.color, background: e.tier.bg }}>
                        {e.tier.label}
                      </span>
                    </td>
                    <td>{e.leaves.total} {e.leaves.pending > 0 && <span className={own.pendingTag}>({e.leaves.pending} pending)</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Benchmarks footer ── */}
          <div className={own.reportBenchmarks}>
            <span>Benchmarks used:</span>
            <span>Clock-in: {benchmarks?.expectedClockIn || '09:00'}</span>
            <span>Hours/day: {expHours}h</span>
            <span>Days/week: {expDays}</span>
            <span>Est. working days this month: ~{Math.round(expWorkingDays)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function UserManagement() {
  const now = new Date()
  const [year, setYear]   = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1) // 1-indexed
  const [data, setData]   = useState([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy]   = useState('name') // name | hours | days | leaves
  const [tick, setTick]       = useState(0) // drives live timers
  const [showReport, setShowReport] = useState(false)

  const isViewingToday = year === now.getFullYear() && month === now.getMonth() + 1

  const fetch = useCallback(async (y, m) => {
    setLoading(true)
    try {
      const { data: rows } = await api.get('/attendance/admin/summary', { params: { year: y, month: m } })
      setData(rows)
    } catch {
      setData([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch(year, month) }, [fetch, year, month])

  // Tick every second to animate live timers when viewing current month
  useEffect(() => {
    if (!isViewingToday) return
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [isViewingToday])

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }
  const isNextDisabled = year === now.getFullYear() && month >= now.getMonth() + 1

  const sorted = [...data].sort((a, b) => {
    if (sortBy === 'name')   return a.user.name.localeCompare(b.user.name)
    if (sortBy === 'hours')  return b.workedSeconds - a.workedSeconds
    if (sortBy === 'days')   return b.daysWorked - a.daysWorked
    if (sortBy === 'leaves') return b.leaves.total - a.leaves.total
    return 0
  })

  // Totals for the summary bar
  const totals = data.reduce((acc, r) => ({
    workedSeconds: acc.workedSeconds + r.workedSeconds,
    daysWorked:    acc.daysWorked    + r.daysWorked,
    leaves:        acc.leaves        + r.leaves.total,
  }), { workedSeconds: 0, daysWorked: 0, leaves: 0 })

  const SortBtn = ({ field, label }) => (
    <button
      className={`${own.sortBtn} ${sortBy === field ? own.sortActive : ''}`}
      onClick={() => setSortBy(field)}
    >
      {label}
    </button>
  )

  return (
    <div>
      {/* ── Header ── */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>User Management</h1>
          <p className={styles.pageSubtitle}>Attendance, hours &amp; leaves per employee</p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* Month picker */}
          <div className={own.monthPicker}>
            <button className={own.monthBtn} onClick={prevMonth} aria-label="Previous month">‹</button>
            <span className={own.monthLabel}>{MONTHS[month - 1]} {year}</span>
            <button className={own.monthBtn} onClick={nextMonth} disabled={isNextDisabled} aria-label="Next month">›</button>
          </div>

          {/* Report button */}
          <button className={own.reportBtn} onClick={() => setShowReport(true)}>
            <Icon name="doc" size={14} />
            Behaviour Report
          </button>
        </div>
      </div>

      {/* ── Report Modal ── */}
      {showReport && (
        <ReportModal
          onClose={() => setShowReport(false)}
          year={year}
          month={month}
          monthLabel={MONTHS[month - 1]}
        />
      )}

      {/* ── Summary strip ── */}
      <div className={own.summaryStrip}>
        <div className={own.summaryItem}>
          <div className={own.summaryIcon} style={{ background: 'var(--green-soft)' }}>
            <Icon name="clock" size={16} color="var(--green)" />
          </div>
          <div>
            <div className={own.summaryVal}>{fmtHours(totals.workedSeconds)}</div>
            <div className={own.summaryLbl}>Total Hours Worked (All Staff)</div>
          </div>
        </div>
        <div className={own.summaryDivider} />
        <div className={own.summaryItem}>
          <div className={own.summaryIcon} style={{ background: 'var(--accent-soft)' }}>
            <Icon name="calendar" size={16} color="var(--accent)" />
          </div>
          <div>
            <div className={own.summaryVal}>{totals.daysWorked}</div>
            <div className={own.summaryLbl}>Total Days Worked (All Staff)</div>
          </div>
        </div>
        <div className={own.summaryDivider} />
        <div className={own.summaryItem}>
          <div className={own.summaryIcon} style={{ background: 'var(--yellow-soft)' }}>
            <Icon name="doc" size={16} color="var(--yellow)" />
          </div>
          <div>
            <div className={own.summaryVal}>{totals.leaves}</div>
            <div className={own.summaryLbl}>Total Leave Days (All Staff)</div>
          </div>
        </div>
      </div>

      {/* ── Sort controls ── */}
      <div className={own.sortRow}>
        <span className={own.sortLabel}>Sort by:</span>
        <SortBtn field="name"   label="Name"   />
        <SortBtn field="hours"  label="Hours"  />
        <SortBtn field="days"   label="Days"   />
        <SortBtn field="leaves" label="Leaves" />
      </div>

      {/* ── Employee cards ── */}
      {loading ? (
        <p className={styles.emptyCell}>Loading…</p>
      ) : sorted.length === 0 ? (
        <p className={styles.emptyCell}>No users found.</p>
      ) : (
        <div className={own.grid}>
          {sorted.map(({ user, daysWorked, workedSeconds, breakSeconds, leaves, today }) => {
            const avgHoursPerDay = daysWorked > 0
              ? Math.round(workedSeconds / daysWorked / 360) / 10
              : 0

            // Today's live data (tick forces recalc every second)
            // eslint-disable-next-line no-unused-expressions
            tick // intentional — keeps recalc fresh
            const liveToday = isViewingToday ? calcLive(today) : null
            const todayStatus = !isViewingToday ? null
              : today.hasSavedLog  ? 'done'
              : today.clockedIn && today.onBreak ? 'break'
              : today.clockedIn ? 'working'
              : 'absent'

            return (
              <div key={user._id} className={own.card}>
                {/* User identity */}
                <div className={own.cardTop}>
                  <div className={own.avatarWrap}>
                    <Avatar user={user} />
                    <span className={`${own.onlineDot} ${user.online ? own.online : own.offline}`} />
                  </div>
                  <div className={own.userInfo}>
                    <div className={own.userName}>{user.name}</div>
                    <div className={own.userSub}>{user.title || '@' + user.username}</div>
                  </div>
                  <Badge label={user.role} />
                </div>

                {/* Stats */}
                <div className={own.statGrid}>
                  <div className={own.statItem}>
                    <div className={own.statVal} style={{ color: 'var(--green)' }}>{fmtHours(workedSeconds)}</div>
                    <div className={own.statLbl}>Hours Worked</div>
                  </div>
                  <div className={own.statItem}>
                    <div className={own.statVal} style={{ color: 'var(--accent)' }}>{daysWorked}</div>
                    <div className={own.statLbl}>Days Present</div>
                  </div>
                  <div className={own.statItem}>
                    <div className={own.statVal} style={{ color: 'var(--yellow)' }}>{leaves.total}</div>
                    <div className={own.statLbl}>Leaves Taken</div>
                  </div>
                  <div className={own.statItem}>
                    <div className={own.statVal} style={{ color: 'var(--text3)' }}>{fmtHours(breakSeconds)}</div>
                    <div className={own.statLbl}>Break Time</div>
                  </div>
                </div>

                {/* ── Today section ── */}
                {isViewingToday && (
                  <div className={own.todaySection}>
                    <div className={own.todayHeader}>
                      <span className={own.todayTitle}>
                        <Icon name="clock" size={11} color="var(--accent)" />
                        Today
                      </span>
                      {todayStatus === 'working' && <span className={own.statusPill} style={{ background: 'var(--green-soft)', color: 'var(--green)' }}><span className={own.liveDot} /> Working</span>}
                      {todayStatus === 'break'   && <span className={own.statusPill} style={{ background: 'var(--yellow-soft)', color: 'var(--yellow)' }}><span className={own.breakDot} /> On Break</span>}
                      {todayStatus === 'done'    && <span className={own.statusPill} style={{ background: 'var(--surface2)', color: 'var(--text3)' }}>Clocked Out</span>}
                      {todayStatus === 'absent'  && <span className={own.statusPill} style={{ background: 'var(--surface2)', color: 'var(--text3)' }}>Not In Yet</span>}
                    </div>

                    {todayStatus === 'absent' ? (
                      <div className={own.todayAbsent}>No clock-in recorded yet today.</div>
                    ) : (
                      <div className={own.todayRow}>
                        <div className={own.todayStat}>
                          <div className={own.todayBig} style={{ color: todayStatus === 'working' ? 'var(--green)' : todayStatus === 'break' ? 'var(--yellow)' : 'var(--text2)', fontVariantNumeric: 'tabular-nums' }}>
                            {todayStatus === 'done'
                              ? fmtHours(liveToday.secs)
                              : fmtTimeLong(liveToday?.secs ?? 0)
                            }
                          </div>
                          <div className={own.todayLbl}>Hours Today</div>
                        </div>
                        <div className={own.todayMeta}>
                          <div className={own.todayChip}>
                            <Icon name="arrowIn" size={11} color="var(--text3)" />
                            In: {fmtTime12(today.clockInTime)}
                          </div>
                          {(todayStatus === 'done') && (
                            <div className={own.todayChip}>
                              <Icon name="logout" size={11} color="var(--text3)" />
                              Out: {fmtTime12(today.clockOutTime)}
                            </div>
                          )}
                          {(liveToday?.breakSecs > 0) && (
                            <div className={own.todayChip} style={{ color: 'var(--yellow)' }}>
                              Break: {fmtHours(liveToday.breakSecs)}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Footer detail row */}
                <div className={own.cardFooter}>
                  <span className={own.footerDetail}>
                    <Icon name="clock" size={11} color="var(--text3)" />
                    Avg {avgHoursPerDay}h/day
                  </span>
                  {leaves.pending > 0 && (
                    <span className={own.pendingBadge}>
                      {leaves.pending} leave{leaves.pending > 1 ? 's' : ''} pending
                    </span>
                  )}
                  {leaves.approved > 0 && (
                    <span className={own.approvedBadge}>
                      {leaves.approved} approved
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
