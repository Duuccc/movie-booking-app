import { useEffect, useRef, useState } from 'react'
import { api, isValidYoutubeUrl } from '../services/api'
import PosterImage from '../components/PosterImage'

const emptyForm = { title: '', description: '', duration: '', genre: '', release_date: '', poster_url: '', trailer_url: '' }

const ALLOWED_POSTER_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_POSTER_BYTES = 5 * 1024 * 1024 // mirrors the backend's 5 MB limit

function AdminMoviesPage() {
  const [movies, setMovies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  // The chosen poster file is only held here until the form is submitted;
  // the movie is saved first (it needs an id), then the file is uploaded.
  const [posterFile, setPosterFile] = useState(null)
  const [posterPreview, setPosterPreview] = useState(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    loadMovies()
  }, [])

  // Local preview of the chosen file. The object URL must be revoked when
  // the file changes or the page unmounts, or the browser keeps it in memory.
  useEffect(() => {
    if (!posterFile) {
      setPosterPreview(null)
      return
    }
    const url = URL.createObjectURL(posterFile)
    setPosterPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [posterFile])

  function loadMovies() {
    setLoading(true)
    api
      .listMovies()
      .then(setMovies)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  function startEdit(movie) {
    setEditingId(movie.id)
    setPosterFile(null)
    setForm({
      title: movie.title,
      description: movie.description || '',
      duration: movie.duration,
      genre: movie.genre || '',
      release_date: movie.release_date || '',
      poster_url: movie.poster_url || '',
      trailer_url: movie.trailer_url || ''
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(emptyForm)
    setPosterFile(null)
  }

  function handlePosterFileChange(event) {
    const file = event.target.files[0]
    event.target.value = '' // so picking the same file again still fires onChange
    if (!file) return

    if (!ALLOWED_POSTER_TYPES.includes(file.type)) {
      setError('Poster must be a JPEG, PNG or WEBP image.')
      return
    }
    if (file.size > MAX_POSTER_BYTES) {
      setError('Poster must be 5 MB or smaller.')
      return
    }
    setError('')
    setPosterFile(file)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    if (!isValidYoutubeUrl(form.trailer_url)) {
      setError('Trailer URL must be a valid YouTube link (e.g. youtube.com/watch?v=... or youtu.be/...)')
      return
    }

    setSubmitting(true)
    const payload = {
      ...form,
      duration: Number(form.duration),
      release_date: form.release_date || null,
    }

    try {
      // Step 1: save the movie itself (JSON). Both endpoints return the
      // saved movie, which is where a brand-new movie's id comes from.
      let savedMovie
      try {
        savedMovie = editingId
          ? await api.updateMovie(editingId, payload)
          : await api.createMovie(payload)
      } catch (err) {
        setError(err.message)
        return
      }

      // Step 2: upload the poster against that id, if one was chosen.
      if (posterFile) {
        try {
          await api.uploadMoviePoster(savedMovie.id, posterFile)
        } catch (err) {
          // The movie IS saved at this point. Switch the form into edit mode
          // for it, so pressing Save again retries the upload instead of
          // creating a duplicate movie.
          setEditingId(savedMovie.id)
          setError(`Movie saved, but the poster upload failed: ${err.message}. Press Save Changes to retry.`)
          loadMovies()
          return
        }
      }

      cancelEdit()
      loadMovies()
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(movieId) {
    if (!window.confirm('Delete this movie? This also removes its showtimes.')) return
    try {
      await api.deleteMovie(movieId)
      loadMovies()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="page-medium">
      <h1 className="page-title">Manage Movies</h1>

      <form onSubmit={handleSubmit} className="form-card" style={{ marginBottom: '1.75rem' }}>
        <h3 style={{ marginTop: 0 }}>{editingId ? 'Edit Movie' : 'Add Movie'}</h3>
        <div className="field">
          <label>Title</label>
          <input
            className="input"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
        </div>
        <div className="field">
          <label>Description</label>
          <textarea
            className="input"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Duration (minutes)</label>
          <input
            type="number"
            className="input"
            value={form.duration}
            onChange={(e) => setForm({ ...form, duration: e.target.value })}
            required
          />
        </div>
        <div className="field">
          <label>Genre</label>
          <input
            className="input"
            value={form.genre}
            onChange={(e) => setForm({ ...form, genre: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Release Date</label>
          <input
            type="date"
            className="input"
            value={form.release_date}
            onChange={(e) => setForm({ ...form, release_date: e.target.value })}
          />
        </div>

        <div className="field">
          <label>Poster image</label>
          <div className="poster-field">
            {posterPreview ? (
              <div className="poster-field-preview">
                <img src={posterPreview} alt="Selected poster preview" />
              </div>
            ) : (
              // key remounts PosterImage when the URL changes, so a broken
              // intermediate URL (hidden by its onError) can't stay hidden.
              <PosterImage
                key={form.poster_url}
                posterUrl={form.poster_url}
                title=""
                className="poster-field-preview"
              />
            )}
            <div className="poster-field-controls">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => fileInputRef.current.click()}
              >
                {posterFile ? 'Change image' : 'Choose image'}
              </button>
              {posterFile && (
                <>
                  <p className="poster-field-hint">{posterFile.name}</p>
                  <button type="button" className="link-btn danger" onClick={() => setPosterFile(null)}>
                    Remove
                  </button>
                </>
              )}
              <p className="poster-field-hint">JPEG, PNG or WEBP, up to 5 MB. Uploaded when you save.</p>
            </div>
          </div>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            ref={fileInputRef}
            onChange={handlePosterFileChange}
            style={{ display: 'none' }}
          />
        </div>

        <div className="field">
          <label>Poster URL (optional -- replaced if you upload an image above)</label>
          <input
            className="input"
            value={form.poster_url}
            onChange={(e) => setForm({ ...form, poster_url: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Trailer URL (YouTube link)</label>
          <input
            className="input"
            value={form.trailer_url}
            onChange={(e) => setForm({ ...form, trailer_url: e.target.value })}
          />
        </div>
        {error && <p className="error-text">{error}</p>}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="submit" disabled={submitting} className="btn btn-primary">
            {submitting ? 'Saving...' : editingId ? 'Save Changes' : 'Add Movie'}
          </button>
          {editingId && (
            <button type="button" onClick={cancelEdit} className="btn btn-ghost">
              Cancel
            </button>
          )}
        </div>
      </form>

      {loading ? (
        <p className="status-message">Loading movies...</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th></th>
                <th>Title</th>
                <th>Genre</th>
                <th>Duration</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {movies.map((movie) => (
                <tr key={movie.id}>
                  <td>
                    <PosterImage
                      posterUrl={movie.poster_url}
                      title={movie.title}
                      style={{ width: '40px', height: '60px', borderRadius: '5px' }}
                    />
                  </td>
                  <td>{movie.title}</td>
                  <td>{movie.genre}</td>
                  <td>{movie.duration} min</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button onClick={() => startEdit(movie)} className="link-btn" style={{ marginRight: '0.75rem' }}>Edit</button>
                    <button onClick={() => handleDelete(movie.id)} className="link-btn danger">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default AdminMoviesPage