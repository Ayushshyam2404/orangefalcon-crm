import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Icon } from '../components/Icon'
import styles from './Login.module.css'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [isLocked, setIsLocked] = useState(false)
  const [lockUntil, setLockUntil] = useState(null)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [loading, setLoading] = useState(false)
  const [companyName, setCompanyName] = useState('Orange Falcon')
  const [logo, setLogo] = useState('')
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('loginTheme')
    return saved ? saved === 'dark' : true
  })
  const intervalRef = useRef(null)

  // Fetch public company branding on mount
  useEffect(() => {
    const base = import.meta.env.VITE_API_URL || '/api'
    fetch(`${base}/company-settings/public`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.companyName) setCompanyName(data.companyName)
        if (data?.logo) setLogo(data.logo)
      })
      .catch(() => {})
  }, [])

  // Countdown timer when account is locked
  useEffect(() => {
    if (!lockUntil) return
    const tick = () => {
      const secs = Math.max(0, Math.ceil((new Date(lockUntil) - Date.now()) / 1000))
      setSecondsLeft(secs)
      if (secs <= 0) {
        setIsLocked(false)
        setLockUntil(null)
        setError('')
        clearInterval(intervalRef.current)
      }
    }
    tick()
    intervalRef.current = setInterval(tick, 1000)
    return () => clearInterval(intervalRef.current)
  }, [lockUntil])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isLocked) return
    setError('')
    setLoading(true)
    try {
      await login(form.username, form.password)
      sessionStorage.setItem('showWelcome', '1')
      sessionStorage.setItem('welcomeCompanyName', companyName)
      sessionStorage.setItem('welcomeLogo', logo)
      navigate('/')
    } catch (err) {
      const status = err.response?.status
      const data   = err.response?.data
      if (status === 423 && data?.lockUntil) {
        setIsLocked(true)
        setLockUntil(data.lockUntil)
        setError(data.message || 'Account locked.')
      } else {
        setError(data?.message || 'Invalid credentials')
      }
    } finally {
      setLoading(false)
    }
  }

  const toggleTheme = () => {
    setIsDark(prev => {
      const next = !prev
      localStorage.setItem('loginTheme', next ? 'dark' : 'light')
      return next
    })
  }

  const mins = Math.floor(secondsLeft / 60)
  const secs = secondsLeft % 60

  return (
    <>
      <div className={`${styles.page}${!isDark ? ` ${styles.light}` : ''}`}>
        {/* Ambient orbs */}
        <div className={styles.orb1} />
        <div className={styles.orb2} />
        <div className={styles.orb3} />
        <div className={styles.grid} />

        {/* Theme toggle */}
        <button
          className={styles.themeToggle}
          onClick={toggleTheme}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <Icon name={isDark ? 'sun' : 'moon'} size={16} />
        </button>

        <div className={styles.card}>
          {/* Logo area */}
          <div className={styles.logoRow}>
            <div className={styles.logoMark}>
              {logo
                ? <img src={logo} alt="logo" className={styles.logoImg} />
                : <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z"/>
                  </svg>
              }
            </div>
            <div>
              <div className={styles.logoName}>{companyName}</div>
              <div className={styles.logoTagline}>CRM Platform</div>
            </div>
          </div>

          <div className={styles.divider} />

          <h1 className={styles.title}>Welcome back</h1>
          <p className={styles.subtitle}>Sign in to access your workspace</p>

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label}>Username</label>
              <div className={styles.inputWrap}>
                <svg className={styles.inputIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
                <input
                  type="text"
                  placeholder="Enter your username"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  autoComplete="username"
                  disabled={isLocked}
                  required
                />
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Password</label>
              <div className={styles.inputWrap}>
                <svg className={styles.inputIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <input
                  type="password"
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  autoComplete="current-password"
                  disabled={isLocked}
                  required
                />
              </div>
            </div>

            {error && (
              <div className={isLocked ? styles.errorLocked : styles.error}>
                {isLocked ? (
                  <>
                    <span style={{display:'flex',alignItems:'center',gap:'6px'}}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                      {error.split('.')[0]}.
                    </span>
                    {secondsLeft > 0 && (
                      <span className={styles.lockCountdown}>
                        Unlocks in {mins > 0 ? `${mins}m ` : ''}{String(secs).padStart(2, '0')}s
                      </span>
                    )}
                  </>
                ) : error}
              </div>
            )}

            <button type="submit" className={styles.loginBtn} disabled={loading || isLocked}>
              {loading
                ? <span className={styles.btnSpinner}><span /><span /><span /></span>
                : isLocked
                  ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Account Locked</>
                  : 'Sign In'}
            </button>
          </form>
        </div>

        <p className={styles.footer}>
          &copy; {new Date().getFullYear()} {companyName}. All rights reserved.
        </p>
      </div>
    </>
  )
}
