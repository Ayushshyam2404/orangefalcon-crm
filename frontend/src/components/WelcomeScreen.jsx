import { useEffect, useLayoutEffect, useState, useMemo } from 'react'
import styles from './WelcomeScreen.module.css'

function useStars(count) {
  return useMemo(() => Array.from({ length: count }, (_, i) => ({
    id: i,
    top:  `${(i * 137.508) % 100}%`,
    left: `${(i * 97.3) % 100}%`,
    size: i % 7 === 0 ? 2.5 : i % 3 === 0 ? 1.5 : 1,
    delay: `${(i * 0.09) % 5}s`,
    dur:   `${2.5 + (i % 5) * 0.6}s`,
    warm:  i % 4 === 0,
  })), [count])
}

export default function WelcomeScreen({ companyName, logo, onDone }) {
  const [phase, setPhase] = useState('dark')
  const stars = useStars(140)

  useLayoutEffect(() => {
    const raf = requestAnimationFrame(() => setPhase('rise'))
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('hold'), 900)
    const t2 = setTimeout(() => setPhase('fall'), 4000)
    const t3 = setTimeout(() => onDone(),         5200)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [onDone])

  return (
    <div className={`${styles.scene} ${styles[phase]}`}>

      {/* Grid overlay */}
      <div className={styles.grid} />

      {/* Stars */}
      <div className={styles.stars} aria-hidden>
        {stars.map(s => (
          <span key={s.id} className={`${styles.star} ${s.warm ? styles.starWarm : ''}`}
            style={{ top: s.top, left: s.left, '--sz': `${s.size}px`, '--delay': s.delay, '--dur': s.dur }} />
        ))}
      </div>

      {/* Glow orbs */}
      <div className={styles.orb1} />
      <div className={styles.orb2} />
      <div className={styles.orb3} />

      {/* Card */}
      <div className={styles.card}>
        {/* Accent strip */}
        <div className={styles.strip} />

        {/* Logo */}
        <div className={styles.logoWrap}>
          <div className={styles.logoRing} />
          <div className={styles.logoRing2} />
          {logo
            ? <img src={logo} alt="logo" className={styles.logoImg} />
            : (
              <div className={styles.logoFallback}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
                  <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
                </svg>
              </div>
            )
          }
        </div>

        <p className={styles.eyebrow}>Welcome to</p>
        <h1 className={styles.title}>{companyName || 'Orange Falcon'}</h1>
        <p className={styles.sub}>CRM Platform</p>

        <div className={styles.barWrap}>
          <div className={styles.bar} />
        </div>
      </div>

    </div>
  )
}
