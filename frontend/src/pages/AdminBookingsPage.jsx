import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { usePagination } from '../hooks/usePagination'
import Pagination from '../components/Pagination'

function AdminBookingsPage() {
  const [bookings, setBookings] = useState([])
  const [showtimesById, setShowtimesById] = useState({})
  const [moviesById, setMoviesById] = useState({})
  const [theatersById, setTheatersById] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [usersById, setUsersById] = useState({})
  const [searchName, setSearchName] = useState('')
  const [searchMovie, setSearchMovie] = useState('')
  const [filterTheaterId, setFilterTheaterId] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPaymentStatus, setFilterPaymentStatus] = useState('')

  const filteredBookings = bookings.filter((b) => {
    const user = usersById[b.user_id]
    const showtime = showtimesById[b.showtime_id]
    const movie = showtime ? moviesById[showtime.movie_id] : null

    const matchesSearch =
      !searchName || (user?.name || '').toLowerCase().includes(searchName.trim().toLowerCase())
    const matchesMovie =
      !searchMovie || (movie?.title || '').toLowerCase().includes(searchMovie.trim().toLowerCase())
    const matchesTheater = !filterTheaterId || showtime?.theater_id === Number(filterTheaterId)
    const matchesStatus = !filterStatus || b.status === filterStatus
    const matchesPayment = !filterPaymentStatus || b.payment_status === filterPaymentStatus

    return matchesSearch && matchesMovie && matchesTheater && matchesStatus && matchesPayment
  })

  const { pageItems, paginationProps } = usePagination(filteredBookings)

  useEffect(() => {
    Promise.all([
      api.listAdminBookings(),
      api.listShowtimes(),
      api.listMovies(),
      api.listTheaters(),
      api.listAdminUsers(),
    ])
      .then(([bookingsData, showtimesData, moviesData, theatersData, usersData]) => {
        setBookings(bookingsData)
        setShowtimesById(Object.fromEntries(showtimesData.map((s) => [s.id, s])))
        setMoviesById(Object.fromEntries(moviesData.map((m) => [m.id, m])))
        setTheatersById(Object.fromEntries(theatersData.map((t) => [t.id, t])))
        setUsersById(Object.fromEntries(usersData.map((u) => [u.id, u])))
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="status-message">Loading bookings...</p>
  if (error) return <p className="status-message error">{error}</p>

  return (
    <div className="page">
      <h1 className="page-title">All Bookings</h1>
      <div className="admin-filter-bar">
        <input
          type="text"
          className="input"
          placeholder="Search by customer name..."
          value={searchName}
          onChange={(e) => setSearchName(e.target.value)}
        />
        <input
          type="text"
          className="input"
          placeholder="Search by movie title..."
          value={searchMovie}
          onChange={(e) => setSearchMovie(e.target.value)}
        />
        <select
          className="input"
          value={filterTheaterId}
          onChange={(e) => setFilterTheaterId(e.target.value)}
        >
          <option value="">All theaters</option>
          {Object.values(theatersById).map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <select
          className="input"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <select
          className="input"
          value={filterPaymentStatus}
          onChange={(e) => setFilterPaymentStatus(e.target.value)}
        >
          <option value="">All payment statuses</option>
          <option value="PAID">Paid</option>
          <option value="PENDING">Pending</option>
          <option value="FAILED">Failed</option>
        </select>
        {(searchName || searchMovie || filterTheaterId || filterStatus || filterPaymentStatus) && (
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              setSearchName('')
              setSearchMovie("")
              setFilterTheaterId("")
              setFilterStatus('')
              setFilterPaymentStatus('')
            }}
          >
            Clear filters
          </button>
        )}
      </div>
      {bookings.length === 0 && <p className="status-message">No bookings yet.</p>}
      {bookings.length > 0 && filteredBookings.length === 0 && (
        <p className="status-message">No bookings match your filters.</p>
      )}
      {filteredBookings.length > 0 && (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Customer</th>
                  <th>Movie</th>
                  <th>Theater</th>
                  <th>Showtime</th>
                  <th>Seats</th>
                  <th>Status</th>
                  <th>Payment</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((booking) => {
                  const showtime = showtimesById[booking.showtime_id]
                  const movie = showtime ? moviesById[showtime.movie_id] : null
                  const theater = showtime ? theatersById[showtime.theater_id] : null
                  return (
                    <tr key={booking.id}>
                      <td>#{booking.id}</td>
                      <td>
                        {usersById[booking.user_id]?.name || `User #${booking.user_id}`}
                        <br />
                        <span className="admin-table-subtext">#{booking.user_id}</span>
                      </td>
                      <td>{movie?.title}</td>
                      <td>{theater?.name}</td>
                      <td>{showtime && new Date(showtime.start_time).toLocaleString()}</td>
                      <td>{booking.seats.map((s) => s.seat_number).sort().join(', ')}</td>
                      <td>
                        <span className={`badge ${booking.status === 'CONFIRMED' ? 'badge-success' : 'badge-muted'}`}>
                          {booking.status}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${booking.payment_status === 'PAID' ? 'badge-success' : 'badge-muted'}`}>
                          {booking.payment_status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Pagination {...paginationProps} />
        </>
      )}
    </div>
  )
}

export default AdminBookingsPage