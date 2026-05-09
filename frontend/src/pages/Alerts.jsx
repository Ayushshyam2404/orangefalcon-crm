import { useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import { Button } from '../components/Button'
import api from '../utils/api'
import styles from './DataPage.module.css'

export default function Alerts() {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchAlerts = async () => {
    const { data } = await api.get('/alerts')
    setAlerts(data)
    setLoading(false)
  }

  useEffect(() => { fetchAlerts() }, [])

  const clearAll = async () => {
    if (!confirm('Clear all alerts?')) return
    await api.delete('/alerts')
    setAlerts([])
  }

  const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Alerts</h1>
          <p className={styles.pageSubtitle}>Login activity & system notifications</p>
        </div>
        <Button variant="secondary" onClick={clearAll}>Clear All</Button>
      </div>

      <div className={styles.card} style={{ padding: 18 }}>
        {loading ? (
          <p className={styles.emptyCell}>Loading...</p>
        ) : alerts.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <Icon name="bell" size={22} color="var(--text3)" />
            </div>
            <p>No alerts yet.</p>
          </div>
        ) : (
          <div className={styles.alertsList}>
            {alerts.map((a) => {
              const isLogin = a.iconType === 'login'
              return (
                <div key={a._id} className={styles.alertItem}>
                  <div
                    className={styles.alertIndicator}
                    style={{ background: isLogin ? 'var(--green-soft)' : 'var(--red-soft)' }}
                  >
                    <Icon
                      name={isLogin ? 'arrowIn' : 'logout'}
                      size={16}
                      color={isLogin ? 'var(--green)' : 'var(--red)'}
                    />
                  </div>
                  <div>
                    <div className={styles.alertTitle}>{a.message}</div>
                    <div className={styles.alertTime}>{a.type} · {fmtDate(a.createdAt)}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
