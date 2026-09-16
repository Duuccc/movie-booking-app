import { useEffect, useState } from 'react'
import { api, formatVnd } from '../services/api'

const emptyForm = { movie_id: '', theater_id: '', start_time: '', price: '75000' }

function AdminShowtimesPage() {
  const [showtimes, setShowtimes] = useState([])
  const [movies, setMovies] = useState([])
  const [theaters, setTheaters] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadAll()
  }, [])

  function loadAll() {
    setLoading(true)
    Promise.all([api.listShowtimes(), api.listMovies(), api.listTheaters()])
      .then(([showtimesData, moviesData, theatersData]) => {
        setShowtimes(showtimesData)
        setMovies(moviesData)
        setTheaters(theatersData)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  function startEdit(showtime) {
    setEditingId(showtime.id)
    setForm({
      movie_id: showtime.movie_id,
      theater_id: showtime.theater_id,
      start_time: showtime.start_time.slice(0, 16),
      price: showtime.price,
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(emptyForm)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    const payload = {
      movie_id: Number(form.movie_id),
      theater_id: Number(form.theater_id),
      start_time: new Date(form.start_time).toISOString(),
      price: Number(form.price),
    }
    try {
      if (editingId) {
        await api.updateShowtime(editingId, payload)
      } else {
        await api.createShowtime(payload)
      }
      cancelEdit()
      loadAll()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(showtimeId) {
    if (!window.confirm('Delete this showtime?')) return
    try {
      await api.deleteShowtime(showtimeId)
      loadAll()
    } catch (err) {
      setError(err.message)
    }
  }

  const movieTitleById = Object.fromEntries(movies.map((m) => [m.id, m.title]))
  const theaterNameById = Object.fromEntries(theaters.map((t) => [t.id, t.name]))

  return (
    <div className="page-medium">
      <h1 className="page-title">Manage Showtimes</h1>

      <form onSubmit={handleSubmit} className="form-card" style={{ marginBottom: '1.75rem' }}>
        <h3 style={{ marginTop: 0 }}>{editingId ? 'Edit Showtime' : 'Add Showtime'}</h3>
        <div className="field">
          <label>Movie</label>
          <select
            className="input"
            value={form.movie_id}
            onChange={(e) => setForm({ ...form, movie_id: e.target.value })}
            required
          >
            <option value="">Select a movie</option>
            {movies.map((movie) => (
              <option key={movie.id} value={movie.id}>{movie.title}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Theater</label>
          <select
            className="input"
            value={form.theater_id}
            onChange={(e) => setForm({ ...form, theater_id: e.target.value })}
            required
          >
            <option value="">Select a theater</option>
            {theaters.map((theater) => (
              <option key={theater.id} value={theater.id}>{theater.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Start Time</label>
          <input
            type="datetime-local"
            className="input"
            value={form.start_time}
            onChange={(e) => setForm({ ...form, start_time: e.target.value })}
            required
          />
        </div>
        <div className="field">
          <label>Price (VND)</label>
          <input
            type="number"
            step="1000"
            min="0"
            className="input"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            required
          />
        </div>
        {error && <p className="error-text">{error}</p>}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="submit" disabled={submitting} className="btn btn-primary">
            {submitting ? 'Saving...' : editingId ? 'Save Changes' : 'Add Showtime'}
          </button>
          {editingId && (
            <button type="button" onClick={cancelEdit} className="btn btn-ghost">
              Cancel
            </button>
          )}
        </div>
      </form>

      {loading ? (
        <p className="status-message">Loading showtimes...</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Movie</th>
                <th>Theater</th>
                <th>Time</th>
                <th>Price</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {showtimes.map((showtime) => (
                <tr key={showtime.id}>
                  <td>{movieTitleById[showtime.movie_id]}</td>
                  <td>{theaterNameById[showtime.theater_id]}</td>
                  <td>{new Date(showtime.start_time).toLocaleString()}</td>
                  <td>{formatVnd(showtime.price)}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button onClick={() => startEdit(showtime)} className="link-btn" style={{ marginRight: '0.75rem' }}>Edit</button>
                    <button onClick={() => handleDelete(showtime.id)} className="link-btn danger">Delete</button>
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

export default AdminShowtimesPage