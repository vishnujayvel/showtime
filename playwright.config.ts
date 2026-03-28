import { defineConfig } from '@playwright/test'

export default defineConfig({
  globalTeardown: './e2e/global-teardown.ts',
  testDir: './e2e',
  timeout: 60000,
  retries: 0,
  workers: 2,
  fullyParallel: true,
  use: {
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'smoke', testMatch: /app-launch|onboarding/ },
    { name: 'core-flow', testMatch: /writers-room|live-show|strike-reset/ },
    { name: 'data-views', testMatch: /data-layer|temporal|temporal-copy|view-tiers|history/ },
    { name: 'visual', testMatch: /visual-regression|visual-validation|consistency/, use: { deviceScaleFactor: 1 } },
    {
      name: 'claude-real',
      testMatch: /claude-real/,
      timeout: 180_000,
      retries: 1,
      use: { trace: 'on', video: 'on', screenshot: 'on' },
    },
    {
      name: 'claude-cassette',
      testMatch: /claude-cassette/,
      timeout: 30_000,
    },
  ],
  testIgnore: ['showtime.test.ts'],
})
