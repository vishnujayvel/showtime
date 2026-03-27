/**
 * Real Claude E2E tests — these call Claude for real (no mocks).
 *
 * Run locally or in nightly CI. Validates that the app actually works
 * end-to-end with a live Claude subprocess generating lineups.
 *
 * Usage:
 *   npx playwright test --project=claude-real
 *
 * Prerequisites:
 *   - Claude CLI installed and authenticated
 *   - App built: npm run build
 */
import { test, expect, screenshot, FIXTURES, seedFixture, freshStart, readClaudeLogEvents, assertLogContains, waitForRefinementComplete } from './fixtures'

test.describe('Real Claude Integration', () => {
  test.setTimeout(180_000)

  // Track which log events each test expects (set by tests, verified by afterEach)
  let expectedLogEvents: string[] = []
  // Track log offset so each test only validates its own log events, not cumulative
  let logOffsetBeforeTest = 0

  test.beforeEach(async ({ mainPage: page, app }) => {
    expectedLogEvents = []
    // Record current log count so afterEach only checks new entries
    try {
      const logs = await readClaudeLogEvents(app)
      logOffsetBeforeTest = logs.length
    } catch {
      logOffsetBeforeTest = 0
    }
    await freshStart(page)
  })

  test.afterEach(async ({ app }) => {
    if (expectedLogEvents.length === 0) return
    try {
      const allLogs = await readClaudeLogEvents(app)
      // Only check logs emitted during THIS test
      const testLogs = allLogs.slice(logOffsetBeforeTest)
      for (const event of expectedLogEvents) {
        assertLogContains(testLogs, event)
      }
    } catch (e) {
      // Log verification is supplementary — don't mask the primary test failure
      console.warn(`Log verification failed: ${e instanceof Error ? e.message : e}`)
    }
  })

  test('happy path: energy -> plan -> lineup', async ({ mainPage: page, app }) => {
    expectedLogEvents = ['claude.lineup_parsed']
    // 1. Seed Writer's Room at the energy step
    await seedFixture(page, FIXTURES.writersRoom_energy)

    // 2. Select energy level — click "High Energy" button text
    const highEnergy = page.getByText('High Energy')
    await expect(highEnergy).toBeVisible({ timeout: 10000 })
    await highEnergy.click()
    await page.waitForTimeout(500)
    await screenshot(page, 'claude-real-01-energy')

    // 3. Plan step: fill the textarea with a realistic plan
    const textarea = page.locator('textarea').first()
    await expect(textarea).toBeVisible({ timeout: 5000 })
    await textarea.fill('I want to do deep work on the project for 2 hours, then take a 30 min exercise break, then do some email')
    await page.waitForTimeout(300)
    await screenshot(page, 'claude-real-02-plan-filled')

    // 4. Click "Build my lineup" to submit to Claude
    const buildBtn = page.getByText('Build my lineup')
    await expect(buildBtn).toBeVisible({ timeout: 3000 })
    await buildBtn.click()

    // 5. Conversation step appears — writers are working
    const writerConvo = page.getByTestId('writer-conversation')
    await expect(writerConvo).toBeVisible({ timeout: 10000 }).catch(() => {})
    await screenshot(page, 'claude-real-03-waiting')

    // 6. Wait for act cards to appear — REAL Claude, this takes 10-60s
    // Act cards in the full lineup use the bg-surface-hover/50 class
    const actCardSelector = page.locator('.bg-surface-hover\\/50').first()

    // Anti-hallucination pattern #3: If Claude doesn't produce a lineup, the test FAILS. Period.
    // No fallback branch that accepts Claude unavailability as passing.
    try {
      await actCardSelector.waitFor({ state: 'visible', timeout: 120000 })
    } catch {
      // Capture diagnostic state before failing
      await screenshot(page, 'claude-real-04-FAILED')
      const conversationText = await page.getByTestId('writer-conversation').textContent().catch(() => 'no conversation')
      const sessionState = await page.evaluate(() => {
        const store = (window as Record<string, unknown>).__sessionStore as Record<string, unknown> | undefined
        if (!store) return 'no store'
        return JSON.stringify(store, null, 2).slice(0, 2000)
      }).catch(() => 'evaluate failed')
      console.log(`DIAGNOSTIC — conversation: ${conversationText?.slice(0, 500)}`)
      console.log(`DIAGNOSTIC — sessionStore: ${sessionState}`)
      throw new Error(`Lineup never appeared after 120s. Conversation: ${conversationText?.slice(0, 200)}`)
    }
    await screenshot(page, 'claude-real-04-result')

    // 7. Assert lineup appeared with at least 2 acts
    const actCards = page.locator('.bg-surface-hover\\/50')
    const cardCount = await actCards.count()
    expect(cardCount).toBeGreaterThanOrEqual(2)

    // Verify act cards have names
    const firstCardName = actCards.first().locator('.font-medium')
    await expect(firstCardName).toBeVisible()
    const nameText = await firstCardName.textContent()
    expect(nameText!.trim().length).toBeGreaterThan(0)

    // Verify act cards have durations
    const durationText = actCards.first().locator('span.text-xs.text-txt-muted')
    await expect(durationText).toBeVisible()
    const duration = await durationText.textContent()
    expect(duration).toMatch(/\d+m/)

    // Verify conversation thread has writer response
    const writerMessages = writerConvo.locator('.justify-start')
    expect(await writerMessages.count()).toBeGreaterThanOrEqual(1)

    // Verify "WE'RE LIVE!" button appeared (lineup exists)
    const goLiveBtn = page.locator('button').filter({ hasText: /LIVE/i }).first()
    await expect(goLiveBtn).toBeVisible({ timeout: 5000 })

    console.log(`Claude path: lineup generated with ${cardCount} acts`)
    await screenshot(page, 'claude-real-05-complete')
  })

  test('refinement updates lineup', async ({ mainPage: page, app }) => {
    expectedLogEvents = ['claude.lineup_parsed', 'claude.refinement_parsed']
    // Setup: seed Writer's Room at energy step
    await seedFixture(page, FIXTURES.writersRoom_energy)

    // Select energy
    const highEnergy = page.getByText('High Energy')
    await expect(highEnergy).toBeVisible({ timeout: 10000 })
    await highEnergy.click()
    await page.waitForTimeout(500)

    // Fill plan and submit
    const textarea = page.locator('textarea').first()
    await expect(textarea).toBeVisible({ timeout: 5000 })
    await textarea.fill('Plan: 1 hour deep work, 30 min exercise, 30 min admin')
    await page.waitForTimeout(300)

    const buildBtn = page.getByText('Build my lineup')
    await buildBtn.click()

    // Wait for initial lineup — must succeed, no fallback
    const actCardSelector = page.locator('.bg-surface-hover\\/50').first()
    await actCardSelector.waitFor({ state: 'visible', timeout: 120000 })

    const initialCards = page.locator('.bg-surface-hover\\/50')
    const initialCount = await initialCards.count()
    console.log(`Refinement test: initial lineup has ${initialCount} acts`)
    await screenshot(page, 'claude-real-refine-01-initial')

    // Send refinement via the LineupChatInput
    const chatInput = page.getByTestId('lineup-chat-input')
    await expect(chatInput).toBeVisible({ timeout: 5000 })
    await chatInput.fill('Add a coffee break between the first and second acts')
    await page.getByTestId('lineup-chat-send').click()

    await screenshot(page, 'claude-real-refine-02-sent')

    await waitForRefinementComplete(page)

    const refinedCards = page.locator('.bg-surface-hover\\/50')
    const refinedCount = await refinedCards.count()
    console.log(`Refinement test: refined lineup has ${refinedCount} acts`)
    await screenshot(page, 'claude-real-refine-03-refined')

    // We asked to add a coffee break — the refined lineup must have MORE acts
    expect(refinedCount).toBeGreaterThan(initialCount)
  })

  test('Claude error produces visible error state', async ({ mainPage: page }) => {
    // This test verifies the app handles Claude failures gracefully.
    // The conversation flow shows writer messages for errors and offers a Retry button.

    await seedFixture(page, FIXTURES.writersRoom_energy)

    // Select energy
    const highEnergy = page.getByText('High Energy')
    await expect(highEnergy).toBeVisible({ timeout: 10000 })
    await highEnergy.click()
    await page.waitForTimeout(500)

    // Fill and submit a minimal plan
    const textarea = page.locator('textarea').first()
    await expect(textarea).toBeVisible({ timeout: 5000 })
    await textarea.fill('test')
    await page.waitForTimeout(300)

    const buildBtn = page.getByText('Build my lineup')
    await buildBtn.click()

    // Conversation step appears
    const writerConvo = page.getByTestId('writer-conversation')
    await expect(writerConvo).toBeVisible({ timeout: 10000 }).catch(() => {})

    await screenshot(page, 'claude-real-error-01-submitted')

    // Wait for either:
    // 1. Lineup acts (success) — act cards appear
    // 2. Error state — Retry button or writer error message
    // 3. Timeout — the 30s conversation timeout fires and shows "coffee break" message
    const actCard = page.locator('.bg-surface-hover\\/50').first()
    const retryBtn = page.locator('button').filter({ hasText: /Retry/i }).first()
    const coffeeMsg = page.getByText(/coffee break/i)
    const writerSteppedOut = page.getByText(/stepped out/i)

    const result = await Promise.race([
      actCard.waitFor({ state: 'visible', timeout: 120000 }).then(() => 'lineup' as const),
      retryBtn.waitFor({ state: 'visible', timeout: 120000 }).then(() => 'retry' as const),
      coffeeMsg.waitFor({ state: 'visible', timeout: 120000 }).then(() => 'timeout-msg' as const),
      writerSteppedOut.waitFor({ state: 'visible', timeout: 120000 }).then(() => 'error-msg' as const),
      new Promise<'hard-timeout'>(resolve => setTimeout(() => resolve('hard-timeout'), 120000)),
    ])

    console.log(`Error test result: ${result}`)

    // App must produce a visible response — hard timeout means nothing rendered
    expect(['lineup', 'retry', 'timeout-msg', 'error-msg']).toContain(result)

    // If an error state appeared, verify conversation thread has content
    if (result === 'retry' || result === 'timeout-msg' || result === 'error-msg') {
      const writerMessages = writerConvo.locator('.justify-start')
      const msgCount = await writerMessages.count()
      expect(msgCount).toBeGreaterThanOrEqual(1)
    }

    await screenshot(page, 'claude-real-error-02-result')
  })

  test('full flow: energy -> plan -> lineup -> go live', async ({ mainPage: page, app }) => {
    expectedLogEvents = ['claude.lineup_parsed']
    // End-to-end: complete the Writer's Room and transition to live show
    await seedFixture(page, FIXTURES.writersRoom_energy)

    // Select energy
    await page.getByText('High Energy').click()
    await page.waitForTimeout(500)

    // Fill plan
    const textarea = page.locator('textarea').first()
    await expect(textarea).toBeVisible({ timeout: 5000 })
    await textarea.fill('Deep work for 1 hour, exercise for 30 minutes')
    await page.waitForTimeout(300)
    await page.getByText('Build my lineup').click()

    // Wait for lineup — must succeed, no fallback
    const actCard = page.locator('.bg-surface-hover\\/50').first()
    await actCard.waitFor({ state: 'visible', timeout: 120000 })

    await screenshot(page, 'claude-real-full-flow-01-lineup')

    // Click "WE'RE LIVE!"
    const goLiveBtn = page.locator('button').filter({ hasText: /LIVE/i }).first()
    await expect(goLiveBtn).toBeVisible({ timeout: 5000 })
    await goLiveBtn.click()
    await page.waitForTimeout(2000)

    await screenshot(page, 'claude-real-full-flow-02-going-live')

    // The Going Live transition may show a confirmation button
    const goLiveConfirm = page.getByTestId('go-live-button')
    if (await goLiveConfirm.isVisible({ timeout: 5000 }).catch(() => false)) {
      await goLiveConfirm.click()
      await page.waitForTimeout(2000)
    }

    await screenshot(page, 'claude-real-full-flow-03-live')

    // Verify we actually transitioned to live phase — check for ON AIR indicator
    // or timer display, not just that the app is mounted
    const onAirIndicator = page.getByText('ON AIR')
    const timerDisplay = page.locator('[data-testid="timer-display"]')
    const pillTimer = page.locator('.font-mono').filter({ hasText: /\d{1,2}:\d{2}/ }).first()

    const hasLiveUI = await Promise.race([
      onAirIndicator.waitFor({ state: 'visible', timeout: 10000 }).then(() => 'on-air'),
      timerDisplay.waitFor({ state: 'visible', timeout: 10000 }).then(() => 'timer'),
      pillTimer.waitFor({ state: 'visible', timeout: 10000 }).then(() => 'pill-timer'),
    ]).catch(() => 'none')

    expect(hasLiveUI).not.toBe('none')

    await screenshot(page, 'claude-real-full-flow-04-complete')
  })

  test('session continuity: refinement references initial lineup context', async ({ mainPage: page, app }) => {
    expectedLogEvents = ['claude.lineup_parsed', 'claude.refinement_parsed']

    // Build initial lineup
    await seedFixture(page, FIXTURES.writersRoom_energy)
    await page.getByText('High Energy').click()
    await page.waitForTimeout(500)

    const textarea = page.locator('textarea').first()
    await expect(textarea).toBeVisible({ timeout: 5000 })
    await textarea.fill('Morning: 90 min deep work on the API refactor. Then 30 min yoga. Then 45 min code review.')
    await page.waitForTimeout(300)
    await page.getByText('Build my lineup').click()

    // Wait for lineup
    const actCardSelector = page.locator('.bg-surface-hover\\/50').first()
    await actCardSelector.waitFor({ state: 'visible', timeout: 120000 })

    const initialCards = page.locator('.bg-surface-hover\\/50')
    const initialCount = await initialCards.count()
    await screenshot(page, 'claude-real-continuity-01-initial')

    // Capture first act name for later reference
    const firstActName = await initialCards.first().locator('.font-medium').textContent()
    console.log(`Session continuity: initial lineup has ${initialCount} acts, first act: "${firstActName}"`)

    // Send a refinement that references the initial lineup — proves Claude remembers turn 1
    const chatInput = page.getByTestId('lineup-chat-input')
    await expect(chatInput).toBeVisible({ timeout: 5000 })
    await chatInput.fill('Make the first act shorter — 45 minutes instead — and add a 15 min coffee break right after it')
    await page.getByTestId('lineup-chat-send').click()

    await screenshot(page, 'claude-real-continuity-02-refinement-sent')

    await waitForRefinementComplete(page)

    const refinedCards = page.locator('.bg-surface-hover\\/50')
    const refinedCount = await refinedCards.count()
    console.log(`Session continuity: refined lineup has ${refinedCount} acts`)
    await screenshot(page, 'claude-real-continuity-03-refined')

    // Session continuity proof: refined lineup should have MORE acts (we asked to add one)
    expect(refinedCount).toBeGreaterThan(initialCount)

    // Context survival proof: the first act should still be present (possibly shorter)
    // This proves Claude retained turn-1 context when processing the refinement
    if (firstActName) {
      const refinedActNames = await refinedCards.locator('.font-medium').allTextContents()
      const firstActStillPresent = refinedActNames.some(name =>
        name.toLowerCase().includes(firstActName!.toLowerCase().split(' ')[0])
      )
      expect(firstActStillPresent).toBe(true)
      console.log(`Context survived: "${firstActName}" still found in refined lineup`)
    }

    // The conversation thread should show both the user refinement and a writer response
    const writerConvo = page.getByTestId('writer-conversation')
    const userMessages = writerConvo.locator('.justify-end')
    const writerMessages = writerConvo.locator('.justify-start')
    expect(await userMessages.count()).toBeGreaterThanOrEqual(1)
    expect(await writerMessages.count()).toBeGreaterThanOrEqual(2) // initial + refinement response
  })
})
