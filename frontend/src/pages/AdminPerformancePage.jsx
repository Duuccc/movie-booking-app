import { useEffect, useMemo, useState } from 'react'
import { Flame, Building2, Clapperboard } from 'lucide-react'
import { api } from '../services/api'

function toDateKey(d) {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })
}

function formatTime(isoString) {
  return new Date(isoString).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
}

function getHour(isoString) {
  return Number(
    new Date(isoString).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      hour12: false,
      timeZone: 'Asia/Ho_Chi_Minh',
    }).split(':')[0]
  )
}


function getSummary(rows) {
  if (rows.length === 0) return null

  const busiest = rows.reduce((best, r) => (r.occupancy_pct > best.occupancy_pct ? r : best))

  // Top Theater / Top Movie: đổi từ "trung bình occupancy %" sang
  // "tổng số ghế đã booked" -- một phim/rạp có nhiều suất ế không còn
  // bị trung bình kéo tụt xuống so với một phim/rạp chỉ có 1 suất đông
  // nhưng quy mô nhỏ. Ví dụ: Út Lan 2 (1 suất, 67/67, 100%) vs Vùng Đất
  // Quỷ Dữ (2 suất, 50+50=100 ghế) -- giờ Vùng Đất Quỷ Dữ thắng vì
  // 100 > 67, đúng ý "chiếm sóng nhiều ghế hơn", dù occupancy % thấp hơn.
  const byTheater = {}
  for (const r of rows) {
    byTheater[r.theater_name] = (byTheater[r.theater_name] || 0) + r.booked_seats
  }
  const bestTheaterEntry = Object.entries(byTheater)
    .map(([name, totalBooked]) => ({ name, totalBooked }))
    .reduce((best, t) => (t.totalBooked > best.totalBooked ? t : best))

  const byMovie = {}
  for (const r of rows) {
    byMovie[r.movie_title] = (byMovie[r.movie_title] || 0) + r.booked_seats
  }
  const bestMovieEntry = Object.entries(byMovie)
    .map(([title, totalBooked]) => ({ title, totalBooked }))
    .reduce((best, m) => (m.totalBooked > best.totalBooked ? m : best))

  return { busiest, bestTheater: bestTheaterEntry, bestMovie: bestMovieEntry }
}

// Lưới Rạp x Giờ -- mỗi ô gộp các showtime cùng rạp, cùng giờ bắt đầu
// (hiếm khi có 2 suất trùng giờ cùng rạp, nhưng gộp để không vỡ layout
// nếu xảy ra). Chỉ lấy những giờ THỰC SỰ có suất chiếu làm cột, tránh
// lưới 24 cột trống trải khi thực tế chỉ có vài khung giờ cố định.
function buildHeatmap(rows) {
  const theaterNames = [...new Set(rows.map((r) => r.theater_name))].sort()
  const hours = [...new Set(rows.map((r) => getHour(r.start_time)))].sort((a, b) => a - b)

  const cellMap = {}
  for (const r of rows) {
    const key = `${r.theater_name}|${getHour(r.start_time)}`
    if (!cellMap[key]) cellMap[key] = []
    cellMap[key].push(r)
  }

  return { theaterNames, hours, cellMap }
}

function occupancyColor(pct) {
  if (pct === null) return 'transparent'
  const alpha = Math.max(0.08, pct / 100)
  return `rgba(183, 64, 43, ${alpha})`
}

function AdminPerformancePage() {
  const [date, setDate] = useState(() => toDateKey(new Date()))
  const [theaters, setTheaters] = useState([])
  const [movies, setMovies] = useState([])
  const [filterTheaterId, setFilterTheaterId] = useState('')
  const [filterMovieId, setFilterMovieId] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([api.listTheaters(), api.listMovies()])
      .then(([theaterData, movieData]) => {
        setTheaters(theaterData)
        setMovies(movieData)
      })
      .catch((err) => setError(err.message))
  }, [])

  useEffect(() => {
    if (!date) return
    setLoading(true)
    api
      .getShowtimePerformance({ date, theaterId: filterTheaterId || undefined, movieId: filterMovieId || undefined })
      .then(setRows)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [date, filterTheaterId, filterMovieId])

  const summary = useMemo(() => getSummary(rows), [rows])
  const heatmap = useMemo(() => buildHeatmap(rows), [rows])

  return (
    <div className="page">
      <h1 className="page-title">Showtime Performance</h1>
      <p className="page-subtitle">See which showtimes, movies and theaters are selling best on a given day.</p>

      <div className="admin-filter-bar">
        <input
          type="date"
          className="input"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <select
          className="input"
          value={filterTheaterId}
          onChange={(e) => setFilterTheaterId(e.target.value)}
        >
          <option value="">All theaters</option>
          {theaters.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <select
          className="input"
          value={filterMovieId}
          onChange={(e) => setFilterMovieId(e.target.value)}
        >
          <option value="">All movies</option>
          {movies.map((m) => (
            <option key={m.id} value={m.id}>{m.title}</option>
          ))}
        </select>
        {(filterTheaterId || filterMovieId) && (
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              setFilterTheaterId('')
              setFilterMovieId('')
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {error && <p className="status-message error">{error}</p>}
      {loading && <p className="status-message">Loading...</p>}

      {!loading && !error && rows.length === 0 && (
        <p className="status-message">No showtimes on this date.</p>
      )}

      {!loading && rows.length > 0 && summary && (
        <>
          <div className="performance-summary">
            <div className="performance-summary-card">
              <Flame size={18} className="performance-summary-icon" />
              <div>
                <p className="performance-summary-label">Busiest Showtime</p>
                <p className="performance-summary-value">
                  {summary.busiest.movie_title} · {formatTime(summary.busiest.start_time)}
                </p>
                <p className="performance-summary-sub">
                  {summary.busiest.theater_name} &middot; {summary.busiest.occupancy_pct}% full
                </p>
              </div>
            </div>
            <div className="performance-summary-card">
              <Building2 size={18} className="performance-summary-icon" />
              <div>
                <p className="performance-summary-label">Top Theater Today</p>
                <p className="performance-summary-value">{summary.bestTheater.name}</p>
                <p className="performance-summary-sub">{summary.bestTheater.totalBooked} seats booked</p>
              </div>
            </div>
            <div className="performance-summary-card">
              <Clapperboard size={18} className="performance-summary-icon" />
              <div>
                <p className="performance-summary-label">Top Movie Today</p>
                <p className="performance-summary-value">{summary.bestMovie.title}</p>
                <p className="performance-summary-sub">{summary.bestMovie.totalBooked} seats booked</p>
              </div>
            </div>
          </div>

          <div className="card performance-heatmap-card">
            <h3 className="analytics-section-title">Occupancy Heatmap</h3>
            <div className="heatmap-scroll">
              <table className="heatmap-table">
                <thead>
                  <tr>
                    <th></th>
                    {heatmap.hours.map((h) => (
                      <th key={h}>{String(h).padStart(2, '0')}:00</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heatmap.theaterNames.map((theaterName) => (
                    <tr key={theaterName}>
                      <th className="heatmap-row-label">{theaterName}</th>
                      {heatmap.hours.map((h) => {
                        const cellRows = heatmap.cellMap[`${theaterName}|${h}`]
                        if (!cellRows) {
                          return <td key={h} className="heatmap-cell heatmap-cell-empty">—</td>
                        }
                        const avgPct =
                          cellRows.reduce((sum, r) => sum + r.occupancy_pct, 0) / cellRows.length
                        const title = cellRows.map((r) => `${r.movie_title} (${r.occupancy_pct}%)`).join(', ')
                        return (
                          <td
                            key={h}
                            className="heatmap-cell"
                            style={{ background: occupancyColor(avgPct) }}
                            title={title}
                          >
                            {avgPct.toFixed(0)}%
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="heatmap-hint">Hover a cell to see which movie it is. Darker = fuller.</p>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Movie</th>
                  <th>Theater</th>
                  <th>Format</th>
                  <th>Seats</th>
                  <th>Occupancy</th>
                </tr>
              </thead>
              <tbody>
                {[...rows]
                  .sort((a, b) => b.occupancy_pct - a.occupancy_pct)
                  .map((r) => (
                    <tr key={r.showtime_id}>
                      <td>{formatTime(r.start_time)}</td>
                      <td>{r.movie_title}</td>
                      <td>{r.theater_name}</td>
                      <td>{r.format}</td>
                      <td>{r.booked_seats} / {r.total_seats}</td>
                      <td>
                        <div className="occupancy-cell">
                          <div className="occupancy-bar">
                            <div
                              className="occupancy-bar-fill"
                              style={{ width: `${Math.min(100, r.occupancy_pct)}%` }}
                            />
                          </div>
                          <span className="occupancy-label">{r.occupancy_pct}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

export default AdminPerformancePage