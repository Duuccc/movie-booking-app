import { NavLink, Link, Outlet, useNavigate } from 'react-router-dom'
import { TrendingUp, Film, Building2, CalendarClock, Ticket, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const MENU = [
  { to: '/admin/analytics', label: 'Analytics', icon: TrendingUp },
  { to: '/admin/movies', label: 'Manage Movies', icon: Film },
  { to: '/admin/theaters', label: 'Manage Theaters', icon: Building2 },
  { to: '/admin/showtimes', label: 'Manage Showtimes', icon: CalendarClock },
  { to: '/admin/bookings', label: 'View Bookings', icon: Ticket },
]

function AdminLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link to="/" className="admin-sidebar-brand">Movie Booking</Link>

        <nav className="admin-sidebar-nav">
          {MENU.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                'admin-sidebar-link' + (isActive ? ' admin-sidebar-link-active' : '')
              }
            >
              <Icon size={18} strokeWidth={1.75} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          {user && <p className="admin-sidebar-user">{user.name}</p>}
          <button onClick={handleLogout} className="admin-sidebar-link admin-sidebar-logout">
            <LogOut size={18} strokeWidth={1.75} />
            <span>Log out</span>
          </button>
        </div>
      </aside>

      <main className="admin-content">
        <Outlet />
      </main>
    </div>
  )
}

export default AdminLayout