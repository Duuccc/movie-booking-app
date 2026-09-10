import { createContext, useContext, useState, useEffect } from 'react'
import { api } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // On first load, if a token is already in localStorage (from a
  // previous session), try to resolve it to a user via /auth/me so a
  // page refresh doesn't log the person out.
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      setLoading(false)
      return
    }
    api
      .getCurrentUser()
      .then(setUser)
      .catch(() => {
        // Token is invalid or expired -- clear it rather than staying
        // "logged in" in the UI with a token that no longer works.
        localStorage.removeItem('token')
      })
      .finally(() => setLoading(false))
  }, [])

  async function login(email, password) {
    const { access_token } = await api.login(email, password)
    localStorage.setItem('token', access_token)
    const currentUser = await api.getCurrentUser()
    setUser(currentUser)
    return currentUser
  }

  async function register(name, email, password) {
    await api.register(name, email, password)
    // Registration does not log the user in automatically -- they land
    // back on the login page and sign in with what they just chose.
  }

  function logout() {
    localStorage.removeItem('token')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}