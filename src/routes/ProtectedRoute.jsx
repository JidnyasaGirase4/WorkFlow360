import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ allowedRoles }) {
  const { isAuthenticated, isLoading, user, sessionExpired } = useAuth()
  const location = useLocation()

  if (isLoading) return null

  if (!isAuthenticated) {
    // Timed-out sessions land on the dedicated page; everyone else goes to login.
    if (sessionExpired) {
      return <Navigate to="/session-expired" replace state={{ from: location.pathname }} />
    }
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/access-denied" replace />
  }

  return <Outlet />
}
