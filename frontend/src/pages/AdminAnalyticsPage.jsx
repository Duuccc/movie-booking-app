import { useEffect, useState } from 'react'
import { ArrowUp, ArrowDown } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { api, formatVnd, formatVndWithoutCurrency } from '../services/api'

function formatShortDate(isoDate) {
  return new Date(isoDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })
}

function ChangeBadge({ value }) {
  // No previous-period baseline to compare against -- omit the badge
  // rather than show a misleading number (see get_percent_change).
  if (value === null || value === undefined) return null
  const isUp = value >= 0
  return (
    <span className={'analytics-change' + (isUp ? ' analytics-change-up' : ' analytics-change-down')}>
      {isUp ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
      {Math.abs(value)}%
    </span>
  )
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

  const chartData = data.daily_revenue.map((d) => ({ ...d, label: formatShortDate(d.date) }))
  const formatChartData = data.revenue_by_format.map((f) => ({ ...f, label: f.format }))

  return (
    <div className="page">
      <h1 className="page-title">Analytics</h1>
      <p className="page-subtitle">Last {data.window_days} days</p>

      <div className="analytics-stats">
        <div className="analytics-stat-card">
          <p className="analytics-stat-label">Total Revenue </p>
          <p className="analytics-stat-value" title={formatVnd(data.total_revenue)}>{formatVnd(data.total_revenue)}</p>
          <ChangeBadge value={data.revenue_change_pct} />
        </div>
        <div className="analytics-stat-card">
          <p className="analytics-stat-label">Paid Bookings</p>
          <p className="analytics-stat-value" title={data.total_bookings}>{data.total_bookings}</p>
          <ChangeBadge value={data.bookings_change_pct} />
        </div>
        <div className="analytics-stat-card">
          <p className="analytics-stat-label">Tickets Sold</p>
          <p className="analytics-stat-value">{data.total_tickets_sold}</p>
        </div>
        <div className="analytics-stat-card">
          <p className="analytics-stat-label">Average Order Value</p>
          <p className="analytics-stat-value">{formatVnd(data.average_order_value)}</p>
        </div>
        <div className="analytics-stat-card">
          <p className="analytics-stat-label">Cancellation Rate</p>
          <p className="analytics-stat-value">{data.cancellation_rate}%</p>
        </div>
        
      </div>

      <div className="analytics-row">
        <div className="card analytics-chart-card analytics-chart-card-main">
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

        <div className="card analytics-chart-card analytics-chart-card-side">
          <h3 className="analytics-section-title">Revenue by Format</h3>
          {formatChartData.length === 0 ? (
            <p className="status-message">No paid bookings in this window yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={formatChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => `${v / 1000}k`} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 12 }} width={50} />
                <Tooltip formatter={(value) => formatVnd(value)} />
                <Bar dataKey="revenue" fill="var(--gold)" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
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