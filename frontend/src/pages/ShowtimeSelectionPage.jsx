// pages/ShowtimeSelectionPage.jsx
import { useEffect, useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api, getUpcomingDates } from '../services/api'

const DATES = getUpcomingDates(7)

function formatTime(isoString) {
  return new Date(isoString).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
}

function ShowtimeSelectionPage() {
  const { movieId } = useParams()
  const [movie, setMovie] = useState(null)
  const [theaters, setTheaters] = useState([])
  const [selectedDate, setSelectedDate] = useState(DATES[0].key)
  const [selectedTheaterId, setSelectedTheaterId] = useState('')
  const [showtimes, setShowtimes] = useState([])
  const [availability, setAvailability] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([api.getMovie(movieId), api.listTheaters()])
      .then(([movieData, theaterData]) => {
        setMovie(movieData)
        setTheaters(theaterData)
      })
      .catch((err) => setError(err.message))
  }, [movieId])

  useEffect(() => {
    setLoading(true)
    api
      .listShowtimes({ date: selectedDate, theaterId: selectedTheaterId || undefined })
      .then((allShowtimes) => {
        // Backend filters by date/theater but not by movie -- narrow to
        // this movie client-side, same as the page's original behavior.
        const forMovie = allShowtimes
          .filter((s) => s.movie_id === Number(movieId))
          .slice()
          .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
        setShowtimes(forMovie)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [movieId, selectedDate, selectedTheaterId])

  const now = Date.now()
  const visibleShowtimes = useMemo(() => {
    return selectedDate === DATES[0].key
      ? showtimes.filter((s) => new Date(s.start_time).getTime() >= now)
      : showtimes
  }, [showtimes, selectedDate]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (visibleShowtimes.length === 0) {
      setAvailability({})
      return
    }
    api
      .listShowtimesAvailability(visibleShowtimes.map((s) => s.id))
      .then((rows) => {
        const map = {}
        rows.forEach((r) => { map[r.showtime_id] = r.available_seats })
        setAvailability(map)
      })
      .catch(() => {})
  }, [visibleShowtimes])

  if (error) return <p className="status-message error">{error}</p>

  return (
    <div className="page-medium">
      <Link to={`/movies/${movieId}`} className="back-link">
        &larr; Back to {movie?.title || 'movie'}
      </Link>
      <h1 className="page-title">Showtimes</h1>
      <p className="page-subtitle">{movie?.title}</p>

      <div className="field" style={{ maxWidth: 260 }}>
        <select
          className="input theater-select"
          value={selectedTheaterId}
          onChange={(e) => setSelectedTheaterId(e.target.value)}
        >
          <option value="">All theaters</option>
          {theaters.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      <div className="date-tabs">
        {DATES.map((d) => (
          <button
            key={d.key}
            type="button"
            onClick={() => setSelectedDate(d.key)}
            className={'date-tab' + (selectedDate === d.key ? ' date-tab-active' : '')}
          >
            <span className="date-tab-day">{d.dayNum}</span>
            <span className="date-tab-weekday">{d.weekday}</span>
          </button>
        ))}
      </div>

      {loading && <p className="status-message">Loading showtimes...</p>}

      {!loading && visibleShowtimes.length === 0 && (
        <p className="status-message">No showtimes for this date.</p>
      )}

      {!loading && visibleShowtimes.length > 0 && (
        <div className="time-row">
          {visibleShowtimes.map((showtime) => (
            <Link key={showtime.id} to={`/showtimes/${showtime.id}/seats`} className="time-btn">
              <span>{formatTime(showtime.start_time)}</span>
              {availability[showtime.id] !== undefined && (
                <span className="time-btn-seats">{availability[showtime.id]} seats left</span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default ShowtimeSelectionPage