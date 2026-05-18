import { useState, useEffect, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, Legend, Cell,
  ReferenceLine,
} from 'recharts'
import api from '../utils/api'
import styles from './RevenueAnalytics.module.css'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const CHART_COLORS = [
  '#ff6b00', '#3b82f6', '#10b981', '#8b5cf6',
  '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16', '#6366f1',
]

const GRAD_PAIRS = [
  ['#ff6b00', '#ff9a50'],
  ['#3b82f6', '#60a5fa'],
  ['#10b981', '#34d399'],
  ['#8b5cf6', '#a78bfa'],
  ['#f59e0b', '#fcd34d'],
  ['#ef4444', '#f87171'],
  ['#06b6d4', '#22d3ee'],
  ['#ec4899', '#f472b6'],
  ['#84cc16', '#a3e635'],
  ['#6366f1', '#818cf8'],
]

function fmtRevenue(n) {
  if (!n && n !== 0) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
  return `$${Math.round(n).toLocaleString()}`
}

function fmtAxis(n) {
  if (!n) return '$0'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}

function StatCard({ label, value, sub, color, icon }) {
  return (
    <div className={styles.statCard} style={{ '--cc': color }}>
      <div className={styles.statIconWrap} style={{ background: `${color}22` }}>
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" style={{ color }}>
          {icon}
        </svg>
      </div>
      <div className={styles.statBody}>
        <div className={styles.statLabel}>{label}</div>
        <div className={styles.statValue}>{value}</div>
        {sub && <div className={styles.statSub}>{sub}</div>}
      </div>
    </div>
  )
}

function RichTooltip({ active, payload, label, currency, total }) {
  if (!active || !payload?.length) return null
  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipTitle}>{label}</div>
      {payload.map((entry) => {
        const pct = total && entry.value ? ((entry.value / total) * 100).toFixed(1) : null
        return (
          <div key={entry.dataKey} className={styles.tooltipRow}>
            <span className={styles.tooltipDot} style={{ background: entry.color }} />
            <span className={styles.tooltipName}>{entry.name}</span>
            <span className={styles.tooltipVal}>
              {currency ? fmtRevenue(entry.value) : (entry.value ?? 0).toLocaleString()}
            </span>
            {pct && <span className={styles.tooltipPct}>{pct}%</span>}
          </div>
        )
      })}
    </div>
  )
}

function SectionHead({ title, sub, badge }) {
  return (
    <div className={styles.sectionHead}>
      <div>
        <div className={styles.sectionTitle}>{title}</div>
        {sub && <div className={styles.sectionSub}>{sub}</div>}
      </div>
      {badge && <span className={styles.sectionBadge}>{badge}</span>}
    </div>
  )
}

export default function RevenueAnalytics() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [period, setPeriod] = useState('all')
  const [selYear, setSelYear] = useState(new Date().getFullYear())
  const [selMonth, setSelMonth] = useState(new Date().getMonth() + 1)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const params = {}
        if (period === 'year') params.year = selYear
        if (period === 'month') { params.year = selYear; params.month = selMonth }
        const res = await api.get('/groups/revenue-analytics', { params })
        setData(res.data)
      } catch (err) {
        console.error('Revenue analytics fetch error:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [period, selYear, selMonth])

  const totals = useMemo(() => {
    if (!data?.propertyStats) return { revenue: 0, groups: 0, roomNights: 0, properties: 0 }
    return data.propertyStats.reduce(
      (acc, p) => ({
        revenue: acc.revenue + (p.totalRevenue || 0),
        groups: acc.groups + (p.totalGroups || 0),
        roomNights: acc.roomNights + (p.totalRoomNights || 0),
        properties: acc.properties + 1,
      }),
      { revenue: 0, groups: 0, roomNights: 0, properties: 0 }
    )
  }, [data])

  const avgRevenue = useMemo(() => {
    if (!data?.propertyStats?.length) return 0
    return Math.round(totals.revenue / data.propertyStats.length)
  }, [data, totals])

  const barData = useMemo(() => {
    if (!data?.propertyStats) return []
    return [...data.propertyStats]
      .sort((a, b) => (b.totalRevenue || 0) - (a.totalRevenue || 0))
      .map((p) => ({
        name: p.hotelName,
        Revenue: Math.round(p.totalRevenue || 0),
        Groups: p.totalGroups || 0,
        'Room Nights': p.totalRoomNights || 0,
      }))
  }, [data])

  const { trendData, hotelNames } = useMemo(() => {
    if (!data?.trend?.length) return { trendData: [], hotelNames: [] }
    const names = data.propertyStats?.map((p) => p.hotelName) || []
    if (period === 'month') return { trendData: [], hotelNames: names }

    const map = {}
    data.trend.forEach((t) => {
      const key = period === 'year'
        ? MONTHS[t.month - 1]
        : `${MONTHS[t.month - 1]} '${String(t.year).slice(2)}`

      if (!map[key]) {
        map[key] = { period: key }
        names.forEach((h) => (map[key][h] = 0))
      }
      map[key][t.hotelName] = (map[key][t.hotelName] || 0) + Math.round(t.totalRevenue || 0)
    })

    let entries = Object.values(map)
    if (period === 'year') {
      entries.sort((a, b) => MONTHS.indexOf(a.period) - MONTHS.indexOf(b.period))
    } else {
      entries.sort((a, b) => {
        const parse = (s) => {
          const parts = s.split(' ')
          return parseInt(`20${parts[1]?.replace("'", '')}`) * 12 + MONTHS.indexOf(parts[0])
        }
        return parse(a.period) - parse(b.period)
      })
    }
    return { trendData: entries, hotelNames: names }
  }, [data, period])

  const availableYears = data?.availableYears || []
  const topProperty = data?.propertyStats?.[0]

  const periodLabel = period === 'month'
    ? `${MONTHS[selMonth - 1]} ${selYear}`
    : period === 'year' ? `${selYear}` : 'All Time'

  return (
    <div className={styles.page}>

      {/* ── Page Header ────────────────────────────── */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div className={styles.pageIconWrap}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="2" y="12" width="3" height="6" rx="1" stroke="#ff6b00" strokeWidth="1.5" fill="none" />
              <rect x="7" y="7" width="3" height="11" rx="1" stroke="#ff6b00" strokeWidth="1.5" fill="none" />
              <rect x="12" y="4" width="3" height="14" rx="1" stroke="#ff6b00" strokeWidth="1.5" fill="none" />
              <rect x="17" y="9" width="3" height="9" rx="1" stroke="#ff6b00" strokeWidth="1.5" fill="none" />
            </svg>
          </div>
          <div>
            <h1 className={styles.pageTitle}>Revenue Analytics</h1>
            <p className={styles.pageSubtitle}>
              Property-wise group revenue performance &middot; {periodLabel}
            </p>
          </div>
        </div>

        <div className={styles.filterGroup}>
          <div className={styles.periodToggle}>
            {[
              { key: 'all', label: 'All Time' },
              { key: 'year', label: 'By Year' },
              { key: 'month', label: 'By Month' },
            ].map(({ key, label }) => (
              <button
                key={key}
                className={`${styles.periodBtn} ${period === key ? styles.periodBtnActive : ''}`}
                onClick={() => setPeriod(key)}
              >
                {label}
              </button>
            ))}
          </div>

          {(period === 'year' || period === 'month') && (
            <select
              className={styles.filterSelect}
              value={selYear}
              onChange={(e) => setSelYear(parseInt(e.target.value))}
            >
              {(availableYears.length ? availableYears : [selYear]).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          )}

          {period === 'month' && (
            <select
              className={styles.filterSelect}
              value={selMonth}
              onChange={(e) => setSelMonth(parseInt(e.target.value))}
            >
              {MONTHS.map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {loading ? (
        <div className={styles.loading}>
          <div className={styles.loadingRing} />
          <span>Crunching your numbers&hellip;</span>
        </div>
      ) : (
        <>
          {/* ── KPI Cards ───────────────────────────── */}
          <div className={styles.kpiGrid}>
            <StatCard
              label="Total Revenue"
              value={fmtRevenue(totals.revenue)}
              sub={`from ${totals.groups} groups`}
              color="#ff6b00"
              icon={
                <path
                  d="M10 2v16M6 5.5a4 4 0 018 0c0 2-2 3-4 3s-4 1-4 3a4 4 0 008 0"
                  stroke="currentColor" strokeWidth="1.5" fill="none"
                />
              }
            />
            <StatCard
              label="Total Groups"
              value={totals.groups.toLocaleString()}
              sub={`${totals.properties} propert${totals.properties === 1 ? 'y' : 'ies'}`}
              color="#3b82f6"
              icon={
                <>
                  <circle cx="8" cy="7" r="3" stroke="currentColor" strokeWidth="1.5" fill="none" />
                  <path d="M2 17c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="currentColor" strokeWidth="1.5" fill="none" />
                  <path d="M14 5c1.657 0 3 1.343 3 3s-1.343 3-3 3M18 17c0-2.21-1.343-4-4-4" stroke="currentColor" strokeWidth="1.5" fill="none" />
                </>
              }
            />
            <StatCard
              label="Total Room Nights"
              value={totals.roomNights.toLocaleString()}
              sub="across all properties"
              color="#10b981"
              icon={
                <>
                  <rect x="2" y="3" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
                  <path d="M2 8h16M6 2v3M14 2v3" stroke="currentColor" strokeWidth="1.5" fill="none" />
                  <circle cx="7" cy="13" r="1" fill="currentColor" />
                  <circle cx="10" cy="13" r="1" fill="currentColor" />
                  <circle cx="13" cy="13" r="1" fill="currentColor" />
                </>
              }
            />
            <StatCard
              label="Avg Revenue / Property"
              value={fmtRevenue(avgRevenue)}
              sub={topProperty ? `Top: ${topProperty.hotelName}` : 'No data'}
              color="#8b5cf6"
              icon={
                <path
                  d="M10 2L12.4 7.2L18 8.1l-4 3.9 1 5.5L10 15l-5 2.5 1-5.5L2 8.1l5.6-.9L10 2z"
                  stroke="currentColor" strokeWidth="1.5" fill="none"
                />
              }
            />
          </div>

          {/* ── Revenue by Property ──────────────────── */}
          {barData.length > 0 && (
            <div className={styles.card}>
              <SectionHead
                title="Revenue by Property"
                sub={`Total group revenue per hotel · ${periodLabel}`}
                badge={`${barData.length} properties`}
              />
              <ResponsiveContainer width="100%" height={340}>
                <BarChart data={barData} margin={{ top: 16, right: 24, left: 8, bottom: 80 }} barCategoryGap="28%">
                  <defs>
                    {barData.map((_, i) => (
                      <linearGradient key={i} id={`revGrad${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={GRAD_PAIRS[i % GRAD_PAIRS.length][1]} stopOpacity={1} />
                        <stop offset="100%" stopColor={GRAD_PAIRS[i % GRAD_PAIRS.length][0]} stopOpacity={0.85} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: 'var(--text2)', fontSize: 11, fontWeight: 500 }}
                    angle={-35}
                    textAnchor="end"
                    interval={0}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: 'var(--text3)', fontSize: 11 }}
                    tickFormatter={fmtAxis}
                    width={68}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    content={(props) => <RichTooltip {...props} currency total={totals.revenue} />}
                    cursor={{ fill: 'rgba(255,255,255,0.03)', radius: 4 }}
                  />
                  {avgRevenue > 0 && (
                    <ReferenceLine
                      y={avgRevenue}
                      stroke="rgba(255,255,255,0.2)"
                      strokeDasharray="6 3"
                      label={{
                        value: `Avg ${fmtAxis(avgRevenue)}`,
                        fill: 'var(--text3)',
                        fontSize: 11,
                        position: 'insideTopRight',
                      }}
                    />
                  )}
                  <Bar dataKey="Revenue" radius={[6, 6, 0, 0]} maxBarSize={56}>
                    {barData.map((_, i) => (
                      <Cell key={i} fill={`url(#revGrad${i})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── Revenue Trend — Area Chart ──────────── */}
          {trendData.length > 1 && (
            <div className={styles.card}>
              <SectionHead
                title={period === 'year' ? `Monthly Revenue Trend — ${selYear}` : 'Revenue Trend Over Time'}
                sub="Per-property revenue breakdown across periods"
              />
              <ResponsiveContainer width="100%" height={340}>
                <AreaChart data={trendData} margin={{ top: 16, right: 24, left: 8, bottom: 10 }}>
                  <defs>
                    {hotelNames.map((h, i) => (
                      <linearGradient key={h} id={`areaGrad${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0.02} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis
                    dataKey="period"
                    tick={{ fill: 'var(--text2)', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: 'var(--text3)', fontSize: 11 }}
                    tickFormatter={fmtAxis}
                    width={68}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    content={(props) => <RichTooltip {...props} currency />}
                    cursor={{ stroke: 'rgba(255,255,255,0.12)', strokeWidth: 1 }}
                  />
                  <Legend
                    wrapperStyle={{ color: 'var(--text2)', fontSize: 12, paddingTop: 16 }}
                    iconType="circle"
                    iconSize={8}
                  />
                  {hotelNames.map((h, i) => (
                    <Area
                      key={h}
                      type="monotone"
                      dataKey={h}
                      stroke={CHART_COLORS[i % CHART_COLORS.length]}
                      strokeWidth={2}
                      fill={`url(#areaGrad${i})`}
                      dot={false}
                      activeDot={{ r: 5, strokeWidth: 0 }}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── Two-column: Groups + Room Nights ─────── */}
          {barData.length > 0 && (
            <div className={styles.twoCol}>
              <div className={styles.card}>
                <SectionHead title="Groups per Property" sub={periodLabel} />
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={barData} margin={{ top: 12, right: 16, left: 8, bottom: 70 }} barCategoryGap="30%">
                    <defs>
                      <linearGradient id="grpGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#60a5fa" stopOpacity={1} />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.7} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: 'var(--text2)', fontSize: 10 }}
                      angle={-35}
                      textAnchor="end"
                      interval={0}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: 'var(--text3)', fontSize: 11 }}
                      allowDecimals={false}
                      width={32}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      content={(props) => <RichTooltip {...props} />}
                      cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                    />
                    <Bar dataKey="Groups" fill="url(#grpGrad)" radius={[5, 5, 0, 0]} maxBarSize={48} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className={styles.card}>
                <SectionHead title="Room Nights per Property" sub={periodLabel} />
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={barData} margin={{ top: 12, right: 16, left: 8, bottom: 70 }} barCategoryGap="30%">
                    <defs>
                      <linearGradient id="rnGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#34d399" stopOpacity={1} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0.7} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: 'var(--text2)', fontSize: 10 }}
                      angle={-35}
                      textAnchor="end"
                      interval={0}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: 'var(--text3)', fontSize: 11 }}
                      tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}K` : v}
                      width={42}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      content={(props) => <RichTooltip {...props} />}
                      cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                    />
                    <Bar dataKey="Room Nights" fill="url(#rnGrad)" radius={[5, 5, 0, 0]} maxBarSize={48} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ── Property Breakdown Table ─────────────── */}
          {data?.propertyStats?.length > 0 && (
            <div className={styles.card}>
              <SectionHead
                title="Property Breakdown"
                sub={`Detailed metrics per hotel · ${periodLabel}`}
                badge={`${data.propertyStats.length} total`}
              />
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>#</th>
                      <th>Property</th>
                      <th className={styles.right}>Groups</th>
                      <th className={styles.right}>Room Nights</th>
                      <th className={styles.right}>Avg Rate / Night</th>
                      <th className={styles.right}>Total Revenue</th>
                      <th style={{ minWidth: 180 }}>Revenue Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.propertyStats.map((p, i) => {
                      const share = totals.revenue > 0
                        ? ((p.totalRevenue / totals.revenue) * 100).toFixed(1)
                        : '0.0'
                      const isTop = i === 0
                      return (
                        <tr key={p.hotelId || i} className={isTop ? styles.topRow : ''}>
                          <td>
                            <span className={`${styles.rank} ${i < 3 ? styles[`rank${i + 1}`] : ''}`}>
                              {i + 1}
                            </span>
                          </td>
                          <td>
                            <div className={styles.propCell}>
                              <span
                                className={styles.propSwatch}
                                style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                              />
                              <div>
                                <div className={styles.propName}>
                                  {p.hotelName}
                                  {isTop && <span className={styles.topBadge}>Top</span>}
                                </div>
                                {p.hotelCity && <div className={styles.propCity}>{p.hotelCity}</div>}
                              </div>
                            </div>
                          </td>
                          <td className={styles.right}>
                            <span className={styles.numChip}>{p.totalGroups}</span>
                          </td>
                          <td className={styles.right}>{(p.totalRoomNights || 0).toLocaleString()}</td>
                          <td className={styles.right}>
                            {p.avgRate ? <span className={styles.rateChip}>${p.avgRate}</span> : '—'}
                          </td>
                          <td className={`${styles.right} ${styles.revenueVal}`}>
                            {fmtRevenue(p.totalRevenue)}
                          </td>
                          <td>
                            <div className={styles.shareRow}>
                              <div className={styles.shareTrack}>
                                <div
                                  className={styles.shareFill}
                                  style={{
                                    width: `${share}%`,
                                    background: `linear-gradient(90deg, ${CHART_COLORS[i % CHART_COLORS.length]}bb, ${CHART_COLORS[i % CHART_COLORS.length]})`,
                                  }}
                                />
                              </div>
                              <span className={styles.sharePct}>{share}%</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className={styles.totalRow}>
                      <td />
                      <td><strong>Total</strong></td>
                      <td className={styles.right}><strong>{totals.groups}</strong></td>
                      <td className={styles.right}><strong>{totals.roomNights.toLocaleString()}</strong></td>
                      <td className={styles.right} />
                      <td className={`${styles.right} ${styles.revenueVal}`}>
                        <strong>{fmtRevenue(totals.revenue)}</strong>
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {(!data || data.propertyStats?.length === 0) && (
            <div className={styles.empty}>
              <svg width="48" height="48" viewBox="0 0 20 20" fill="none" style={{ marginBottom: 14, opacity: 0.25 }}>
                <rect x="2" y="12" width="3" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" />
                <rect x="7" y="7" width="3" height="11" rx="1" stroke="currentColor" strokeWidth="1.2" />
                <rect x="12" y="4" width="3" height="14" rx="1" stroke="currentColor" strokeWidth="1.2" />
                <rect x="17" y="9" width="3" height="9" rx="1" stroke="currentColor" strokeWidth="1.2" />
              </svg>
              No revenue data found for the selected period.
            </div>
          )}
        </>
      )}
    </div>
  )
}
