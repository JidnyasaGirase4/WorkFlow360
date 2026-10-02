import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { AUTH_EXPIRED_EVENT } from '../services/apiClient'
import { authService } from '../services/authService'

const AuthContext = createContext(null)

const STORAGE_KEY = 'wf360-auth'

// Mock JWTs carry an expiry (like a real `exp` claim). authService tokens do not
// include one yet, so the provider stamps `expiresAt` when a session is created.
// Override for demos:  localStorage.setItem('wf360-session-ttl-ms', '15000')
const DEFAULT_SESSION_TTL_MS = 8 * 60 * 60 * 1000

function sessionTtl() {
  try {
    const override = Number(window.localStorage.getItem('wf360-session-ttl-ms'))
    if (override > 0) return override
  } catch {
    // ignore storage errors
  }
  return DEFAULT_SESSION_TTL_MS
}

const EMPTY_SESSION = { user: null, token: null, expiresAt: null, expired: false }

function readStoredSession() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      const expiresAt = parsed.expiresAt ?? null
      // A stored session past its expiry is discarded immediately (lazy initial state).
      if (parsed.user && parsed.token && expiresAt && expiresAt <= Date.now()) {
        window.localStorage.removeItem(STORAGE_KEY)
        return { ...EMPTY_SESSION, expired: true }
      }
      return { user: parsed.user ?? null, token: parsed.token ?? null, expiresAt, expired: false }
    }
  } catch {
    window.localStorage.removeItem(STORAGE_KEY)
  }
  return EMPTY_SESSION
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(readStoredSession)
  const { user, token, expiresAt, expired } = session
  const isLoading = false

  const persist = useCallback((nextUser, nextToken) => {
    const nextExpiry = Date.now() + sessionTtl()
    setSession({ user: nextUser, token: nextToken, expiresAt: nextExpiry, expired: false })
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: nextUser, token: nextToken, expiresAt: nextExpiry }))
  }, [])

  const clearSession = useCallback((markExpired) => {
    setSession({ ...EMPTY_SESSION, expired: markExpired })
    window.localStorage.removeItem(STORAGE_KEY)
  }, [])

  // The API client fires this when a 401 could not be recovered by refreshing the token.
  useEffect(() => {
    const onAuthExpired = () => clearSession(true)
    window.addEventListener(AUTH_EXPIRED_EVENT, onAuthExpired)
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onAuthExpired)
  }, [clearSession])

  // Expire the session when the token's expiry passes. The timer callback (not
  // the effect body) updates state, so nothing is set synchronously in the effect.
  // A visibility check covers timers throttled in background tabs / after sleep.
  useEffect(() => {
    if (!user || !token || !expiresAt) return undefined
    const expire = () => clearSession(true)
    const timer = setTimeout(expire, Math.max(0, expiresAt - Date.now()))
    function onVisible() {
      if (document.visibilityState === 'visible' && Date.now() >= expiresAt) expire()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [user, token, expiresAt, clearSession])

  const login = useCallback(
    async (credentials) => {
      const { user: loggedInUser, token: newToken } = await authService.login(credentials)
      persist(loggedInUser, newToken)
      return loggedInUser
    },
    [persist]
  )

  const register = useCallback(
    async (payload) => {
      const { user: newUser, token: newToken } = await authService.register(payload)
      persist(newUser, newToken)
      return newUser
    },
    [persist]
  )

  const logout = useCallback(async () => {
    await authService.logout()
    clearSession(false)
  }, [clearSession])

  const value = useMemo(
    () => ({
      user,
      token,
      expiresAt,
      // True after a session timed out; ProtectedRoute uses it to redirect to /session-expired.
      sessionExpired: expired,
      isAuthenticated: Boolean(user && token),
      isLoading,
      login,
      register,
      logout,
    }),
    [user, token, expiresAt, expired, isLoading, login, register, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
