import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../services/api'
import PosterImage from '../components/PosterImage'

function formatCountdown(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function MyBookingsPage() {
  const [bookings, setBookings] = useState([])
  const [showtimesById, setShowtimesById] = useState({})
  const [moviesById, setMoviesById] = useState({})
  const [theatersById, setTheatersById] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cancellingId, setCancellingId] = useState(null)
  const [countdowns, setCountdowns] = useState({}) // { [bookingId]: secondsLeft }
  const reloadPendingRef = useRef(false) // guards against multiple reload triggers in one tick

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
        reloadPendingRef.current = false
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  // Live per-row countdown for bookings that are still held but unpaid.
  // When any one of them hits zero, refetch once -- the backend (not this
  // effect) is the source of truth for whether it's actually expired.
  useEffect(() => {
    const pending = bookings.filter(
      (b) => b.status === 'CONFIRMED' && b.payment_status !== 'PAID' && b.expires_at
    )
    if (pending.length === 0) return

    function tick() {
      const now = Date.now()
      const next = {}
      let anyJustExpired = false

      for (const b of pending) {
        const secondsLeft = Math.max(0, Math.ceil((new Date(b.expires_at).getTime() - now) / 1000))
        next[b.id] = secondsLeft
        if (secondsLeft === 0) anyJustExpired = true
      }

      setCountdowns(next)

      if (anyJustExpired && !reloadPendingRef.current) {
        reloadPendingRef.current = true
        loadData()
      }
    }

    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [bookings])

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
      <h1 className="showtimes-select-title">My Bookings</h1>
      {bookings.map((booking) => {
        const showtime = showtimesById[booking.showtime_id]
        const movie = showtime ? moviesById[showtime.movie_id] : null
        const theater = showtime ? theatersById[showtime.theater_id] : null
        const isUnpaidHeld = booking.status === 'CONFIRMED' && booking.payment_status !== 'PAID'
        const secondsLeft = countdowns[booking.id]

        return (
          <div key={booking.id} className="booking-row">
            <PosterImage
              posterUrl={movie?.poster_url}
              title={movie?.title}
              className="booking-row-poster"
            />
            <div className="booking-row-body">
              <p className="booking-row-title">{movie?.title || `Showtime #${booking.showtime_id}`}</p>
              <p className="booking-row-sub">
                {theater?.name} · {showtime && new Date(showtime.start_time).toLocaleString()}
              </p>
              <p className="booking-row-seats">
                Seats: {booking.seats.map((s) => s.seat_number).sort().join(', ')}
              </p>
              <p className="booking-row-date">Booked {new Date(booking.created_at).toLocaleString()}</p>
              {isUnpaidHeld && secondsLeft !== undefined && (
                <p className={'booking-row-timer' + (secondsLeft <= 60 ? ' booking-row-timer-urgent' : '')}>
                  {secondsLeft > 0 ? `Held for ${formatCountdown(secondsLeft)}` : 'Expiring...'}
                </p>
              )}
            </div>
            <div className="booking-row-actions">
              <div className="confirmation-badges">
                <span className={`badge ${booking.status === 'CONFIRMED' ? 'badge-success' : 'badge-muted'}`}>
                  {booking.status}
                </span>
                <span className={`badge ${booking.payment_status === 'PAID' ? 'badge-success' : 'badge-muted'}`}>
                  {booking.payment_status}
                </span>
              </div>
              {isUnpaidHeld && (
                <Link to={`/bookings/${booking.id}/checkout`} className="btn btn-primary btn-sm">
                  Pay now
                </Link>
              )}
              {isUnpaidHeld && (
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