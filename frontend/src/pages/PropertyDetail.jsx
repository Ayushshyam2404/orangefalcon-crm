import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { Badge, statusColor } from '../components/Badge'
import api from '../utils/api'
import styles from './PropertyDetail.module.css'

function fmtMoney(n) {
  if (!n && n !== 0) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
  return `$${Math.round(n).toLocaleString()}`
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function scoreColor(n) {
  return n >= 80 ? 'var(--green)' : n >= 50 ? 'var(--accent)' : 'var(--red)'
}

function StatCard({ label, value, icon, color }) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statIcon} style={{ background: `${color}22`, color }}>
        <Icon name={icon} size={16} />
      </div>
      <div>
        <div className={styles.statValue}>{value}</div>
        <div className={styles.statLabel}>{label}</div>
      </div>
    </div>
  )
}

export default function PropertyDetail() {
  const [searchParams] = useSearchParams()
  const name = searchParams.get('name') || ''
  const navigate = useNavigate()

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!name) return
    setLoading(true)
    setError('')
    api.get('/properties/detail', { params: { name } })
      .then(({ data }) => setData(data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load property'))
      .finally(() => setLoading(false))
  }, [name])

  if (loading) {
    return <div className={styles.loading}>Loading property…</div>
  }

  if (error || !data) {
    return (
      <div className={styles.empty}>
        <p>{error || 'Property not found.'}</p>
        <Link to="/properties" className={styles.backLink}>← Back to Manage Properties</Link>
      </div>
    )
  }

  const { sales, reputation } = data

  return (
    <div>
      <button className={styles.backBtn} onClick={() => navigate('/properties')}>
        ← Back to Manage Properties
      </button>

      {/* ── Hero ─────────────────────────────────────── */}
      <div className={styles.hero}>
        {data.photo
          ? <img src={data.photo} alt={data.name} className={styles.heroPhoto} />
          : (
            <div className={styles.heroNoPhoto}>
              <Icon name="building" size={32} color="var(--text3)" />
              <span>No property photo available</span>
            </div>
          )
        }
        <div className={styles.heroOverlay} />
        <div className={styles.heroContent}>
          <div className={styles.heroTags}>
            {data.hasSales && <span className={`${styles.tag} ${styles.tagSales}`}>Sales</span>}
            {data.hasReputation && <span className={`${styles.tag} ${styles.tagRep}`}>Reputation</span>}
          </div>
          <h1 className={styles.heroName}>{data.name}</h1>
          {data.city && <div className={styles.heroCity}><Icon name="building" size={13} /> {data.city}</div>}
        </div>
      </div>

      {!sales && !reputation && (
        <div className={styles.empty}><p>No activity logged for this property yet.</p></div>
      )}

      {/* ── Sales snapshot ───────────────────────────── */}
      {sales && (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <Icon name="barChart" size={16} color="var(--accent)" />
            <h2>Sales Performance</h2>
          </div>

          <div className={styles.statGrid}>
            <StatCard label="Total RFPs" value={sales.totalRFPs} icon="doc" color="var(--accent)" />
            <StatCard label="Won Revenue" value={fmtMoney(sales.wonRevenue)} icon="dollar" color="var(--green)" />
            <StatCard label="Groups Booked" value={sales.totalGroups} icon="users" color="var(--blue)" />
            <StatCard label="Group Revenue" value={fmtMoney(sales.totalGroupRevenue)} icon="dollar" color="var(--green)" />
            <StatCard label="Room Nights" value={sales.totalRoomNights.toLocaleString()} icon="calendar" color="var(--purple)" />
            <StatCard label="Total Calls" value={sales.totalCalls} icon="phone" color="var(--blue)" />
          </div>

          {Object.keys(sales.rfpsByStatus).length > 0 && (
            <div className={styles.chipRow}>
              <span className={styles.chipRowLabel}>RFPs by status</span>
              {Object.entries(sales.rfpsByStatus).map(([status, count]) => (
                <span key={status} className={styles.statusChip} style={{ '--c': statusColor(status) }}>
                  {status} <strong>{count}</strong>
                </span>
              ))}
            </div>
          )}

          {Object.keys(sales.callsByOutcome).length > 0 && (
            <div className={styles.chipRow}>
              <span className={styles.chipRowLabel}>Calls by outcome</span>
              {Object.entries(sales.callsByOutcome).map(([outcome, count]) => (
                <span key={outcome} className={styles.statusChip} style={{ '--c': statusColor(outcome) }}>
                  {outcome} <strong>{count}</strong>
                </span>
              ))}
            </div>
          )}

          {sales.recentRfps.length > 0 && (
            <div className={styles.subSection}>
              <h3>Recent RFPs</h3>
              <div className={styles.miniList}>
                {sales.recentRfps.map((r) => (
                  <div key={r._id} className={styles.miniRow}>
                    <div className={styles.miniRowMain}>
                      <span className={styles.miniRowName}>{r.client}</span>
                      <span className={styles.miniRowSub}>{r.checkin || '—'}{r.checkout ? ` → ${r.checkout}` : ''}</span>
                    </div>
                    <div className={styles.miniRowEnd}>
                      {r.price != null && <span className={styles.miniRowPrice}>${Number(r.price).toLocaleString()}</span>}
                      <Badge label={r.status} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {sales.recentGroups.length > 0 && (
            <div className={styles.subSection}>
              <h3>Recent Groups</h3>
              <div className={styles.miniList}>
                {sales.recentGroups.map((g) => (
                  <div key={g._id} className={styles.miniRow}>
                    <div className={styles.miniRowMain}>
                      <span className={styles.miniRowName}>{g.groupName}</span>
                      <span className={styles.miniRowSub}>
                        {fmtDate(g.checkIn)} → {fmtDate(g.checkOut)} · {g.numRooms || '—'} rooms
                      </span>
                    </div>
                    <div className={styles.miniRowEnd}>
                      <span className={styles.typeTag} style={{ background: g.type === 'guaranteed' ? '#ff6b6b' : '#51cf66' }}>{g.type}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── Reputation snapshot ──────────────────────── */}
      {reputation && (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <Icon name="star" size={16} color="#8b5cf6" />
            <h2>Reputation Performance</h2>
          </div>

          <div className={styles.statGrid}>
            <StatCard
              label="Average Score"
              value={reputation.avgScore != null ? reputation.avgScore : '—'}
              icon="trophy"
              color={reputation.avgScore != null ? scoreColor(reputation.avgScore) : 'var(--text3)'}
            />
            <StatCard
              label="Latest Score"
              value={reputation.latestScore != null ? reputation.latestScore : '—'}
              icon="star"
              color={reputation.latestScore != null ? scoreColor(reputation.latestScore) : 'var(--text3)'}
            />
            <StatCard label="Entries Logged" value={reputation.totalEntries} icon="clipboard" color="var(--blue)" />
          </div>

          {reputation.recentScores.length > 0 && (
            <div className={styles.subSection}>
              <h3>Recent Score Entries</h3>
              <div className={styles.miniList}>
                {reputation.recentScores.map((s) => (
                  <div key={s._id} className={styles.miniRow}>
                    <div className={styles.miniRowMain}>
                      <span className={styles.miniRowName}>{fmtDate(s.date)}</span>
                      {s.notes && <span className={styles.miniRowSub}>{s.notes}</span>}
                    </div>
                    <div className={styles.miniRowEnd}>
                      <span className={styles.scoreDot} style={{ '--c': scoreColor(s.score) }}>{s.score}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
