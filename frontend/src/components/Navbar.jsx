import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">Movie Booking</Link>
      <div className="navbar-links">
        <Link to="/showtimes" className="navbar-link navbar-link-primary">Showtimes by Theaters</Link>
        {user ? (
          <>
            <Link to="/bookings" className="navbar-link">My Bookings</Link>
            {user.role === 'ADMIN' && (
              <Link to="/admin" className="navbar-link">Admin</Link>
            )}
            <span className="navbar-user">{user.name}</span>
            <button onClick={handleLogout} className="navbar-logout">Logout</button>
          </>
        ) : (
          <>
            <Link to="/login" className="navbar-link">Login</Link>
            <Link to="/register" className="navbar-link navbar-link-cta">Register</Link>
          </>
        )}
      </div>
    </nav>
  )
}

export default Navbar