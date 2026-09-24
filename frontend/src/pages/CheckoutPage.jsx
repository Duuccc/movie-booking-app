import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { api, formatVnd } from '../services/api'

const METHODS = [
  { value: 'MOMO', label: 'MoMo' },
  { value: 'VNPAY', label: 'VNPay' },
  { value: 'CARD', label: 'Card' },
]

function CheckoutPage() {
  const { bookingId } = useParams()
  const navigate = useNavigate()
  const [booking, setBooking] = useState(null)
  const [movie, setMovie] = useState(null)
  const [showtime, setShowtime] = useState(null)
  const [method, setMethod] = useState('MOMO')
  const [simulateFailure, setSimulateFailure] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [payError, setPayError] = useState('')
  const [paying, setPaying] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(null)
  const payingRef = useRef(false)

  useEffect(() => {
    payingRef.current = paying
  }, [paying])

  useEffect(() => {
    api
      .getBooking(bookingId)
      .then((bookingData) => {
        setBooking(bookingData)
        if (bookingData.payment_status === 'PAID') {
          navigate(`/bookings/${bookingData.id}/confirmation`, { replace: true })
          return null
        }
        return api.getShowtime(bookingData.showtime_id)
      })
      .then((showtimeData) => {
        if (!showtimeData) return null
        setShowtime(showtimeData)
        return api.getMovie(showtimeData.movie_id)
      })
      .then((movieData) => {
        if (movieData) setMovie(movieData)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [bookingId, navigate])

  useEffect(() => {
    if (!booking?.expires_at) return

    function updateCountdown() {
      const expiresAt = new Date(booking.expires_at).getTime()
      const now = Date.now()
      setSecondsLeft(Math.max(0, Math.ceil((expiresAt - now) / 1000)))
    }

    updateCountdown()
    const timer = setInterval(updateCountdown, 1000)
    return () => clearInterval(timer)
  }, [booking])

  useEffect(() => {
    if (secondsLeft !== 0) return
    if (payingRef.current) return

    async function expireBooking() {
      try {
        await api.cancelBooking(Number(bookingId))
        navigate('/bookings')
      } catch (err) {
        setPayError(err.message)
      }
    }

    expireBooking()
  }, [secondsLeft, bookingId, navigate])

  async function handlePay() {
    setPayError('')
    setPaying(true)
    try {
      const payment = await api.payBooking(Number(bookingId), method, simulateFailure)
      if (payment.succeeded) {
        navigate(`/bookings/${bookingId}/confirmation`)
      } else {
        setPayError('Payment was declined. Your seats are still held — try another method.')
      }
    } catch (err) {
      setPayError(err.message)
    } finally {
      setPaying(false)
    }
  }

  if (loading) return <p className="status-message">Loading checkout...</p>
  if (error) return <p className="status-message error">{error}</p>
  if (!booking) return null

  const seatNumbers = booking.seats.map((s) => s.seat_number).sort().join(', ')

  return (
    <div className="page-narrow">
      <p className="movie-details-tag">Checkout</p>
      <h1 className="checkout-title">Complete Payment</h1>
      <p className="page-subtitle">Your seats are held. Pay to confirm.</p>

      {secondsLeft !== null && (
        <div className="checkout-timer">
          <span className="checkout-timer-label">Time remaining</span>
          <span className="checkout-timer-clock">
            {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
          </span>
        </div>
      )}

      <div className="card checkout-card">
        <dl className="confirmation-details" style={{ marginTop: 0 }}>
          <dt>Movie</dt>
          <dd>{movie?.title}</dd>
          <dt>Showtime</dt>
          <dd>{showtime && new Date(showtime.start_time).toLocaleString()}</dd>
          <dt>Seats</dt>
          <dd>{seatNumbers}</dd>
          <dt>Tickets</dt>
          <dd>{booking.total_seats}</dd>
        </dl>

        <div className="checkout-total">
          <span>Total</span>
          <strong>{formatVnd(booking.total_amount)}</strong>
        </div>

        <div className="field" style={{ marginTop: '1.25rem' }}>
          <label>Payment method</label>
          <div className="method-row">
            {METHODS.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMethod(m.value)}
                className={'method-btn' + (method === m.value ? ' method-btn-active' : '')}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <label className="simulate-toggle">
          <input
            type="checkbox"
            checked={simulateFailure}
            onChange={(e) => setSimulateFailure(e.target.checked)}
          />
          Simulate a declined payment (demo only)
        </label>

        {payError && <p className="error-text">{payError}</p>}

        <button
          onClick={handlePay}
          disabled={paying || secondsLeft === 0}
          className="btn btn-primary btn-block"
        >
          {paying ? 'Processing...' : `Pay ${formatVnd(booking.total_amount)}`}
        </button>

        <p className="mock-notice">
          This is a mock payment. No real transaction takes place.
        </p>
      </div>

      <p className="form-footer">
        <Link to="/bookings">Pay later from My Bookings</Link>
      </p>
    </div>
  )
}

export default CheckoutPage