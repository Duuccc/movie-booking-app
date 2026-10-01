import { useEffect, useState } from 'react'
import { api, formatVnd } from '../services/api'
import { usePagination } from '../hooks/usePagination'
import Pagination from '../components/Pagination'

const emptyForm = { movie_id: '', theater_id: '', start_time: '', price: '75000', format: '2D' }
const emptyBatchRow = { movie_id: '', theater_id: '', start_time: '', price: '75000', format: '2D' }

function AdminShowtimesPage() {
  const [showtimes, setShowtimes] = useState([])
  const [movies, setMovies] = useState([])
  const [theaters, setTheaters] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const [batchRows, setBatchRows] = useState([{ ...emptyBatchRow }])
  const [batchError, setBatchError] = useState('')
  const [batchSubmitting, setBatchSubmitting] = useState(false)

  const { pageItems, paginationProps } = usePagination(showtimes)

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
      format: showtime.format,
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
      format: form.format,
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

  function updateBatchRow(index, field, value) {
    setBatchRows((rows) => rows.map((r, i) => (i === index ? { ...r, [field]: value } : r)))
  }

  function addBatchRow() {
    setBatchRows((rows) => [...rows, { ...emptyBatchRow }])
  }

  function removeBatchRow(index) {
    setBatchRows((rows) => rows.filter((_, i) => i !== index))
  }

  async function handleBatchSubmit(event) {
    event.preventDefault()
    setBatchError('')
    setBatchSubmitting(true)
    const payload = batchRows.map((r) => ({
      movie_id: Number(r.movie_id),
      theater_id: Number(r.theater_id),
      start_time: new Date(r.start_time).toISOString(),
      price: Number(r.price),
      format: r.format,
    }))
    try {
      await api.createShowtimesBatch(payload)
      setBatchRows([{ ...emptyBatchRow }])
      loadAll()
    } catch (err) {
      setBatchError(err.message)
    } finally {
      setBatchSubmitting(false)
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
        <div className="field">
          <label>Format</label>
          <select
            className="input"
            value={form.format}
            onChange={(e) => setForm({ ...form, format: e.target.value })}
            required
          >
            <option value="2D">2D</option>
            <option value="3D">3D</option>
            <option value="IMAX">IMAX</option>
          </select>
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

      <form onSubmit={handleBatchSubmit} className="form-card batch-form" style={{ marginBottom: '1.75rem' }}>
        <h3 style={{ marginTop: 0 }}>Add Multiple Showtimes</h3>
        <p className="page-subtitle" style={{ marginBottom: '1rem' }}>
          Add as many rows as you need, then create them all at once.
        </p>

        <div className="batch-rows">
          {batchRows.map((row, index) => (
            <div key={index} className="batch-row">
              <select
                className="input"
                value={row.movie_id}
                onChange={(e) => updateBatchRow(index, 'movie_id', e.target.value)}
                required
              >
                <option value="">Movie</option>
                {movies.map((m) => (
                  <option key={m.id} value={m.id}>{m.title}</option>
                ))}
              </select>
              <select
                className="input"
                value={row.theater_id}
                onChange={(e) => updateBatchRow(index, 'theater_id', e.target.value)}
                required
              >
                <option value="">Theater</option>
                {theaters.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <input
                type="datetime-local"
                className="input"
                value={row.start_time}
                onChange={(e) => updateBatchRow(index, 'start_time', e.target.value)}
                required
              />
              <input
                type="number"
                step="1000"
                min="0"
                className="input"
                value={row.price}
                onChange={(e) => updateBatchRow(index, 'price', e.target.value)}
                required
              />
              <select
                className="input"
                value={row.format}
                onChange={(e) => updateBatchRow(index, 'format', e.target.value)}
                required
              >
                <option value="2D">2D</option>
                <option value="3D">3D</option>
                <option value="IMAX">IMAX</option>
              </select>
              <button
                type="button"
                className="link-btn danger batch-row-remove"
                onClick={() => removeBatchRow(index)}
                disabled={batchRows.length === 1}
                title={batchRows.length === 1 ? 'At least one row is required' : 'Remove row'}
              >
                &times;
              </button>
            </div>
          ))}
        </div>

        <button type="button" onClick={addBatchRow} className="btn btn-ghost btn-sm" style={{ marginTop: '0.75rem' }}>
          + Add Row
        </button>

        {batchError && <p className="error-text">{batchError}</p>}

        <div style={{ marginTop: '1rem' }}>
          <button type="submit" disabled={batchSubmitting} className="btn btn-primary">
            {batchSubmitting ? 'Creating...' : `Create All (${batchRows.length})`}
          </button>
        </div>
      </form>

      {loading ? (
        <p className="status-message">Loading showtimes...</p>
      ) : (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Movie</th>
                  <th>Theater</th>
                  <th>Time</th>
                  <th>Price</th>
                  <th>Format</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((showtime) => (
                  <tr key={showtime.id}>
                    <td>{movieTitleById[showtime.movie_id]}</td>
                    <td>{theaterNameById[showtime.theater_id]}</td>
                    <td>{new Date(showtime.start_time).toLocaleString()}</td>
                    <td>{formatVnd(showtime.price)}</td>
                    <td>{showtime.format}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button onClick={() => startEdit(showtime)} className="link-btn" style={{ marginRight: '0.75rem' }}>Edit</button>
                      <button onClick={() => handleDelete(showtime.id)} className="link-btn danger">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination {...paginationProps} />
        </>
      )}
    </div>
  )
}

export default AdminShowtimesPage