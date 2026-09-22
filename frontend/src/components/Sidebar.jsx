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
  const can = (module, action = 'read') => user?.isMaster || user?.permissions?.[module]?.[action] === true
  const canAny = modules => user?.isMaster || modules.some(module => can(module))

  useEffect(() => {
    api.get('/company-settings/public').then(({ data }) => {
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
    { to: user?.isMaster ? '/sales' : '/', label: 'Dashboard', icon: 'grid', exact: true, module: 'dashboard' },
    { to: '/rfps', label: 'RFPs', icon: 'doc', module: 'rfps' },
    { to: '/rfps-consideration', label: 'RFP Consideration', icon: 'star', module: 'rfpConsideration' },
    { to: '/calls', label: 'Calls', icon: 'phone', module: 'calls' },
    { to: '/groups', label: 'Groups', icon: 'users', module: 'groups' },
    { to: '/revenue-analytics', label: 'Revenue Analytics', icon: 'barChart', module: 'revenueAnalytics' },
    { to: '/tasks', label: 'Tasks', icon: 'check', module: 'tasks' },
    { to: '/leads', label: 'Inbound Leads', icon: 'funnel', module: 'leads' },
    { to: '/corporate', label: 'Corporate Profiles', icon: 'building', module: 'corporate' },
    { to: '/calendar', label: 'Calendar', icon: 'calendar', module: 'calendar' },
    { to: '/announcements', label: 'Announcements', icon: 'megaphone', module: 'announcements' },
  ].filter(item => can(item.module))

  const reputationItems = [
    { to: '/reputation', label: 'Dashboard', icon: 'grid', module: 'reputationDashboard' },
    { to: '/hotel-scores', label: 'Hotel Scores', icon: 'star', module: 'hotelScores' },
    { to: '/reputation-tasks', label: 'Tasks', icon: 'check', module: 'reputationTasks' },
    { to: '/reputation-calls', label: 'Calls', icon: 'phone', module: 'reputationCalls' },
  ].filter(item => can(item.module))

  const departmentItems = [
    { label: 'Marketing', items: [{ to: '/marketing', label: 'Dashboard', icon: 'grid', module: 'marketingDashboard' }, { to: '/marketing-tasks', label: 'Daily Tasks', icon: 'check', module: 'marketingTasks' }] },
    { label: 'Operations', items: [{ to: '/operations', label: 'Dashboard', icon: 'grid', module: 'operationsDashboard' }, { to: '/operations-tasks', label: 'Daily Tasks', icon: 'check', module: 'operationsTasks' }] },
    { label: 'Internal Sales', items: [{ to: '/internal-sales', label: 'Dashboard', icon: 'grid', module: 'internalSalesDashboard' }, { to: '/internal-sales-tasks', label: 'Product Sales Tasks', icon: 'check', module: 'internalSalesTasks' }] },
  ].map(section => ({ ...section, items: section.items.filter(item => can(item.module)) })).filter(section => section.items.length)

  const propertyItems = [
    { to: '/properties', label: 'Manage Properties', icon: 'building', module: 'properties' },
  ].filter(item => can(item.module))

  const adminItems = [
    ...(canAny(['employeeBehaviour', 'leaveApprovals']) ? [{ to: '/user-management', label: 'Employee Behaviour', icon: 'users' }] : []),
    ...(canAny(['appearance', 'companySettings', 'reportRecipients', 'dailyReports', 'backupRestore', 'userManagement', 'hotels', 'hotelScores']) ? [{ to: '/settings', label: 'Settings', icon: 'settings' }] : []),
    { to: '/alerts', label: 'Alerts', icon: 'bell', badge: alertCount, module: 'alerts' },
    ...(user?.isMaster ? [{ to: '/access-control', label: 'Access Control', icon: 'settings' }] : []),
  ].filter(item => !item.module || can(item.module))

  const userIdentity = <>
    <div className={styles.avatar}>
      {user?.avatar
        ? <img src={user.avatar} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
        : user?.name?.[0]?.toUpperCase()
      }
    </div>
    <div className={styles.userInfo}>
      <div className={styles.userName}>{user?.name}</div>
      <div className={styles.userRole}>{user?.isMaster ? 'Master' : (user?.department || user?.role || 'Staff').replace('-', ' ')}</div>
    </div>
  </>

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

      {can('attendance') && <div className={styles.timer}>
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
      </div>}

      <nav className={styles.nav}>
        {can('executiveOverview') && <>
          <div className={styles.navLabel}>Overview</div>
          <NavLink to={user?.isMaster ? '/' : '/company-overview'} end className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}><Icon name="barChart" size={16} />Company Overview</NavLink>
        </>}
        {navItems.length > 0 && <div className={styles.navLabel}>Sales</div>}
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

        {reputationItems.length > 0 && <div className={styles.navLabel} style={{ marginTop: 16 }}>Reputation</div>}
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

        {departmentItems.map(section => <div key={section.label}>
          <div className={styles.navLabel} style={{ marginTop: 16 }}>{section.label}</div>
          {section.items.map(item => <NavLink key={item.to} to={item.to} className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}><Icon name={item.icon} size={16} />{item.label}</NavLink>)}
        </div>)}

        {propertyItems.length > 0 && <div className={styles.navLabel} style={{ marginTop: 16 }}>Properties</div>}
        {propertyItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
          >
            <Icon name={item.icon} size={16} />
            {item.label}
          </NavLink>
        ))}

        {adminItems.length > 0 && (
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
          {can('profile')
            ? <NavLink to="/profile" className={styles.userCardLink}>{userIdentity}</NavLink>
            : <div className={styles.userCardLink}>{userIdentity}</div>
          }
          <button className={styles.logoutBtn} onClick={handleLogout} title="Logout">
            <Icon name="logout" size={16} />
          </button>
        </div>
      </div>
    </aside>
  )
}
