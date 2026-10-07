import { useEffect, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { api, isValidYoutubeUrl } from '../services/api'
import PosterImage from '../components/PosterImage'
import Modal from '../components/Modal'
import { usePagination } from '../hooks/usePagination'
import Pagination from '../components/Pagination'
import { Pencil, Trash2 } from 'lucide-react'
import ConfirmDialog from '../components/ConfirmDialog'

const emptyForm = { title: '', description: '', duration: '', genre: '', release_date: '', poster_url: '', trailer_url: '' }
const ALLOWED_POSTER_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_POSTER_BYTES = 5 * 1024 * 1024

function AdminMoviesPage() {
  const [movies, setMovies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [posterFile, setPosterFile] = useState(null)
  const [posterPreview, setPosterPreview] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)
  const fileInputRef = useRef(null)

  // Modal chỉ hiện khi true -- cả "Add" lẫn "Edit" đều dùng chung modal
  // này, chỉ khác ở việc editingId có giá trị hay không.
  const [modalOpen, setModalOpen] = useState(false)

  const [search, setSearch] = useState('')
  const [filterGenre, setFilterGenre] = useState('')

  useEffect(() => {
    loadMovies()
  }, [])

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

  function openAddModal() {
    setEditingId(null)
    setForm(emptyForm)
    setPosterFile(null)
    setError('')
    setModalOpen(true)
  }

  function startEdit(movie) {
    setEditingId(movie.id)
    setPosterFile(null)
    setError('')
    setForm({
      title: movie.title,
      description: movie.description || '',
      duration: movie.duration,
      genre: movie.genre || '',
      release_date: movie.release_date || '',
      poster_url: movie.poster_url || '',
      trailer_url: movie.trailer_url || ''
    })
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditingId(null)
    setForm(emptyForm)
    setPosterFile(null)
    setError('')
  }

  function handlePosterFileChange(event) {
    const file = event.target.files[0]
    event.target.value = ''
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
      let savedMovie
      try {
        savedMovie = editingId
          ? await api.updateMovie(editingId, payload)
          : await api.createMovie(payload)
      } catch (err) {
        setError(err.message)
        return
      }

      if (posterFile) {
        try {
          await api.uploadMoviePoster(savedMovie.id, posterFile)
        } catch (err) {
          setEditingId(savedMovie.id)
          setError(`Movie saved, but the poster upload failed: ${err.message}. Press Save Changes to retry.`)
          loadMovies()
          return
        }
      }

      closeModal()
      loadMovies()
    } finally {
      setSubmitting(false)
    }
  }

  async function confirmDelete() {
    const movie = pendingDelete
    setPendingDelete(null)
    try {
      await api.deleteMovie(movie.id)
      loadMovies()
    } catch (err) {
      setError(err.message)
    }
  }

  const genres = [
    ...new Set(
      movies.flatMap((m) =>
        (m.genre || '')
          .split(',')
          .map((g) => g.trim())
          .filter(Boolean)
      )
    ),
  ].sort()

  const filteredMovies = movies.filter((m) => {
    const matchesSearch = m.title.toLowerCase().includes(search.trim().toLowerCase())
    const movieGenres = (m.genre || '').split(',').map((g) => g.trim())
    const matchesGenre = !filterGenre || movieGenres.includes(filterGenre)
    return matchesSearch && matchesGenre
  })

  const { pageItems, paginationProps } = usePagination(filteredMovies)

  const movieForm = (
    <form onSubmit={handleSubmit}>
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
        <button type="button" onClick={closeModal} className="btn btn-ghost">
          Cancel
        </button>
      </div>
    </form>
  )

  return (
    <div className="page-medium">
      <div className="admin-page-header">
        <h1 className="page-title">Manage Movies</h1>
        <button type="button" className="btn btn-primary" onClick={openAddModal}>
          <Plus size={16} /> Add Movie
        </button>
      </div>

      <div className="admin-filter-bar">
        <input
          type="text"
          className="input"
          placeholder="Search by title..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input"
          value={filterGenre}
          onChange={(e) => setFilterGenre(e.target.value)}
        >
          <option value="">All genres</option>
          {genres.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
        {(search || filterGenre) && (
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              setSearch('')
              setFilterGenre('')
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {loading ? (
        <p className="status-message">Loading movies...</p>
      ) : (
        <>
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
                {pageItems.map((movie) => (
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
                      <button onClick={() => startEdit(movie)} className="icon-btn" aria-label='Edit'>
                        <Pencil size={16} strokeWidth={1.75} />
                      </button>
                      <button onClick={() => setPendingDelete(movie)} className="icon-btn icon-btn-danger" aria-label='Delete'>
                        <Trash2 size={16} strokeWidth={1.75} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination {...paginationProps} />
        </>
      )}

      {modalOpen && (
        <Modal title={editingId ? 'Edit Movie' : 'Add Movie'} onClose={closeModal}>
          {movieForm}
        </Modal>
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Delete Movie"
          message={`Delete "${pendingDelete.title}"? This also removes its showtimes. This cannot be undone.`}
          confirmLabel="Delete Movie"
          danger
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  )
}

export default AdminMoviesPage