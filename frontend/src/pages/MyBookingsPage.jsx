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
    // Bookings only carry a showtime_id -- fetch showtimes/movies/theaters
    // once and join client-side, same approach as the confirmation page,
    // so each row can show "Movie · Theater · Time" instead of just IDs.
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

  if (loading) return <p style={styles.status}>Loading your bookings...</p>
  if (error) return <p style={{ ...styles.status, color: '#e94560' }}>{error}</p>
  if (bookings.length === 0) {
    return (
      <p style={styles.status}>
        You haven't booked anything yet. <Link to="/">Browse movies</Link>
      </p>
    )
  }

  return (
    <div style={styles.container}>
      <h1>My Bookings</h1>
      {bookings.map((booking) => {
        const showtime = showtimesById[booking.showtime_id]
        const movie = showtime ? moviesById[showtime.movie_id] : null
        const theater = showtime ? theatersById[showtime.theater_id] : null

        return (
          <div key={booking.id} style={styles.card}>
            <div>
              <p style={styles.movieTitle}>{movie?.title || `Showtime #${booking.showtime_id}`}</p>
              <p style={styles.subline}>
                {theater?.name} · {showtime && new Date(showtime.start_time).toLocaleString()}
              </p>
              <p style={styles.seatLine}>
                Seats: {booking.seats.map((s) => s.seat_number).sort().join(', ')}
              </p>
              <p style={styles.dateLine}>Booked {new Date(booking.created_at).toLocaleString()}</p>
            </div>
            <div style={styles.rightCol}>
              <span
                style={{
                  ...styles.badge,
                  ...(booking.status === 'CONFIRMED' ? styles.badgeConfirmed : styles.badgeCancelled),
                }}
              >
                {booking.status}
              </span>
              {booking.status === 'CONFIRMED' && (
                <button
                  onClick={() => handleCancel(booking.id)}
                  disabled={cancellingId === booking.id}
                  style={styles.cancelButton}
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

const styles = {
  status: { textAlign: 'center', marginTop: '3rem' },
  container: { maxWidth: '600px', margin: '0 auto', padding: '1.5rem' },
  card: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    background: '#fff',
    borderRadius: '8px',
    padding: '1rem',
    marginBottom: '0.75rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  movieTitle: { margin: '0 0 0.15rem', fontWeight: 'bold' },
  subline: { margin: '0 0 0.4rem', color: '#666', fontSize: '0.85rem' },
  seatLine: { margin: '0 0 0.25rem', color: '#333' },
  dateLine: { margin: 0, color: '#999', fontSize: '0.75rem' },
  rightCol: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' },
  badge: { padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 'bold' },
  badgeConfirmed: { background: '#e8f5e9', color: '#2e7d32' },
  badgeCancelled: { background: '#eee', color: '#888' },
  cancelButton: {
    padding: '0.35rem 0.75rem',
    fontSize: '0.85rem',
    cursor: 'pointer',
    background: '#e94560',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
  },
}

export default MyBookingsPage