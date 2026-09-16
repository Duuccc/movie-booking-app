import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api, formatVnd } from '../services/api'

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

  if (loading) return <p className="status-message">Loading confirmation...</p>
  if (error) return <p className="status-message error">{error}</p>
  if (!booking) return null

  const seatNumbers = booking.seats.map((s) => s.seat_number).sort().join(', ')
  const total = showtime ? formatVnd(booking.total_seats * showtime.price) : null

  return (
    <div className="page-narrow">
      <div className="card confirmation-card">
        <div className="confirmation-check">&#10003;</div>
        <h1 style={{ marginBottom: '0.2rem' }}>Booking Confirmed</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <span className="badge badge-success">{booking.status}</span>
          <span className={`badge ${booking.payment_status === 'PAID' ? 'badge-success' : 'badge-muted'}`}>
            {booking.payment_status}
          </span>
        </div>

        <dl className="confirmation-details">
          <dt>Movie</dt>
          <dd>{movie?.title}</dd>
          <dt>Theater</dt>
          <dd>{theater?.name}</dd>
          <dt>Showtime</dt>
          <dd>{showtime && new Date(showtime.start_time).toLocaleString()}</dd>
          <dt>Seats</dt>
          <dd>{seatNumbers}</dd>
          <dt>Total</dt>
          <dd>{total || '—'}</dd>
          <dt>Booking ID</dt>
          <dd>#{booking.id}</dd>
        </dl>

        <div className="confirmation-actions">
          <Link to="/bookings">View My Bookings</Link>
          <Link to="/">Browse More Movies</Link>
        </div>
      </div>
    </div>
  )
}

export default BookingConfirmationPage