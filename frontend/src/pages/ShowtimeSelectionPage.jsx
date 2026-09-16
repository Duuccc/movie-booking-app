import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { api } from '../services/api'

// 'en-CA' reliably produces YYYY-MM-DD regardless of the browser's
// locale/timezone settings -- we need that as a stable grouping key,
// separate from whatever human-readable label we show in the UI.
function getDayKey(startTime) {
  return new Date(startTime).toLocaleDateString('en-CA')
}

function getDayLabel(startTime) {
  return new Date(startTime).toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function ShowtimeSelectionPage() {
  const { movieId } = useParams()
  const navigate = useNavigate()
  const [movie, setMovie] = useState(null)
  const [showtimes, setShowtimes] = useState([])
  const [theaters, setTheaters] = useState({})
  const [selectedDay, setSelectedDay] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([api.getMovie(movieId), api.listShowtimes(), api.listTheaters()])
      .then(([movieData, allShowtimes, allTheaters]) => {
        const now = new Date()
        const forMovie = allShowtimes
          .filter((s) => s.movie_id === Number(movieId) && new Date(s.start_time) >= now)
          .slice()
          .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
        setMovie(movieData)
        setShowtimes(forMovie)
        setTheaters(Object.fromEntries(allTheaters.map((t) => [t.id, t])))
        if (forMovie.length > 0) setSelectedDay(getDayKey(forMovie[0].start_time))
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [movieId])

  if (loading) return <p className="status-message">Loading showtimes...</p>
  if (error) return <p className="status-message error">{error}</p>

  // One entry per distinct day, in chronological order (showtimes is
  // already sorted, so first-seen order is correct order).
  const days = []
  const seenDayKeys = new Set()
  for (const s of showtimes) {
    const key = getDayKey(s.start_time)
    if (!seenDayKeys.has(key)) {
      seenDayKeys.add(key)
      days.push({ key, label: getDayLabel(s.start_time) })
    }
  }

  const dayShowtimes = showtimes.filter((s) => getDayKey(s.start_time) === selectedDay)

  const byTheater = dayShowtimes.reduce((acc, showtime) => {
    const key = showtime.theater_id
    if (!acc[key]) acc[key] = []
    acc[key].push(showtime)
    return acc
  }, {})

  return (
    <div className="page-medium">
      <Link to={`/movies/${movieId}`} className="back-link">
        &larr; Back to {movie?.title || 'movie'}
      </Link>
      <h1 className="page-title">Showtimes</h1>
      <p className="page-subtitle">{movie?.title}</p>

      {showtimes.length === 0 && (
        <p className="status-message">No showtimes scheduled for this movie yet.</p>
      )}

      {days.length > 0 && (
        <div className="day-row">
          {days.map((day) => (
            <button
              key={day.key}
              onClick={() => setSelectedDay(day.key)}
              className={'day-pill' + (day.key === selectedDay ? ' day-pill-active' : '')}
            >
              {day.label}
            </button>
          ))}
        </div>
      )}

      {showtimes.length > 0 && dayShowtimes.length === 0 && (
        <p className="status-message">No showtimes on this day.</p>
      )}

      {Object.entries(byTheater).map(([theaterId, theaterShowtimes]) => (
        <div key={theaterId} className="theater-block">
          <h3 className="theater-name">{theaters[theaterId]?.name || 'Theater'}</h3>
          <p className="theater-location">{theaters[theaterId]?.location}</p>
          <div className="time-row">
            {theaterShowtimes
              .slice()
              .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
              .map((showtime) => (
                <button
                  key={showtime.id}
                  className="time-btn"
                  onClick={() => navigate(`/showtimes/${showtime.id}/seats`)}
                >
                  {new Date(showtime.start_time).toLocaleString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </button>
              ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default ShowtimeSelectionPage