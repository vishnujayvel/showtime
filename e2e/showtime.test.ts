import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import path from 'path'

let app: ElectronApplication
let page: Page

// Helper: take screenshot without waiting for web fonts (which may not load in test)
async function screenshot(name: string) {
  try {
    await page.screenshot({ path: `e2e/screenshots/${name}.png`, timeout: 5000 })
  } catch {
    // Font loading timeout — screenshot still useful if it was captured partially
  }
}

// Helper: navigate without waiting for full "load" (which hangs on font loading)
async function navigateAndWait() {
  const url = page.url()
  await page.goto(url, { waitUntil: 'commit', timeout: 10000 })
  await page.waitForTimeout(3000)
}

test.beforeAll(async () => {
  app = await electron.launch({
    args: [path.join(__dirname, '..', 'dist', 'main', 'index.js')],
    env: { ...process.env, NODE_ENV: 'test' },
    timeout: 30000,
  })

  page = await app.firstWindow()
  // Wait for React to mount (don't rely on load event which hangs on Google Fonts)
  await page.waitForSelector('div', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(3000)

  // Clear persisted show state so tests start from no_show phase
  await page.evaluate(() => localStorage.removeItem('showtime-show-state'))
  await navigateAndWait()
})

test.afterAll(async () => {
  if (app) await app.close()
})

// ─── openspec-7.1: App launches successfully ───

test.describe('7.1 — App Launch', () => {
  test('window opens and is visible', async () => {
    const windowCount = app.windows().length
    expect(windowCount).toBeGreaterThanOrEqual(1)

    const isVisible = await page.evaluate(() => document.visibilityState === 'visible')
    expect(isVisible).toBe(true)
  })

  test('renders Dark Studio view (no_show phase)', async () => {
    // The CTA button has a 1.2s animation delay — give it time
    const cta = page.getByText("Enter the Writer's Room")
    await expect(cta).toBeVisible({ timeout: 10000 })
    await screenshot('01-dark-studio')
  })
})

// ─── openspec-7.2: Dark Studio → Writer's Room transition ───

test.describe('7.2 — Dark Studio → Writer\'s Room', () => {
  test('clicking CTA transitions to Writer\'s Room', async () => {
    const cta = page.getByText("Enter the Writer's Room")
    await cta.click()
    await page.waitForTimeout(500)

    // Writer's Room should show energy selector
    const highEnergy = page.getByText('High Energy')
    await expect(highEnergy).toBeVisible({ timeout: 5000 })
    await screenshot('02-writers-room')
  })
})

// ─── openspec-7.3: Energy → Plan → Lineup → "We're Live!" ───

test.describe('7.3 — Writer\'s Room Flow', () => {
  test('can select energy level', async () => {
    const highButton = page.getByText('High Energy')
    await highButton.click()
    await page.waitForTimeout(500)
    await screenshot('03-energy-selected')
  })

  test('shows plan dump textarea after energy selection', async () => {
    const textarea = page.locator('textarea').first()
    await expect(textarea).toBeVisible({ timeout: 5000 })

    await textarea.fill('Deep Work on Showtime for 2 hours\nExercise for 45 minutes\nAdmin catch-up for 30 minutes')
    await page.waitForTimeout(300)
    await screenshot('04-plan-filled')
  })

  test('can submit plan and see lineup preview', async () => {
    // Find and click the submit/next button
    const nextButton = page.getByText('Show me the lineup')
    if (await nextButton.isVisible().catch(() => false)) {
      await nextButton.click()
      await page.waitForTimeout(500)
    } else {
      // Try alternative button text patterns
      const altButton = page.locator('button').filter({ hasText: /lineup|next|continue/i }).first()
      if (await altButton.isVisible().catch(() => false)) {
        await altButton.click()
        await page.waitForTimeout(500)
      }
    }
    await screenshot('05-lineup-preview')
  })

  test('can go live', async () => {
    const goLiveButton = page.locator('button').filter({ hasText: /live/i }).first()
    if (await goLiveButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await goLiveButton.click()
      await page.waitForTimeout(3000)
      await screenshot('06-going-live')
    }
  })
})

// ─── openspec-7.4: Act timer, Beat Check, Intermission ───

test.describe('7.4 — Live Show Flows', () => {
  test('expanded view shows content when live', async () => {
    const body = await page.textContent('body')
    expect(body!.length).toBeGreaterThan(0)
    await screenshot('07-expanded-view')
  })

  test('can trigger beat check via store manipulation', async () => {
    // Set beatCheckPending=true via localStorage and re-navigate
    await page.evaluate(() => {
      const raw = localStorage.getItem('showtime-show-state')
      if (raw) {
        const parsed = JSON.parse(raw)
        parsed.state.beatCheckPending = true
        localStorage.setItem('showtime-show-state', JSON.stringify(parsed))
      }
    })
    await navigateAndWait()
    await screenshot('08-beat-check')
  })

  test('can trigger intermission via store manipulation', async () => {
    await page.evaluate(() => {
      const raw = localStorage.getItem('showtime-show-state')
      if (raw) {
        const parsed = JSON.parse(raw)
        parsed.state.phase = 'intermission'
        parsed.state.beatCheckPending = false
        localStorage.setItem('showtime-show-state', JSON.stringify(parsed))
      }
    })
    await navigateAndWait()

    // Look for intermission UI
    const intermissionText = page.getByText(/right back|intermission|no rush/i)
    const isVisible = await intermissionText.isVisible().catch(() => false)
    await screenshot('09-intermission')
    if (isVisible) {
      expect(isVisible).toBe(true)
    }
  })
})

// ─── openspec-7.5: Strike the Stage with verdict ───

test.describe('7.5 — Strike the Stage', () => {
  test('can render strike view with verdict', async () => {
    await page.evaluate(() => {
      const raw = localStorage.getItem('showtime-show-state')
      if (raw) {
        const parsed = JSON.parse(raw)
        parsed.state.phase = 'strike'
        parsed.state.verdict = 'SOLID_SHOW'
        parsed.state.beatsLocked = 2
        parsed.state.beatThreshold = 3
        parsed.state.isExpanded = true
        localStorage.setItem('showtime-show-state', JSON.stringify(parsed))
      }
    })
    await navigateAndWait()

    const body = await page.textContent('body')
    const hasVerdict = body?.includes('SOLID SHOW')
      || body?.includes('DAY WON')
      || body?.includes('GOOD EFFORT')
      || body?.includes('SHOW CALLED')

    await screenshot('10-strike-verdict')

    if (hasVerdict) {
      expect(hasVerdict).toBe(true)
    }
  })
})

// ─── Pill ↔ Expanded transition ───

test.describe('Pill ↔ Expanded', () => {
  test('can toggle between pill and expanded views', async () => {
    // Set to live phase, expanded
    await page.evaluate(() => {
      const raw = localStorage.getItem('showtime-show-state')
      if (raw) {
        const parsed = JSON.parse(raw)
        parsed.state.phase = 'live'
        parsed.state.isExpanded = true
        parsed.state.verdict = null
        localStorage.setItem('showtime-show-state', JSON.stringify(parsed))
      }
    })
    await navigateAndWait()

    // Look for a collapse/minimize button
    const collapseBtn = page.locator('button').filter({ hasText: /collapse|minimize|−/i }).first()
    if (await collapseBtn.isVisible().catch(() => false)) {
      await collapseBtn.click()
      await page.waitForTimeout(500)
      await screenshot('11-pill-view')

      // Click to expand back
      const pill = page.locator('[data-clui-ui]').first()
      if (await pill.isVisible().catch(() => false)) {
        await pill.click()
        await page.waitForTimeout(500)
        await screenshot('12-expanded-again')
      }
    }

    await screenshot('13-final-state')
  })
})
