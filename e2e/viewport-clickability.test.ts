/**
 * Viewport Clickability Tests
 *
 * Asserts that every interactive element in every view is truly clickable
 * by a real user — visible, within viewport, not obscured, and not
 * pointer-events: none. Uses the custom toBeUserClickable() matcher.
 *
 * This catches the Issue #74 class of bug where elements exist in the DOM
 * but require scrolling to reach, which Playwright's auto-scroll masks.
 */
import { test, expect, screenshot, FIXTURES, seedFixture } from './fixtures'

test.describe('Viewport Clickability', () => {

  // ─── Dark Studio (no_show phase) ───

  test('DarkStudio — all interactive elements clickable', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.darkStudio)
    // Wait for the primary CTA to render (Framer Motion delayed entrance at 1.2s)
    await page.waitForTimeout(2000)

    // "Enter the Writer's Room" button (or "Resume Today's Show" if there's a persisted show)
    const enterBtn = page.locator('[data-testid="enter-writers-room"]')
    const resumeBtn = page.locator('[data-testid="resume-show-btn"]')

    const enterVisible = await enterBtn.isVisible().catch(() => false)
    const resumeVisible = await resumeBtn.isVisible().catch(() => false)

    if (enterVisible) {
      await expect(enterBtn).toBeUserClickable()
    }
    if (resumeVisible) {
      await expect(resumeBtn).toBeUserClickable()
    }
    // At least one CTA must be present
    expect(enterVisible || resumeVisible).toBe(true)

    // "Past Shows" button
    const pastShowsBtn = page.getByRole('button', { name: /past shows/i })
    if (await pastShowsBtn.isVisible().catch(() => false)) {
      await expect(pastShowsBtn).toBeUserClickable()
    }

    await screenshot(page, 'clickability-dark-studio')
  })

  // ─── Writer's Room (chat step, empty — no lineup) ───

  test('WritersRoom (chat, empty) — all interactive elements clickable', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.writersRoom_chat)
    await page.waitForTimeout(1000)

    // Energy picker chip (in title bar)
    const energyChip = page.locator('[data-testid="energy-chip"]')
    if (await energyChip.isVisible().catch(() => false)) {
      await expect(energyChip).toBeUserClickable()
    }

    // Quick-start template buttons (visible when no messages)
    const templateLight = page.locator('[data-testid="template-light"]')
    const templateDeepFocus = page.locator('[data-testid="template-deep-focus"]')
    if (await templateLight.isVisible().catch(() => false)) {
      await expect(templateLight).toBeUserClickable()
    }
    if (await templateDeepFocus.isVisible().catch(() => false)) {
      await expect(templateDeepFocus).toBeUserClickable()
    }

    // Chat input textarea
    const chatInput = page.locator('[data-testid="chat-input"]')
    await expect(chatInput).toBeUserClickable()

    // Send button (disabled when empty, but still should be in viewport)
    const sendBtn = page.locator('[data-testid="chat-send"]')
    await expect(sendBtn).toBeUserClickable()

    // BUILD MY LINEUP button
    const buildLineupBtn = page.locator('[data-testid="build-lineup-btn"]')
    await expect(buildLineupBtn).toBeUserClickable()

    // Toolbar buttons: close, view menu trigger, mute toggle
    const quitBtn = page.locator('[data-testid="toolbar-quit-btn"]')
    if (await quitBtn.isVisible().catch(() => false)) {
      await expect(quitBtn).toBeUserClickable()
    }

    const viewMenuTrigger = page.locator('[data-testid="view-menu-trigger"]')
    if (await viewMenuTrigger.isVisible().catch(() => false)) {
      await expect(viewMenuTrigger).toBeUserClickable()
    }

    const muteToggle = page.locator('[data-testid="mute-toggle"]')
    if (await muteToggle.isVisible().catch(() => false)) {
      await expect(muteToggle).toBeUserClickable()
    }

    await screenshot(page, 'clickability-writers-room-chat')
  })

  // ─── Writer's Room (lineup step — acts present, ready to go live) ───

  test('WritersRoom (lineup ready) — all interactive elements clickable', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.writersRoom_lineup)
    await page.waitForTimeout(1000)

    // Energy picker chip
    const energyChip = page.locator('[data-testid="energy-chip"]')
    if (await energyChip.isVisible().catch(() => false)) {
      await expect(energyChip).toBeUserClickable()
    }

    // Toolbar buttons
    const quitBtn = page.locator('[data-testid="toolbar-quit-btn"]')
    if (await quitBtn.isVisible().catch(() => false)) {
      await expect(quitBtn).toBeUserClickable()
    }

    const viewMenuTrigger = page.locator('[data-testid="view-menu-trigger"]')
    if (await viewMenuTrigger.isVisible().catch(() => false)) {
      await expect(viewMenuTrigger).toBeUserClickable()
    }

    const muteToggle = page.locator('[data-testid="mute-toggle"]')
    if (await muteToggle.isVisible().catch(() => false)) {
      await expect(muteToggle).toBeUserClickable()
    }

    await screenshot(page, 'clickability-writers-room-lineup')
  })

  // ─── Expanded View (live phase) ───

  test('Expanded (live) — all interactive elements clickable', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.live_expanded)
    await page.waitForTimeout(1000)

    // Toolbar: Director button
    const directorBtn = page.locator('[data-testid="toolbar-director-btn"]')
    if (await directorBtn.isVisible().catch(() => false)) {
      await expect(directorBtn).toBeUserClickable()
    }

    // Toolbar: Collapse button
    const collapseBtn = page.locator('[data-testid="toolbar-collapse-btn"]')
    if (await collapseBtn.isVisible().catch(() => false)) {
      await expect(collapseBtn).toBeUserClickable()
    }

    // Toolbar: Close/quit button
    const quitBtn = page.locator('[data-testid="toolbar-quit-btn"]')
    if (await quitBtn.isVisible().catch(() => false)) {
      await expect(quitBtn).toBeUserClickable()
    }

    // Toolbar: View menu trigger
    const viewMenuTrigger = page.locator('[data-testid="view-menu-trigger"]')
    if (await viewMenuTrigger.isVisible().catch(() => false)) {
      await expect(viewMenuTrigger).toBeUserClickable()
    }

    // Toolbar: Mute toggle
    const muteToggle = page.locator('[data-testid="mute-toggle"]')
    if (await muteToggle.isVisible().catch(() => false)) {
      await expect(muteToggle).toBeUserClickable()
    }

    await screenshot(page, 'clickability-expanded-live')
  })

  // ─── Expanded View (intermission phase) ───

  test('Expanded (intermission) — all interactive elements clickable', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.intermission)
    await page.waitForTimeout(1000)

    // IntermissionView: "Back to the show" button
    const backToShowBtn = page.getByRole('button', { name: /back to the show/i })
    if (await backToShowBtn.isVisible().catch(() => false)) {
      await expect(backToShowBtn).toBeUserClickable()
    }

    // Toolbar buttons (intermission on expanded tier)
    const directorBtn = page.locator('[data-testid="toolbar-director-btn"]')
    if (await directorBtn.isVisible().catch(() => false)) {
      await expect(directorBtn).toBeUserClickable()
    }

    const viewMenuTrigger = page.locator('[data-testid="view-menu-trigger"]')
    if (await viewMenuTrigger.isVisible().catch(() => false)) {
      await expect(viewMenuTrigger).toBeUserClickable()
    }

    const muteToggle = page.locator('[data-testid="mute-toggle"]')
    if (await muteToggle.isVisible().catch(() => false)) {
      await expect(muteToggle).toBeUserClickable()
    }

    await screenshot(page, 'clickability-expanded-intermission')
  })

  // ─── Compact View (live phase) ───

  test('Compact (live) — all interactive elements clickable', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.live_compact)
    await page.waitForTimeout(1000)

    // Toolbar: Collapse button
    const collapseBtn = page.locator('[data-testid="toolbar-collapse-btn"]')
    if (await collapseBtn.isVisible().catch(() => false)) {
      await expect(collapseBtn).toBeUserClickable()
    }

    // Toolbar: Close/quit button
    const quitBtn = page.locator('[data-testid="toolbar-quit-btn"]')
    if (await quitBtn.isVisible().catch(() => false)) {
      await expect(quitBtn).toBeUserClickable()
    }

    // Toolbar: View menu trigger
    const viewMenuTrigger = page.locator('[data-testid="view-menu-trigger"]')
    if (await viewMenuTrigger.isVisible().catch(() => false)) {
      await expect(viewMenuTrigger).toBeUserClickable()
    }

    // Toolbar: Mute toggle
    const muteToggle = page.locator('[data-testid="mute-toggle"]')
    if (await muteToggle.isVisible().catch(() => false)) {
      await expect(muteToggle).toBeUserClickable()
    }

    await screenshot(page, 'clickability-compact-live')
  })

  // ─── Dashboard View (live phase) ───

  test('Dashboard (live) — all interactive elements clickable', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.live_dashboard)
    await page.waitForTimeout(1000)

    // Toolbar: Director button (dashboard tier has director)
    const directorBtn = page.locator('[data-testid="toolbar-director-btn"]')
    if (await directorBtn.isVisible().catch(() => false)) {
      await expect(directorBtn).toBeUserClickable()
    }

    // Toolbar: Collapse button
    const collapseBtn = page.locator('[data-testid="toolbar-collapse-btn"]')
    if (await collapseBtn.isVisible().catch(() => false)) {
      await expect(collapseBtn).toBeUserClickable()
    }

    // Toolbar: Close/quit button
    const quitBtn = page.locator('[data-testid="toolbar-quit-btn"]')
    if (await quitBtn.isVisible().catch(() => false)) {
      await expect(quitBtn).toBeUserClickable()
    }

    // Toolbar: View menu trigger
    const viewMenuTrigger = page.locator('[data-testid="view-menu-trigger"]')
    if (await viewMenuTrigger.isVisible().catch(() => false)) {
      await expect(viewMenuTrigger).toBeUserClickable()
    }

    // Toolbar: Mute toggle
    const muteToggle = page.locator('[data-testid="mute-toggle"]')
    if (await muteToggle.isVisible().catch(() => false)) {
      await expect(muteToggle).toBeUserClickable()
    }

    await screenshot(page, 'clickability-dashboard-live')
  })

  // ─── Pill View (live phase, micro tier) ───

  test('Pill (live) — all interactive elements clickable', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.live_micro)
    await page.waitForTimeout(1000)

    // Pill minimize button
    const minimizeBtn = page.locator('[data-testid="pill-minimize-btn"]')
    if (await minimizeBtn.isVisible().catch(() => false)) {
      await expect(minimizeBtn).toBeUserClickable()
    }

    // Toolbar: View menu trigger (pill has a different style but same testid)
    const viewMenuTrigger = page.locator('[data-testid="view-menu-trigger"]')
    if (await viewMenuTrigger.isVisible().catch(() => false)) {
      await expect(viewMenuTrigger).toBeUserClickable()
    }

    await screenshot(page, 'clickability-pill-live')
  })

  // ─── Strike View (DAY WON verdict) ───

  test('Strike (DAY_WON) — all interactive elements clickable', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.strike_dayWon)
    await page.waitForTimeout(1500)

    // "Add an Encore" button
    const encoreBtn = page.locator('[data-testid="encore-btn"]')
    if (await encoreBtn.isVisible().catch(() => false)) {
      await expect(encoreBtn).toBeUserClickable()
    }

    // "Plan Tomorrow" button
    const planTomorrowBtn = page.locator('[data-testid="plan-tomorrow-btn"]')
    if (await planTomorrowBtn.isVisible().catch(() => false)) {
      await expect(planTomorrowBtn).toBeUserClickable()
    }

    // "That's a Wrap" button
    const wrapsBtn = page.locator('[data-testid="thats-a-wrap-btn"]')
    if (await wrapsBtn.isVisible().catch(() => false)) {
      await expect(wrapsBtn).toBeUserClickable()
    }

    // "View Past Shows" button
    const viewHistoryBtn = page.locator('[data-testid="view-history-btn"]')
    if (await viewHistoryBtn.isVisible().catch(() => false)) {
      await expect(viewHistoryBtn).toBeUserClickable()
    }

    // Toolbar: Close/quit
    const quitBtn = page.locator('[data-testid="toolbar-quit-btn"]')
    if (await quitBtn.isVisible().catch(() => false)) {
      await expect(quitBtn).toBeUserClickable()
    }

    // Toolbar: View menu trigger
    const viewMenuTrigger = page.locator('[data-testid="view-menu-trigger"]')
    if (await viewMenuTrigger.isVisible().catch(() => false)) {
      await expect(viewMenuTrigger).toBeUserClickable()
    }

    // Toolbar: Mute toggle
    const muteToggle = page.locator('[data-testid="mute-toggle"]')
    if (await muteToggle.isVisible().catch(() => false)) {
      await expect(muteToggle).toBeUserClickable()
    }

    // Toolbar: Collapse button (strike phase has collapse)
    const collapseBtn = page.locator('[data-testid="toolbar-collapse-btn"]')
    if (await collapseBtn.isVisible().catch(() => false)) {
      await expect(collapseBtn).toBeUserClickable()
    }

    await screenshot(page, 'clickability-strike-day-won')
  })

  // ─── Strike View (GOOD_EFFORT verdict — no confetti overlay) ───

  test('Strike (GOOD_EFFORT) — all interactive elements clickable', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.strike_goodEffort)
    await page.waitForTimeout(1500)

    // Same footer buttons as DAY_WON
    const encoreBtn = page.locator('[data-testid="encore-btn"]')
    if (await encoreBtn.isVisible().catch(() => false)) {
      await expect(encoreBtn).toBeUserClickable()
    }

    const planTomorrowBtn = page.locator('[data-testid="plan-tomorrow-btn"]')
    if (await planTomorrowBtn.isVisible().catch(() => false)) {
      await expect(planTomorrowBtn).toBeUserClickable()
    }

    const wrapsBtn = page.locator('[data-testid="thats-a-wrap-btn"]')
    if (await wrapsBtn.isVisible().catch(() => false)) {
      await expect(wrapsBtn).toBeUserClickable()
    }

    const viewHistoryBtn = page.locator('[data-testid="view-history-btn"]')
    if (await viewHistoryBtn.isVisible().catch(() => false)) {
      await expect(viewHistoryBtn).toBeUserClickable()
    }

    await screenshot(page, 'clickability-strike-good-effort')
  })

  // ─── Sweep test: generic locator scan across key views ───

  test('sweep: no visible button/link is outside viewport in DarkStudio', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.darkStudio)
    await page.waitForTimeout(2000)

    const interactives = page.locator('button:visible, a:visible, [role="button"]:visible')
    const count = await interactives.count()
    for (let i = 0; i < count; i++) {
      await expect(interactives.nth(i)).toBeUserClickable()
    }
  })

  test('sweep: no visible button/link is outside viewport in Expanded (live)', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.live_expanded)
    await page.waitForTimeout(1000)

    const interactives = page.locator('button:visible, a:visible, [role="button"]:visible')
    const count = await interactives.count()
    for (let i = 0; i < count; i++) {
      await expect(interactives.nth(i)).toBeUserClickable()
    }
  })

  test('sweep: no visible button/link is outside viewport in Compact (live)', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.live_compact)
    await page.waitForTimeout(1000)

    const interactives = page.locator('button:visible, a:visible, [role="button"]:visible')
    const count = await interactives.count()
    for (let i = 0; i < count; i++) {
      await expect(interactives.nth(i)).toBeUserClickable()
    }
  })

  test('sweep: no visible button/link is outside viewport in Dashboard (live)', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.live_dashboard)
    await page.waitForTimeout(1000)

    const interactives = page.locator('button:visible, a:visible, [role="button"]:visible')
    const count = await interactives.count()
    for (let i = 0; i < count; i++) {
      await expect(interactives.nth(i)).toBeUserClickable()
    }
  })

  test('sweep: no visible button/link is outside viewport in Pill (live)', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.live_micro)
    await page.waitForTimeout(1000)

    const interactives = page.locator('button:visible, a:visible, [role="button"]:visible')
    const count = await interactives.count()
    for (let i = 0; i < count; i++) {
      await expect(interactives.nth(i)).toBeUserClickable()
    }
  })

  test('sweep: no visible button/link is outside viewport in Strike (DAY_WON)', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.strike_dayWon)
    await page.waitForTimeout(1500)

    // Exclude confetti elements (pointer-events: none overlay, intentionally not clickable)
    const interactives = page.locator(
      'button:visible, a:visible, [role="button"]:visible'
    )
    const count = await interactives.count()
    for (let i = 0; i < count; i++) {
      const el = interactives.nth(i)
      // Skip elements inside the confetti overlay (they have pointer-events: none by design)
      const isConfetti = await el.evaluate((node) => {
        return node.closest('.animate-confetti') !== null ||
               node.closest('[class*="pointer-events-none"]') !== null
      })
      if (!isConfetti) {
        await expect(el).toBeUserClickable()
      }
    }
  })

  test('sweep: no visible button/link is outside viewport in WritersRoom (chat)', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.writersRoom_chat)
    await page.waitForTimeout(1000)

    const interactives = page.locator('button:visible, a:visible, [role="button"]:visible')
    const count = await interactives.count()
    for (let i = 0; i < count; i++) {
      await expect(interactives.nth(i)).toBeUserClickable()
    }
  })
})
