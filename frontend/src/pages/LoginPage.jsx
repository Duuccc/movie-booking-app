import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(email, password)
      const from = location.state?.from
      if(from) {
        navigate(`${from.pathname}${from.search || ''}`, {replace: true, state: from.state})
      } else{
        navigate("/")
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page-narrow">
      <p className="movie-details-tag" style={{ textAlign: 'center' }}>Welcome back</p>
      <h1 className="auth-title">Log In</h1>
      <div className="form-card">
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Email</label>
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="error-text">{error}</p>}
          <button type="submit" disabled={submitting} className="btn btn-primary btn-block">
            {submitting ? 'Logging in...' : 'Log In'}
          </button>
        </form>
      </div>
      <p className="form-footer">
        No account? <Link to="/register">Register</Link>
      </p>
    </div>
  )
}

export default LoginPage