import { resolvePosterUrl } from '../services/api'

/**
 * Renders a movie poster if one exists. Falls back to a plain
 * placeholder if poster_url is empty/missing, or if the image URL is
 * broken (deleted file, bad external link, etc.) -- so a missing
 * poster always shows *something*, never a blank broken-image icon.
 */
function PosterImage({ posterUrl, title, style, className }) {
  const resolvedUrl = resolvePosterUrl(posterUrl)

  function handleImageError(event) {
    event.target.style.display = 'none'
    event.target.nextSibling.style.display = 'flex'
  }

  return (
    <div
      className={className}
      style={{ position: 'relative', overflow: 'hidden', ...style }}
    >
      {resolvedUrl && (
        <img
          src={resolvedUrl}
          alt={title}
          onError={handleImageError}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      )}
      <div className="poster-fallback" style={{ display: resolvedUrl ? 'none' : 'flex' }}>
        {title || 'No Poster'}
      </div>
    </div>
  )
}

export default PosterImage