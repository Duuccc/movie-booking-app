import { useEffect, useState, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
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

function ShowtimesPage() {
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

  const [theaters, setTheaters] = useState([])
  const [movies, setMovies] = useState([])
  const [showtimes, setShowtimes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [availability, setAvailability] = useState({})

  useEffect(() => {
    Promise.all([api.listTheaters(), api.listMovies()])
      .then(([theaterData, movieData]) => {
        setTheaters(theaterData)
        setMovies(movieData)
      })
      .catch((err) => setError(err.message))
  }, [])

  useEffect(() => {
    setLoading(true)
    api
      .listShowtimes({ date: selectedDate, theaterId: selectedTheaterId || undefined })
      .then(setShowtimes)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [selectedDate, selectedTheaterId])

  const movieById = new Map(movies.map((m) => [m.id, m]))
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
    const ids = visibleShowtimes.map((s) => s.id)
    api
      .listShowtimesAvailability(ids)
      .then((rows) => {
        const map = {}
        rows.forEach((r) => { map[r.showtime_id] = r.available_seats })
        setAvailability(map)
      })
      .catch(() => {})
  }, [visibleShowtimes])

  const groups = new Map()
  for (const showtime of visibleShowtimes) {
    const movie = movieById.get(showtime.movie_id)
    if (!movie) continue
    if (!groups.has(movie.id)) groups.set(movie.id, { movie, showtimes: [] })
    groups.get(movie.id).showtimes.push(showtime)
  }
  const movieGroups = Array.from(groups.values())

  return (
    <>
      <div className="schedule-subheader">
        <div className="schedule-subheader-inner">
          <label className="schedule-filter-label" htmlFor="theater-filter-all">Theater</label>
          <select
            id="theater-filter-all"
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
      </div>

      <div className="page">
        <h1 className="showtimes-select-title">Showtimes</h1>

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
        {error && <p className="status-message error">{error}</p>}

        {!loading && !error && movieGroups.length === 0 && (
          <p className="status-message">No showtimes for this date.</p>
        )}

        <div className="showtime-list">
          {movieGroups.map(({ movie, showtimes: movieShowtimes }) => (
            <div key={movie.id} className="showtime-movie-row">
              <Link to={`/movies/${movie.id}`} className="showtime-movie-poster">
                <PosterImage posterUrl={movie.poster_url} title={movie.title} style={{ width: '100%', height: '100%' }} />
              </Link>
              <div className="showtime-movie-info">
                <Link to={`/movies/${movie.id}`} className="showtime-movie-title-link">
                  <h3 className="showtime-movie-title">{movie.title}</h3>
                </Link>
                <p className="movie-details-tag">{movie.genre}</p>

                <p className="showtime-movie-meta">{movie.duration} min</p>
                <div className="time-row">
                  {movieShowtimes.map((s) => (
                    <Link key={s.id} to={`/showtimes/${s.id}/seats`} className="time-btn">
                      <span className="time-btn-time">{formatTime(s.start_time)}</span>
                      {availability[s.id] !== undefined && (
                        <span className="time-btn-seats">{availability[s.id]} left</span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

export default ShowtimesPage