import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import api from '../utils/api'
import styles from './Properties.module.css'

export default function Properties() {
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/properties')
      .then(({ data }) => setProperties(data))
      .finally(() => setLoading(false))
  }, [])

  const filtered = properties.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.city || '').toLowerCase().includes(search.toLowerCase())
  )

  const openProperty = (name) => navigate(`/properties/view?name=${encodeURIComponent(name)}`)

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Manage Properties</h1>
          <p className={styles.pageSubtitle}>Every hotel across Sales &amp; Reputation, in one place — click a property for its full snapshot</p>
        </div>
      </div>

      <div className={styles.searchWrap}>
        <Icon name="search" size={13} color="var(--text3)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
        <input
          className={styles.searchInput}
          placeholder="Search properties..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className={styles.empty}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}><Icon name="building" size={22} color="var(--text3)" /></div>
          <p>{properties.length === 0 ? 'No properties yet — add a hotel to get started.' : 'No properties match your search.'}</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {filtered.map((p) => (
            <button key={p.name.toLowerCase()} className={styles.card} onClick={() => openProperty(p.name)}>
              <div className={styles.photoWrap}>
                {p.photo
                  ? <img src={p.photo} alt={p.name} className={styles.photo} />
                  : (
                    <div className={styles.noPhoto}>
                      <Icon name="building" size={26} color="var(--text3)" />
                      <span>No property photo available</span>
                    </div>
                  )
                }
                <div className={styles.badges}>
                  {p.hasSales && <span className={`${styles.tag} ${styles.tagSales}`}>Sales</span>}
                  {p.hasReputation && <span className={`${styles.tag} ${styles.tagRep}`}>Reputation</span>}
                </div>
              </div>
              <div className={styles.cardBody}>
                <div className={styles.cardName}>{p.name}</div>
                {p.city && <div className={styles.cardCity}>{p.city}</div>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
