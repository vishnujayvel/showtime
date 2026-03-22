import { test, expect, screenshot, seedFixture, FIXTURES } from './fixtures'

// ─── All-Verdicts Coverage (#16 + completeness) ───

test.describe('7.5 — Strike the Stage: DAY_WON', () => {
  test('renders DAY_WON verdict', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.strike_dayWon)
    const body = await page.textContent('body')
    expect(body).toMatch(/DAY WON/i)
    await screenshot(page, '10-strike-day-won')
  })
})

test.describe('7.5 — Strike the Stage: SOLID_SHOW', () => {
  test('renders SOLID_SHOW verdict', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.strike_solidShow)
    const body = await page.textContent('body')
    expect(body).toMatch(/SOLID SHOW/i)
    await screenshot(page, '10-strike-solid-show')
  })
})

test.describe('7.5 — Strike the Stage: GOOD_EFFORT', () => {
  test('renders GOOD_EFFORT verdict', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.strike_goodEffort)
    const body = await page.textContent('body')
    expect(body).toMatch(/GOOD EFFORT/i)
    await screenshot(page, '10-strike-good-effort')
  })
})

test.describe('7.5 — Strike the Stage: SHOW_CALLED_EARLY', () => {
  test('renders SHOW_CALLED_EARLY verdict', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.strike_calledEarly)
    const body = await page.textContent('body')
    expect(body).toMatch(/SHOW CALLED/i)
    await screenshot(page, '10-strike-called-early')
  })
})

// ─── Director State factory (fresh timestamp per test) ───

function makeDirectorState() {
  return {
    phase: 'director',
    viewTier: 'expanded',
    beatsLocked: 1,
    beatThreshold: 3,
    goingLiveActive: false,
    beatCheckPending: false,
    celebrationActive: false,
    acts: [
      { id: 'reset-act-1', name: 'Test Act', sketch: 'Testing', durationMinutes: 25, status: 'active', beatLocked: false, order: 0 },
    ],
    currentActId: 'reset-act-1',
    showStartedAt: Date.now() - 600000,
  }
}

// ─── Reset Show (#16) ───

test.describe('Reset Show (#16)', () => {
  test('Director Mode shows reset button with confirmation dialog', async ({ mainPage: page }) => {
    await seedFixture(page, makeDirectorState())

    const directorTitle = page.getByText('The Director is here.')
    await expect(directorTitle).toBeVisible({ timeout: 10000 })

    const resetBtn = page.locator('button').filter({ hasText: /Reset .+ show/i }).first()
    await expect(resetBtn).toBeVisible({ timeout: 5000 })
    await resetBtn.click()
    await page.waitForTimeout(500)

    const confirmTitle = page.locator('[role="dialog"] h2, [role="alertdialog"] h2').filter({ hasText: /Reset .+ show/i }).first()
    await expect(confirmTitle).toBeVisible({ timeout: 5000 })
    await screenshot(page, 'reset-show-confirm')

    const cancelBtn = page.getByRole('button', { name: 'Cancel' })
    await cancelBtn.click()
    await page.waitForTimeout(300)

    await expect(directorTitle).toBeVisible({ timeout: 3000 })
  })

  test('confirming reset returns to Dark Studio', async ({ mainPage: page }) => {
    await seedFixture(page, makeDirectorState())

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
    expect(state).not.toBeNull()
    expect(state.phase).toBe('no_show')
    expect(state.acts).toHaveLength(0)
    expect(state.beatsLocked).toBe(0)
    await screenshot(page, 'reset-show-complete')
  })
})
