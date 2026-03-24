import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  retries: 0,
  workers: 4,
  fullyParallel: true,
  use: {
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'smoke', testMatch: /app-launch|onboarding/ },
    { name: 'core-flow', testMatch: /writers-room|live-show|strike-reset/ },
    { name: 'data-views', testMatch: /data-layer|temporal|temporal-copy|view-tiers/ },
    { name: 'visual', testMatch: /visual-regression|visual-validation|consistency/ },
  ],
  testIgnore: ['showtime.test.ts'],
})
