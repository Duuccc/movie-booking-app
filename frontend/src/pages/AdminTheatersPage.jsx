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
    <div className="page-medium">
      <h1 className="page-title">Manage Theaters</h1>

      <form onSubmit={handleSubmit} className="form-card" style={{ marginBottom: '1.75rem' }}>
        <h3 style={{ marginTop: 0 }}>{editingId ? 'Edit Theater' : 'Add Theater'}</h3>
        <div className="field">
          <label>Name</label>
          <input
            className="input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </div>
        <div className="field">
          <label>Location</label>
          <input
            className="input"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            required
          />
        </div>
        {error && <p className="error-text">{error}</p>}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="submit" disabled={submitting} className="btn btn-primary">
            {submitting ? 'Saving...' : editingId ? 'Save Changes' : 'Add Theater'}
          </button>
          {editingId && (
            <button type="button" onClick={cancelEdit} className="btn btn-ghost">
              Cancel
            </button>
          )}
        </div>
      </form>

      {loading ? (
        <p className="status-message">Loading theaters...</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Location</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {theaters.map((theater) => (
                <tr key={theater.id}>
                  <td>{theater.name}</td>
                  <td>{theater.location}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button onClick={() => startEdit(theater)} className="link-btn" style={{ marginRight: '0.75rem' }}>Edit</button>
                    <button onClick={() => handleDelete(theater.id)} className="link-btn danger">Delete</button>
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

export default AdminTheatersPage