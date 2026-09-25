import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { api, formatVnd } from '../services/api'

function formatShortDate(isoDate) {
  return new Date(isoDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })
}

function AdminAnalyticsPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .getAdminAnalytics()
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="status-message">Loading analytics...</p>
  if (error) return <p className="status-message error">{error}</p>
  if (!data) return null

  const chartData = data.daily_revenue.map((d) => ({
    ...d,
    label: formatShortDate(d.date),
  }))

  return (
    <div className="page">
      <h1 className="page-title">Analytics</h1>
      <p className="page-subtitle">Last {data.window_days} days</p>

      <div className="analytics-stats">
        <div className="analytics-stat-card">
          <p className="analytics-stat-label">Total Revenue</p>
          <p className="analytics-stat-value">{formatVnd(data.total_revenue)}</p>
        </div>
        <div className="analytics-stat-card">
          <p className="analytics-stat-label">Average Occupancy</p>
          <p className="analytics-stat-value">{data.average_occupancy}%</p>
        </div>
      </div>

      <div className="card analytics-chart-card">
        <h3 className="analytics-section-title">Revenue by Day</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v / 1000}k`} />
            <Tooltip formatter={(value) => formatVnd(value)} />
            <Bar dataKey="revenue" fill="var(--accent)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card analytics-top-movies-card">
        <h3 className="analytics-section-title">Top Movies by Revenue</h3>
        {data.top_movies.length === 0 ? (
          <p className="status-message">No paid bookings in this window yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Movie</th>
                <th>Payments</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {data.top_movies.map((m) => (
                <tr key={m.movie_id}>
                  <td>{m.title}</td>
                  <td>{m.bookings_count}</td>
                  <td>{formatVnd(m.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default AdminAnalyticsPage