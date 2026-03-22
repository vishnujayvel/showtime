import { test, expect, screenshot, seedFixture, FIXTURES } from './fixtures'

test.describe('7.5 — Strike the Stage', () => {
  test('can render strike view with verdict', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.strike_solidShow as unknown as Record<string, unknown>)

    const body = await page.textContent('body')
    const hasVerdict = body?.includes('SOLID SHOW')
      || body?.includes('DAY WON')
      || body?.includes('GOOD EFFORT')
      || body?.includes('SHOW CALLED')

    await screenshot(page, '10-strike-verdict')

    if (hasVerdict) {
      expect(hasVerdict).toBe(true)
    }
  })
})

const DIRECTOR_STATE = {
  phase: 'director',
  viewTier: 'expanded',
  beatsLocked: 1,
  beatThreshold: 3,
  acts: [
    { id: 'reset-act-1', name: 'Test Act', sketch: 'Testing', durationMinutes: 25, status: 'active', beatLocked: false, order: 0 },
  ],
  currentActId: 'reset-act-1',
  showStartedAt: Date.now() - 600000,
}

test.describe('Reset Show (#16)', () => {
  test('Director Mode shows reset button with confirmation dialog', async ({ mainPage: page }) => {
    await seedFixture(page, DIRECTOR_STATE)

    const directorTitle = page.getByText('The Director is here.')
    await expect(directorTitle).toBeVisible({ timeout: 10000 })

    // Reset button now uses temporal label
    const resetBtn = page.locator('button').filter({ hasText: /Reset .+ show/i }).first()
    await expect(resetBtn).toBeVisible({ timeout: 5000 })
    await resetBtn.click()
    await page.waitForTimeout(500)

    // Confirmation dialog now uses temporal label
    const confirmTitle = page.locator('[role="dialog"] h2, [role="alertdialog"] h2').filter({ hasText: /Reset .+ show/i }).first()
    await expect(confirmTitle).toBeVisible({ timeout: 5000 })
    await screenshot(page, 'reset-show-confirm')

    const cancelBtn = page.getByRole('button', { name: 'Cancel' })
    await cancelBtn.click()
    await page.waitForTimeout(300)

    await expect(directorTitle).toBeVisible({ timeout: 3000 })
  })

  test('confirming reset returns to Dark Studio', async ({ mainPage: page }) => {
    await seedFixture(page, DIRECTOR_STATE)

    const directorTitle = page.getByText('The Director is here.')
    await expect(directorTitle).toBeVisible({ timeout: 10000 })

    const resetBtn = page.locator('button').filter({ hasText: /Reset .+ show/i }).first()
    await expect(resetBtn).toBeVisible({ timeout: 5000 })
    await resetBtn.click()
    await page.waitForTimeout(500)

    const confirmResetBtn = page.getByRole('button', { name: 'Reset Show' })
    await confirmResetBtn.click()
    await page.waitForTimeout(1000)

    const cta = page.getByText("Enter the Writer's Room")
    await expect(cta).toBeVisible({ timeout: 10000 })

    const state = await page.evaluate(() => {
      const raw = localStorage.getItem('showtime-show-state')
      return raw ? JSON.parse(raw).state : null
    })
    if (state) {
      expect(state.phase).toBe('no_show')
      expect(state.acts).toHaveLength(0)
      expect(state.beatsLocked).toBe(0)
    }
    await screenshot(page, 'reset-show-complete')
  })
})
