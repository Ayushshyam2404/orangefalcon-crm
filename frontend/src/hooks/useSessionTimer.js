import { useState, useEffect, useCallback } from 'react'
import api from '../utils/api'

const LS_KEY = 'attendance'

function fmtSecs(s) {
  if (s < 0) s = 0
  const h = Math.floor(s / 3600).toString().padStart(2, '0')
  const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0')
  const sec = (s % 60).toString().padStart(2, '0')
  return `${h}:${m}:${sec}`
}

function getEstTime() {
  return new Date().toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
  })
}

function getEstDate() {
  return new Date().toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short', month: 'short', day: 'numeric'
  })
}

function loadState() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || {} } catch { return {} }
}

function saveState(s) {
  localStorage.setItem(LS_KEY, JSON.stringify(s))
}

export function useAttendance() {
  const [state, setState] = useState(() => {
    const s = loadState()
    return {
      clockedIn: s.clockedIn || false,
      clockInTime: s.clockInTime ? Number(s.clockInTime) : null,
      onBreak: s.onBreak || false,
      breakStart: s.breakStart ? Number(s.breakStart) : null,
      breakSeconds: s.breakSeconds || 0,
    }
  })
  const [display, setDisplay] = useState(() => {
    const s = loadState()
    if (!s.clockedIn || !s.clockInTime) return '00:00:00'
    const elapsed = Math.floor((Date.now() - Number(s.clockInTime)) / 1000)
    let breakSecs = s.breakSeconds || 0
    if (s.onBreak && s.breakStart) {
      breakSecs += Math.floor((Date.now() - Number(s.breakStart)) / 1000)
    }
    return fmtSecs(Math.max(0, elapsed - breakSecs))
  })
  const [estTime, setEstTime] = useState(getEstTime())
  const [estDate, setEstDate] = useState(getEstDate())
  const [loading, setLoading] = useState(false)

  // Sync with server on mount
  useEffect(() => {
    api.get('/auth/me').then(({ data }) => {
      if (data.clockedIn) {
        const s = {
          clockedIn: true,
          clockInTime: data.clockInTime ? new Date(data.clockInTime).getTime() : null,
          onBreak: data.onBreak || false,
          breakStart: data.breakStart ? new Date(data.breakStart).getTime() : null,
          breakSeconds: data.breakSeconds || 0,
        }
        setState(s)
        saveState(s)
      } else {
        // Server says this user is not clocked in — clear any stale localStorage from a previous user
        const cleared = { clockedIn: false, clockInTime: null, onBreak: false, breakStart: null, breakSeconds: 0 }
        setState(cleared)
        saveState(cleared)
        setDisplay('00:00:00')
      }
    }).catch(() => {})
  }, [])

  // Tick every second
  useEffect(() => {
    const interval = setInterval(() => {
      setEstTime(getEstTime())
        setEstDate(getEstDate())
      if (!state.clockedIn || !state.clockInTime) {
        setDisplay('00:00:00')
        return
      }
      const elapsed = Math.floor((Date.now() - state.clockInTime) / 1000)
      let breakSecs = state.breakSeconds || 0
      if (state.onBreak && state.breakStart) {
        breakSecs += Math.floor((Date.now() - state.breakStart) / 1000)
      }
      setDisplay(fmtSecs(elapsed - breakSecs))
    }, 1000)
    return () => clearInterval(interval)
  }, [state])

  const clockIn = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.post('/auth/clock-in')
      const s = {
        clockedIn: true,
        clockInTime: new Date(data.clockInTime).getTime(),
        onBreak: false,
        breakStart: null,
        breakSeconds: 0,
      }
      setState(s)
      saveState(s)
    } finally { setLoading(false) }
  }, [])

  const clockOut = useCallback(async () => {
    setLoading(true)
    try {
      await api.post('/auth/clock-out')
      const cleared = { clockedIn: false, clockInTime: null, onBreak: false, breakStart: null, breakSeconds: 0 }
      setState(cleared)
      saveState(cleared)
      setDisplay('00:00:00')
    } finally { setLoading(false) }
  }, [])

  const startBreak = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.post('/auth/break-start')
      const s = { ...state, onBreak: true, breakStart: new Date(data.breakStart).getTime() }
      setState(s)
      saveState(s)
    } finally { setLoading(false) }
  }, [state])

  const endBreak = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.post('/auth/break-end')
      const s = { ...state, onBreak: false, breakStart: null, breakSeconds: data.breakSeconds }
      setState(s)
      saveState(s)
    } finally { setLoading(false) }
  }, [state])

  return { display, estTime, estDate, clockedIn: state.clockedIn, onBreak: state.onBreak, loading, clockIn, clockOut, startBreak, endBreak }
}

// Legacy export kept so nothing else breaks
export function useSessionTimer() {
  const { display } = useAttendance()
  return display
}
