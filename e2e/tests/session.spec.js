import { test, expect } from '@playwright/test'
import { adminToken, authHeaders, createCustomer, signIn } from '../helpers/api.js'

test('a session the server no longer accepts logs the user out', async ({ page, context, request }) => {
  const token = await adminToken(request)
  const customer = await createCustomer(request)
  await signIn(context, request, customer)

  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible()   // logged in

  // The account disappears server-side while the page is still open
  const deleted = await request.delete(`/api/admin/users/${customer.id}`, { headers: authHeaders(token) })
  expect(deleted.status()).toBe(204)

  // Next authenticated call gets a 401, api.js fires auth:expired, AuthContext logs out.
  // In-app navigation (no reload), so the sign-in init script does not run again.
  await page.getByRole('link', { name: 'My Bookings', exact: true }).click()
  await expect(page).toHaveURL(/\/login/)
})