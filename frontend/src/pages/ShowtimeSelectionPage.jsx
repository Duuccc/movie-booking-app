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
    Promise.all([api.getMovie(movieId), api.listShowtimes(), api.listTheaters()])
      .then(([movieData, allShowtimes, allTheaters]) => {
        setMovie(movieData)
        setShowtimes(allShowtimes.filter((s) => s.movie_id === Number(movieId)))
        setTheaters(Object.fromEntries(allTheaters.map((t) => [t.id, t])))
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [movieId])

  if (loading) return <p className="status-message">Loading showtimes...</p>
  if (error) return <p className="status-message error">{error}</p>

  const byTheater = showtimes.reduce((acc, showtime) => {
    const key = showtime.theater_id
    if (!acc[key]) acc[key] = []
    acc[key].push(showtime)
    return acc
  }, {})

  return (
    <div className="page-medium">
      <Link to={`/movies/${movieId}`} className="back-link">&larr; Back to {movie?.title || 'movie'}</Link>
      <h1 className="page-title">Showtimes</h1>
      <p className="page-subtitle">{movie?.title}</p>

      {showtimes.length === 0 && <p className="status-message">No showtimes scheduled for this movie yet.</p>}

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

export default ShowtimeSelectionPage