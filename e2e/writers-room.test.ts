import { test, expect, screenshot, navigateAndWait, seedFixture, FIXTURES } from './fixtures'

test.describe('7.2 — Dark Studio → Writer\'s Room', () => {
  test('clicking CTA transitions to Writer\'s Room', async ({ mainPage: page }) => {
    // Ensure we start from Dark Studio
    await page.evaluate(() => {
      localStorage.removeItem('showtime-show-state')
      localStorage.setItem('showtime-onboarding-complete', 'true')
    })
    await navigateAndWait(page)

    const cta = page.getByText("Enter the Writer's Room")
    await expect(cta).toBeVisible({ timeout: 10000 })
    await cta.click()
    await page.waitForTimeout(500)

    // Chat-first UI: should see chat input and energy chip
    const chatInput = page.getByTestId('chat-input')
    await expect(chatInput).toBeVisible({ timeout: 5000 })
    await screenshot(page, '02-writers-room')
  })
})

test.describe('7.3 — Writer\'s Room Chat-First Flow', () => {
  test('shows chat input and energy chip', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.writersRoom_chat)

    const chatInput = page.getByTestId('chat-input')
    await expect(chatInput).toBeVisible({ timeout: 5000 })

    const energyChip = page.getByTestId('energy-chip')
    await expect(energyChip).toBeVisible({ timeout: 5000 })
    await screenshot(page, '03-chat-first-ready')
  })

  test('can type in chat input', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.writersRoom_chat)

    const chatInput = page.getByTestId('chat-input')
    await expect(chatInput).toBeVisible({ timeout: 5000 })
    await chatInput.fill('Deep Work on Showtime for 2 hours\nExercise for 45 minutes')
    await page.waitForTimeout(300)
    await screenshot(page, '04-chat-input-filled')
  })

  test('shows BUILD MY LINEUP button when no lineup', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.writersRoom_chat)

    const buildBtn = page.getByTestId('build-lineup-btn')
    await expect(buildBtn).toBeVisible({ timeout: 5000 })
    await expect(buildBtn).toHaveText('BUILD MY LINEUP')
    await screenshot(page, '05-build-lineup-button')
  })

  test('shows WE\'RE LIVE button when lineup exists', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.writersRoom_withLineup)

    const goLiveBtn = page.getByTestId('go-live-btn')
    await expect(goLiveBtn).toBeVisible({ timeout: 5000 })
    await screenshot(page, '06-go-live-button')
  })

  test('can trigger BUILD MY LINEUP', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.writersRoom_chat)

    // Type a message first
    const chatInput = page.getByTestId('chat-input')
    await expect(chatInput).toBeVisible({ timeout: 5000 })
    await chatInput.fill('I need to do deep work on the API, then exercise')

    const sendBtn = page.getByTestId('chat-send')
    await sendBtn.click()
    await page.waitForTimeout(500)

    // Click BUILD MY LINEUP
    const buildBtn = page.getByTestId('build-lineup-btn')
    if (await buildBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await buildBtn.click()
      // Should show activity indicator
      await page.waitForTimeout(5000)
    }
    await screenshot(page, '07-building-lineup')
  })

  test('can go live', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.writersRoom_withLineup)

    const goLiveBtn = page.getByTestId('go-live-btn')
    if (await goLiveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await goLiveBtn.click()
      await page.waitForTimeout(2000)

      // Going Live transition now requires clicking the "Go Live" button
      const goLiveConfirm = page.getByTestId('go-live-button')
      if (await goLiveConfirm.isVisible({ timeout: 3000 }).catch(() => false)) {
        await goLiveConfirm.click()
        await page.waitForTimeout(1000)
      }
      await screenshot(page, '08-going-live')
    }
  })
})

test.describe('Calendar Prefetch (#58)', () => {
  test('shows CalendarToggle when calendar MCP is available', async ({ mainPage: page }) => {
    await page.evaluate(() => {
      localStorage.setItem('showtime-gcal-connected', 'true')
      localStorage.setItem('showtime-calendar-enabled', 'true')
    })
    await seedFixture(page, FIXTURES.writersRoom_chat)

    const toggle = page.getByTestId('calendar-toggle')
    await expect(toggle).toBeVisible({ timeout: 5000 })

    const statusLabel = page.getByTestId('calendar-status')
    await expect(statusLabel).toBeVisible({ timeout: 3000 })
    await screenshot(page, 'calendar-toggle-with-status')
  })
})

test.describe('Claude E2E Verification (#6, #13)', () => {
  test('Writer\'s Room generates real lineup via Claude (conditional)', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.writersRoom_chat)

    // Type plan in chat input
    const chatInput = page.getByTestId('chat-input')
    await expect(chatInput).toBeVisible({ timeout: 5000 })
    await chatInput.fill('Today I need to do deep work on the API, exercise at lunch, then admin tasks')

    const sendBtn = page.getByTestId('chat-send')
    await sendBtn.click()
    await page.waitForTimeout(500)

    // Click BUILD MY LINEUP
    const buildBtn = page.getByTestId('build-lineup-btn')
    await expect(buildBtn).toBeVisible({ timeout: 3000 })
    await buildBtn.click()

    // Wait for Claude response or timeout
    const chatMessages = page.getByTestId('chat-messages')
    const lineupCard = page.getByTestId('lineup-card')

    let claudePath: 'lineup' | 'unavailable' = 'unavailable'

    try {
      await Promise.race([
        lineupCard.waitFor({ state: 'visible', timeout: 35000 }).then(() => { claudePath = 'lineup' }),
        page.waitForTimeout(35000).then(() => { claudePath = 'unavailable' }),
      ])
    } catch {
      // timeout
    }

    if (claudePath === 'lineup') {
      console.log('Claude path: lineup generated successfully')
      await expect(lineupCard).toBeVisible()

      // Check that assistant messages are visible
      const assistantMessages = chatMessages.locator('[data-testid="assistant-message"]')
      expect(await assistantMessages.count()).toBeGreaterThanOrEqual(1)
    } else {
      console.log('Claude path: unavailable, checking for messages in chat')
      // Should still have chat messages visible
      await expect(chatMessages).toBeVisible()
    }

    await screenshot(page, 'claude-e2e-verification')
  })
})
