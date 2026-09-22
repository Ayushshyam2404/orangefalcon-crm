import { useEffect, useRef, useState } from 'react'
import api from '../utils/api'
import { useAuth } from '../context/AuthContext'

export default function InactivityMonitor() {
  const { user } = useAuth()
  const lastActivity = useRef(Date.now())
  const warned = useRef(false)
  const lastHeartbeat = useRef(0)
  const [config, setConfig] = useState({ inactivityMinutes: 5, inactivityWarningLimit: 3 })
  const [notice, setNotice] = useState(null)

  useEffect(() => { if (!user?.isMaster) api.get('/activity/config').then(r => setConfig(r.data)).catch(() => {}) }, [user?.isMaster])
  useEffect(() => {
    if (user?.isMaster) return undefined
    const active = () => {
      const now = Date.now(); lastActivity.current = now; warned.current = false
      if (now - lastHeartbeat.current > 60000) { lastHeartbeat.current = now; api.post('/activity/heartbeat').catch(() => {}) }
    }
    const events = ['mousemove', 'pointerdown', 'keydown', 'scroll', 'touchstart']
    events.forEach(name => window.addEventListener(name, active, { passive: true }))
    const id = setInterval(async () => {
      const inactiveSeconds = Math.floor((Date.now() - lastActivity.current) / 1000)
      if (!warned.current && inactiveSeconds >= config.inactivityMinutes * 60) {
        warned.current = true
        try { const { data } = await api.post('/activity/warning', { inactiveSeconds }); setNotice({ ...data, inactiveSeconds }) } catch {}
      }
    }, 10000)
    return () => { clearInterval(id); events.forEach(name => window.removeEventListener(name, active)) }
  }, [config.inactivityMinutes, user?.isMaster])

  if (!notice || user?.isMaster) return null
  return <div style={{ position: 'fixed', right: 24, bottom: 24, zIndex: 10000, width: 'min(380px, calc(100vw - 48px))', background: 'var(--surface)', border: '1px solid var(--red, #ef4444)', borderRadius: 14, padding: 18, boxShadow: '0 18px 60px rgba(0,0,0,.35)' }}>
    <div style={{ color: 'var(--red, #ef4444)', fontWeight: 800, marginBottom: 7 }}>Inactivity warning</div>
    <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text2)' }}>No computer activity was detected for {Math.floor(notice.inactiveSeconds / 60)} minutes. Warning {notice.warningCount} has been recorded in employee behaviour.</div>
    {notice.warningCount >= notice.warningLimit && <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: 'var(--red, #ef4444)' }}>Configured warning limit reached.</div>}
    <button onClick={async () => { if (notice.warning?._id) await api.patch(`/activity/${notice.warning._id}/acknowledge`).catch(() => {}); lastActivity.current = Date.now(); warned.current = false; setNotice(null) }} style={{ marginTop: 14, width: '100%', padding: 9, border: 0, borderRadius: 8, background: 'var(--accent)', color: 'white', fontWeight: 700, cursor: 'pointer' }}>I’m back</button>
  </div>
}
