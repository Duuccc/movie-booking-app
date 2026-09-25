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

  return (
    <div className="page-narrow">
      <div className="card confirmation-card" id="ticket">
        <div className="confirmation-check no-print">&#10003;</div>
        <p className="movie-details-tag">Booking Confirmed</p>
        <h1 className="confirmation-title">{movie?.title}</h1>
        <div className="confirmation-badges no-print">
          <span className="badge badge-success">{booking.status}</span>
          <span className={`badge ${booking.payment_status === 'PAID' ? 'badge-success' : 'badge-muted'}`}>
            {booking.payment_status}
          </span>
        </div>

        <dl className="confirmation-details">
          <dt>Theater</dt>
          <dd>{theater?.name}</dd>
          <dt>Showtime</dt>
          <dd>{showtime && new Date(showtime.start_time).toLocaleString()}</dd>
          <dt>Seats</dt>
          <dd>{seatNumbers}</dd>
          <dt>Total</dt>
          <dd>{formatVnd(booking.total_amount)}</dd>
          <dt>Booking ID</dt>
          <dd>#{booking.id}</dd>
        </dl>

        <div className="ticket-barcode">#{String(booking.id).padStart(8, '0')}</div>

        <div className="confirmation-actions no-print">
          <Link to="/bookings" className="link-btn">View My Bookings</Link>
          <Link to="/" className="link-btn">Browse More Movies</Link>
        </div>

        <button onClick={() => window.print()} className="btn btn-ghost btn-block no-print" style={{ marginTop: '1.25rem' }}>
          Print Ticket
        </button>
      </div>
    </div>
  )
}

export default BookingConfirmationPage