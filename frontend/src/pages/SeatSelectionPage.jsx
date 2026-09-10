import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { api } from '../services/api'

function parseSeat(seatNumber) {
  const match = seatNumber.match(/^([A-Za-z]+)(\d+)$/)
  if (!match) return { row: seatNumber, number: 0 }
  return { row: match[1], number: Number(match[2]) }
}

function SeatSelectionPage() {
  const { showtimeId } = useParams()
  const navigate = useNavigate()
  const [showtime, setShowtime] = useState(null)
  const [movie, setMovie] = useState(null)
  const [theater, setTheater] = useState(null)
  const [seats, setSeats] = useState([])
  const [selectedSeatIds, setSelectedSeatIds] = useState([])
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
    setBookingError('')
    setSubmitting(true)
    try {
      const booking = await api.createBooking(Number(showtimeId), selectedSeatIds)
      navigate(`/bookings/${booking.id}/confirmation`)
    } catch (err) {
      setBookingError(err.message)
      // A 409 means someone else grabbed a seat between page load and
      // submit -- refresh seat availability so the grid reflects reality,
      // and drop any selected seat that's no longer available.
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

  if (loading) return <p style={styles.status}>Loading seats...</p>
  if (error) return <p style={{ ...styles.status, color: '#e94560' }}>{error}</p>

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
    <div style={styles.container}>
      <Link to={`/movies/${showtime?.movie_id}/showtimes`}>&larr; Back to showtimes</Link>
      <h1 style={styles.movieTitle}>{movie?.title}</h1>
      <p style={styles.meta}>
        {theater?.name} · {showtime && new Date(showtime.start_time).toLocaleString()}
      </p>

      <div style={styles.screen}>SCREEN</div>

      <div style={styles.grid}>
        {rowLetters.map((row) => (
          <div key={row} style={styles.row}>
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
                    style={{
                      ...styles.seat,
                      ...(isBooked
                        ? styles.seatBooked
                        : isSelected
                        ? styles.seatSelected
                        : styles.seatAvailable),
                    }}
                  >
                    {seat.seat_number}
                  </button>
                )
              })}
          </div>
        ))}
      </div>

      <div style={styles.legend}>
        <span><span style={{ ...styles.swatch, ...styles.seatAvailable }} /> Available</span>
        <span><span style={{ ...styles.swatch, ...styles.seatSelected }} /> Selected</span>
        <span><span style={{ ...styles.swatch, ...styles.seatBooked }} /> Booked</span>
      </div>

      <div style={styles.summary}>
        <p>Selected seats: {selectedSeatNumbers.length ? selectedSeatNumbers.join(', ') : 'None'}</p>
        <p>Number of tickets: {selectedSeatIds.length}</p>
        {showtime && (
          <p>Price: ${(selectedSeatIds.length * Number(showtime.price)).toFixed(2)}</p>
        )}
        {bookingError && <p style={styles.error}>{bookingError}</p>}
        <button
          onClick={handleConfirm}
          disabled={selectedSeatIds.length === 0 || submitting}
          style={styles.confirmButton}
        >
          {submitting ? 'Booking...' : 'Confirm Booking'}
        </button>
      </div>
    </div>
  )
}

const styles = {
  status: { textAlign: 'center', marginTop: '3rem' },
  container: { maxWidth: '600px', margin: '0 auto', padding: '1.5rem' },
  movieTitle: { marginBottom: '0.25rem' },
  meta: { color: '#666' },
  screen: {
    textAlign: 'center',
    background: '#ccc',
    padding: '0.5rem',
    margin: '1.5rem 0',
    borderRadius: '4px',
    letterSpacing: '0.2em',
    fontSize: '0.8rem',
  },
  grid: { display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' },
  row: { display: 'flex', gap: '0.5rem' },
  seat: {
    width: '36px',
    height: '36px',
    borderRadius: '4px',
    border: '1px solid #999',
    fontSize: '0.7rem',
    cursor: 'pointer',
  },
  seatAvailable: { background: '#fff', color: '#333' },
  seatSelected: { background: '#1a1a2e', color: '#fff', border: '1px solid #1a1a2e' },
  seatBooked: { background: '#ccc', color: '#888', cursor: 'not-allowed' },
  legend: {
    display: 'flex',
    gap: '1.5rem',
    justifyContent: 'center',
    margin: '1.5rem 0',
    fontSize: '0.85rem',
  },
  swatch: {
    display: 'inline-block',
    width: '12px',
    height: '12px',
    borderRadius: '2px',
    marginRight: '0.35rem',
    verticalAlign: 'middle',
    border: '1px solid #999',
  },
  summary: { textAlign: 'center', marginTop: '1rem' },
  error: { color: '#e94560' },
  confirmButton: {
    padding: '0.6rem 1.5rem',
    fontSize: '1rem',
    cursor: 'pointer',
    background: '#1a1a2e',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
  },
}

export default SeatSelectionPage