import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, resolveYoutubeEmbedUrl } from '../services/api'
import PosterImage from '../components/PosterImage'

function MovieDetailsPage() {
  const { movieId } = useParams()
  const navigate = useNavigate()
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
      <button onClick={() => navigate(-1)} className="back-link" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
        &larr; Back to movies
      </button>

      <div className="movie-details-layout">
        <PosterImage
          posterUrl={movie.poster_url}
          title={movie.title}
          className="movie-details-poster"
        />
        <div className="movie-details-info">
          <p className="movie-details-tag">{movie.genre}</p>
          <h1 className="movie-details-title">{movie.title}</h1>
          <p className="movie-details-meta">
            {movie.duration} min &middot; {movie.release_date}
          </p>
          <p className="movie-details-description">{movie.description}</p>
          <button onClick={() => navigate(`/movies/${movieId}/showtimes`)} className="btn btn-primary">
            View Showtimes
          </button>
        </div>
      </div>

      {embedUrl && (
        <div className="movie-details-trailer">
          <h3 className="movie-details-trailer-label">Trailer</h3>
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