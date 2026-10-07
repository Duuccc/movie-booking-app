import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { api } from '../services/api'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'

const emptyForm = { name: '', location: '' }
const emptySeatRow = { row: '', seat_count: '', seat_type: 'STANDARD' }

function AdminTheatersPage() {
  const [theaters, setTheaters] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(null)

  // Used for both the initial layout (new theater) and additional rows
  // (existing theater) -- same shape, same form, different follow-up.
  const [seatRows, setSeatRows] = useState([{ ...emptySeatRow }])
  // Only populated when editing an existing theater, to show "currently
  // has N seats across rows X, Y, Z" above the add-rows section.
  const [seatsSummary, setSeatsSummary] = useState(null)

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
    setSeatRows([{ ...emptySeatRow }])
    setSeatsSummary(null)
    setError('')
    setModalOpen(true)
  }

  function startEdit(theater) {
    setEditingId(theater.id)
    setForm({ name: theater.name, location: theater.location })
    setSeatRows([{ ...emptySeatRow }])
    setSeatsSummary(null)
    setError('')
    setModalOpen(true)
    api
      .getTheaterSeatSummary(theater.id)
      .then(setSeatsSummary)
      .catch((err) => setError(err.message))
  }

  function closeModal() {
    setModalOpen(false)
    setEditingId(null)
    setForm(emptyForm)
    setSeatRows([{ ...emptySeatRow }])
    setSeatsSummary(null)
    setError('')
  }

  function updateSeatRow(index, field, value) {
    setSeatRows((rows) => rows.map((r, i) => (i === index ? { ...r, [field]: value } : r)))
  }

  function addSeatRow() {
    setSeatRows((rows) => [...rows, { ...emptySeatRow }])
  }

  function removeSeatRow(index) {
    setSeatRows((rows) => rows.filter((_, i) => i !== index))
  }

  function getValidSeatRows() {
    const rows = seatRows.filter((r) => r.row.trim() || Number(r.seat_count) > 0)

    for (const r of rows) {
      const rowLetter = r.row.trim().toUpperCase()
      if (!/^[A-Z]{1,2}$/.test(rowLetter)) {
        throw new Error(`Row "${r.row}" is invalid -- use 1-2 letters, e.g. "A" or "AA".`)
      }
      const count = Number(r.seat_count)
      if (!Number.isInteger(count) || count < 1) {
        throw new Error(`Row ${rowLetter}: seat count must be a whole number of at least 1.`)
      }
      if (count > 50) {
        throw new Error(`Row ${rowLetter}: seat count cannot exceed 50 per row.`)
      }
    }

    const normalizedRows = rows.map((r) => ({
      row: r.row.trim().toUpperCase(),
      seat_count: Number(r.seat_count),
      seat_type: r.seat_type,
    }))

    const rowLetters = normalizedRows.map((r) => r.row)
    const duplicatesInForm = rowLetters.filter((r, i) => rowLetters.indexOf(r) !== i)
    if (duplicatesInForm.length > 0) {
      throw new Error(`Row(s) listed more than once: ${[...new Set(duplicatesInForm)].join(', ')}`)
    }

    if (editingId && seatsSummary) {
      const alreadyExists = rowLetters.filter((r) => seatsSummary.rows.includes(r))
      if (alreadyExists.length > 0) {
        throw new Error(`Row(s) already exist and cannot be extended: ${alreadyExists.join(', ')}`)
      }
    }

    return normalizedRows
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      let validRows
      try {
        validRows = getValidSeatRows()
      } catch (err) {
        setError(err.message)
        return
      }

      let theaterId = editingId
      if (editingId) {
        await api.updateTheater(editingId, form)
      } else {
        const savedTheater = await api.createTheater(form)
        theaterId = savedTheater.id
      }

      if (validRows.length > 0) {
        try {
          await api.generateTheaterSeats(theaterId, validRows)
        } catch (err) {
          setEditingId(theaterId)
          setSeatRows([{ ...emptySeatRow }])
          setError(`Theater saved, but adding seats failed: ${err.message}. Adjust the rows and try again.`)
          loadTheaters()
          return
        }
      }

      closeModal()
      loadTheaters()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function confirmDelete() {
    const theater = pendingDelete
    setPendingDelete(null)
    try {
      await api.deleteTheater(theater.id)
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
                    <button onClick={() => startEdit(theater)} className="icon-btn" aria-label="Edit">
                      <Pencil size={16} strokeWidth={1.75} />
                    </button>
                    <button onClick={() => setPendingDelete(theater)} className="icon-btn icon-btn-danger" aria-label="Delete">
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
        <Modal title={editingId ? 'Edit Theater' : 'Add Theater'} onClose={closeModal} wide>
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

            <div className="field">
              <label>{editingId ? 'Add seats' : 'Seat layout'}</label>

              {editingId && seatsSummary && (
                <p className="poster-field-hint" style={{ marginBottom: '0.6rem' }}>
                  Currently {seatsSummary.total_seats} seats across rows {seatsSummary.rows.join(', ') || '—'}.
                  Existing seats are never changed here -- only new (row, seat number) combinations are added.
                </p>
              )}
              {!editingId && (
                <p className="poster-field-hint" style={{ marginBottom: '0.6rem' }}>
                  One row per entry, e.g. row "A", 10 seats, Standard. You can add more seats later.
                </p>
              )}

              <div className="batch-rows">
                {seatRows.map((row, index) => (
                  <div key={index} className="seat-row-config">
                    <input
                      type="text"
                      className="input"
                      placeholder="Row (e.g. A)"
                      value={row.row}
                      onChange={(e) => updateSeatRow(index, 'row', e.target.value.toUpperCase())}
                      maxLength={2}
                      pattern='[A-Z]{1,2}'
                    />
                    <input
                      type="number"
                      min="1"
                      max="50"
                      className="input"
                      placeholder="Seat count"
                      value={row.seat_count}
                      onChange={(e) => updateSeatRow(index, 'seat_count', e.target.value)}
                    />
                    <select
                      className="input"
                      value={row.seat_type}
                      onChange={(e) => updateSeatRow(index, 'seat_type', e.target.value)}
                    >
                      <option value="STANDARD">Standard</option>
                      <option value="VIP">VIP</option>
                      <option value="COUPLE">Couple</option>
                    </select>
                    <button
                      type="button"
                      className="link-btn danger batch-row-remove"
                      onClick={() => removeSeatRow(index)}
                      disabled={seatRows.length === 1}
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={addSeatRow} className="btn btn-ghost btn-sm" style={{ marginTop: '0.6rem' }}>
                + Add Row
              </button>
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

      {pendingDelete && (
        <ConfirmDialog
          title="Delete Theater"
          message={`Delete "${pendingDelete.name}"? This also removes its seats and showtimes. This cannot be undone.`}
          confirmLabel="Delete Theater"
          danger
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  )
}

export default AdminTheatersPage