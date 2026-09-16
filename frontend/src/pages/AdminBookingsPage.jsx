import { useEffect, useState } from 'react'
import { api } from '../services/api'

function AdminBookingsPage() {
  const [bookings, setBookings] = useState([])
  const [showtimesById, setShowtimesById] = useState({})
  const [moviesById, setMoviesById] = useState({})
  const [theatersById, setTheatersById] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([api.listAdminBookings(), api.listShowtimes(), api.listMovies(), api.listTheaters()])
      .then(([bookingsData, showtimesData, moviesData, theatersData]) => {
        setBookings(bookingsData)
        setShowtimesById(Object.fromEntries(showtimesData.map((s) => [s.id, s])))
        setMoviesById(Object.fromEntries(moviesData.map((m) => [m.id, m])))
        setTheatersById(Object.fromEntries(theatersData.map((t) => [t.id, t])))
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="status-message">Loading bookings...</p>
  if (error) return <p className="status-message error">{error}</p>

  return (
    <div className="page">
      <h1 className="page-title">All Bookings</h1>
      {bookings.length === 0 && <p className="status-message">No bookings yet.</p>}
      {bookings.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>User ID</th>
                <th>Movie</th>
                <th>Theater</th>
                <th>Showtime</th>
                <th>Seats</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => {
                const showtime = showtimesById[booking.showtime_id]
                const movie = showtime ? moviesById[showtime.movie_id] : null
                const theater = showtime ? theatersById[showtime.theater_id] : null
                return (
                  <tr key={booking.id}>
                    <td>#{booking.id}</td>
                    <td>{booking.user_id}</td>
                    <td>{movie?.title}</td>
                    <td>{theater?.name}</td>
                    <td>{showtime && new Date(showtime.start_time).toLocaleString()}</td>
                    <td>{booking.seats.map((s) => s.seat_number).sort().join(', ')}</td>
                    <td>
                      <span className={`badge ${booking.status === 'CONFIRMED' ? 'badge-success' : 'badge-muted'}`}>
                        {booking.status}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default AdminBookingsPage