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

  if (loading) return <p style={styles.status}>Loading bookings...</p>
  if (error) return <p style={{ ...styles.status, color: '#e94560' }}>{error}</p>

  return (
    <div style={styles.container}>
      <h1>All Bookings</h1>
      {bookings.length === 0 && <p>No bookings yet.</p>}
      {bookings.length > 0 && (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>ID</th>
              <th style={styles.th}>User ID</th>
              <th style={styles.th}>Movie</th>
              <th style={styles.th}>Theater</th>
              <th style={styles.th}>Showtime</th>
              <th style={styles.th}>Seats</th>
              <th style={styles.th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((booking) => {
              const showtime = showtimesById[booking.showtime_id]
              const movie = showtime ? moviesById[showtime.movie_id] : null
              const theater = showtime ? theatersById[showtime.theater_id] : null
              return (
                <tr key={booking.id}>
                  <td style={styles.td}>#{booking.id}</td>
                  {/* No admin/users endpoint exists yet, so this shows the
                      raw user_id rather than a name/email -- straightforward
                      to upgrade later if a users-list endpoint gets added. */}
                  <td style={styles.td}>{booking.user_id}</td>
                  <td style={styles.td}>{movie?.title}</td>
                  <td style={styles.td}>{theater?.name}</td>
                  <td style={styles.td}>
                    {showtime && new Date(showtime.start_time).toLocaleString()}
                  </td>
                  <td style={styles.td}>
                    {booking.seats.map((s) => s.seat_number).sort().join(', ')}
                  </td>
                  <td style={styles.td}>{booking.status}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

const styles = {
  status: { textAlign: 'center', marginTop: '3rem' },
  container: { maxWidth: '900px', margin: '0 auto', padding: '1.5rem' },
  table: { width: '100%', borderCollapse: 'collapse', background: '#fff', fontSize: '0.9rem' },
  th: { textAlign: 'left', borderBottom: '2px solid #eee', padding: '0.5rem' },
  td: { borderBottom: '1px solid #eee', padding: '0.5rem' },
}

export default AdminBookingsPage