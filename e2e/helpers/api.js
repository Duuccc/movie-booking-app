import { randomUUID } from 'node:crypto'

export const ADMIN = {
  email: process.env.E2E_ADMIN_EMAIL ?? 'e2e-admin@example.com',
  password: process.env.E2E_ADMIN_PASSWORD ?? 'E2e-Admin-Pass-1',
}
export const CUSTOMER_PASSWORD = 'Password123!'

const VN_TZ = 'Asia/Ho_Chi_Minh'

// Fixed-length random suffix: two different suffixes can never be substrings of
// each other, so getByRole('link', { name: title }) never matches two movies.
export function unique(prefix) {
  return `${prefix} ${randomUUID().slice(0, 8)}`
}

async function ensureOk(response, what) {
  if (!response.ok()) {
    throw new Error(`${what} failed: ${response.status()} ${await response.text()}`)
  }
}

export function authHeaders(token) {
  return { Authorization: `Bearer ${token}` }
}

export async function login(request, email, password) {
  // /auth/login takes form-encoded fields (OAuth2 password flow), not JSON
  const response = await request.post('/api/auth/login', { form: { username: email, password } })
  await ensureOk(response, `login as ${email}`)
  return (await response.json()).access_token
}

export const adminToken = (request) => login(request, ADMIN.email, ADMIN.password)

async function postJson(request, path, data, token) {
  const response = await request.post(path, { data, headers: token ? authHeaders(token) : {} })
  await ensureOk(response, `POST ${path}`)
  return response.json()
}

export async function createCustomer(request) {
  const user = {
    name: 'E2E Customer',
    email: `cust-${randomUUID().slice(0, 8)}@example.com`,
    password: CUSTOMER_PASSWORD,
  }
  const created = await postJson(request, '/api/auth/register', user)
  return { ...user, id: created.id }
}

/** One movie, one theater with seats A1..A{seatCount}, one showtime tomorrow at 12:00 Vietnam time. */
export async function createShowtimeScenario(request, token, { price = 100000, seatCount = 5 } = {}) {
  const movieTitle = unique('E2E Movie')
  const theaterName = unique('E2E Theater')

  const movie = await postJson(
    request, '/api/movies',
    { title: movieTitle, description: 'Created by an E2E test', duration: 100, genre: 'Drama' },
    token,
  )
  const theater = await postJson(request, '/api/theaters', { name: theaterName, location: 'E2E Street' }, token)
  await postJson(
    request, `/api/theaters/${theater.id}/seats`,
    { rows: [{ row: 'A', seat_count: seatCount, seat_type: 'STANDARD' }] },
    token,
  )

  // Tomorrow, because the UI hides today's past showtimes. A fixed wall-clock time
  // makes the date tab and the time label predictable.
  const dateKey = new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString('en-CA', { timeZone: VN_TZ })
  const showtime = await postJson(
    request, '/api/showtimes',
    {
      movie_id: movie.id,
      theater_id: theater.id,
      start_time: `${dateKey}T12:00:00+07:00`,
      price,
      format: '2D',
    },
    token,
  )

  return {
    movieId: movie.id,
    movieTitle,
    theaterId: theater.id,
    theaterName,
    showtimeId: showtime.id,
    dateKey,
    timeLabel: '12:00',
    price,
  }
}

/**
 * Log a browser context in without touching the login form. AuthContext reads
 * localStorage.token on startup, so having it there before the first page load
 * IS being logged in. Note the script re-runs on every FULL page load, so
 * don't use this in a test that logs out and then reloads.
 */
export async function signIn(context, request, user) {
  const token = await login(request, user.email, user.password)
  await context.addInitScript((value) => window.localStorage.setItem('token', value), token)
}