import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  // One worker: all tests share one database. Each test creates its own uniquely
  // named data, so parallel runs would work too, but sequential is easier to debug.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:8081',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})