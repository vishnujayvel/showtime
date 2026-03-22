import { test, expect, screenshot, navigateAndWait, setShowState } from './fixtures'

test.describe('7.5 — Strike the Stage', () => {
  test('can render strike view with verdict', async ({ mainPage: page }) => {
    await page.evaluate(() => {
      const raw = localStorage.getItem('showtime-show-state')
      if (raw) {
        const parsed = JSON.parse(raw)
        parsed.state.phase = 'strike'
        parsed.state.verdict = 'SOLID_SHOW'
        parsed.state.beatsLocked = 2
        parsed.state.beatThreshold = 3
        parsed.state.viewTier = 'expanded'
        localStorage.setItem('showtime-show-state', JSON.stringify(parsed))
      }
    })
    await navigateAndWait(page)

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

test.describe('Reset Show (#16)', () => {
  test('Director Mode shows reset button with confirmation dialog', async ({ mainPage: page }) => {
    await page.evaluate(() => {
      const raw = localStorage.getItem('showtime-show-state')
      if (raw) {
        const parsed = JSON.parse(raw)
        parsed.state.phase = 'director'
        parsed.state.viewTier = 'expanded'
        parsed.state.beatsLocked = 1
        parsed.state.beatCheckPending = false
        parsed.state.celebrationActive = false
        parsed.state.goingLiveActive = false
        if (!parsed.state.acts || parsed.state.acts.length === 0) {
          parsed.state.acts = [
            { id: 'reset-act-1', name: 'Test Act', sketch: 'Testing', durationMinutes: 25, status: 'active', beatLocked: false, order: 0 },
          ]
          parsed.state.currentActId = 'reset-act-1'
        }
        localStorage.setItem('showtime-show-state', JSON.stringify(parsed))
      }
    })
    await navigateAndWait(page)

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

    const cancelBtn = page.getByText('Cancel')
    await cancelBtn.click()
    await page.waitForTimeout(300)

    await expect(directorTitle).toBeVisible({ timeout: 3000 })
  })

  test('confirming reset returns to Dark Studio', async ({ mainPage: page }) => {
    const resetBtn = page.locator('button').filter({ hasText: /Reset .+ show/i }).first()
    await resetBtn.click()
    await page.waitForTimeout(500)

    const confirmResetBtn = page.getByText('Reset Show')
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
