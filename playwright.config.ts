import { defineConfig } from '@playwright/test'

export default defineConfig({
  globalTeardown: './e2e/global-teardown.ts',
  testDir: './e2e',
  timeout: 60000,
  retries: 0,
  workers: 2,
  fullyParallel: true,
  reporter: [
    ['./reporters/progress-reporter.ts'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['html', { open: 'never' }],
    ['allure-playwright'],
  ],
  use: {
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'smoke', testMatch: /app-launch|onboarding/, metadata: { durationBudgetMs: 10_000 } },
    { name: 'core-flow', testMatch: /writers-room|live-show|strike-reset|cold-open/, metadata: { durationBudgetMs: 15_000 } },
    { name: 'data-views', testMatch: /data-layer|temporal|temporal-copy|view-tiers|history|settings/, metadata: { durationBudgetMs: 15_000 } },
    { name: 'visual', testMatch: /visual-regression|visual-validation|consistency/, use: { deviceScaleFactor: 1 }, metadata: { durationBudgetMs: 20_000 } },
    {
      name: 'claude-real',
      testMatch: /claude-real/,
      timeout: 180_000,
      retries: 1,
      use: { trace: 'on', video: 'on', screenshot: 'on' },
      metadata: { durationBudgetMs: 120_000 },
    },
    {
      name: 'claude-cassette',
      testMatch: /claude-cassette/,
      timeout: 30_000,
      metadata: { durationBudgetMs: 20_000 },
    },
  ],
  testIgnore: ['showtime.test.ts'],
})
