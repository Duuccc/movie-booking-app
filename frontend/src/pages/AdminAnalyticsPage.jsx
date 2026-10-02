import { useEffect, useState } from 'react'
import { ArrowUp, ArrowDown } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { api, formatVnd } from '../services/api'

function formatShortDate(isoDate) {
  return new Date(isoDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })
}

function toDateKey(d) {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })
}

function ChangeBadge({ value }) {
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
  // Mặc định: 30 ngày gần nhất, tính theo lịch VN.
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 29)
    return toDateKey(d)
  })
  const [dateTo, setDateTo] = useState(() => toDateKey(new Date()))

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!dateFrom || !dateTo || dateFrom > dateTo) return
    setLoading(true)
    api
      .getAdminAnalytics(dateFrom, dateTo)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [dateFrom, dateTo])

  if (loading && !data) return <p className="status-message">Loading analytics...</p>
  if (error) return <p className="status-message error">{error}</p>
  if (!data) return null

  const chartData = data.daily_revenue.map((d) => ({ ...d, label: formatShortDate(d.date) }))
  const formatChartData = data.revenue_by_format.map((f) => ({ ...f, label: f.format }))

  return (
    <div className="page">
      <h1 className="page-title">Analytics</h1>

      <div className="analytics-header">
        <p className="page-subtitle" style={{ margin: 0 }}>
          {data.date_from} to {data.date_to}
        </p>
        <div className="analytics-date-range">
          <input
            type="date"
            className="input"
            value={dateFrom}
            max={dateTo}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <span className="analytics-date-range-sep">to</span>
          <input
            type="date"
            className="input"
            value={dateTo}
            min={dateFrom}
            max={toDateKey(new Date())}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
      </div>

      <div className="analytics-stats">
        <div className="analytics-stat-card">
          <p className="analytics-stat-label">Total Revenue</p>
          <p className="analytics-stat-value" title={formatVnd(data.total_revenue)}>
            {formatVnd(data.total_revenue)}
          </p>
          <ChangeBadge value={data.revenue_change_pct} />
        </div>
        <div className="analytics-stat-card">
          <p className="analytics-stat-label">Paid Bookings</p>
          <p className="analytics-stat-value">{data.total_bookings}</p>
          <ChangeBadge value={data.bookings_change_pct} />
        </div>
        <div className="analytics-stat-card">
          <p className="analytics-stat-label">Tickets Sold</p>
          <p className="analytics-stat-value">{data.total_tickets_sold}</p>
        </div>
        <div className="analytics-stat-card">
          <p className="analytics-stat-label">Average Order Value</p>
          <p className="analytics-stat-value" title={formatVnd(data.average_order_value)}>
            {formatVnd(data.average_order_value)}
          </p>
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

      <div className="card analytics-chart-card" style={{ marginBottom: '1.5rem' }}>
        <h3 className="analytics-section-title">Revenue by Seat Type</h3>
        {data.revenue_by_seat_type.length === 0 ? (
          <p className="status-message">No paid bookings in this window yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.revenue_by_seat_type.map((s) => ({ ...s, label: s.seat_type }))} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => `${v / 1000}k`} />
              <YAxis type="category" dataKey="label" tick={{ fontSize: 12 }} width={70} />
              <Tooltip formatter={(value) => formatVnd(Math.round(value))} />
              <Bar dataKey="revenue" fill="var(--success)" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="card analytics-chart-card" style={{ marginBottom: '1.5rem' }}>
        <h3 className="analytics-section-title">Revenue by Theater</h3>
        {data.revenue_by_theater.length === 0 ? (
          <p className="status-message">No paid bookings in this window yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.revenue_by_theater.map((t) => ({ ...t, label: t.theater_name }))} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => `${v / 1000}k`} />
              <YAxis type="category" dataKey="label" tick={{ fontSize: 12 }} width={120} />
              <Tooltip formatter={(value) => formatVnd(value)} />
              <Bar dataKey="revenue" fill="var(--ink-soft)" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="analytics-row">
        <div className="card analytics-chart-card">
          <h3 className="analytics-section-title">Bookings by Hour</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.peak_hours.map((h) => ({ ...h, label: `${h.hour}h` }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={1} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="bookings_count" fill="var(--accent)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card analytics-chart-card">
          <h3 className="analytics-section-title">Bookings by Day of Week</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.bookings_by_weekday}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="weekday" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="bookings_count" fill="var(--gold)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
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
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {data.top_movies.map((m) => (
                <tr key={m.movie_id}>
                  <td>{m.title}</td>
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