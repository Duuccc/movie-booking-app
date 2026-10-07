import { useEffect, useState } from 'react'
import { Shield, Trash2 } from 'lucide-react'
import { api } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { usePagination } from '../hooks/usePagination'
import Pagination from '../components/Pagination'
import ConfirmDialog from '../components/ConfirmDialog'

function formatJoinDate(isoString) {
  if (!isoString) return '—'
  return new Date(isoString).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function AdminUsersPage() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [updatingId, setUpdatingId] = useState(null)

  // { type: 'role' | 'delete', user: <user object> } | null
  const [pendingAction, setPendingAction] = useState(null)

  useEffect(() => {
    loadUsers()
  }, [])

  function loadUsers() {
    setLoading(true)
    api
      .listAdminUsers()
      .then(setUsers)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  const filteredUsers = users.filter((u) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
  })

  const { pageItems, paginationProps } = usePagination(filteredUsers)

  async function confirmRoleToggle() {
    const targetUser = pendingAction.user
    const newRole = targetUser.role === 'ADMIN' ? 'CUSTOMER' : 'ADMIN'

    setPendingAction(null)
    setUpdatingId(targetUser.id)
    setError('')
    try {
      await api.updateUserRole(targetUser.id, newRole)
      loadUsers()
    } catch (err) {
      setError(err.message)
    } finally {
      setUpdatingId(null)
    }
  }

  async function confirmDelete() {
    const targetUser = pendingAction.user
    setPendingAction(null)
    try {
      await api.deleteUser(targetUser.id)
      loadUsers()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="page-medium">
      <h1 className="page-title">Manage Users</h1>

      <div className="admin-filter-bar">
        <input
          type="text"
          className="input"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && <p className="error-text">{error}</p>}

      {loading ? (
        <p className="status-message">Loading users...</p>
      ) : (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Joined</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((u) => {
                  const isSelf = u.id === currentUser?.id
                  return (
                    <tr key={u.id}>
                      <td>{u.name}{isSelf && <span className="admin-table-subtext"> (you)</span>}</td>
                      <td>{u.email}</td>
                      <td>
                        <span className={`badge ${u.role === 'ADMIN' ? 'badge-success' : 'badge-muted'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td>{formatJoinDate(u.created_at)}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button
                          onClick={() => setPendingAction({ type: 'role', user: u })}
                          disabled={updatingId === u.id || (isSelf && u.role === 'ADMIN')}
                          className="icon-btn"
                          aria-label={u.role === 'ADMIN' ? 'Remove admin' : 'Make admin'}
                          title={
                            isSelf && u.role === 'ADMIN'
                              ? "You can't remove your own admin role"
                              : u.role === 'ADMIN' ? 'Remove admin' : 'Make admin'
                          }
                        >
                          <Shield size={16} strokeWidth={1.75} />
                        </button>
                        <button
                          onClick={() => setPendingAction({ type: 'delete', user: u })}
                          disabled={isSelf}
                          className="icon-btn icon-btn-danger"
                          aria-label="Delete"
                          title={isSelf ? "You can't delete your own account" : 'Delete'}
                        >
                          <Trash2 size={16} strokeWidth={1.75} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Pagination {...paginationProps} />
        </>
      )}

      {pendingAction?.type === 'role' && (
        <ConfirmDialog
          title={pendingAction.user.role === 'ADMIN' ? 'Remove Admin Access' : 'Grant Admin Access'}
          message={
            pendingAction.user.role === 'ADMIN'
              ? `Remove admin access from "${pendingAction.user.name}"? They'll become a regular customer account.`
              : `Make "${pendingAction.user.name}" an admin? They'll gain full access to the admin dashboard.`
          }
          confirmLabel={pendingAction.user.role === 'ADMIN' ? 'Remove Admin' : 'Make Admin'}
          danger={pendingAction.user.role === 'ADMIN'}
          onConfirm={confirmRoleToggle}
          onCancel={() => setPendingAction(null)}
        />
      )}

      {pendingAction?.type === 'delete' && (
        <ConfirmDialog
          title="Delete User"
          message={`Delete "${pendingAction.user.name}"? This permanently deletes their account AND every booking they've ever made, including paid ones. This cannot be undone.`}
          confirmLabel="Delete User"
          danger
          onConfirm={confirmDelete}
          onCancel={() => setPendingAction(null)}
        />
      )}
    </div>
  )
}

export default AdminUsersPage