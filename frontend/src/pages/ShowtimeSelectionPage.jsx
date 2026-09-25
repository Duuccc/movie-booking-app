import { useEffect, useState, useMemo } from 'react'
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom'
import { api, getUpcomingDates } from '../services/api'
import PosterImage from '../components/PosterImage'

const DATES = getUpcomingDates(7)

function formatTime(isoString) {
  return new Date(isoString).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
}

const FORMAT_ORDER = ['2D', '3D', 'IMAX']

function groupByFormat(showtimes) {
  const groups = {}
  for (const s of showtimes) {
    const fmt = s.format || '2D'
    if (!groups[fmt]) groups[fmt] = []
    groups[fmt].push(s)
  }
  // Sắp theo thứ tự cố định 2D → 3D → IMAX, format nào không nằm trong
  // FORMAT_ORDER (không nên xảy ra, nhưng để an toàn) thì xếp cuối.
  return FORMAT_ORDER.filter((fmt) => groups[fmt]?.length > 0).map((fmt) => ({
    format: fmt,
    showtimes: groups[fmt],
  }))
}

function ShowtimeSelectionPage() {
  const { movieId } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const selectedDate = searchParams.get('date') || DATES[0].key
  const selectedTheaterId = searchParams.get('theater_id') || ''

  function updateParams(updates) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        Object.entries(updates).forEach(([key, value]) => {
          if (!value) next.delete(key)
          else next.set(key, value)
        })
        return next
      },
      { replace: true }
    )
  }

  const [movie, setMovie] = useState(null)
  const [theaters, setTheaters] = useState([])
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
    <div className="page">
      <button onClick={() => navigate(-1)} className="back-link" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
        &larr; Back to {movie?.title || 'movie'}
      </button>

      <div className="showtime-select-header">
        <PosterImage
          posterUrl={movie?.poster_url}
          title={movie?.title}
          className="showtime-select-poster"
        />
        <div className="showtime-select-info">
          <h1 className="movie-details-title">{movie?.title}</h1>
          <p className="movie-details-tag">{movie?.genre}</p>
          <p className="movie-details-meta">
            {movie?.duration} min &middot; {movie?.release_date}
          </p>
          {movie?.description && (
            <p className="showtime-select-description">{movie.description}</p>
          )}
        </div>
      </div>

      <div className="showtime-select-schedule">
        <div className="schedule-filter-bar">
          <label className="schedule-filter-label" htmlFor="theater-filter">Theater</label>
          <select
            id="theater-filter"
            className="input theater-select"
            value={selectedTheaterId}
            onChange={(e) => updateParams({ theater_id: e.target.value })}
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
              onClick={() => updateParams({ date: d.key === DATES[0].key ? null : d.key })}
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
          <div className="format-sections">
            {groupByFormat(visibleShowtimes).map(({ format, showtimes: formatShowtimes }) => (
              <div key={format} className="format-section">
                <p className="format-section-label">{format}</p>
                <div className="time-row">
                  {formatShowtimes.map((showtime) => (
                    <Link key={showtime.id} to={`/showtimes/${showtime.id}/seats`} className="time-btn">
                      <span className="time-btn-time">{formatTime(showtime.start_time)}</span>
                      {availability[showtime.id] !== undefined && (
                        <span className="time-btn-seats">{availability[showtime.id]} left</span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default ShowtimeSelectionPage