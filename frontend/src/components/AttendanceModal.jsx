import { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import { Icon } from './Icon';
import styles from './AttendanceModal.module.css';

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const LEAVE_TYPES = [
  { value: 'sick',     label: 'Sick Leave' },
  { value: 'vacation', label: 'Vacation' },
  { value: 'personal', label: 'Personal' },
  { value: 'other',    label: 'Other' },
];

function fmtSecs(s) {
  if (!s || s <= 0) return '0m';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function fmtSecsLong(s) {
  if (!s || s <= 0) return '0h 0m';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}h ${String(m).padStart(2, '0')}m ${String(sec).padStart(2, '0')}s`;
}

function fmtTime(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

function todayNY() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

function getLiveSession() {
  try {
    const s = JSON.parse(localStorage.getItem('attendance')) || {};
    if (s.clockedIn && s.clockInTime) return s;
  } catch { /* ignore */ }
  return null;
}

function calcLiveWorkedSecs(session) {
  if (!session?.clockInTime) return 0;
  const elapsed = Math.floor((Date.now() - Number(session.clockInTime)) / 1000);
  let breakSecs = session.breakSeconds || 0;
  if (session.onBreak && session.breakStart) {
    breakSecs += Math.floor((Date.now() - Number(session.breakStart)) / 1000);
  }
  return Math.max(0, elapsed - breakSecs);
}

export function AttendanceModal({ onClose }) {
  const today = new Date();
  const [viewYear, setViewYear]     = useState(today.getFullYear());
  const [viewMonth, setViewMonth]   = useState(today.getMonth()); // 0-indexed
  const [logs, setLogs]             = useState([]);
  const [leaves, setLeaves]         = useState([]);
  const [loading, setLoading]       = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveForm, setLeaveForm]   = useState({ date: todayNY(), type: 'sick', reason: '' });
  const [saving, setSaving]         = useState(false);
  const [tick, setTick]             = useState(0); // force re-render for live timer

  const fetchData = useCallback(async (year, month) => {
    setLoading(true);
    try {
      const [logsRes, leavesRes] = await Promise.all([
        api.get('/attendance', { params: { year, month: month + 1 } }),
        api.get('/attendance/leaves', { params: { year, month: month + 1 } }),
      ]);
      setLogs(logsRes.data);
      setLeaves(leavesRes.data);
    } catch (e) {
      console.error('Failed to fetch attendance:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(viewYear, viewMonth);
  }, [fetchData, viewYear, viewMonth]);

  // Tick every second to keep live session time fresh
  useEffect(() => {
    const liveSession = getLiveSession();
    if (!liveSession) return;
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
    setSelectedDate(null);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
    setSelectedDate(null);
  };
  const isNextDisabled = viewYear === today.getFullYear() && viewMonth >= today.getMonth();

  // Build calendar cells
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const logMap = {};
  logs.forEach(l => { logMap[l.date] = l; });
  const leaveMap = {};
  leaves.forEach(l => { leaveMap[l.date] = l; });

  const todayStr = todayNY();

  // Show live session for today if user is currently clocked in and no saved log exists
  const liveSession = getLiveSession();
  const isViewingCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth();
  if (liveSession && isViewingCurrentMonth && !logMap[todayStr]) {
    logMap[todayStr] = {
      isLive: true,
      clockInTime: new Date(Number(liveSession.clockInTime)),
      clockOutTime: null,
      workedSeconds: calcLiveWorkedSecs(liveSession),
      breakSeconds: liveSession.breakSeconds || 0,
      onBreak: liveSession.onBreak || false,
    };
  }

  const cells = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push(dateStr);
  }

  // Summary for selected month — recalc live worked on each tick
  const savedWorkedSecs  = logs.reduce((s, l) => s + (l.workedSeconds || 0), 0);
  const liveWorkedSecs   = (liveSession && isViewingCurrentMonth && !logs.some(l => l.date === todayStr))
    ? calcLiveWorkedSecs(liveSession) : 0;
  const totalWorkedSecs  = savedWorkedSecs + liveWorkedSecs;
  const totalBreakSecs   = logs.reduce((s, l) => s + (l.breakSeconds || 0), 0)
    + (liveSession && isViewingCurrentMonth && !logs.some(l => l.date === todayStr) ? (liveSession.breakSeconds || 0) : 0);
  const daysWorked       = logs.length + (liveWorkedSecs > 0 ? 1 : 0);
  const daysOnLeave      = leaves.length;

  const selLog   = selectedDate ? logMap[selectedDate]   : null;
  // recalc live workedSeconds on tick
  const selLogDisplay = (selLog?.isLive && liveSession)
    ? { ...selLog, workedSeconds: calcLiveWorkedSecs(liveSession) }
    : selLog;
  const selLeave = selectedDate ? leaveMap[selectedDate] : null;

  const submitLeave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/attendance/leaves', leaveForm);
      await fetchData(viewYear, viewMonth);
      setShowLeaveForm(false);
      setLeaveForm({ date: todayNY(), type: 'sick', reason: '' });
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save leave request');
    } finally {
      setSaving(false);
    }
  };

  const cancelLeave = async (id) => {
    if (!window.confirm('Cancel this leave request?')) return;
    try {
      await api.delete(`/attendance/leaves/${id}`);
      await fetchData(viewYear, viewMonth);
      setSelectedDate(null);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to cancel leave');
    }
  };

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.panel}>

        {/* ── Header ── */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <Icon name="calendar" size={17} color="var(--accent)" />
            <span className={styles.title}>Work History</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">×</button>
        </div>

        {/* ── Month navigation ── */}
        <div className={styles.monthNav}>
          <button className={styles.navBtn} onClick={prevMonth} aria-label="Previous month">‹</button>
          <span className={styles.monthLabel}>{MONTHS[viewMonth]} {viewYear}</span>
          <button className={styles.navBtn} onClick={nextMonth} disabled={isNextDisabled} aria-label="Next month">›</button>
        </div>

        {/* ── Calendar grid ── */}
        <div className={styles.calWrap}>
          {loading && <div className={styles.loadingOverlay}>Loading…</div>}
          <div className={styles.calGrid}>
            {DAYS.map(d => (
              <div key={d} className={styles.dayLabel}>{d}</div>
            ))}
            {cells.map((dateStr, i) => {
              if (!dateStr) return <div key={`empty-${i}`} className={styles.emptyCell} />;
              const dayNum  = parseInt(dateStr.split('-')[2], 10);
              const hasLog  = !!logMap[dateStr];
              const isLive  = hasLog && logMap[dateStr]?.isLive;
              const hasLeave = !!leaveMap[dateStr];
              const isToday   = dateStr === todayStr;
              const isFuture  = dateStr > todayStr;
              const isSelected = selectedDate === dateStr;

              return (
                <button
                  key={dateStr}
                  className={[
                    styles.dayCell,
                    isToday    ? styles.isToday    : '',
                    isFuture   ? styles.isFuture   : '',
                    isSelected ? styles.isSelected : '',
                  ].join(' ')}
                  onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                >
                  <span className={styles.dayNum}>{dayNum}</span>
                  <span className={styles.dots}>
                    {hasLog   && <span className={isLive ? styles.dotLive : styles.dotGreen} />}
                    {hasLeave && <span className={styles.dotOrange} />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Legend ── */}
        <div className={styles.legend}>
          <span className={styles.legendItem}><span className={`${styles.legendDot} ${styles.lgGreen}`}  /> Worked</span>
          <span className={styles.legendItem}><span className={`${styles.legendDot} ${styles.lgLive}`}   /> Live</span>
          <span className={styles.legendItem}><span className={`${styles.legendDot} ${styles.lgOrange}`} /> Leave</span>
          <span className={styles.legendItem}><span className={`${styles.legendDot} ${styles.lgToday}`}  /> Today</span>
        </div>

        {/* ── Monthly summary ── */}
        <div className={styles.summaryRow}>
          <div className={styles.summaryItem}>
            <div className={styles.summaryVal} style={{ color: 'var(--green)' }}>{fmtSecs(totalWorkedSecs)}</div>
            <div className={styles.summaryLbl}>Worked</div>
          </div>
          <div className={styles.summaryDivider} />
          <div className={styles.summaryItem}>
            <div className={styles.summaryVal}>{daysWorked}</div>
            <div className={styles.summaryLbl}>Days Present</div>
          </div>
          <div className={styles.summaryDivider} />
          <div className={styles.summaryItem}>
            <div className={styles.summaryVal} style={{ color: 'var(--yellow)' }}>{daysOnLeave}</div>
            <div className={styles.summaryLbl}>Leaves</div>
          </div>
          <div className={styles.summaryDivider} />
          <div className={styles.summaryItem}>
            <div className={styles.summaryVal} style={{ color: 'var(--text3)' }}>{fmtSecs(totalBreakSecs)}</div>
            <div className={styles.summaryLbl}>Break Time</div>
          </div>
        </div>

        {/* ── Selected day details ── */}
        {selectedDate && (
          <div className={styles.dayDetail}>
            <div className={styles.dayDetailDate}>
              {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
                weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
              })}
            </div>
            {selLogDisplay ? (
              <div className={styles.workInfo}>
                <div className={styles.workHours}>
                  {selLogDisplay.isLive
                    ? <><span className={styles.liveDot} /> In progress — {fmtSecsLong(selLogDisplay.workedSeconds)}</>
                    : <><Icon name="check" size={14} color="var(--green)" /> Worked {fmtSecs(selLogDisplay.workedSeconds)}</>
                  }
                </div>
                <div className={styles.timesRow}>
                  <span className={styles.timeChip}>In: {fmtTime(selLogDisplay.clockInTime)}</span>
                  {selLogDisplay.clockOutTime
                    ? <span className={styles.timeChip}>Out: {fmtTime(selLogDisplay.clockOutTime)}</span>
                    : <span className={`${styles.timeChip} ${styles.liveChip}`}>Still working…</span>
                  }
                  {selLogDisplay.breakSeconds > 0 && (
                    <span className={styles.timeChip} style={{ color: 'var(--yellow)' }}>
                      Break: {fmtSecs(selLogDisplay.breakSeconds)}
                    </span>
                  )}
                  {selLogDisplay.onBreak && (
                    <span className={styles.timeChip} style={{ color: 'var(--yellow)' }}>On break now</span>
                  )}
                </div>
              </div>
            ) : selLeave ? (
              <div className={styles.leaveInfo}>
                <div className={styles.leaveTypeRow}>
                  <span className={styles.leaveTypeBadge}>
                    {LEAVE_TYPES.find(t => t.value === selLeave.type)?.label || selLeave.type}
                  </span>
                  <span className={`${styles.leaveStatus} ${styles[`status_${selLeave.status}`]}`}>
                    {selLeave.status}
                  </span>
                </div>
                {selLeave.reason && <p className={styles.leaveReason}>{selLeave.reason}</p>}
                {selLeave.status === 'pending' && (
                  <button className={styles.cancelLeaveBtn} onClick={() => cancelLeave(selLeave._id)}>
                    Cancel Request
                  </button>
                )}
              </div>
            ) : (
              <div className={styles.noRecord}>No attendance record for this day.</div>
            )}
          </div>
        )}

        {/* ── Leave request form / button ── */}
        {showLeaveForm ? (
          <form className={styles.leaveForm} onSubmit={submitLeave}>
            <div className={styles.leaveFormTitle}>Request a Leave Day</div>
            <div className={styles.leaveFormRow}>
              <div className={styles.leaveField}>
                <label htmlFor="leave-date">Date</label>
                <input
                  id="leave-date"
                  type="date"
                  value={leaveForm.date}
                  onChange={e => setLeaveForm(f => ({ ...f, date: e.target.value }))}
                  required
                />
              </div>
              <div className={styles.leaveField}>
                <label htmlFor="leave-type">Type</label>
                <select
                  id="leave-type"
                  value={leaveForm.type}
                  onChange={e => setLeaveForm(f => ({ ...f, type: e.target.value }))}
                >
                  {LEAVE_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className={styles.leaveField}>
              <label htmlFor="leave-reason">Reason <span className={styles.optLabel}>(optional)</span></label>
              <textarea
                id="leave-reason"
                rows={2}
                value={leaveForm.reason}
                onChange={e => setLeaveForm(f => ({ ...f, reason: e.target.value }))}
                placeholder="Brief reason…"
              />
            </div>
            <div className={styles.leaveFormActions}>
              <button type="button" className={styles.cancelFormBtn} onClick={() => setShowLeaveForm(false)}>
                Cancel
              </button>
              <button type="submit" className={styles.submitBtn} disabled={saving}>
                {saving ? 'Submitting…' : 'Submit Request'}
              </button>
            </div>
          </form>
        ) : (
          <button
            className={styles.takeLeaveBtn}
            onClick={() => {
              setLeaveForm({ date: todayNY(), type: 'sick', reason: '' });
              setShowLeaveForm(true);
            }}
          >
            <Icon name="calendar" size={13} />
            Request a Leave Day
          </button>
        )}

      </div>
    </div>
  );
}
