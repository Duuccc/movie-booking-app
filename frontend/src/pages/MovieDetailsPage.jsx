import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api, resolveYoutubeEmbedUrl } from '../services/api'
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

  if (loading) return <p style={styles.status}>Loading...</p>
  if (error) return <p style={{ ...styles.status, color: '#e94560' }}>{error}</p>
  if (!movie) return null

  return (
    <div style={styles.container}>
      <Link to="/">&larr; Back to movies</Link>
      <div style={styles.layout}>
        <PosterImage
          posterUrl={movie.poster_url}
          title={movie.title}
          style={styles.poster}
        />
        <div>
          <h1 style={styles.title}>{movie.title}</h1>
          <p style={styles.meta}>
            {movie.genre} · {movie.duration} min · {movie.release_date}
          </p>
          <p>{movie.description}</p>
          {movie.trailer_url && resolveYoutubeEmbedUrl(movie.trailer_url) && (
            <div style={styles.trailerWrapper}>
              <iframe
                src={resolveYoutubeEmbedUrl(movie.trailer_url)}
                title={`${movie.title} trailer`}
                style={styles.trailer}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}
          <Link to={`/movies/${movieId}/showtimes`} style={styles.showtimesButton}>
            View Showtimes
          </Link>
        </div>
      </div>
    </div>
  )
}

const styles = {
  status: { textAlign: 'center', marginTop: '3rem' },
  container: { maxWidth: '800px', margin: '0 auto', padding: '1.5rem' },
  layout: { display: 'flex', gap: '2rem', marginTop: '1rem' },
  poster: { width: '220px', height: '330px', borderRadius: '8px' },
  title: { marginTop: 0 },
  meta: { color: '#666' },
  showtimesButton: {
    display: 'inline-block',
    marginTop: '1rem',
    padding: '0.6rem 1.2rem',
    background: '#1a1a2e',
    color: '#fff',
    textDecoration: 'none',
    borderRadius: '4px',
  },
  trailerWrapper: { position: 'relative', paddingTop: '56.25%', marginTop: '1rem' },
  trailer: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0, borderRadius: '8px' },  
}

export default MovieDetailsPage