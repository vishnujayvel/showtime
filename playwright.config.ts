import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  retries: 0,
  // All tests share one Electron app via worker-scoped fixture
  workers: 1,
  fullyParallel: false,
  use: {
    trace: 'on-first-retry',
  },
  // Exclude the old monolith (kept for reference)
  testIgnore: ['showtime.test.ts'],
})
