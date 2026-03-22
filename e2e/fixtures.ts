/**
 * Shared Playwright fixtures for Electron E2E tests.
 * Launches the app once per worker and shares it across all test files.
 */
import { test as base, _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import path from 'path'

type ElectronFixtures = {
  app: ElectronApplication
  mainPage: Page
}

export const test = base.extend<{}, ElectronFixtures>({
  app: [async ({}, use) => {
    const app = await electron.launch({
      args: [path.join(__dirname, '..', 'dist', 'main', 'index.js')],
      env: { ...process.env, NODE_ENV: 'test' },
      timeout: 30000,
    })

    const page = await app.firstWindow()
    await page.waitForSelector('div', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(3000)

    // Clear persisted show state so tests start from no_show phase
    await page.evaluate(() => {
      localStorage.removeItem('showtime-show-state')
      localStorage.setItem('showtime-onboarding-complete', 'true')
    })
    await navigateAndWaitPage(page)

    await use(app)

    const pid = app.process().pid
    await app.close().catch(() => {})
    if (pid) {
      try { process.kill(pid, 'SIGKILL') } catch {}
    }
  }, { scope: 'worker' }],

  mainPage: [async ({ app }, use) => {
    const page = await app.firstWindow()
    await use(page)
  }, { scope: 'worker' }],
})

export { expect } from '@playwright/test'

/** Take screenshot without waiting for web fonts */
export async function screenshot(page: Page, name: string) {
  try {
    await page.screenshot({ path: `e2e/screenshots/${name}.png`, timeout: 5000 })
  } catch {}
}

/** Navigate without waiting for full "load" (hangs on font loading) */
export async function navigateAndWait(page: Page) {
  await navigateAndWaitPage(page)
}

async function navigateAndWaitPage(page: Page) {
  const url = page.url()
  await page.goto(url, { waitUntil: 'commit', timeout: 10000 })
  await page.waitForTimeout(3000)
}

/** Set show state via localStorage manipulation and reload */
export async function setShowState(page: Page, stateOverrides: Record<string, unknown>) {
  await page.evaluate((overrides) => {
    const raw = localStorage.getItem('showtime-show-state')
    if (raw) {
      const parsed = JSON.parse(raw)
      Object.assign(parsed.state, overrides)
      localStorage.setItem('showtime-show-state', JSON.stringify(parsed))
    }
  }, stateOverrides)
  await navigateAndWaitPage(page)
}
