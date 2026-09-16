import { useEffect, useState } from 'react'
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

  useEffect(() => {
    api
      .getBooking(bookingId)
      .then((bookingData) => {
        setBooking(bookingData)
        // Already paid? No reason to sit on a checkout page -- send them
        // straight to the confirmation.
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

        const remaining = Math.max(0, Math.ceil((expiresAt - now) / 1000))

        setSecondsLeft(remaining)
    }

    updateCountdown()

    const timer = setInterval(updateCountdown, 1000)

    return () => clearInterval(timer)
    }, [booking])

    useEffect(() => {
        if (secondsLeft !== 0) return

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
    const minutes = Math.floor(secondsLeft/60)
    const seconds = secondsLeft % 60

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
      <h1 className="page-title">Checkout</h1>
      <p className="page-subtitle">Your seats are held. Complete payment to confirm.</p>
        {secondsLeft !== null && (
            <div className="checkout-timer">
                Time remaining:{' '}
                {Math.floor(secondsLeft / 60)}:
                {String(secondsLeft % 60).padStart(2, '0')}
            </div>
            )}
      <div className="card" style={{ padding: '1.5rem' }}>
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

        {/* Mock-only control so the failure path is demonstrable.
            A real gateway decides this itself; this checkbox would not exist. */}
        <label className="simulate-toggle">
          <input
            type="checkbox"
            checked={simulateFailure}
            onChange={(e) => setSimulateFailure(e.target.checked)}
          />
          Simulate a declined payment (demo only)
        </label>

        {payError && <p className="error-text">{payError}</p>}

        <button onClick={handlePay} disabled={paying} className="btn btn-primary btn-block">
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