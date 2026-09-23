import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../services/api'
import PosterImage from '../components/PosterImage'

const CATEGORIES = [
  { key: 'showing', label: 'Now Showing' },
  { key: 'coming_soon', label: 'Coming Soon' },
  { key: 'trending', label: 'Trending' },
]

function MovieListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const category = searchParams.get("category") || CATEGORIES[0].key
  const [movies, setMovies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    api
      .listMovies(category)
      .then(setMovies)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [category])

  function selectCategory(key) {
    if(key === CATEGORIES[0].key) {
      setSearchParams({})
    } else {
      setSearchParams({ category: key })
    }
  }

  return (
    <div className="page">
      <h1 className="page-title">Movies</h1>
      <p className="page-subtitle">Pick something and grab your seats.</p>

      <div className="category-tabs">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => selectCategory(c.key)}
            className={'category-tab' + (category === c.key ? ' category-tab-active' : '')}
          >
            {c.label}
          </button>
        ))}
      </div>

      {loading && <p className="status-message">Loading movies...</p>}
      {error && <p className="status-message error">{error}</p>}
      {!loading && !error && movies.length === 0 && (
        <p className="status-message">No movies in this category yet.</p>
      )}

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