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
  // dataFlush returns a promise that resolves after SQLite write — no timeout needed
}

/** Clear all seeded shows from SQLite */
async function clearHistory(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    return window.clui.clearShowHistory?.() ?? Promise.resolve()
  })
}

/** Navigate to HistoryView from DarkStudio */
async function openHistoryFromDarkStudio(page: import('@playwright/test').Page) {
  await seedFixture(page, FIXTURES.darkStudio)
  const pastShowsBtn = page.getByRole('button', { name: 'Past Shows' })
  await expect(pastShowsBtn).toBeVisible({ timeout: 10000 })
  await pastShowsBtn.click()
  // Wait for HistoryView to render instead of arbitrary timeout
  await expect(page.getByText('PAST SHOWS', { exact: true })).toBeVisible({ timeout: 10000 })
}

/** Assert HistoryView header is visible */
async function expectHistoryHeader(page: import('@playwright/test').Page) {
  const header = page.getByText('PAST SHOWS', { exact: true })
  await expect(header).toBeVisible({ timeout: 5000 })
}

/** Generate a unique showId for test isolation */
function uniqueShowId(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10)
}

// ─── Test 1: Navigate to HistoryView from DarkStudioView (empty state) ───

test.describe('HistoryView — Navigation from DarkStudio', () => {
  test('shows empty state when no past shows exist', async ({ mainPage: page }) => {
    // Clear any leftover data from prior tests
    await clearHistory(page)

    await openHistoryFromDarkStudio(page)
    await expectHistoryHeader(page)

    // Verify empty state message
    const emptyMsg = page.getByText('No past shows yet')
    await expect(emptyMsg).toBeVisible({ timeout: 5000 })

    await screenshot(page, 'history-empty-state')

    // Navigate back and wait for DarkStudio to appear
    const backBtn = page.getByRole('button', { name: 'Back to Stage' })
    await backBtn.click()
    await expect(page.getByText("Enter the Writer's Room")).toBeVisible({ timeout: 10000 })
  })
})

// ─── Test 2: Navigate to HistoryView from StrikeView ───

test.describe('HistoryView — Navigation from Strike', () => {
  test('navigates from StrikeView via View Past Shows button', async ({ mainPage: page }) => {
    // Seed a past show with unique ID so it doesn't collide
    const showId = uniqueShowId(2)
    await seedPastShow(page, showId)

    // Seed StrikeView state
    await seedFixture(page, FIXTURES.strike_dayWon)

    // Click "View Past Shows" button
    const viewHistoryBtn = page.locator('[data-testid="view-history-btn"]')
    await expect(viewHistoryBtn).toBeVisible({ timeout: 15000 })
    await viewHistoryBtn.click()

    // Wait for HistoryView to render
    await expectHistoryHeader(page)

    await screenshot(page, 'history-from-strike')

    // Navigate back and wait for DarkStudio
    const backBtn = page.getByRole('button', { name: 'Back to Stage' })
    await backBtn.click()
    await expect(page.getByText("Enter the Writer's Room")).toBeVisible({ timeout: 10000 })
  })
})

// ─── Test 3: Past show appears after completing a show (DAY_WON) ───

test.describe('HistoryView — Show Entry Verification', () => {
  test('displays past show with date, verdict, act count, and beat stars', async ({ mainPage: page }) => {
    // Seed a completed show with unique ID
    const showId = uniqueShowId(3)
    await seedPastShow(page, showId, {
      verdict: 'DAY_WON',
      beatsLocked: 3,
    })

    // Navigate to HistoryView
    await openHistoryFromDarkStudio(page)
    await expectHistoryHeader(page)

    // Verify NOT the empty state
    const emptyMsg = page.getByText('No past shows yet')
    await expect(emptyMsg).not.toBeVisible({ timeout: 3000 })

    // Verify show entry via data-testid
    const showEntry = page.locator(`[data-testid="show-entry-${showId}"]`)
    await expect(showEntry).toBeVisible({ timeout: 5000 })

    // Verdict badge should show "Day Won"
    await expect(showEntry.getByText('Day Won')).toBeVisible()

    // Act count should show (e.g. "2/3 acts")
    await expect(showEntry.getByText(/\d+\/\d+ acts/)).toBeVisible()

    // Beat stars — verify golden stars exist (★ character)
    const goldenStars = showEntry.locator('.text-beat')
    const starCount = await goldenStars.count()
    expect(starCount).toBeGreaterThan(0)

    await screenshot(page, 'history-show-entry')

    // Navigate back
    const backBtn = page.getByRole('button', { name: 'Back to Stage' })
    await backBtn.click()
    await expect(page.getByText("Enter the Writer's Room")).toBeVisible({ timeout: 10000 })
  })
})

// ─── Test 4: All verdict types display correctly ───

test.describe('HistoryView — Verdict Types', () => {
  test('displays GOOD_EFFORT and SHOW_CALLED_EARLY verdicts', async ({ mainPage: page }) => {
    // Seed shows with each verdict type using unique IDs
    const goodEffortId = uniqueShowId(5)
    const calledEarlyId = uniqueShowId(6)

    await seedPastShow(page, goodEffortId, { verdict: 'GOOD_EFFORT', beatsLocked: 1 })
    await seedPastShow(page, calledEarlyId, { verdict: 'SHOW_CALLED_EARLY', beatsLocked: 0 })

    await openHistoryFromDarkStudio(page)
    await expectHistoryHeader(page)

    // Verify GOOD_EFFORT entry
    const goodEffortEntry = page.locator(`[data-testid="show-entry-${goodEffortId}"]`)
    await expect(goodEffortEntry).toBeVisible({ timeout: 5000 })
    await expect(goodEffortEntry.getByText('Good Effort')).toBeVisible()

    // Verify SHOW_CALLED_EARLY entry
    const calledEarlyEntry = page.locator(`[data-testid="show-entry-${calledEarlyId}"]`)
    await expect(calledEarlyEntry).toBeVisible({ timeout: 5000 })
    await expect(calledEarlyEntry.getByText('Called Early')).toBeVisible()

    // Navigate back
    const backBtn = page.getByRole('button', { name: 'Back to Stage' })
    await backBtn.click()
    await expect(page.getByText("Enter the Writer's Room")).toBeVisible({ timeout: 10000 })
  })
})

// ─── Test 5: Expand a show to see detail (acts, plan, cut acts, drift) ───

test.describe('HistoryView — Expand Show Detail', () => {
  test('expanding a show reveals act list with names, statuses, durations, and drift', async ({ mainPage: page }) => {
    // Seed a past show with unique ID
    const showId = uniqueShowId(4)
    await seedPastShow(page, showId, {
      verdict: 'SOLID_SHOW',
      planText: 'Focus on deep work and exercise',
    })

    // Navigate to HistoryView
    await openHistoryFromDarkStudio(page)
    await expectHistoryHeader(page)

    // Click on the show entry via data-testid
    const showEntry = page.locator(`[data-testid="show-entry-${showId}"]`)
    await expect(showEntry).toBeVisible({ timeout: 5000 })
    await showEntry.click()

    // Wait for expanded detail to appear
    const detailPanel = page.locator(`[data-testid="show-detail-${showId}"]`)
    await expect(detailPanel).toBeVisible({ timeout: 5000 })

    // Verify ACTS label appears
    await expect(detailPanel.getByText('ACTS', { exact: true })).toBeVisible()

    // Verify PLAN label appears
    await expect(detailPanel.getByText('PLAN', { exact: true })).toBeVisible()

    // Verify plan text is shown
    await expect(detailPanel.getByText('Focus on deep work')).toBeVisible()

    // Verify completed act names
    await expect(detailPanel.getByText('Deep Work Session')).toBeVisible()
    await expect(detailPanel.getByText('Exercise Break')).toBeVisible()

    // Verify cut act renders with "Cut" label
    const cutRow = detailPanel.locator('[data-testid="act-row-cut"]')
    await expect(cutRow).toBeVisible()
    await expect(cutRow.getByText('Cut')).toBeVisible()
    await expect(cutRow.getByText('Email & Slack')).toBeVisible()

    // Verify duration drift indicator (planned != actual for Exercise Break: 25m → 30m)
    const driftIndicator = detailPanel.locator('[data-testid="drift-indicator"]')
    const driftCount = await driftIndicator.count()
    expect(driftCount).toBeGreaterThan(0)

    // Verify act durations are shown (e.g., "45m", "25m")
    const detailText = await detailPanel.textContent()
    expect(detailText).toMatch(/\d+m/)

    await screenshot(page, 'history-expanded-detail')

    // ─── Collapse: click again and verify detail hides ───
    await showEntry.click()
    await expect(detailPanel).not.toBeVisible({ timeout: 5000 })

    // Navigate back
    const backBtn = page.getByRole('button', { name: 'Back to Stage' })
    await backBtn.click()
    await expect(page.getByText("Enter the Writer's Room")).toBeVisible({ timeout: 10000 })
  })
})

// ─── Test 6: Multiple shows display in reverse-chronological order ───

test.describe('HistoryView — Multiple Shows & Ordering', () => {
  test('displays multiple shows in reverse-chronological order', async ({ mainPage: page }) => {
    // Seed three shows on different days
    const olderShowId = uniqueShowId(9)
    const middleShowId = uniqueShowId(8)
    const newerShowId = uniqueShowId(7)

    await seedPastShow(page, olderShowId, { verdict: 'GOOD_EFFORT', beatsLocked: 1 })
    await seedPastShow(page, middleShowId, { verdict: 'SOLID_SHOW', beatsLocked: 2 })
    await seedPastShow(page, newerShowId, { verdict: 'DAY_WON', beatsLocked: 3 })

    await openHistoryFromDarkStudio(page)
    await expectHistoryHeader(page)

    // All three entries should be visible
    await expect(page.locator(`[data-testid="show-entry-${olderShowId}"]`)).toBeVisible({ timeout: 5000 })
    await expect(page.locator(`[data-testid="show-entry-${middleShowId}"]`)).toBeVisible({ timeout: 5000 })
    await expect(page.locator(`[data-testid="show-entry-${newerShowId}"]`)).toBeVisible({ timeout: 5000 })

    // Verify ordering: newer shows should appear before older ones
    // Get all show-entry elements and check their data-testid order
    const entries = page.locator('[data-testid^="show-entry-"]')
    const count = await entries.count()
    expect(count).toBeGreaterThanOrEqual(3)

    // Get all testids in display order
    const testIds: string[] = []
    for (let i = 0; i < count; i++) {
      const tid = await entries.nth(i).getAttribute('data-testid')
      if (tid) testIds.push(tid)
    }

    // Newer show ID should appear before older in the list (reverse-chrono)
    const newerIdx = testIds.indexOf(`show-entry-${newerShowId}`)
    const olderIdx = testIds.indexOf(`show-entry-${olderShowId}`)
    expect(newerIdx).toBeLessThan(olderIdx)

    // Navigate back
    const backBtn = page.getByRole('button', { name: 'Back to Stage' })
    await backBtn.click()
    await expect(page.getByText("Enter the Writer's Room")).toBeVisible({ timeout: 10000 })
  })
})

// ─── Test 7: Back button returns to previous view ───

test.describe('HistoryView — Back Navigation', () => {
  test('Back to Stage returns to DarkStudioView', async ({ mainPage: page }) => {
    // Navigate to HistoryView from DarkStudio
    await openHistoryFromDarkStudio(page)
    await expectHistoryHeader(page)

    // Click "Back to Stage"
    const backBtn = page.getByRole('button', { name: 'Back to Stage' })
    await expect(backBtn).toBeVisible({ timeout: 3000 })
    await backBtn.click()

    // Verify we're back on DarkStudioView
    await expect(page.getByText("Enter the Writer's Room")).toBeVisible({ timeout: 10000 })

    // Verify "Past Shows" button is visible again (confirms DarkStudio view)
    await expect(page.getByRole('button', { name: 'Past Shows' })).toBeVisible({ timeout: 5000 })

    await screenshot(page, 'history-back-to-stage')
  })
})
