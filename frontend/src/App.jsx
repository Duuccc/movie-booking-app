import { useEffect, useState } from 'react'

// Milestone 1 only: a tiny smoke test that the frontend can reach the
// backend's /health endpoint. Real pages (login, movie list, etc.) get
// built in later milestones and this component goes away.
function App() {
  const [status, setStatus] = useState('checking...')

  useEffect(() => {
    fetch('http://localhost:8000/health')
      .then((res) => res.json())
      .then((data) => setStatus(`${data.status} (db: ${data.database})`))
      .catch(() => setStatus('backend unreachable'))
  }, [])

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem' }}>
      <h1>Movie Booking</h1>
      <p>Backend status: {status}</p>
    </div>
  )
}

export default App
