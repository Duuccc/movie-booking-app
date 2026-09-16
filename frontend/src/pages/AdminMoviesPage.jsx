import { useEffect, useRef, useState } from 'react'
import { api, isValidYoutubeUrl } from '../services/api'
import PosterImage from '../components/PosterImage'

const emptyForm = { title: '', description: '', duration: '', genre: '', release_date: '', poster_url: '', trailer_url: '' }

function AdminMoviesPage() {
  const [movies, setMovies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  // Which movie's "Upload Poster" button was clicked -- the hidden file
  // input below is shared across every row, so we track which row it's
  // currently acting on rather than rendering one input per row.
  const [uploadingForId, setUploadingForId] = useState(null)
  const fileInputRef = useRef(null)
  // Tracks whether the file input's onChange actually fired (a file was
  // chosen), so the window-focus-based cancel detection below (see
  // triggerPosterUpload) knows whether to leave uploadingForId alone or
  // reset it.
  const fileWasSelectedRef = useRef(false)

  useEffect(() => {
    loadMovies()
  }, [])

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
      if (editingId) {
        await api.updateMovie(editingId, payload)
      } else {
        await api.createMovie(payload)
      }
      cancelEdit()
      loadMovies()
    } catch (err) {
      setError(err.message)
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

  function triggerPosterUpload(movieId) {
    fileWasSelectedRef.current = false
    setUploadingForId(movieId)
    fileInputRef.current.value = ''
    fileInputRef.current.click()

    // Browsers don't reliably fire a 'change' event when the native file
    // picker is dismissed via Cancel, so without this, uploadingForId
    // would stay stuck forever and the button would be frozen on
    // "Uploading...". Instead, listen for the window regaining focus
    // (which happens whether the dialog was cancelled OR a file was
    // picked), then check shortly after whether onChange actually ran.
    function handleWindowFocus() {
      window.removeEventListener('focus', handleWindowFocus)
      // Give onChange a brief moment to fire first, in case a file WAS
      // selected -- 'change' and 'focus' don't fire in a guaranteed
      // order across browsers.
      setTimeout(() => {
        if (!fileWasSelectedRef.current) {
          setUploadingForId(null)
        }
      }, 300)
    }
    window.addEventListener('focus', handleWindowFocus)
  }

  async function handlePosterFileSelected(event) {
    const file = event.target.files[0]
    event.target.value = '' // reset so picking the same file twice still fires onChange
    if (!file) return
    fileWasSelectedRef.current = true

    setError('')
    const movieId = uploadingForId
    try {
      await api.uploadMoviePoster(movieId, file)
      loadMovies()
    } catch (err) {
      setError(err.message)
    } finally {
      setUploadingForId(null)
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
          <label>Poster URL (optional -- or upload one after saving, below)</label>
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
                    <button
                      onClick={() => triggerPosterUpload(movie.id)}
                      disabled={uploadingForId === movie.id}
                      className="link-btn"
                      style={{ marginRight: '0.75rem' }}
                    >
                      {uploadingForId === movie.id ? 'Uploading...' : 'Upload Poster'}
                    </button>
                    <button onClick={() => handleDelete(movie.id)} className="link-btn danger">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* One shared, hidden file input for every row's "Upload Poster"
          button -- triggerPosterUpload() records which movie it's for,
          then simulates a click so the browser's native file picker opens. */}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        ref={fileInputRef}
        onChange={handlePosterFileSelected}
        style={{ display: 'none' }}
      />
    </div>
  )
}

export default AdminMoviesPage