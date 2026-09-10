import { Link } from 'react-router-dom'

function AdminDashboardPage() {
  return (
    <div style={styles.container}>
      <h1>Admin Dashboard</h1>
      <div style={styles.grid}>
        <Link to="/admin/movies" style={styles.card}>Manage Movies</Link>
        <Link to="/admin/theaters" style={styles.card}>Manage Theaters</Link>
        <Link to="/admin/showtimes" style={styles.card}>Manage Showtimes</Link>
        <Link to="/admin/bookings" style={styles.card}>View Bookings</Link>
      </div>
    </div>
  )
}

const styles = {
  container: { maxWidth: '600px', margin: '0 auto', padding: '1.5rem' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1.5rem' },
  card: {
    display: 'block',
    padding: '1.5rem',
    background: '#fff',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    textAlign: 'center',
    color: '#1a1a2e',
    textDecoration: 'none',
    fontWeight: 'bold',
  },
}

export default AdminDashboardPage