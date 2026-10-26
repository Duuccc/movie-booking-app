import { test, expect } from '@playwright/test'
import { adminToken, createShowtimeScenario } from '../helpers/api.js'

test('a hard load of a deep link still serves the app (nginx SPA fallback)', async ({ page, request }) => {
  const token = await adminToken(request)
  const scenario = await createShowtimeScenario(request, token)

  await page.goto(`/movies/${scenario.movieId}`)   // a fresh page load, not in-app navigation

  await expect(page.getByRole('heading', { name: scenario.movieTitle })).toBeVisible()
})

test('the API is reachable through the nginx proxy', async ({ request }) => {
  const response = await request.get('/api/health')

  expect(response.ok()).toBeTruthy()
  // JSON, not index.html: the request really reached FastAPI
  expect(response.headers()['content-type']).toContain('application/json')
})