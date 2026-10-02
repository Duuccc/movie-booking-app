import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { api } from '../services/api'
import Modal from '../components/Modal'
import { Pencil, Trash2 } from 'lucide-react'

const emptyForm = { name: '', location: '' }

function AdminTheatersPage() {
  const [theaters, setTheaters] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

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

  function openAddModal() {
    setEditingId(null)
    setForm(emptyForm)
    setError('')
    setModalOpen(true)
  }

  function startEdit(theater) {
    setEditingId(theater.id)
    setForm({ name: theater.name, location: theater.location })
    setError('')
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
    try {
      if (editingId) {
        await api.updateTheater(editingId, form)
      } else {
        await api.createTheater(form)
      }
      closeModal()
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
      <div className="admin-page-header">
        <h1 className="page-title">Manage Theaters</h1>
        <button type="button" className="btn btn-primary" onClick={openAddModal}>
          <Plus size={16} /> Add Theater
        </button>
      </div>

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
                    <button onClick={() => startEdit(theater)} className="icon-btn" aria-label='Edit'>
                      <Pencil size={16} strokeWidth={1.75} />
                    </button>
                    <button onClick={() => handleDelete(theater.id)} className="icon-btn icon-btn-danger" aria-label='Delete'>
                      <Trash2 size={16} strokeWidth={1.75} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <Modal title={editingId ? 'Edit Theater' : 'Add Theater'} onClose={closeModal}>
          <form onSubmit={handleSubmit}>
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
              <button type="button" onClick={closeModal} className="btn btn-ghost">
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default AdminTheatersPage