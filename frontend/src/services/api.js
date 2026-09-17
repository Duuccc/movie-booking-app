export const API_BASE_URL = 'http://localhost:8000'

/**
 * poster_url from the backend is either a relative path under our own
 * /static/posters/ (from an upload) or a full external URL (an admin
 * pasted one in directly). Resolve it to something an <img> can use,
 * or null if there's no poster at all.
 */
export function resolvePosterUrl(posterUrl) {
  if (!posterUrl) return null
  if (posterUrl.startsWith('http://') || posterUrl.startsWith('https://')) return posterUrl
  return `${API_BASE_URL}${posterUrl}`
}

export function resolveYoutubeEmbedUrl(trailerUrl) {
  if (!trailerUrl) return null
  const watchMatch = trailerUrl.match(/[?&]v=([^&]+)/)
  const shortMatch = trailerUrl.match(/youtu\.be\/([^?&]+)/)
  const videoId = watchMatch?.[1] || shortMatch?.[1]
  if (!videoId) return null
  return `https://www.youtube.com/embed/${videoId}`
}

export function isValidYoutubeUrl(trailerUrl) {
  if (!trailerUrl) return true // empty is fine -- trailer_url is optional
  return resolveYoutubeEmbedUrl(trailerUrl) !== null
}

export function formatVnd(amount) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)
}

export function toVnDateKey(d) {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })
}

// Today + next `count - 1` days, each as { key, label }, for the date
// tab strip. label is short ("Hôm nay", "18/09") -- swap wording here if
// you want it in English instead.
export function getUpcomingDates(count = 7) {
  const today = new Date()
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() + i)
    const key = toVnDateKey(d)
    return {
      key,
      dayNum: d.toLocaleDateString('en-GB', { day: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }),
      weekday:
        i === 0
          ? 'Hôm nay'
          : d.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'Asia/Ho_Chi_Minh' }),
    }
  })
}

function getToken() {
  return localStorage.getItem('token')
}

/**
 * Thin wrapper around fetch. Centralizes: base URL, JSON body encoding,
 * attaching the Authorization header when needed, and turning FastAPI's
 * {"detail": "..."} error shape into a normal thrown Error so every
 * page can just `catch (err) { setError(err.message) }`.
 */
async function request(path, { method = 'GET', body, auth = false, form = false } = {}) {
  const headers = {}
  if (!form) headers['Content-Type'] = 'application/json'
  if (auth) {
    const token = getToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: form ? body : body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    let detail = `Request failed (${response.status})`
    try {
      const errorBody = await response.json()
      if (errorBody.detail) detail = errorBody.detail
    } catch {
      // Response wasn't JSON -- fall back to the generic message above.
    }
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail))
  }

  if (response.status === 204) return null
  return response.json()
}

export const api = {
  register: (name, email, password) =>
    request('/auth/register', { method: 'POST', body: { name, email, password } }),

  login: (email, password) => {
    // The backend's /auth/login expects OAuth2 form-encoded fields
    // (username/password), not JSON -- see backend/app/routers/auth.py.
    const form = new URLSearchParams()
    form.set('username', email)
    form.set('password', password)
    return request('/auth/login', { method: 'POST', body: form, form: true })
  },

  getCurrentUser: () => request('/auth/me', { auth: true }),

  listMovies: () => request('/movies'),
  getMovie: (id) => request(`/movies/${id}`),

  listTheaters: () => request('/theaters'),
  getTheater: (id) => request(`/theaters/${id}`),

  listShowtimes: ({date, theaterId} = {}) => {
    const params = new URLSearchParams()
    if(date) params.set("date", date)
    if(theaterId) params.set("theater_id", theaterId)
    
    const query = params.toString()
    return request(`/showtimes${query ? `?${query}` : ''}`)
  },
  getShowtime: (id) => request(`/showtimes/${id}`),
  getShowtimeSeats: (id) => request(`/showtimes/${id}/seats`),

  createBooking: (showtimeId, seatIds) =>
    request('/bookings', {
      method: 'POST',
      auth: true,
      body: { showtime_id: showtimeId, seat_ids: seatIds },
    }),
  getBooking: (id) => request(`/bookings/${id}`, { auth: true }),
  listMyBookings: () => request('/bookings', { auth: true }),
  cancelBooking: (id) => request(`/bookings/${id}/cancel`, { method: 'POST', auth: true }),
  payBooking: (id, method, simulateFailure = false) =>
    request(`/bookings/${id}/pay`, {
      method: 'POST',
      auth: true,
      body: { method, simulate_failure: simulateFailure },
    }),
  listAdminBookings: () => request('/admin/bookings', { auth: true }),

  createMovie: (payload) => request('/movies', { method: 'POST', auth: true, body: payload }),
  updateMovie: (id, payload) => request(`/movies/${id}`, { method: 'PUT', auth: true, body: payload }),
  deleteMovie: (id) => request(`/movies/${id}`, { method: 'DELETE', auth: true }),
  uploadMoviePoster: (movieId, file) => {
    const formData = new FormData()
    formData.append('file', file)
    // form: true skips the JSON Content-Type header -- the browser sets
    // its own "multipart/form-data; boundary=..." header for FormData,
    // and setting one manually would break the upload.
    return request(`/movies/${movieId}/poster`, { method: 'POST', auth: true, body: formData, form: true })
  },

  createTheater: (payload) => request('/theaters', { method: 'POST', auth: true, body: payload }),
  updateTheater: (id, payload) =>
    request(`/theaters/${id}`, { method: 'PUT', auth: true, body: payload }),
  deleteTheater: (id) => request(`/theaters/${id}`, { method: 'DELETE', auth: true }),

  createShowtime: (payload) => request('/showtimes', { method: 'POST', auth: true, body: payload }),
  updateShowtime: (id, payload) =>
    request(`/showtimes/${id}`, { method: 'PUT', auth: true, body: payload }),
  deleteShowtime: (id) => request(`/showtimes/${id}`, { method: 'DELETE', auth: true }),
}