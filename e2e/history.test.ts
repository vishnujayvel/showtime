import { test, expect, screenshot, seedFixture, FIXTURES } from './fixtures'

// ─── HistoryView E2E Tests (#37) ───
// Verifies full data flow: showStore → SyncEngine → SQLite → ShowRepository → IPC → HistoryView

/** Seed a past show into SQLite via dataFlush IPC */
async function seedPastShow(page: import('@playwright/test').Page, showId: string, opts?: {
  verdict?: string
  energy?: string
  beatsLocked?: number
  planText?: string
}) {
  const now = Date.now()
  await page.evaluate(({ showId, now, opts }) => {
    return window.clui.dataFlush({
      showId,
      phase: 'strike',
      energy: opts?.energy ?? 'high',
      verdict: opts?.verdict ?? 'SOLID_SHOW',
      beatsLocked: opts?.beatsLocked ?? 2,
      beatThreshold: 3,
      startedAt: now - 7200000,
      endedAt: now - 3600000,
      planText: opts?.planText ?? 'Focus on deep work and exercise',
      acts: [
        {
          id: `${showId}-act-1`, name: 'Deep Work Session', sketch: 'Deep Work',
          category: 'deep', plannedDurationMs: 2700000, actualDurationMs: 2400000,
          sortOrder: 0, status: 'completed', beatLocked: 1,
          plannedStartAt: now - 7200000, actualStartAt: now - 7200000, actualEndAt: now - 4800000,
        },
        {
          id: `${showId}-act-2`, name: 'Exercise Break', sketch: 'Exercise',
          category: 'exercise', plannedDurationMs: 1500000, actualDurationMs: 1800000,
          sortOrder: 1, status: 'completed', beatLocked: 1,
          plannedStartAt: now - 4800000, actualStartAt: now - 4800000, actualEndAt: now - 3000000,
        },
        {
          id: `${showId}-act-3`, name: 'Email & Slack', sketch: 'Admin',
          category: 'admin', plannedDurationMs: 1200000, actualDurationMs: null,
          sortOrder: 2, status: 'cut', beatLocked: 0,
          plannedStartAt: now - 3000000, actualStartAt: null, actualEndAt: null,
        },
      ],
    })
  }, { showId, now, opts: opts ?? {} })
  // Small wait to ensure SQLite write completes
  await page.waitForTimeout(500)
}

/** Navigate to HistoryView from DarkStudio */
async function openHistoryFromDarkStudio(page: import('@playwright/test').Page) {
  await seedFixture(page, FIXTURES.darkStudio)
  const pastShowsBtn = page.getByRole('button', { name: 'Past Shows' })
  await expect(pastShowsBtn).toBeVisible({ timeout: 10000 })
  await pastShowsBtn.click()
  await page.waitForTimeout(1500)
}

/** Assert HistoryView header is visible */
async function expectHistoryHeader(page: import('@playwright/test').Page) {
  const header = page.getByText('PAST SHOWS', { exact: true })
  await expect(header).toBeVisible({ timeout: 5000 })
}

// ─── Test 1: Navigate to HistoryView from DarkStudioView (empty state) ───

test.describe('HistoryView — Navigation from DarkStudio', () => {
  test('shows empty state when no past shows exist', async ({ mainPage: page }) => {
    await openHistoryFromDarkStudio(page)

    await expectHistoryHeader(page)

    // Verify empty state message
    const emptyMsg = page.getByText('No past shows yet')
    await expect(emptyMsg).toBeVisible({ timeout: 5000 })

    await screenshot(page, 'history-empty-state')

    // Navigate back so state is clean for next test
    const backBtn = page.getByRole('button', { name: 'Back to Stage' })
    await backBtn.click()
    await page.waitForTimeout(1000)
  })
})

// ─── Test 2: Navigate to HistoryView from StrikeView ───

test.describe('HistoryView — Navigation from Strike', () => {
  test('navigates from StrikeView via View Past Shows button', async ({ mainPage: page }) => {
    // Seed a past show so history isn't empty when we get there
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    await seedPastShow(page, yesterday)

    // Seed StrikeView state
    await seedFixture(page, FIXTURES.strike_dayWon)

    // Click "View Past Shows" button
    const viewHistoryBtn = page.locator('[data-testid="view-history-btn"]')
    await expect(viewHistoryBtn).toBeVisible({ timeout: 15000 })
    await viewHistoryBtn.click()
    await page.waitForTimeout(1500)

    // Verify HistoryView renders
    await expectHistoryHeader(page)

    await screenshot(page, 'history-from-strike')

    // Navigate back
    const backBtn = page.getByRole('button', { name: 'Back to Stage' })
    await backBtn.click()
    await page.waitForTimeout(1000)
  })
})

// ─── Test 3: Past show appears after completing a show ───

test.describe('HistoryView — Show Entry Verification', () => {
  test('displays past show with date, verdict, act count, and beat stars', async ({ mainPage: page }) => {
    // Seed a completed show into SQLite (simulating post-Strike persistence)
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    await seedPastShow(page, yesterday, {
      verdict: 'DAY_WON',
      beatsLocked: 3,
    })

    // Navigate to HistoryView
    await openHistoryFromDarkStudio(page)
    await expectHistoryHeader(page)

    // Verify NOT the empty state
    const emptyMsg = page.getByText('No past shows yet')
    await expect(emptyMsg).not.toBeVisible({ timeout: 3000 })

    // Verify show entry elements are visible
    const body = await page.textContent('body')

    // Verdict badge should show "Day Won"
    expect(body).toMatch(/Day Won/i)

    // Act count should show (e.g. "2/3 acts")
    expect(body).toMatch(/\d+\/\d+ acts/)

    // Beat stars — verify golden stars exist (★ character)
    const goldenStars = page.locator('.text-beat')
    const starCount = await goldenStars.count()
    expect(starCount).toBeGreaterThan(0)

    await screenshot(page, 'history-show-entry')

    // Navigate back
    const backBtn = page.getByRole('button', { name: 'Back to Stage' })
    await backBtn.click()
    await page.waitForTimeout(1000)
  })
})

// ─── Test 4: Expand a show to see detail ───

test.describe('HistoryView — Expand Show Detail', () => {
  test('expanding a show reveals act list with names and durations', async ({ mainPage: page }) => {
    // Seed a past show with plan text
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    await seedPastShow(page, yesterday, {
      verdict: 'SOLID_SHOW',
      planText: 'Focus on deep work and exercise',
    })

    // Navigate to HistoryView
    await openHistoryFromDarkStudio(page)
    await expectHistoryHeader(page)

    // Click on the show entry to expand it (entries are motion.button with act count text)
    const showEntry = page.locator('.overflow-y-auto button').first()
    await expect(showEntry).toBeVisible({ timeout: 5000 })
    await showEntry.click()
    await page.waitForTimeout(1500)

    // Verify act names appear in the expanded detail
    const body = await page.textContent('body')
    expect(body).toContain('Deep Work Session')
    expect(body).toContain('Exercise Break')

    // Verify act durations are shown (e.g., "45m", "25m")
    expect(body).toMatch(/\d+m/)

    // Verify plan text is shown
    expect(body).toContain('Focus on deep work')

    // Verify ACTS label appears
    const actsLabel = page.getByText('ACTS', { exact: true })
    await expect(actsLabel).toBeVisible({ timeout: 3000 })

    // Verify PLAN label appears
    const planLabel = page.getByText('PLAN', { exact: true })
    await expect(planLabel).toBeVisible({ timeout: 3000 })

    await screenshot(page, 'history-expanded-detail')

    // Navigate back
    const backBtn = page.getByRole('button', { name: 'Back to Stage' })
    await backBtn.click()
    await page.waitForTimeout(1000)
  })
})

// ─── Test 5: Back button returns to previous view ───

test.describe('HistoryView — Back Navigation', () => {
  test('Back to Stage returns to DarkStudioView', async ({ mainPage: page }) => {
    // Navigate to HistoryView from DarkStudio
    await openHistoryFromDarkStudio(page)
    await expectHistoryHeader(page)

    // Click "Back to Stage"
    const backBtn = page.getByRole('button', { name: 'Back to Stage' })
    await expect(backBtn).toBeVisible({ timeout: 3000 })
    await backBtn.click()
    await page.waitForTimeout(1000)

    // Verify we're back on DarkStudioView
    const writersCta = page.getByText("Enter the Writer's Room")
    await expect(writersCta).toBeVisible({ timeout: 10000 })

    // Verify "Past Shows" button is visible again (confirms DarkStudio view)
    await expect(page.getByRole('button', { name: 'Past Shows' })).toBeVisible({ timeout: 5000 })

    await screenshot(page, 'history-back-to-stage')
  })
})
