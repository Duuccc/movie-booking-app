import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * Like ProtectedRoute, but also requires the ADMIN role. A logged-in
 * customer hitting an admin URL is bounced to the home page rather than
 * to /login -- they ARE authenticated, they're just not allowed here.
 */
function AdminRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) return <p style={{ textAlign: 'center', marginTop: '3rem' }}>Loading...</p>
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'ADMIN') return <Navigate to="/" replace />

  return children
}

export default AdminRoute