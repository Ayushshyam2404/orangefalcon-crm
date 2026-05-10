import { useEffect, useState } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useAttendance } from '../hooks/useSessionTimer'
import { Icon } from './Icon'
import api from '../utils/api'
import styles from './Sidebar.module.css'

export function Sidebar({ alertCount, isOpen, onClose, onOpenAttendance }) {
  const { user, logout } = useAuth()
  const { display, estTime, estDate, clockedIn, onBreak, loading, clockIn, clockOut, startBreak, endBreak } = useAttendance()
  const navigate = useNavigate()
  const location = useLocation()

  const [companyName, setCompanyName] = useState('Orange Falcon')
  const [companyLogo, setCompanyLogo] = useState('')

  useEffect(() => {
    api.get('/company-settings').then(({ data }) => {
      if (data.companyName) setCompanyName(data.companyName)
      if (data.logo)        setCompanyLogo(data.logo)
    }).catch(() => {})
  }, [])

  // Close sidebar when navigating on mobile
  useEffect(() => {
    onClose?.()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const navItems = [
    { to: '/', label: 'Dashboard', icon: 'grid', exact: true },
    { to: '/rfps', label: 'RFPs', icon: 'doc' },
    { to: '/rfps-consideration', label: 'RFP Consideration', icon: 'star' },
    { to: '/calls', label: 'Calls', icon: 'phone' },
    { to: '/groups', label: 'Groups', icon: 'users' },
    { to: '/tasks', label: 'Tasks', icon: 'check' },
    { to: '/leads', label: 'Inbound Leads', icon: 'funnel' },
    { to: '/corporate', label: 'Corporate Profiles', icon: 'building' },
    { to: '/calendar', label: 'Calendar', icon: 'calendar' },
    { to: '/announcements', label: 'Announcements', icon: 'megaphone' },
  ]

  const reputationItems = [
    { to: '/reputation', label: 'Dashboard', icon: 'grid' },
    { to: '/hotel-scores', label: 'Hotel Scores', icon: 'star' },
    { to: '/reputation-tasks', label: 'Tasks', icon: 'check' },
    { to: '/reputation-calls', label: 'Calls', icon: 'phone' },
  ]

  const adminItems = [
    { to: '/user-management', label: 'User Management', icon: 'users' },
    { to: '/settings', label: 'Settings', icon: 'settings' },
    { to: '/alerts', label: 'Alerts', icon: 'bell', badge: alertCount },
  ]

  return (
    <aside className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}>
      <div className={styles.header}>
        <div className={styles.logo}>
            {companyLogo
              ? <img src={companyLogo} alt="Logo" className={styles.logoImg} />
              : <div className={styles.logoMark}><Icon name="falcon" size={16} /></div>
            }
            <div>
              <div className={styles.logoText}>{companyName}</div>
              <div className={styles.logoSub}>CRM</div>
            </div>
          </div>
      </div>

      <div className={styles.timer}>
        <div className={styles.timerTopRow}>
          <div className={styles.estTime}>{estTime} <span className={styles.estLabel}>EST</span></div>
          <div className={`${styles.statusDot} ${clockedIn ? (onBreak ? styles.dotBreak : styles.dotActive) : styles.dotOff}`} />
        </div>
        <div className={styles.estDate}>{estDate}</div>
        <div className={styles.timerDisplay}>{display}</div>
        <div className={styles.timerStatus}>
          {!clockedIn ? 'Not Clocked In' : onBreak ? 'On Break' : 'Working'}
        </div>
        <div className={styles.clockBtns}>
          {!clockedIn ? (
            <button className={`${styles.clockBtn} ${styles.clockInBtn}`} onClick={clockIn} disabled={loading}>
              Clock In
            </button>
          ) : onBreak ? (
            <button className={`${styles.clockBtn} ${styles.breakEndBtn}`} onClick={endBreak} disabled={loading}>
              End Break
            </button>
          ) : (
            <>
              <button className={`${styles.clockBtn} ${styles.breakBtn}`} onClick={startBreak} disabled={loading}>
                Break
              </button>
              <button className={`${styles.clockBtn} ${styles.clockOutBtn}`} onClick={clockOut} disabled={loading}>
                Clock Out
              </button>
            </>
          )}
        </div>
        <button className={styles.historyBtn} onClick={onOpenAttendance}>
          <Icon name="calendar" size={11} color="currentColor" />
          View Work History
        </button>
      </div>

      <nav className={styles.nav}>
        <div className={styles.navLabel}>Sales & Operations</div>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.exact}
            className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
          >
            <Icon name={item.icon} size={16} />
            {item.label}
          </NavLink>
        ))}

        <div className={styles.navLabel} style={{ marginTop: 16 }}>Reputation</div>
        {reputationItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
          >
            <Icon name={item.icon} size={16} />
            {item.label}
          </NavLink>
        ))}

        {user?.role === 'admin' && (
          <>
            <div className={styles.navLabel} style={{ marginTop: 16 }}>Admin</div>
            {adminItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
              >
                <Icon name={item.icon} size={16} />
                {item.label}
                {item.badge > 0 && (
                  <span className={styles.badge} style={{ background: 'var(--red)' }}>
                    {item.badge}
                  </span>
                )}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      <div className={styles.userSection}>
        <div className={styles.userCard}>
          <NavLink to="/profile" className={styles.userCardLink}>
            <div className={styles.avatar}>
              {user?.avatar
                ? <img src={user.avatar} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                : user?.name?.[0]?.toUpperCase()
              }
            </div>
            <div className={styles.userInfo}>
              <div className={styles.userName}>{user?.name}</div>
              <div className={styles.userRole}>{user?.role === 'admin' ? 'Administrator' : 'Staff'}</div>
            </div>
          </NavLink>
          <button className={styles.logoutBtn} onClick={handleLogout} title="Logout">
            <Icon name="logout" size={16} />
          </button>
        </div>
      </div>
    </aside>
  )
}
