import { useEffect, useState } from 'react'
import { api } from '../services/api'

const emptyForm = { movie_id: '', theater_id: '', start_time: '', price: '10.00' }

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
      // datetime-local inputs want "YYYY-MM-DDTHH:mm" -- trim seconds/timezone.
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
      price: form.price,
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
    <div style={styles.container}>
      <h1>Manage Showtimes</h1>

      <form onSubmit={handleSubmit} style={styles.form}>
        <h3 style={styles.formHeading}>{editingId ? 'Edit Showtime' : 'Add Showtime'}</h3>
        <select
          value={form.movie_id}
          onChange={(e) => setForm({ ...form, movie_id: e.target.value })}
          required
          style={styles.input}
        >
          <option value="">Select a movie</option>
          {movies.map((movie) => (
            <option key={movie.id} value={movie.id}>{movie.title}</option>
          ))}
        </select>
        <select
          value={form.theater_id}
          onChange={(e) => setForm({ ...form, theater_id: e.target.value })}
          required
          style={styles.input}
        >
          <option value="">Select a theater</option>
          {theaters.map((theater) => (
            <option key={theater.id} value={theater.id}>{theater.name}</option>
          ))}
        </select>
        <input
          type="datetime-local"
          value={form.start_time}
          onChange={(e) => setForm({ ...form, start_time: e.target.value })}
          required
          style={styles.input}
        />
        <input
          type="number"
          step="0.01"
          placeholder="Price"
          value={form.price}
          onChange={(e) => setForm({ ...form, price: e.target.value })}
          required
          style={styles.input}
        />
        {error && <p style={styles.error}>{error}</p>}
        <div style={styles.formActions}>
          <button type="submit" disabled={submitting} style={styles.submitButton}>
            {submitting ? 'Saving...' : editingId ? 'Save Changes' : 'Add Showtime'}
          </button>
          {editingId && (
            <button type="button" onClick={cancelEdit} style={styles.cancelButton}>
              Cancel
            </button>
          )}
        </div>
      </form>

      {loading ? (
        <p>Loading showtimes...</p>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Movie</th>
              <th style={styles.th}>Theater</th>
              <th style={styles.th}>Time</th>
              <th style={styles.th}>Price</th>
              <th style={styles.th}></th>
            </tr>
          </thead>
          <tbody>
            {showtimes.map((showtime) => (
              <tr key={showtime.id}>
                <td style={styles.td}>{movieTitleById[showtime.movie_id]}</td>
                <td style={styles.td}>{theaterNameById[showtime.theater_id]}</td>
                <td style={styles.td}>{new Date(showtime.start_time).toLocaleString()}</td>
                <td style={styles.td}>${showtime.price}</td>
                <td style={styles.td}>
                  <button onClick={() => startEdit(showtime)} style={styles.linkButton}>Edit</button>
                  <button onClick={() => handleDelete(showtime.id)} style={styles.linkButtonDanger}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

const styles = {
  container: { maxWidth: '750px', margin: '0 auto', padding: '1.5rem' },
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
  input: { padding: '0.5rem', fontSize: '0.95rem' },
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

export default AdminShowtimesPage