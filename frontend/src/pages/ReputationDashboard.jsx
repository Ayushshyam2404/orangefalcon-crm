import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { Icon } from '../components/Icon'
import api from '../utils/api'
import styles from './ReputationDashboard.module.css'

// ── Helpers ────────────────────────────────────────────────────────────────────

function scoreColor(score) {
  const n = parseFloat(score)
  if (n >= 80) return 'var(--green)'
  if (n >= 50) return 'var(--accent)'
  return 'var(--red, #ef4444)'
}

function ScoreBadge({ score, size = 52 }) {
  const color = scoreColor(score)
  const n = parseFloat(score)
  const display = Number.isInteger(n) ? n : n.toFixed(1)
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: color + '18', border: `2.5px solid ${color}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 800, fontSize: Math.round(size * 0.27), color,
      flexShrink: 0,
    }}>
      {display}
    </div>
  )
}

function StatCard({ icon, iconColor, iconBg, accentColor, value, label }) {
  return (
    <div className={styles.statCard} style={{ '--sc': accentColor }}>
      <div className={styles.statIcon} style={{ background: iconBg }}>
        <Icon name={icon} size={18} color={iconColor} />
      </div>
      <div className={styles.statValue}>{value}</div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  )
}

function TrendIcon({ trend }) {
  if (trend === 'up')     return <span style={{ color: 'var(--green)',           fontWeight: 800, fontSize: 16 }}>↑</span>
  if (trend === 'down')   return <span style={{ color: 'var(--red, #ef4444)',   fontWeight: 800, fontSize: 16 }}>↓</span>
  if (trend === 'stable') return <span style={{ color: 'var(--text3)',           fontWeight: 800, fontSize: 16 }}>→</span>
  return <span style={{ color: 'var(--text3)', fontWeight: 700 }}>—</span>
}

function HotelCard({ hotel, latestScore, avgScore, trend, totalEntries, lastDate, needsImprovement }) {
  return (
    <div className={`${styles.hotelCard} ${needsImprovement ? styles.hotelCardAlert : ''}`}>
      <div className={styles.hotelCardTop}>
        <div className={styles.hotelCardInfo}>
          <div className={styles.hotelCardName}>{hotel.name}</div>
          <div className={styles.hotelCardCity}>{hotel.city}</div>
        </div>
        {latestScore !== null
          ? <ScoreBadge score={latestScore} size={52} />
          : <div className={styles.noScoreChip}>No data yet</div>
        }
      </div>

      {latestScore !== null && (
        <div className={styles.hotelCardStats}>
          <div className={styles.hotelStatItem}>
            <span className={styles.hotelStatLabel}>Avg 30d</span>
            <span className={styles.hotelStatValue} style={{ color: avgScore !== null ? scoreColor(avgScore) : 'var(--text3)' }}>
              {avgScore !== null ? avgScore.toFixed(1) : '—'}
            </span>
          </div>
          <div className={styles.hotelStatItem}>
            <span className={styles.hotelStatLabel}>Trend</span>
            <span className={styles.hotelStatValue}><TrendIcon trend={trend} /></span>
          </div>
          <div className={styles.hotelStatItem}>
            <span className={styles.hotelStatLabel}>Entries</span>
            <span className={styles.hotelStatValue}>{totalEntries}</span>
          </div>
        </div>
      )}

      {lastDate && (
        <div className={styles.hotelCardFooter}>
          <Icon name="calendar" size={11} color="var(--text3)" />
          Last logged {new Date(lastDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
      )}

      {needsImprovement && (
        <div className={styles.needsImprovementBadge}>⚠ Needs Improvement</div>
      )}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function ReputationDashboard() {
  const { user } = useAuth()
  const [hotels, setHotels] = useState([])
  const [scores, setScores] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/hotels', { params: { category: 'reputation' } }),
      api.get('/hotel-scores'),
    ])
      .then(([h, s]) => {
        setHotels(h.data)
        setScores(s.data)
      })
      .catch(err => console.error('Failed to load reputation data:', err))
      .finally(() => setLoading(false))
  }, [])

  // Per-hotel aggregated stats
  const hotelStats = useMemo(() => {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    return hotels.map(hotel => {
      const hotelScores = scores
        .filter(s => {
          const id = s.hotel?._id || s.hotel
          return String(id) === String(hotel._id)
        })
        .sort((a, b) => new Date(b.date) - new Date(a.date))

      const latestScore = hotelScores.length > 0 ? hotelScores[0].score : null
      const prevScore   = hotelScores.length > 1 ? hotelScores[1].score : null

      const recentScores = hotelScores.filter(s => new Date(s.date) >= thirtyDaysAgo)
      const avgScore = recentScores.length > 0
        ? recentScores.reduce((sum, s) => sum + s.score, 0) / recentScores.length
        : null

      const trend = latestScore !== null && prevScore !== null
        ? latestScore > prevScore ? 'up' : latestScore < prevScore ? 'down' : 'stable'
        : 'none'

      return {
        hotel,
        latestScore,
        prevScore,
        avgScore,
        trend,
        totalEntries: hotelScores.length,
        lastDate: hotelScores[0]?.date ?? null,
        needsImprovement: latestScore !== null && latestScore < 50,
      }
    })
  }, [hotels, scores])

  // Summary stats
  const tracked          = hotelStats.filter(h => h.latestScore !== null)
  const fleetAvg         = tracked.length > 0
    ? (tracked.reduce((sum, h) => sum + h.latestScore, 0) / tracked.length)
    : null
  const needsImpCount    = hotelStats.filter(h => h.needsImprovement).length
  const topPerformerCount = hotelStats.filter(h => h.latestScore !== null && h.latestScore >= 80).length

  const hr = new Date().getHours()
  const greeting = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening'

  const recentScores = [...scores]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 8)

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Reputation Dashboard</h1>
          <p className={styles.subtitle}>{greeting}, {user?.name} · Hotel performance overview</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className={styles.statsGrid}>
        <StatCard
          icon="building" iconColor="var(--accent)" iconBg="var(--accent-soft)"
          accentColor="var(--accent)"
          value={hotels.length} label="Total Hotels"
        />
        <StatCard
          icon="star" iconColor="var(--blue)" iconBg="var(--blue-soft)"
          accentColor="var(--blue)"
          value={fleetAvg !== null ? fleetAvg.toFixed(1) : '—'} label="Fleet Avg Score"
        />
        <StatCard
          icon="check" iconColor="var(--green)" iconBg="var(--green-soft)"
          accentColor="var(--green)"
          value={topPerformerCount} label="Top Performers ≥80"
        />
        <StatCard
          icon="bell" iconColor="var(--red, #ef4444)" iconBg="rgba(239,68,68,0.1)"
          accentColor="var(--red, #ef4444)"
          value={needsImpCount} label="Need Improvement"
        />
      </div>

      {/* Hotels needing improvement */}
      {!loading && needsImpCount > 0 && (
        <div className={styles.alertSection}>
          <div className={styles.alertTitle}>
            <Icon name="bell" size={14} color="var(--red, #ef4444)" />
            Hotels Needing Immediate Attention
          </div>
          <div className={styles.alertGrid}>
            {hotelStats.filter(h => h.needsImprovement).map(({ hotel, latestScore }) => (
              <div key={hotel._id} className={styles.alertCard}>
                <div>
                  <div className={styles.alertHotelName}>{hotel.name}</div>
                  <div className={styles.alertHotelCity}>{hotel.city}</div>
                </div>
                <ScoreBadge score={latestScore} size={46} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All hotel cards */}
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>All Hotels</span>
        <span className={styles.sectionSub}>{hotels.length} hotel{hotels.length !== 1 ? 's' : ''} tracked</span>
      </div>
      <div className={styles.hotelGrid}>
        {loading ? (
          <p style={{ color: 'var(--text3)', fontSize: 13 }}>Loading...</p>
        ) : hotels.length === 0 ? (
          <p style={{ color: 'var(--text3)', fontSize: 13 }}>
            No reputation hotels added yet. Add them in Admin → Settings → Reputation Hotels.
          </p>
        ) : (
          hotelStats.map(stat => (
            <HotelCard key={stat.hotel._id} {...stat} />
          ))
        )}
      </div>

      {/* Recent score entries */}
      <div className={styles.recentSection}>
        <div className={styles.recentHeader}>Recent Score Entries</div>
        {recentScores.length === 0 ? (
          <div className={styles.emptyState}>No scores logged yet.</div>
        ) : (
          recentScores.map(s => (
            <div key={s._id} className={styles.recentItem}>
              <ScoreBadge score={s.score} size={38} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className={styles.recentHotel}>{s.hotel?.name}</div>
                <div className={styles.recentMeta}>
                  {new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  {s.notes && <span> · {s.notes.length > 70 ? s.notes.slice(0, 70) + '…' : s.notes}</span>}
                </div>
              </div>
              <div className={styles.recentBy}>by {s.createdBy?.name}</div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
