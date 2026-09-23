import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom'
import { api, formatVnd } from '../services/api'
import { useAuth } from '../context/AuthContext'

function parseSeat(seatNumber) {
  const match = seatNumber.match(/^([A-Za-z]+)(\d+)$/)
  if (!match) return { row: seatNumber, number: 0 }
  return { row: match[1], number: Number(match[2]) }
}

function SeatSelectionPage() {
  const { showtimeId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const [showtime, setShowtime] = useState(null)
  const [movie, setMovie] = useState(null)
  const [theater, setTheater] = useState(null)
  const [seats, setSeats] = useState([])
  // Restored from location.state if we're bouncing back from a login
  // redirect (see handleConfirm below) -- otherwise starts empty as before.
  const [selectedSeatIds, setSelectedSeatIds] = useState(
    () => location.state?.selectedSeatIds || []
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [bookingError, setBookingError] = useState('')

  useEffect(() => {
    api
      .getShowtime(showtimeId)
      .then((showtimeData) => {
        setShowtime(showtimeData)
        return Promise.all([
          api.getMovie(showtimeData.movie_id),
          api.getTheater(showtimeData.theater_id),
          api.getShowtimeSeats(showtimeId),
        ])
      })
      .then(([movieData, theaterData, seatsData]) => {
        setMovie(movieData)
        setTheater(theaterData)
        setSeats(seatsData)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [showtimeId])

  function toggleSeat(seat) {
    if (seat.status === 'BOOKED') return
    setSelectedSeatIds((current) =>
      current.includes(seat.seat_id)
        ? current.filter((id) => id !== seat.seat_id)
        : [...current, seat.seat_id]
    )
  }

  async function handleConfirm() {
    if (!user) {
      navigate('/login', {
        state: {
          from: {
            pathname: location.pathname,
            search: location.search,
            state: { selectedSeatIds },
          },
        },
      })
      return
    }

    setBookingError('')
    setSubmitting(true)
    try {
      const booking = await api.createBooking(Number(showtimeId), selectedSeatIds)
      navigate(`/bookings/${booking.id}/checkout`)
    } catch (err) {
      setBookingError(err.message)
      const freshSeats = await api.getShowtimeSeats(showtimeId)
      setSeats(freshSeats)
      setSelectedSeatIds((current) =>
        current.filter(
          (id) => freshSeats.find((s) => s.seat_id === id)?.status === 'AVAILABLE'
        )
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <p className="status-message">Loading seats...</p>
  if (error) return <p className="status-message error">{error}</p>

  const rows = {}
  for (const seat of seats) {
    const { row } = parseSeat(seat.seat_number)
    if (!rows[row]) rows[row] = []
    rows[row].push(seat)
  }
  const rowLetters = Object.keys(rows).sort()

  const selectedSeatNumbers = seats
    .filter((s) => selectedSeatIds.includes(s.seat_id))
    .map((s) => s.seat_number)
    .sort()

  return (
    <div className="page-medium">
      <Link to={`/movies/${showtime?.movie_id}/showtimes`} className="back-link">&larr; Back to showtimes</Link>
      <h1 style={{ marginBottom: '0.15rem' }}>{movie?.title}</h1>
      <p style={{ color: 'var(--muted)' }}>
        {theater?.name} · {showtime && new Date(showtime.start_time).toLocaleString()}
      </p>

      <div className="screen-bar">
        <div className="screen-curve" />
        <span className="screen-label">SCREEN</span>
      </div>

      <div className="seat-grid">
        {rowLetters.map((row) => (
          <div key={row} className="seat-row">
            <span className="seat-row-label">{row}</span>
            {rows[row]
              .slice()
              .sort((a, b) => parseSeat(a.seat_number).number - parseSeat(b.seat_number).number)
              .map((seat) => {
                const isSelected = selectedSeatIds.includes(seat.seat_id)
                const isBooked = seat.status === 'BOOKED'
                return (
                  <button
                    key={seat.seat_id}
                    onClick={() => toggleSeat(seat)}
                    disabled={isBooked}
                    title={seat.seat_number}
                    className={
                      'seat' + (isBooked ? ' seat-booked' : isSelected ? ' seat-selected' : '')
                    }
                  >
                    {seat.seat_number}
                  </button>
                )
              })}
          </div>
        ))}
      </div>

      <div className="seat-legend">
        <span><span className="seat-legend-swatch" style={{ background: 'var(--paper)' }} /> Available</span>
        <span><span className="seat-legend-swatch" style={{ background: 'var(--accent)', borderColor: 'var(--accent-dark)' }} /> Selected</span>
        <span><span className="seat-legend-swatch" style={{ background: 'var(--border)' }} /> Booked</span>
      </div>

      <div className="booking-summary">
        <p>Selected seats: {selectedSeatNumbers.length ? selectedSeatNumbers.join(', ') : 'None'}</p>
        <p>Number of tickets: {selectedSeatIds.length}</p>
        {showtime && (
          <p className="booking-price">
            {formatVnd(selectedSeatIds.length * showtime.price)}
          </p>
        )}
        {bookingError && <p className="error-text">{bookingError}</p>}
        <button
          onClick={handleConfirm}
          disabled={selectedSeatIds.length === 0 || submitting}
          className="btn btn-primary"
        >
          {submitting ? 'Booking...' : user ? 'Confirm Booking' : 'Log In to Book'}
        </button>
      </div>
    </div>
  )
}

export default SeatSelectionPage