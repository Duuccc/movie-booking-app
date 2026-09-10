import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { api } from '../services/api'

function ShowtimeSelectionPage() {
  const { movieId } = useParams()
  const navigate = useNavigate()
  const [movie, setMovie] = useState(null)
  const [showtimes, setShowtimes] = useState([])
  const [theaters, setTheaters] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    // GET /showtimes has no query params to filter by movie, so we fetch
    // everything and filter client-side. Fine at this project's scale;
    // would need a real query param if the showtime list ever got large.
    Promise.all([api.getMovie(movieId), api.listShowtimes(), api.listTheaters()])
      .then(([movieData, allShowtimes, allTheaters]) => {
        setMovie(movieData)
        setShowtimes(allShowtimes.filter((s) => s.movie_id === Number(movieId)))
        setTheaters(Object.fromEntries(allTheaters.map((t) => [t.id, t])))
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [movieId])

  if (loading) return <p style={styles.status}>Loading showtimes...</p>
  if (error) return <p style={{ ...styles.status, color: '#e94560' }}>{error}</p>

  const byTheater = showtimes.reduce((acc, showtime) => {
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
                    weekday: 'short',
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