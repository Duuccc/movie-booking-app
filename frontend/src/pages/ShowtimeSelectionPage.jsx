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

  if (loading) return <p style={styles.status}>Loading showtimes...</p>
  if (error) return <p style={{ ...styles.status, color: '#e94560' }}>{error}</p>

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
    <div style={styles.container}>
      <Link to={`/movies/${movieId}`}>&larr; Back to {movie?.title || 'movie'}</Link>
      <h1>Showtimes for {movie?.title}</h1>

      {showtimes.length === 0 && <p>No showtimes scheduled for this movie yet.</p>}

      {days.length > 0 && (
        <div style={styles.daysRow}>
          {days.map((day) => (
            <button
              key={day.key}
              onClick={() => setSelectedDay(day.key)}
              style={day.key === selectedDay ? styles.dayButtonActive : styles.dayButton}
            >
              {day.label}
            </button>
          ))}
        </div>
      )}

      {showtimes.length > 0 && dayShowtimes.length === 0 && (
        <p>No showtimes on this day.</p>
      )}

      {Object.entries(byTheater).map(([theaterId, theaterShowtimes]) => (
        <div key={theaterId} style={styles.theaterBlock}>
          <h3 style={styles.theaterName}>{theaters[theaterId]?.name || 'Theater'}</h3>
          <p style={styles.location}>{theaters[theaterId]?.location}</p>
          <div style={styles.timesRow}>
            {theaterShowtimes
              .slice()
              .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
              .map((showtime) => (
                <button
                  key={showtime.id}
                  style={styles.timeButton}
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

const styles = {
  status: { textAlign: 'center', marginTop: '3rem' },
  container: { maxWidth: '700px', margin: '0 auto', padding: '1.5rem' },
  daysRow: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem' },
  dayButton: {
    padding: '0.5rem 0.9rem',
    border: '1px solid #ccc',
    borderRadius: '999px',
    background: '#fff',
    cursor: 'pointer',
  },
  dayButtonActive: {
    padding: '0.5rem 0.9rem',
    border: '1px solid #1a1a2e',
    borderRadius: '999px',
    background: '#1a1a2e',
    color: '#fff',
    cursor: 'pointer',
  },
  theaterBlock: { marginTop: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid #eee' },
  theaterName: { margin: '0 0 0.15rem' },
  location: { color: '#666', fontSize: '0.85rem', margin: '0 0 0.5rem' },
  timesRow: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap' },
  timeButton: {
    padding: '0.5rem 0.9rem',
    border: '1px solid #1a1a2e',
    borderRadius: '4px',
    background: '#fff',
    cursor: 'pointer',
  },
}

export default ShowtimeSelectionPage