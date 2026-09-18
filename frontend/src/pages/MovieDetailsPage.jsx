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

  if (loading) return <p className="status-message">Loading...</p>
  if (error) return <p className="status-message error">{error}</p>
  if (!movie) return null

  const embedUrl = movie.trailer_url ? resolveYoutubeEmbedUrl(movie.trailer_url) : null

  return (
    <div className="page">
      <Link to="/" className="back-link">&larr; Back to movies</Link>

      <div className="movie-details-layout">
        <PosterImage
          posterUrl={movie.poster_url}
          title={movie.title}
          className="movie-details-poster"
        />
        <div className="movie-details-info">
          <h1 className="movie-details-title">{movie.title}</h1>
          <p className="movie-details-meta">
            {movie.genre} · {movie.duration} min · {movie.release_date}
          </p>
          <p className="movie-details-description">{movie.description}</p>
          <Link to={`/movies/${movieId}/showtimes`} className="btn btn-primary">
            View Showtimes
          </Link>
        </div>
      </div>

      {embedUrl && (
        <div className="movie-details-trailer">
          <h3>Trailer</h3>
          <div className="trailer-frame">
            <iframe
              src={embedUrl}
              title={`${movie.title} trailer`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default MovieDetailsPage