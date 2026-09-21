import { useState, useRef } from 'react'
import api from '../utils/api'
import { useAuth } from '../context/AuthContext'
import { Button } from '../components/Button'
import { Icon } from '../components/Icon'
import styles from './Profile.module.css'
import settingsStyles from './Settings.module.css'

function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark')
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('theme', next)
    document.documentElement.setAttribute('data-theme', next)
  }
  return { theme, toggle }
}

const GENDER_OPTIONS = [
  { value: '', label: 'Prefer not to say' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
]

// Resize image to max 256×256 and return base64
function resizeImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const MAX = 256
        const scale = Math.min(MAX / img.width, MAX / img.height, 1)
        const canvas = document.createElement('canvas')
        canvas.width = img.width * scale
        canvas.height = img.height * scale
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

// Resize a wallpaper for fast loading and calculate whether dark or light UI
// text will have the best contrast against it.
function prepareWallpaper(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('Please choose an image file.'))
    if (file.size > 12 * 1024 * 1024) return reject(new Error('Please choose an image under 12 MB.'))
    const reader = new FileReader()
    reader.onload = event => {
      const img = new Image()
      img.onload = () => {
        const MAX_WIDTH = 1800
        const MAX_HEIGHT = 1200
        const scale = Math.min(MAX_WIDTH / img.width, MAX_HEIGHT / img.height, 1)
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(img.width * scale))
        canvas.height = Math.max(1, Math.round(img.height * scale))
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#111318'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

        const sample = document.createElement('canvas')
        sample.width = 48
        sample.height = 48
        const sampleCtx = sample.getContext('2d')
        sampleCtx.drawImage(canvas, 0, 0, 48, 48)
        const pixels = sampleCtx.getImageData(0, 0, 48, 48).data
        let luminance = 0
        for (let index = 0; index < pixels.length; index += 4) {
          luminance += (0.2126 * pixels[index] + 0.7152 * pixels[index + 1] + 0.0722 * pixels[index + 2]) / 255
        }
        luminance /= pixels.length / 4
        resolve({
          image: canvas.toDataURL('image/jpeg', 0.8),
          tone: luminance > 0.56 ? 'light' : 'dark',
        })
      }
      img.onerror = () => reject(new Error('Could not read that image.'))
      img.src = event.target.result
    }
    reader.onerror = () => reject(new Error('Could not read that image.'))
    reader.readAsDataURL(file)
  })
}

export default function Profile() {
  const { user, refreshUser } = useAuth()
  const fileRef = useRef()
  const wallpaperRef = useRef()
  const { theme, toggle: toggleTheme } = useTheme()

  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    bio: user?.bio || '',
    gender: user?.gender || '',
    age: user?.age || '',
    avatar: user?.avatar || '',
  })
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [saving, setSaving] = useState(false)
  const [savingPw, setSavingPw] = useState(false)
  const [savingWallpaper, setSavingWallpaper] = useState(false)
  const [wallpaper, setWallpaper] = useState(user?.wallpaper || '')
  const [wallpaperTone, setWallpaperTone] = useState(user?.wallpaperTone || 'dark')
  const [toast, setToast] = useState(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const setPw = (k, v) => setPwForm(f => ({ ...f, [k]: v }))

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const handleAvatarClick = () => fileRef.current.click()

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const base64 = await resizeImage(file)
    set('avatar', base64)
    e.target.value = ''
  }

  const handleRemoveAvatar = () => set('avatar', '')

  const handleWallpaperChange = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const prepared = await prepareWallpaper(file)
      setWallpaper(prepared.image)
      setWallpaperTone(prepared.tone)
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      event.target.value = ''
    }
  }

  const handleSaveWallpaper = async () => {
    setSavingWallpaper(true)
    try {
      await api.put('/auth/profile', { wallpaper, wallpaperTone })
      await refreshUser()
      showToast(wallpaper ? 'Wallpaper applied!' : 'Wallpaper removed!')
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save wallpaper', 'error')
    } finally {
      setSavingWallpaper(false)
    }
  }

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.put('/auth/profile', {
        name: form.name,
        email: form.email,
        phone: form.phone,
        bio: form.bio,
        gender: form.gender,
        age: form.age ? Number(form.age) : null,
        avatar: form.avatar,
      })
      await refreshUser()
      showToast('Profile saved!')
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleSavePassword = async (e) => {
    e.preventDefault()
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      return showToast('Passwords do not match', 'error')
    }
    setSavingPw(true)
    try {
      await api.put('/auth/profile', {
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      })
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      showToast('Password updated!')
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update password', 'error')
    } finally {
      setSavingPw(false)
    }
  }

  const initials = (form.name || user?.name || '?')[0].toUpperCase()

  return (
    <div className={styles.page}>
      {toast && (
        <div className={`${styles.toast} ${toast.type === 'error' ? styles.toastError : styles.toastSuccess}`}>
          {toast.msg}
        </div>
      )}

      <div className={styles.header}>
        <h1>My Profile</h1>
        <p>Manage your personal information and account settings</p>
      </div>

      <div className={styles.layout}>
        {/* Left: Avatar card */}
        <div className={styles.avatarCard}>
          <div className={styles.avatarWrap}>
            {form.avatar ? (
              <img src={form.avatar} alt="Profile" className={styles.avatarImg} />
            ) : (
              <div className={styles.avatarInitials}>{initials}</div>
            )}
            <button className={styles.avatarOverlay} onClick={handleAvatarClick} title="Change photo">
              <Icon name="pen" size={16} color="#fff" />
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleAvatarChange}
          />
          <div className={styles.avatarName}>{form.name || user?.name}</div>
          <div className={styles.avatarTitle}>{user?.title || (user?.role === 'admin' ? 'Administrator' : 'Staff')}</div>
          <div className={styles.avatarMeta}>@{user?.username}</div>
          {form.avatar && (
            <button className={styles.removePhoto} onClick={handleRemoveAvatar}>
              Remove photo
            </button>
          )}
        </div>

        {/* Right: Form */}
        <div className={styles.formCol}>
          {/* Profile info */}
          <form className={styles.card} onSubmit={handleSaveProfile}>
            <div className={styles.cardHeader}>
              <Icon name="users" size={16} color="var(--accent)" />
              Personal Information
            </div>

            <div className={styles.formRow}>
              <div className={styles.field}>
                <label>Full Name</label>
                <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Your full name" required />
              </div>
              <div className={styles.field}>
                <label>Email</label>
                <input value={form.email} onChange={e => set('email', e.target.value)} type="email" placeholder="you@example.com" />
              </div>
            </div>

            <div className={styles.formRow}>
              <div className={styles.field}>
                <label>Phone Number</label>
                <input value={form.phone} onChange={e => set('phone', e.target.value)} type="tel" placeholder="+1 (555) 000-0000" />
              </div>
              <div className={styles.field}>
                <label>Age</label>
                <input value={form.age} onChange={e => set('age', e.target.value)} type="number" min="16" max="99" placeholder="e.g. 28" />
              </div>
            </div>

            <div className={styles.formRow}>
              <div className={styles.field}>
                <label>Gender</label>
                <select value={form.gender} onChange={e => set('gender', e.target.value)}>
                  {GENDER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className={styles.field} style={{ opacity: 0.5, pointerEvents: 'none' }}>
                <label>Username</label>
                <input value={user?.username || ''} readOnly tabIndex={-1} />
              </div>
            </div>

            <div className={styles.field}>
              <label>Bio / About</label>
              <textarea
                value={form.bio}
                onChange={e => set('bio', e.target.value)}
                placeholder="Tell your team a little about yourself…"
                rows={3}
              />
            </div>

            <div className={styles.cardActions}>
              <Button variant="primary" type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save Profile'}
              </Button>
            </div>
          </form>

          {/* Change password */}
          <form className={styles.card} onSubmit={handleSavePassword}>
            <div className={styles.cardHeader}>
              <Icon name="settings" size={16} color="var(--accent)" />
              Change Password
            </div>

            <div className={styles.field}>
              <label>Current Password</label>
              <input
                value={pwForm.currentPassword}
                onChange={e => setPw('currentPassword', e.target.value)}
                type="password"
                placeholder="Enter your current password"
                autoComplete="current-password"
              />
            </div>

            <div className={styles.formRow}>
              <div className={styles.field}>
                <label>New Password</label>
                <input
                  value={pwForm.newPassword}
                  onChange={e => setPw('newPassword', e.target.value)}
                  type="password"
                  placeholder="At least 6 characters"
                  autoComplete="new-password"
                />
              </div>
              <div className={styles.field}>
                <label>Confirm New Password</label>
                <input
                  value={pwForm.confirmPassword}
                  onChange={e => setPw('confirmPassword', e.target.value)}
                  type="password"
                  placeholder="Repeat new password"
                  autoComplete="new-password"
                />
              </div>
            </div>

            <div className={styles.cardActions}>
              <Button variant="primary" type="submit" disabled={savingPw || !pwForm.currentPassword || !pwForm.newPassword}>
                {savingPw ? 'Updating…' : 'Update Password'}
              </Button>
            </div>
          </form>

          {/* Appearance */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <Icon name="settings" size={16} color="var(--accent)" />
              Appearance
            </div>
            <div className={settingsStyles.appearanceCard}>
              <div className={settingsStyles.appearanceRow}>
                <div>
                  <div className={settingsStyles.appearanceLabel}>Theme</div>
                  <div className={settingsStyles.appearanceHint}>
                    {theme === 'dark' ? 'Dark mode is active' : 'Light mode is active'}
                  </div>
                </div>
                <button
                  className={`${settingsStyles.themeToggle} ${theme === 'light' ? settingsStyles.themeToggleLight : ''}`}
                  onClick={toggleTheme}
                  aria-label="Toggle theme"
                >
                  <span className={settingsStyles.themeToggleThumb} />
                </button>
              </div>
              <div className={settingsStyles.themePreviews}>
                <div
                  className={`${settingsStyles.themePreview} ${settingsStyles.themePreviewDark} ${theme === 'dark' ? settingsStyles.themePreviewActive : ''}`}
                  onClick={() => { if (theme !== 'dark') toggleTheme() }}
                >
                  <div className={settingsStyles.previewDots}><span /><span /><span /></div>
                  <div className={settingsStyles.previewLines}>
                    <span style={{ width: '70%' }} />
                    <span style={{ width: '50%' }} />
                    <span style={{ width: '60%' }} />
                  </div>
                  <div className={settingsStyles.previewLabel}>Dark</div>
                </div>
                <div
                  className={`${settingsStyles.themePreview} ${settingsStyles.themePreviewLight} ${theme === 'light' ? settingsStyles.themePreviewActive : ''}`}
                  onClick={() => { if (theme !== 'light') toggleTheme() }}
                >
                  <div className={settingsStyles.previewDots}><span /><span /><span /></div>
                  <div className={settingsStyles.previewLines}>
                    <span style={{ width: '70%' }} />
                    <span style={{ width: '50%' }} />
                    <span style={{ width: '60%' }} />
                  </div>
                  <div className={settingsStyles.previewLabel}>Light</div>
                </div>
              </div>

              <div className={styles.wallpaperSection}>
                <div className={styles.wallpaperHeading}>
                  <div>
                    <div className={settingsStyles.appearanceLabel}>Personal wallpaper</div>
                    <div className={settingsStyles.appearanceHint}>Optional and visible only when you sign in. Text contrast adjusts automatically.</div>
                  </div>
                  {wallpaper && <span className={styles.contrastBadge}>{wallpaperTone === 'light' ? 'Dark text' : 'Light text'}</span>}
                </div>

                <button
                  type="button"
                  className={`${styles.wallpaperPreview} ${!wallpaper ? styles.wallpaperEmpty : ''}`}
                  style={wallpaper ? { backgroundImage: `linear-gradient(${wallpaperTone === 'light' ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.3)'}, ${wallpaperTone === 'light' ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.3)'}), url("${wallpaper}")` } : undefined}
                  onClick={() => wallpaperRef.current?.click()}
                >
                  {wallpaper ? (
                    <span className={wallpaperTone === 'light' ? styles.previewDarkText : styles.previewLightText}>
                      <strong>Wallpaper preview</strong>
                      <small>Click to replace</small>
                    </span>
                  ) : (
                    <span><Icon name="plus" size={18} /><strong>Choose a background photo</strong><small>JPG, PNG or WebP · up to 12 MB</small></span>
                  )}
                </button>
                <input ref={wallpaperRef} type="file" accept="image/*" hidden onChange={handleWallpaperChange} />

                <div className={styles.wallpaperActions}>
                  {wallpaper && <Button variant="secondary" type="button" onClick={() => { setWallpaper(''); setWallpaperTone('dark') }}>Remove</Button>}
                  <Button type="button" onClick={handleSaveWallpaper} disabled={savingWallpaper}>
                    {savingWallpaper ? 'Saving…' : wallpaper ? 'Apply wallpaper' : 'Save default background'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
