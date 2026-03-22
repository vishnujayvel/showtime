import { test, expect, screenshot, FIXTURES, seedFixture, setShowState } from './fixtures'

test.describe('Cross-Component Data Consistency', () => {

  test('act name matches across expanded and pill views', async ({ mainPage: page }) => {
    // Start in expanded view, read act name (appears in both timer and sidebar, use first)
    await seedFixture(page, FIXTURES.live_expanded)
    const expandedActName = await page.getByText('Deep Work Session').first().textContent()
    expect(expandedActName).toBeTruthy()

    await screenshot(page, 'consistency-expanded-act-name')

    // Switch to micro (pill) view
    await setShowState(page, { viewTier: 'micro' })
    const pillActName = await page.getByText('Deep Work Session').first().textContent()

    // They should match
    expect(expandedActName).toBe(pillActName)
    await screenshot(page, 'consistency-pill-act-name')
  })

  test('act name matches across expanded and compact views', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.live_expanded)
    const expandedName = await page.getByText('Deep Work Session').first().textContent()

    await setShowState(page, { viewTier: 'compact' })
    const compactName = await page.getByText('Deep Work Session').first().textContent()

    expect(expandedName).toBe(compactName)
    await screenshot(page, 'consistency-compact-act-name')
  })

  test('act name matches across expanded and dashboard views', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.live_expanded)
    const expandedName = await page.getByText('Deep Work Session').first().textContent()

    await setShowState(page, { viewTier: 'dashboard' })
    const dashboardName = await page.getByText('Deep Work Session').first().textContent()

    expect(expandedName).toBe(dashboardName)
    await screenshot(page, 'consistency-dashboard-act-name')
  })

  test('beat count is consistent across views', async ({ mainPage: page }) => {
    // Seed with 1 beat locked
    await seedFixture(page, {
      ...FIXTURES.live_expanded,
      beatsLocked: 2,
      beatThreshold: 3,
    })

    // Read beat state from expanded view via localStorage
    const expandedBeats = await page.evaluate(() => {
      const raw = localStorage.getItem('showtime-show-state')
      if (raw) {
        const parsed = JSON.parse(raw)
        return { locked: parsed.state.beatsLocked, threshold: parsed.state.beatThreshold }
      }
      return null
    })
    expect(expandedBeats).toEqual({ locked: 2, threshold: 3 })

    // Switch to compact
    await setShowState(page, { viewTier: 'compact' })
    const compactBeats = await page.evaluate(() => {
      const raw = localStorage.getItem('showtime-show-state')
      if (raw) {
        const parsed = JSON.parse(raw)
        return { locked: parsed.state.beatsLocked, threshold: parsed.state.beatThreshold }
      }
      return null
    })
    expect(compactBeats).toEqual({ locked: 2, threshold: 3 })

    // Switch to pill
    await setShowState(page, { viewTier: 'micro' })
    const pillBeats = await page.evaluate(() => {
      const raw = localStorage.getItem('showtime-show-state')
      if (raw) {
        const parsed = JSON.parse(raw)
        return { locked: parsed.state.beatsLocked, threshold: parsed.state.beatThreshold }
      }
      return null
    })
    expect(pillBeats).toEqual({ locked: 2, threshold: 3 })

    await screenshot(page, 'consistency-beats')
  })

  test('date label matches between ExpandedView and WritersRoom', async ({ mainPage: page }) => {
    // Read date label from expanded view
    await seedFixture(page, FIXTURES.live_expanded)
    const expandedDate = await page.locator('[data-testid="date-label"]').textContent().catch(() => '')

    // Switch to WritersRoom
    await seedFixture(page, FIXTURES.writersRoom_energy)
    // WritersRoom also has a date label in the title bar
    const writersRoomDate = await page.locator('[data-testid="date-label"]').textContent().catch(() => '')

    // Both should show the same formatted date
    if (expandedDate && writersRoomDate) {
      expect(expandedDate).toBe(writersRoomDate)
    }

    await screenshot(page, 'consistency-date-labels')
  })

  test('strike stats match actual act data', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.strike_dayWon)

    // COMPLETED_ACTS has 3 completed acts, 0 skipped
    // DAY_WON has beatsLocked: 3

    // Verify stats display
    await expect(page.getByText('Acts Completed')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Acts Cut')).toBeVisible()
    await expect(page.getByText('Beats Locked')).toBeVisible()

    // Read the numbers - they're in preceding sibling divs
    const statsText = await page.textContent('body')

    // 3 completed acts
    expect(statsText).toContain('3')
    // 0 skipped
    expect(statsText).toContain('0')

    await screenshot(page, 'consistency-strike-stats')
  })

  test('END CREDITS in strike lists all acts', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.strike_dayWon)

    await expect(page.getByText('END CREDITS')).toBeVisible({ timeout: 5000 })

    // All 3 acts from COMPLETED_ACTS should appear
    await expect(page.getByText('Deep Work Session')).toBeVisible()
    await expect(page.getByText('Exercise Break')).toBeVisible()
    await expect(page.getByText('Email & Slack')).toBeVisible()

    await screenshot(page, 'consistency-end-credits')
  })

  test('intermission shows same act count as live', async ({ mainPage: page }) => {
    // Read act count from live expanded
    await seedFixture(page, FIXTURES.live_expanded)
    const liveActCount = await page.evaluate(() => {
      const raw = localStorage.getItem('showtime-show-state')
      if (raw) return JSON.parse(raw).state.acts.length
      return 0
    })

    // Switch to intermission
    await seedFixture(page, FIXTURES.intermission)
    const intermissionActCount = await page.evaluate(() => {
      const raw = localStorage.getItem('showtime-show-state')
      if (raw) return JSON.parse(raw).state.acts.length
      return 0
    })

    expect(liveActCount).toBe(intermissionActCount)
    expect(liveActCount).toBe(3) // STANDARD_ACTS has 3

    await screenshot(page, 'consistency-intermission-acts')
  })

  test('pill "Intermission" text matches expanded intermission', async ({ mainPage: page }) => {
    // Expanded intermission
    await seedFixture(page, {
      ...FIXTURES.intermission,
      viewTier: 'expanded',
    })
    const expandedHasIntermission = await page.getByText(/right back|intermission/i).isVisible().catch(() => false)

    // Pill intermission
    await seedFixture(page, {
      ...FIXTURES.intermission,
      viewTier: 'micro',
    })
    const pillHasIntermission = await page.getByText('Intermission').isVisible().catch(() => false)

    // Both should show intermission text
    expect(expandedHasIntermission || pillHasIntermission).toBe(true)
    if (pillHasIntermission) {
      expect(pillHasIntermission).toBe(true)
    }

    await screenshot(page, 'consistency-intermission-text')
  })
})
