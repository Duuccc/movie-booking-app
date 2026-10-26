import { test, expect } from '@playwright/test'
import { ADMIN, createCustomer, signIn } from '../helpers/api.js'

test('a customer is bounced away from the admin area', async ({ page, context, request }) => {
  const customer = await createCustomer(request)
  await signIn(context, request, customer)

  await page.goto('/admin')

  // AdminRoute sends non-admins home
  await expect.poll(() => new URL(page.url()).pathname).toBe('/')
})

test('an admin lands on Analytics and its queries run against real Postgres', async ({ page, context, request }) => {
  await signIn(context, request, ADMIN)

  await page.goto('/admin')

  await expect.poll(() => new URL(page.url()).pathname).toBe('/admin/analytics')
  await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible()
  // Only rendered after GET /admin/analytics answered, i.e. every aggregation query ran
  await expect(page.getByText('Revenue by Day')).toBeVisible()
})