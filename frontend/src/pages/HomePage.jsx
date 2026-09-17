import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, getUpcomingDates, resolvePosterUrl } from '../services/api'
import PosterImage from '../components/PosterImage'

const DATES = getUpcomingDates(7)

function formatTime(isoString) {
  return new Date(isoString).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
}

function HomePage() {
  const [selectedDate, setSelectedDate] = useState(DATES[0].key)
  const [selectedTheaterId, setSelectedTheaterId] = useState('')
  const [theaters, setTheaters] = useState([])
  const [movies, setMovies] = useState([])
  const [showtimes, setShowtimes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Theaters (for the dropdown) and movies (to join titles/posters onto
  // showtimes -- ShowtimeOut only carries movie_id, not a nested movie)
  // are stable lists, fetched once.
  useEffect(() => {
    Promise.all([api.listTheaters(), api.listMovies()])
      .then(([theaterData, movieData]) => {
        setTheaters(theaterData)
        setMovies(movieData)
      })
      .catch((err) => setError(err.message))
  }, [])

  // Showtimes refetch whenever the selected date or theater changes.
  useEffect(() => {
    setLoading(true)
    api
      .listShowtimes({ date: selectedDate, theaterId: selectedTheaterId || undefined })
      .then(setShowtimes)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [selectedDate, selectedTheaterId])

  const movieById = new Map(movies.map((m) => [m.id, m]))

  // Past showtimes only matter when "today" is selected -- any other
  // selected date is entirely in the future already.
  const now = Date.now()
  const visibleShowtimes =
    selectedDate === DATES[0].key
      ? showtimes.filter((s) => new Date(s.start_time).getTime() >= now)
      : showtimes

  // Group by movie, preserving start_time order within each group (the
  // backend already returns showtimes ordered by start_time).
  const groups = new Map()
  for (const showtime of visibleShowtimes) {
    const movie = movieById.get(showtime.movie_id)
    if (!movie) continue // movie deleted or not yet loaded -- skip rather than crash
    if (!groups.has(movie.id)) groups.set(movie.id, { movie, showtimes: [] })
    groups.get(movie.id).showtimes.push(showtime)
  }
  const movieGroups = Array.from(groups.values())

  return (
    <div className="page">
      <h1 className="page-title">Now Showing</h1>
      <p className="page-subtitle">Pick a date and time, grab your seats.</p>

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

      <div className="home-filters">
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

      {loading && <p className="status-message">Loading showtimes...</p>}
      {error && <p className="status-message error">{error}</p>}

      {!loading && !error && movieGroups.length === 0 && (
        <p className="status-message">No showtimes for this date.</p>
      )}

      <div className="showtime-list">
        {movieGroups.map(({ movie, showtimes: movieShowtimes }) => (
          <div key={movie.id} className="card showtime-movie-card">
            <Link to={`/movies/${movie.id}`} className="showtime-movie-poster">
              <PosterImage posterUrl={movie.poster_url} title={movie.title} style={{ width: '100%', height: '100%' }} />
            </Link>
            <div className="showtime-movie-info">
              <Link to={`/movies/${movie.id}`} className="showtime-movie-title-link">
                <h3 className="showtime-movie-title">{movie.title}</h3>
              </Link>
              <p className="showtime-movie-meta">
                {movie.genre} · {movie.duration} min
              </p>
              <div className="time-row">
                {movieShowtimes.map((s) => (
                  <Link key={s.id} to={`/showtimes/${s.id}/seats`} className="time-btn">
                    {formatTime(s.start_time)}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default HomePage