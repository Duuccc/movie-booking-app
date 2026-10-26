import { test, expect } from '@playwright/test'
import { adminToken, createCustomer, createShowtimeScenario, signIn } from '../helpers/api.js'

test('a customer browses, picks seats, logs in, pays and sees the booking', async ({ page, request }) => {
  // Arrange through the API: fast and reliable. Act through the UI: what we are testing.
  const token = await adminToken(request)
  const scenario = await createShowtimeScenario(request, token, { price: 100000 })
  const customer = await createCustomer(request)

  // Browse: home -> movie -> showtimes
  await page.goto('/')
  await page.getByRole('link', { name: scenario.movieTitle }).click()
  await expect(page.getByRole('heading', { name: scenario.movieTitle })).toBeVisible()
  await page.getByText('View Showtimes').click()

  // The showtime is tomorrow, so open that date tab first
  await page.getByTestId(`date-tab-${scenario.dateKey}`).click()
  await page.getByRole('link', { name: new RegExp(scenario.timeLabel) }).click()

  // Anonymous visitors may pick seats
  await expect(page).toHaveURL(new RegExp(`/showtimes/${scenario.showtimeId}/seats`))
  await page.getByRole('button', { name: 'A1', exact: true }).click()
  await page.getByRole('button', { name: 'A2', exact: true }).click()

  // Booking needs an account: bounce to login, and the seats must survive the detour
  await page.getByRole('button', { name: 'Log In to Book' }).click()
  await expect(page).toHaveURL(/\/login/)
  await page.locator('input[type="email"]').fill(customer.email)
  await page.locator('input[type="password"]').fill(customer.password)
  await page.getByRole('button', { name: 'Log In', exact: true }).click()

  await expect(page).toHaveURL(new RegExp(`/showtimes/${scenario.showtimeId}/seats`))
  await expect(page.getByText('A1, A2')).toBeVisible()   // restored after the login round trip

  // Book, then pay
  await page.getByRole('button', { name: 'Confirm Booking' }).click()
  await expect(page).toHaveURL(/\/bookings\/\d+\/checkout/)
  await expect(page.getByText('Time remaining')).toBeVisible()
  await expect(page.getByText(/200\.000/).first()).toBeVisible()   // 2 seats x 100,000 VND
  await page.getByRole('button', { name: 'MoMo' }).click()
  await page.getByRole('button', { name: /^Pay / }).click()

  await expect(page).toHaveURL(/\/bookings\/\d+\/confirmation/)
  await expect(page.getByText('Booking Confirmed')).toBeVisible()
  await expect(page.getByRole('heading', { name: scenario.movieTitle })).toBeVisible()
  await expect(page.getByText('PAID')).toBeVisible()

  // And it shows up in My Bookings
  await page.getByRole('link', { name: 'My Bookings', exact: true }).click()
  const row = page.locator('.booking-row', { hasText: scenario.movieTitle })
  await expect(row).toContainText('PAID')
  await expect(row).toContainText('A1, A2')
})

test('when two customers pick the same seat, the slower one is told it is taken', async ({
  browser,
  baseURL,
  request,
}) => {
  const token = await adminToken(request)
  const scenario = await createShowtimeScenario(request, token)
  const alice = await createCustomer(request)
  const bob = await createCustomer(request)

  const contexts = []
  async function openSeatPageAs(user) {
    const context = await browser.newContext({ baseURL })   // separate browser profile per person
    contexts.push(context)
    await signIn(context, request, user)
    const page = await context.newPage()
    await page.goto(`/showtimes/${scenario.showtimeId}/seats`)
    await page.getByRole('button', { name: 'A1', exact: true }).click()
    return page
  }

  try {
    const alicePage = await openSeatPageAs(alice)
    const bobPage = await openSeatPageAs(bob)   // Bob's page loaded while A1 was still free

    await alicePage.getByRole('button', { name: 'Confirm Booking' }).click()
    await expect(alicePage).toHaveURL(/\/bookings\/\d+\/checkout/)

    await bobPage.getByRole('button', { name: 'Confirm Booking' }).click()
    await expect(bobPage.getByText(/already booked/i)).toBeVisible()
    // the page recovered: A1 now shows as taken, and Bob's selection was cleared
    await expect(bobPage.getByRole('button', { name: 'A1', exact: true })).toBeDisabled()
    await expect(bobPage.getByRole('button', { name: 'Confirm Booking' })).toBeDisabled()
    await expect(bobPage).toHaveURL(/\/seats/)
  } finally {
    await Promise.all(contexts.map((context) => context.close()))
  }
})