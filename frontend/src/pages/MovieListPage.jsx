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

  if (loading) return <p style={styles.status}>Loading movies...</p>
  if (error) return <p style={{ ...styles.status, color: '#e94560' }}>{error}</p>
  if (movies.length === 0) return <p style={styles.status}>No movies available yet.</p>

  return (
    <div style={styles.grid}>
      {movies.map((movie) => (
        <Link to={`/movies/${movie.id}`} key={movie.id} style={styles.card}>
          <PosterImage posterUrl={movie.poster_url} title={movie.title} style={styles.poster} />
          <div style={styles.cardBody}>
            <h3 style={styles.title}>{movie.title}</h3>
            <p style={styles.meta}>{movie.genre} · {movie.duration} min</p>
          </div>
        </Link>
      ))}
    </div>
  )
}

const styles = {
  status: { textAlign: 'center', marginTop: '3rem' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: '1.5rem',
    padding: '1.5rem',
  },
  card: {
    color: 'inherit',
    textDecoration: 'none',
    background: '#fff',
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  poster: { width: '100%', display: 'block', aspectRatio: '2 / 3', objectFit: 'cover' },
  cardBody: { padding: '0.75rem' },
  title: { margin: '0 0 0.25rem' },
  meta: { color: '#666', fontSize: '0.85rem', margin: 0 },
}

export default MovieListPage