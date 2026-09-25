import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom'
import { api, formatVnd } from '../services/api'
import { useAuth } from '../context/AuthContext'

function parseSeat(seatNumber) {
  const match = seatNumber.match(/^([A-Za-z]+)(\d+)$/)
  if (!match) return { row: seatNumber, number: 0 }
  return { row: match[1], number: Number(match[2]) }
}

function getFormatModifier(format) {
  if (format === '3D') return '3d'
  if (format === 'IMAX') return 'imax'
  return null
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

  const selectedSeats = seats.filter((s) => selectedSeatIds.includes(s.seat_id))
  const selectedSeatNumbers = selectedSeats
    .map((s) => s.seat_number)
    .sort()

  const selectedTotal = selectedSeats.reduce((sum, s) => sum + s.price, 0)

  return (
    <div className="page">
      <button onClick={() => navigate(-1)} className="back-link" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
        &larr; Back to showtimes
      </button>

      <p className="movie-details-tag">{theater?.name}</p>
      <h1 className="showtimes-select-title" style={{ marginBottom: '0.2rem' }}>{movie?.title}</h1>
      <p className="seat-page-subtitle">
        {showtime && new Date(showtime.start_time).toLocaleString([], {
          weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
        })}
        {showtime?.format && showtime.format !== "2D" && (
          <span className='format-badge'>{showtime.format}</span>
        )}
      </p>


      <div className={['screen-bar', getFormatModifier(showtime?.format) && `screen-bar-${getFormatModifier(showtime?.format)}`].filter(Boolean).join(' ')}>
        <div className="screen-curve" />
        <span className="screen-label">
          SCREEN{showtime?.format && showtime.format !== '2D' ? ` · ${showtime.format}` : ''}
        </span>
      </div>

      <div className={['seat-grid', getFormatModifier(showtime?.format) && `seat-grid-${getFormatModifier(showtime?.format)}`].filter(Boolean).join(' ')}>
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
                    title={`${seat.seat_number} (${seat.seat_type})`}
                    className={
                      'seat' +
                      (isBooked ? ' seat-booked' : isSelected ? ' seat-selected' : '') +
                      (!isBooked && seat.seat_type === 'VIP' ? ' seat-vip' : '') +
                      (!isBooked && seat.seat_type === 'COUPLE' ? ' seat-couple' : '')
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
        <span><span className="seat-legend-swatch seat-legend-swatch-available" /> Standard</span>
        <span><span className="seat-legend-swatch seat-legend-swatch-vip" /> VIP</span>
        <span><span className="seat-legend-swatch seat-legend-swatch-couple" /> Couple</span>
        <span><span className="seat-legend-swatch seat-legend-swatch-selected" /> Selected</span>
        <span><span className="seat-legend-swatch seat-legend-swatch-booked" /> Booked</span>
      </div>

      <div className="booking-summary">
        <p className="booking-summary-seats">
          {selectedSeatNumbers.length ? selectedSeatNumbers.join(', ') : 'No seats selected'}
        </p>
        <p className="booking-summary-count">{selectedSeatIds.length} ticket{selectedSeatIds.length === 1 ? '' : 's'}</p>
        
        <p className="booking-price">{formatVnd(selectedTotal)}</p>
        
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

