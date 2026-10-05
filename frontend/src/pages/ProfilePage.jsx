import { useState } from 'react'
import { User as UserIcon, Mail, Calendar, Shield } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'

function formatJoinDate(isoString) {
  if (!isoString) return null
  return new Date(isoString).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function ProfilePage() {
  const { user, refreshUser } = useAuth()

  const [name, setName] = useState(user?.name || '')
  const [nameError, setNameError] = useState('')
  const [nameSuccess, setNameSuccess] = useState('')
  const [nameSubmitting, setNameSubmitting] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [passwordSubmitting, setPasswordSubmitting] = useState(false)

  async function handleNameSubmit(event) {
    event.preventDefault()
    setNameError('')
    setNameSuccess('')
    setNameSubmitting(true)
    try {
      await api.updateProfile(name)
      await refreshUser()
      setNameSuccess('Name updated.')
    } catch (err) {
      setNameError(err.message)
    } finally {
      setNameSubmitting(false)
    }
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.')
      return
    }

    setPasswordSubmitting(true)
    try {
      await api.changePassword(currentPassword, newPassword)
      setPasswordSuccess('Password changed.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setPasswordError(err.message)
    } finally {
      setPasswordSubmitting(false)
    }
  }

  if (!user) return null

  const joinDate = formatJoinDate(user.created_at)
  const initial = user.name?.charAt(0).toUpperCase() || '?'

  return (
    <div className="page">
      <div className="profile-header card">
        <div className="profile-avatar">{initial}</div>
        <div className="profile-header-info">
          <p className="movie-details-tag">Account</p>
          <h1 className="profile-name">{user.name}</h1>
          <div className="profile-meta-row">
            <span className="profile-meta-item">
              <Mail size={14} /> {user.email}
            </span>
            <span className="profile-meta-item">
              <Shield size={14} /> {user.role}
            </span>
            {joinDate && (
              <span className="profile-meta-item">
                <Calendar size={14} /> Joined {joinDate}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="profile-forms">
        <form onSubmit={handleNameSubmit} className="card profile-form-card">
          <div className="profile-form-icon">
            <UserIcon size={18} />
          </div>
          <h3 className="profile-form-title">Display Name</h3>
          <p className="profile-form-subtitle">This is the name shown across your account and bookings.</p>

          <div className="field">
            <label>Name</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          {nameError && <p className="error-text">{nameError}</p>}
          {nameSuccess && <p className="success-text">{nameSuccess}</p>}
          <button type="submit" disabled={nameSubmitting} className="btn btn-primary">
            {nameSubmitting ? 'Saving...' : 'Save Name'}
          </button>
        </form>

        <form onSubmit={handlePasswordSubmit} className="card profile-form-card">
          <div className="profile-form-icon profile-form-icon-accent">
            <Shield size={18} />
          </div>
          <h3 className="profile-form-title">Change Password</h3>
          <p className="profile-form-subtitle">Choose a new password with at least 8 characters.</p>

          <div className="field">
            <label>Current Password</label>
            <input
              type="password"
              className="input"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label>New Password</label>
            <input
              type="password"
              className="input"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>
          <div className="field">
            <label>Confirm New Password</label>
            <input
              type="password"
              className="input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>
          {passwordError && <p className="error-text">{passwordError}</p>}
          {passwordSuccess && <p className="success-text">{passwordSuccess}</p>}
          <button type="submit" disabled={passwordSubmitting} className="btn btn-primary">
            {passwordSubmitting ? 'Changing...' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default ProfilePage