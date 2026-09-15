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
    <div style={styles.container}>
      <h1>Manage Movies</h1>

      <form onSubmit={handleSubmit} style={styles.form}>
        <h3 style={styles.formHeading}>{editingId ? 'Edit Movie' : 'Add Movie'}</h3>
        <input
          placeholder="Title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          required
          style={styles.input}
        />
        <textarea
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          style={styles.textarea}
        />
        <input
          type="number"
          placeholder="Duration (minutes)"
          value={form.duration}
          onChange={(e) => setForm({ ...form, duration: e.target.value })}
          required
          style={styles.input}
        />
        <input
          placeholder="Genre"
          value={form.genre}
          onChange={(e) => setForm({ ...form, genre: e.target.value })}
          style={styles.input}
        />
        <input
          type="date"
          value={form.release_date}
          onChange={(e) => setForm({ ...form, release_date: e.target.value })}
          style={styles.input}
        />
        <input
          placeholder="Poster URL (optional -- or upload one after saving, below)"
          value={form.poster_url}
          onChange={(e) => setForm({ ...form, poster_url: e.target.value })}
          style={styles.input}
        />
        <input
          placeholder="Trailer URL (YouTube link)"
          value={form.trailer_url}
          onChange={(e) => setForm({ ...form, trailer_url: e.target.value })}
          style={styles.input}
        />
        {error && <p style={styles.error}>{error}</p>}
        <div style={styles.formActions}>
          <button type="submit" disabled={submitting} style={styles.submitButton}>
            {submitting ? 'Saving...' : editingId ? 'Save Changes' : 'Add Movie'}
          </button>
          {editingId && (
            <button type="button" onClick={cancelEdit} style={styles.cancelButton}>
              Cancel
            </button>
          )}
        </div>
      </form>

      {loading ? (
        <p>Loading movies...</p>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}></th>
              <th style={styles.th}>Title</th>
              <th style={styles.th}>Genre</th>
              <th style={styles.th}>Duration</th>
              <th style={styles.th}></th>
            </tr>
          </thead>
          <tbody>
            {movies.map((movie) => (
              <tr key={movie.id}>
                <td style={styles.td}>
                  <PosterImage
                    posterUrl={movie.poster_url}
                    title={movie.title}
                    style={styles.thumbnail}
                  />
                </td>
                <td style={styles.td}>{movie.title}</td>
                <td style={styles.td}>{movie.genre}</td>
                <td style={styles.td}>{movie.duration} min</td>
                <td style={styles.td}>
                  <button onClick={() => startEdit(movie)} style={styles.linkButton}>Edit</button>
                  <button
                    onClick={() => triggerPosterUpload(movie.id)}
                    disabled={uploadingForId === movie.id}
                    style={styles.linkButton}
                  >
                    {uploadingForId === movie.id ? 'Uploading...' : 'Upload Poster'}
                  </button>
                  <button onClick={() => handleDelete(movie.id)} style={styles.linkButtonDanger}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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

const styles = {
  container: { maxWidth: '700px', margin: '0 auto', padding: '1.5rem' },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
    background: '#fff',
    padding: '1rem',
    borderRadius: '8px',
    marginBottom: '1.5rem',
  },
  formHeading: { margin: 0 },
  thumbnail: { width: '40px', height: '60px', borderRadius: '4px', flexShrink: 0 },
  input: { padding: '0.5rem', fontSize: '0.95rem' },
  textarea: { padding: '0.5rem', fontSize: '0.95rem', minHeight: '60px' },
  error: { color: '#e94560', margin: 0 },
  formActions: { display: 'flex', gap: '0.5rem' },
  submitButton: {
    padding: '0.5rem 1rem',
    background: '#1a1a2e',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  cancelButton: {
    padding: '0.5rem 1rem',
    background: '#eee',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  table: { width: '100%', borderCollapse: 'collapse', background: '#fff' },
  th: { textAlign: 'left', borderBottom: '2px solid #eee', padding: '0.5rem' },
  td: { borderBottom: '1px solid #eee', padding: '0.5rem' },
  linkButton: {
    background: 'none',
    border: 'none',
    color: '#1a1a2e',
    cursor: 'pointer',
    marginRight: '0.75rem',
    textDecoration: 'underline',
    padding: 0,
  },
  linkButtonDanger: {
    background: 'none',
    border: 'none',
    color: '#e94560',
    cursor: 'pointer',
    textDecoration: 'underline',
    padding: 0,
  },
}

export default AdminMoviesPage