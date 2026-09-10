import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * Wraps a route element that requires a logged-in user (seat selection,
 * booking confirmation, and later My Bookings / Admin pages). Redirects
 * to /login if there's no user, preserving where they were headed via
 * location state -- not wired up to auto-redirect back yet, but the
 * `from` state is there if a later milestone wants that.
 */
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <p style={{ textAlign: 'center', marginTop: '3rem' }}>Loading...</p>
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />

  return children
}

export default ProtectedRoute