import { Link } from 'react-router-dom'

function AdminDashboardPage() {
  return (
    <div className="page-medium">
      <h1 className="page-title">Admin Dashboard</h1>
      <p className="page-subtitle">Manage the catalog and keep an eye on bookings.</p>
      <div className="admin-grid">
        <Link to="/admin/analytics" className="card admin-card">Analytics</Link>
        <Link to="/admin/movies" className="card admin-card">Manage Movies</Link>
        <Link to="/admin/theaters" className="card admin-card">Manage Theaters</Link>
        <Link to="/admin/showtimes" className="card admin-card">Manage Showtimes</Link>
        <Link to="/admin/bookings" className="card admin-card">View Bookings</Link>
      </div>
    </div>
  )
}

export default AdminDashboardPage