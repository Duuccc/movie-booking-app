import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../services/api'
import PosterImage from '../components/PosterImage'

function MovieListPage() {
  const [movies, setMovies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .listMovies()
      .then(setMovies)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="status-message">Loading movies...</p>
  if (error) return <p className="status-message error">{error}</p>
  if (movies.length === 0) return <p className="status-message">No movies available yet.</p>

  return (
    <div className="page">
      <h1 className="page-title">Now Showing</h1>
      <p className="page-subtitle">Pick something and grab your seats.</p>
      <div className="movie-grid">
        {movies.map((movie) => (
          <Link to={`/movies/${movie.id}`} key={movie.id} className="movie-card">
            <PosterImage
              posterUrl={movie.poster_url}
              title={movie.title}
              style={{ width: '100%', aspectRatio: '2 / 3' }}
            />
            <div className="movie-card-body">
              <h3 className="movie-card-title">{movie.title}</h3>
              <p className="movie-card-meta">{movie.genre} · {movie.duration} min</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default MovieListPage