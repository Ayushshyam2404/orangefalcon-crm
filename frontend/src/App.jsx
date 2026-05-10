import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { Sidebar } from './components/Sidebar'
import { AttendanceModal } from './components/AttendanceModal'
import WelcomeScreen from './components/WelcomeScreen'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import RFPs from './pages/RFPs'
import RFPsInConsideration from './pages/RFPsInConsideration'
import Calls from './pages/Calls'
import Groups from './pages/Groups'
import Settings from './pages/Settings'
import Alerts from './pages/Alerts'
import Tasker from './pages/Tasker'
import InboundLeads from './pages/InboundLeads'
import CorporateProfiles from './pages/CorporateProfiles'
import Profile from './pages/Profile'
import Calendar from './pages/Calendar'
import Announcements from './pages/Announcements'
import UserManagement from './pages/UserManagement'
import HotelScores from './pages/HotelScores'
import ReputationDashboard from './pages/ReputationDashboard'
import ReputationTasker from './pages/ReputationTasker'
import ReputationCalls from './pages/ReputationCalls'
import api from './utils/api'

// ── Force change password modal ───────────────────────────────────────────────
function ForceChangePasswordModal() {
  const { clearMustChangePassword } = useAuth()
  const [form, setForm]   = useState({ newPassword: '', confirm: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [showPw, setShowPw] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.newPassword.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (form.newPassword !== form.confirm) {
      setError('Passwords do not match.')
      return
    }
    setSaving(true)
    try {
      await api.post('/auth/change-initial-password', { newPassword: form.newPassword })
      clearMustChangePassword()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to change password. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border2)',
        borderRadius: '20px', padding: '40px 36px', width: '100%', maxWidth: '420px',
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
      }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14, marginBottom: 18,
            background: 'linear-gradient(135deg, var(--accent), #ff8822)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 20px rgba(255,107,0,0.35)',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>
            Set your password
          </div>
          <div style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.5 }}>
            Your account was set up with a temporary password. Please create a new one before continuing.
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 7 }}>
              New Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'}
                value={form.newPassword}
                onChange={e => setForm(f => ({ ...f, newPassword: e.target.value }))}
                placeholder="Min. 6 characters"
                autoComplete="new-password"
                required
                minLength={6}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'var(--surface2)', border: '1px solid var(--border2)',
                  borderRadius: 'var(--radius-sm)', padding: '12px 44px 12px 14px',
                  fontSize: 14, color: 'var(--text)', outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)',
                  fontSize: 12, fontWeight: 600,
                }}
              >
                {showPw ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 7 }}>
              Confirm New Password
            </label>
            <input
              type={showPw ? 'text' : 'password'}
              value={form.confirm}
              onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
              placeholder="Repeat your new password"
              autoComplete="new-password"
              required
              minLength={6}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'var(--surface2)', border: '1px solid var(--border2)',
                borderRadius: 'var(--radius-sm)', padding: '12px 14px',
                fontSize: 14, color: 'var(--text)', outline: 'none',
              }}
            />
          </div>

          {error && (
            <div style={{
              background: 'rgba(229,62,62,0.1)', border: '1px solid rgba(229,62,62,0.3)',
              borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#ff8080',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            style={{
              marginTop: 6, width: '100%', padding: '13px',
              background: saving ? 'var(--surface3)' : 'linear-gradient(135deg, var(--accent) 0%, #ff8822 100%)',
              color: 'white', border: 'none', borderRadius: 'var(--radius-sm)',
              fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
              boxShadow: saving ? 'none' : '0 4px 14px rgba(255,107,0,0.35)',
              transition: 'all 0.2s',
            }}
          >
            {saving ? 'Saving…' : 'Set Password & Continue'}
          </button>
        </form>
      </div>
    </div>
  )
}

function ProtectedLayout() {
  const { user, loading } = useAuth()
  const [alertCount, setAlertCount] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [attendanceOpen, setAttendanceOpen] = useState(false)
  const [showWelcome, setShowWelcome] = useState(() => !!sessionStorage.getItem('showWelcome'))
  const [welcomeCompanyName] = useState(() => sessionStorage.getItem('welcomeCompanyName') || 'Orange Falcon')
  const [welcomeLogo] = useState(() => sessionStorage.getItem('welcomeLogo') || '')

  // Clear the flag immediately so refresh doesn't replay it
  useEffect(() => {
    if (showWelcome) {
      sessionStorage.removeItem('showWelcome')
      sessionStorage.removeItem('welcomeCompanyName')
      sessionStorage.removeItem('welcomeLogo')
    }
  }, [showWelcome])

  useEffect(() => {
    if (user?.role === 'admin') {
      api.get('/alerts').then(r => setAlertCount(r.data.length)).catch(() => {})
    }
  }, [user])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: 'var(--text3)', fontSize: 14 }}>
        Loading...
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  return (
    <div className="appLayout">
      {showWelcome && (
        <WelcomeScreen
          companyName={welcomeCompanyName}
          logo={welcomeLogo}
          onDone={() => setShowWelcome(false)}
        />
      )}
      {/* Forced password change blocks access until complete */}
      {user.mustChangePassword && <ForceChangePasswordModal />}

      <Sidebar alertCount={alertCount} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} onOpenAttendance={() => setAttendanceOpen(true)} />
      {sidebarOpen && <div className="sidebarOverlay" onClick={() => setSidebarOpen(false)} />}
      {attendanceOpen && <AttendanceModal onClose={() => setAttendanceOpen(false)} />}
      <main className="appMain">
        <button className="hamburgerBtn" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
          <svg width="18" height="14" viewBox="0 0 18 14" fill="currentColor">
            <rect width="18" height="2" rx="1"/>
            <rect y="6" width="18" height="2" rx="1"/>
            <rect y="12" width="18" height="2" rx="1"/>
          </svg>
        </button>
        <Outlet />
      </main>
    </div>
  )
}

function AdminRoute() {
  const { user } = useAuth()
  if (user?.role !== 'admin') return <Navigate to="/" replace />
  return <Outlet />
}

function PublicRoute() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) return <Navigate to="/" replace />
  return <Outlet />
}

export default function App() {
  // Apply persisted theme before first render
  useEffect(() => {
    const saved = localStorage.getItem('theme')
    if (saved) document.documentElement.setAttribute('data-theme', saved)
  }, [])

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<PublicRoute />}>
            <Route path="/login" element={<Login />} />
          </Route>

          <Route element={<ProtectedLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/rfps" element={<RFPs />} />
            <Route path="/rfps-consideration" element={<RFPsInConsideration />} />
            <Route path="/calls" element={<Calls />} />
            <Route path="/groups" element={<Groups />} />
            <Route path="/tasks" element={<Tasker />} />
            <Route path="/leads" element={<InboundLeads />} />
            <Route path="/corporate" element={<CorporateProfiles />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/announcements" element={<Announcements />} />
            <Route path="/hotel-scores" element={<HotelScores />} />
            <Route path="/reputation" element={<ReputationDashboard />} />
            <Route path="/reputation-tasks" element={<ReputationTasker />} />
            <Route path="/reputation-calls" element={<ReputationCalls />} />

            <Route element={<AdminRoute />}>
              <Route path="/settings" element={<Settings />} />
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/user-management" element={<UserManagement />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
