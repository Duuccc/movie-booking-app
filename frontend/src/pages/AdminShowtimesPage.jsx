import { useEffect, useState } from 'react'
import { Plus, ListPlus } from 'lucide-react'
import { api, formatVnd } from '../services/api'
import Modal from '../components/Modal'
import { usePagination } from '../hooks/usePagination'
import Pagination from '../components/Pagination'
import { Pencil, Trash2 } from 'lucide-react'
import ConfirmDialog from '../components/ConfirmDialog'

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
  const [modalOpen, setModalOpen] = useState(false)

  const [batchRows, setBatchRows] = useState([{ ...emptyBatchRow }])
  const [batchError, setBatchError] = useState('')
  const [batchSubmitting, setBatchSubmitting] = useState(false)
  const [batchModalOpen, setBatchModalOpen] = useState(false)

  const [filterMovieId, setFilterMovieId] = useState('')
  const [filterTheaterId, setFilterTheaterId] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')

  const [pendingDelete, setPendingDelete] = useState(null)

  useEffect(() => {
    loadAll()
  }, [filterMovieId, filterTheaterId, filterDateFrom])

  function loadAll() {
    setLoading(true)
    Promise.all([
      api.listShowtimes({
        movieId: filterMovieId || undefined,
        theaterId: filterTheaterId || undefined,
        date: filterDateFrom || undefined,
      }),
      api.listMovies(),
      api.listTheaters(),
    ])
      .then(([showtimesData, moviesData, theatersData]) => {
        setShowtimes(showtimesData)
        setMovies(moviesData)
        setTheaters(theatersData)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  function openAddModal() {
    setEditingId(null)
    setForm(emptyForm)
    setError('')
    setModalOpen(true)
  }

  function startEdit(showtime) {
    setEditingId(showtime.id)
    setError('')
    setForm({
      movie_id: showtime.movie_id,
      theater_id: showtime.theater_id,
      start_time: showtime.start_time.slice(0, 16),
      price: showtime.price,
      format: showtime.format,
    })
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditingId(null)
    setForm(emptyForm)
    setError('')
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
      closeModal()
      loadAll()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function confirmDelete() {
    const showtime = pendingDelete
    setPendingDelete(null)
    try {
      await api.deleteShowtime(showtime.id)
      loadAll()
    } catch (err) {
      setError(err.message)
    }
  }

  function openBatchModal() {
    setBatchRows([{ ...emptyBatchRow }])
    setBatchError('')
    setBatchModalOpen(true)
  }

  function closeBatchModal() {
    setBatchModalOpen(false)
    setBatchRows([{ ...emptyBatchRow }])
    setBatchError('')
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
      closeBatchModal()
      loadAll()
    } catch (err) {
      setBatchError(err.message)
    } finally {
      setBatchSubmitting(false)
    }
  }

  const dateFilteredShowtimes = filterDateTo
    ? showtimes.filter((s) => s.start_time.slice(0, 10) <= filterDateTo)
    : showtimes

  const { pageItems, paginationProps } = usePagination(dateFilteredShowtimes)

  const movieTitleById = Object.fromEntries(movies.map((m) => [m.id, m.title]))
  const theaterNameById = Object.fromEntries(theaters.map((t) => [t.id, t.name]))

  return (
    <div className="page-medium">
      <div className="admin-page-header">
        <h1 className="page-title">Manage Showtimes</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" className="btn btn-ghost" onClick={openBatchModal}>
            <ListPlus size={16} /> Add Multiple
          </button>
          <button type="button" className="btn btn-primary" onClick={openAddModal}>
            <Plus size={16} /> Add Showtime
          </button>
        </div>
      </div>

      <div className="admin-filter-bar">
        <select
          className="input"
          value={filterMovieId}
          onChange={(e) => setFilterMovieId(e.target.value)}
        >
          <option value="">All movies</option>
          {movies.map((m) => (
            <option key={m.id} value={m.id}>{m.title}</option>
          ))}
        </select>
        <select
          className="input"
          value={filterTheaterId}
          onChange={(e) => setFilterTheaterId(e.target.value)}
        >
          <option value="">All theaters</option>
          {theaters.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <input
          type="date"
          className="input"
          value={filterDateFrom}
          onChange={(e) => setFilterDateFrom(e.target.value)}
        />
        <input
          type="date"
          className="input"
          value={filterDateTo}
          onChange={(e) => setFilterDateTo(e.target.value)}
        />
        {(filterMovieId || filterTheaterId || filterDateFrom || filterDateTo) && (
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              setFilterMovieId('')
              setFilterTheaterId('')
              setFilterDateFrom('')
              setFilterDateTo('')
            }}
          >
            Clear filters
          </button>
        )}
      </div>

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
                      <button onClick={() => startEdit(showtime)} className="icon-btn" aria-label='Edit'>
                        <Pencil size={16} strokeWidth={1.75} />
                      </button>
                      <button onClick={() => setPendingDelete(showtime)} className="icon-btn icon-btn-danger" aria-label="Delete">
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
        <Modal title={editingId ? 'Edit Showtime' : 'Add Showtime'} onClose={closeModal}>
          <form onSubmit={handleSubmit}>
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
              <button type="button" onClick={closeModal} className="btn btn-ghost">
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}

      {batchModalOpen && (
        <Modal title="Add Multiple Showtimes" onClose={closeBatchModal} wide>
          <form onSubmit={handleBatchSubmit}>
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

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button type="submit" disabled={batchSubmitting} className="btn btn-primary">
                {batchSubmitting ? 'Creating...' : `Create All (${batchRows.length})`}
              </button>
              <button type="button" onClick={closeBatchModal} className="btn btn-ghost">
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Delete Showtime"
          message={`Delete the ${movieTitleById[pendingDelete.movie_id]} showtime at ${theaterNameById[pendingDelete.theater_id]} on ${new Date(pendingDelete.start_time).toLocaleString()}? This cannot be undone.`}
          confirmLabel="Delete Showtime"
          danger
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  )
}

export default AdminShowtimesPage