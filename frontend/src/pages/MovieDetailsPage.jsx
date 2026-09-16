import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../services/api'
import PosterImage from '../components/PosterImage'

function MovieDetailsPage() {
  const { movieId } = useParams()
  const [movie, setMovie] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .getMovie(movieId)
      .then(setMovie)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [movieId])

  if (loading) return <p className="status-message">Loading...</p>
  if (error) return <p className="status-message error">{error}</p>
  if (!movie) return null

  return (
    <div className="page-medium">
      <Link to="/" className="back-link">&larr; Back to movies</Link>
      <div style={{ display: 'flex', gap: '2rem', marginTop: '1rem', flexWrap: 'wrap' }}>
        <PosterImage
          posterUrl={movie.poster_url}
          title={movie.title}
          style={{ width: '220px', height: '330px', borderRadius: '10px', flexShrink: 0 }}
        />
        <div style={{ flex: 1, minWidth: '220px' }}>
          <h1 style={{ marginTop: 0 }}>{movie.title}</h1>
          <p style={{ color: 'var(--muted)' }}>
            {movie.genre} · {movie.duration} min · {movie.release_date}
          </p>
          <p style={{ lineHeight: 1.7 }}>{movie.description}</p>
          <Link to={`/movies/${movieId}/showtimes`} className="btn btn-primary">
            View Showtimes
          </Link>
        </div>
      </div>
    </div>
  )
}

export default MovieDetailsPage