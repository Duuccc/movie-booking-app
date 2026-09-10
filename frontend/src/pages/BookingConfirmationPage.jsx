import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../services/api'

function BookingConfirmationPage() {
  const { bookingId } = useParams()
  const [booking, setBooking] = useState(null)
  const [showtime, setShowtime] = useState(null)
  const [movie, setMovie] = useState(null)
  const [theater, setTheater] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .getBooking(bookingId)
      .then((bookingData) => {
        setBooking(bookingData)
        return api.getShowtime(bookingData.showtime_id)
      })
      .then((showtimeData) => {
        setShowtime(showtimeData)
        return Promise.all([
          api.getMovie(showtimeData.movie_id),
          api.getTheater(showtimeData.theater_id),
        ])
      })
      .then(([movieData, theaterData]) => {
        setMovie(movieData)
        setTheater(theaterData)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [bookingId])

  if (loading) return <p style={styles.status}>Loading confirmation...</p>
  if (error) return <p style={{ ...styles.status, color: '#e94560' }}>{error}</p>
  if (!booking) return null

  const seatNumbers = booking.seats.map((s) => s.seat_number).sort().join(', ')
  const total = showtime ? (booking.total_seats * Number(showtime.price)).toFixed(2) : null

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.heading}>Booking Confirmed</h1>
        <p style={styles.statusLine}>Status: {booking.status}</p>
        <dl style={styles.details}>
          <dt>Movie</dt>
          <dd>{movie?.title}</dd>
          <dt>Theater</dt>
          <dd>{theater?.name}</dd>
          <dt>Showtime</dt>
          <dd>{showtime && new Date(showtime.start_time).toLocaleString()}</dd>
          <dt>Seats</dt>
          <dd>{seatNumbers}</dd>
          <dt>Total</dt>
          <dd>{total ? `$${total}` : '—'}</dd>
          <dt>Booking ID</dt>
          <dd>#{booking.id}</dd>
        </dl>
        <div style={styles.actions}>
          <Link to="/bookings">View My Bookings</Link>
          <Link to="/">Browse More Movies</Link>
        </div>
      </div>
    </div>
  )
}

const styles = {
  status: { textAlign: 'center', marginTop: '3rem' },
  container: { maxWidth: '480px', margin: '2rem auto', padding: '0 1rem' },
  card: {
    background: '#fff',
    borderRadius: '8px',
    padding: '1.5rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  heading: { marginTop: 0 },
  statusLine: { color: '#2e7d32', fontWeight: 'bold' },
  details: { display: 'grid', gridTemplateColumns: '120px 1fr', rowGap: '0.4rem' },
  actions: { display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem' },
}

export default BookingConfirmationPage