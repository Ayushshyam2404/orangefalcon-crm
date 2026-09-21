import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../utils/api'

const AuthContext = createContext(null)

function applyUserWallpaper(user) {
  const root = document.documentElement
  if (user?.wallpaper) {
    root.dataset.wallpaper = 'true'
    root.dataset.wallpaperTone = user.wallpaperTone || 'dark'
    root.style.setProperty('--wallpaper-image', `url("${user.wallpaper}")`)
  } else {
    delete root.dataset.wallpaper
    delete root.dataset.wallpaperTone
    root.style.removeProperty('--wallpaper-image')
  }
}

function cacheUser(user) {
  if (!user) return localStorage.removeItem('user')
  const { wallpaper, ...lightweightUser } = user
  localStorage.setItem('user', JSON.stringify(lightweightUser))
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user')
    return stored ? JSON.parse(stored) : null
  })
  const [loading, setLoading] = useState(true)
  const [sessionStart, setSessionStart] = useState(null)

  useEffect(() => { applyUserWallpaper(user) }, [user])

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      api.get('/auth/me')
        .then((res) => {
          setUser(res.data)
          cacheUser(res.data)
          setSessionStart(Date.now())
        })
        .catch(() => {
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          setUser(null)
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = useCallback(async (username, password) => {
    const { data } = await api.post('/auth/login', { username, password })
    localStorage.setItem('token', data.token)
    cacheUser(data.user)
    setUser(data.user)
    setSessionStart(Date.now())
    return data.user
  }, [])

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout') } catch {}
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('attendance')
    setUser(null)
    setSessionStart(null)
  }, [])

  const refreshUser = useCallback(async () => {
    const { data } = await api.get('/auth/me')
    setUser(data)
    cacheUser(data)
    return data
  }, [])

  // Called after user completes forced password change
  const clearMustChangePassword = useCallback(() => {
    setUser(prev => {
      if (!prev) return prev
      const updated = { ...prev, mustChangePassword: false }
      cacheUser(updated)
      return updated
    })
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser, sessionStart, clearMustChangePassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
