import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../services/api'

function MyBookingsPage() {
  const [bookings, setBookings] = useState([])
  const [showtimesById, setShowtimesById] = useState({})
  const [moviesById, setMoviesById] = useState({})
  const [theatersById, setTheatersById] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cancellingId, setCancellingId] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  function loadData() {
    setLoading(true)
    Promise.all([api.listMyBookings(), api.listShowtimes(), api.listMovies(), api.listTheaters()])
      .then(([bookingsData, showtimesData, moviesData, theatersData]) => {
        setBookings(bookingsData)
        setShowtimesById(Object.fromEntries(showtimesData.map((s) => [s.id, s])))
        setMoviesById(Object.fromEntries(moviesData.map((m) => [m.id, m])))
        setTheatersById(Object.fromEntries(theatersData.map((t) => [t.id, t])))
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  async function handleCancel(bookingId) {
    setCancellingId(bookingId)
    try {
      await api.cancelBooking(bookingId)
      loadData()
    } catch (err) {
      setError(err.message)
    } finally {
      setCancellingId(null)
    }
  }

  if (loading) return <p className="status-message">Loading your bookings...</p>
  if (error) return <p className="status-message error">{error}</p>
  if (bookings.length === 0) {
    return (
      <p className="status-message">
        You haven't booked anything yet. <Link to="/">Browse movies</Link>
      </p>
    )
  }

  return (
    <div className="page-medium">
      <h1 className="page-title">My Bookings</h1>
      {bookings.map((booking) => {
        const showtime = showtimesById[booking.showtime_id]
        const movie = showtime ? moviesById[showtime.movie_id] : null
        const theater = showtime ? theatersById[showtime.theater_id] : null

        return (
          <div key={booking.id} className="card booking-card">
            <div>
              <p className="booking-card-title">{movie?.title || `Showtime #${booking.showtime_id}`}</p>
              <p className="booking-card-sub">
                {theater?.name} · {showtime && new Date(showtime.start_time).toLocaleString()}
              </p>
              <p className="booking-card-seats">
                Seats: {booking.seats.map((s) => s.seat_number).sort().join(', ')}
              </p>
              <p className="booking-card-date">Booked {new Date(booking.created_at).toLocaleString()}</p>
            </div>
            <div className="booking-card-actions">
              <span className={`badge ${booking.status === 'CONFIRMED' ? 'badge-success' : 'badge-muted'}`}>
                {booking.status}
              </span>
              {booking.status === 'CONFIRMED' && (
                <button
                  onClick={() => handleCancel(booking.id)}
                  disabled={cancellingId === booking.id}
                  className="btn btn-danger btn-sm"
                >
                  {cancellingId === booking.id ? 'Cancelling...' : 'Cancel'}
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default MyBookingsPage