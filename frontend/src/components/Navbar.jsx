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
    <nav style={styles.nav}>
      <Link to="/" style={styles.brand}>Movie Booking</Link>
      <div style={styles.links}>
        {user ? (
          <>
            <Link to="/bookings" style={styles.link}>My Bookings</Link>
            {user.role === 'ADMIN' && (
              <Link to="/admin" style={styles.link}>Admin</Link>
            )}
            <span style={styles.userLabel}>{user.name} ({user.role})</span>
            <button onClick={handleLogout} style={styles.button}>Logout</button>
          </>
        ) : (
          <>
            <Link to="/login" style={styles.link}>Login</Link>
            <Link to="/register" style={styles.link}>Register</Link>
          </>
        )}
      </div>
    </nav>
  )
}

const styles = {
  nav: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 1.5rem',
    background: '#1a1a2e',
    color: '#fff',
  },
  brand: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: '1.25rem',
    textDecoration: 'none',
  },
  links: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  link: {
    color: '#fff',
    textDecoration: 'none',
  },
  userLabel: {
    fontSize: '0.9rem',
    opacity: 0.85,
  },
  button: {
    background: '#e94560',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    padding: '0.4rem 0.8rem',
    cursor: 'pointer',
  },
}

export default Navbar