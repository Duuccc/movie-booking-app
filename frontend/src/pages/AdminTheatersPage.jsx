import { useEffect, useState } from 'react'
import { api } from '../services/api'

const emptyForm = { name: '', location: '' }

function AdminTheatersPage() {
  const [theaters, setTheaters] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadTheaters()
  }, [])

  function loadTheaters() {
    setLoading(true)
    api
      .listTheaters()
      .then(setTheaters)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  function startEdit(theater) {
    setEditingId(theater.id)
    setForm({ name: theater.name, location: theater.location })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(emptyForm)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      if (editingId) {
        await api.updateTheater(editingId, form)
      } else {
        await api.createTheater(form)
      }
      cancelEdit()
      loadTheaters()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(theaterId) {
    if (!window.confirm('Delete this theater? This also removes its seats and showtimes.')) return
    try {
      await api.deleteTheater(theaterId)
      loadTheaters()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div style={styles.container}>
      <h1>Manage Theaters</h1>

      <form onSubmit={handleSubmit} style={styles.form}>
        <h3 style={styles.formHeading}>{editingId ? 'Edit Theater' : 'Add Theater'}</h3>
        <input
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
          style={styles.input}
        />
        <input
          placeholder="Location"
          value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
          required
          style={styles.input}
        />
        {error && <p style={styles.error}>{error}</p>}
        <div style={styles.formActions}>
          <button type="submit" disabled={submitting} style={styles.submitButton}>
            {submitting ? 'Saving...' : editingId ? 'Save Changes' : 'Add Theater'}
          </button>
          {editingId && (
            <button type="button" onClick={cancelEdit} style={styles.cancelButton}>
              Cancel
            </button>
          )}
        </div>
      </form>

      {loading ? (
        <p>Loading theaters...</p>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Name</th>
              <th style={styles.th}>Location</th>
              <th style={styles.th}></th>
            </tr>
          </thead>
          <tbody>
            {theaters.map((theater) => (
              <tr key={theater.id}>
                <td style={styles.td}>{theater.name}</td>
                <td style={styles.td}>{theater.location}</td>
                <td style={styles.td}>
                  <button onClick={() => startEdit(theater)} style={styles.linkButton}>Edit</button>
                  <button onClick={() => handleDelete(theater.id)} style={styles.linkButtonDanger}>Delete</button>
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
  container: { maxWidth: '600px', margin: '0 auto', padding: '1.5rem' },
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

export default AdminTheatersPage