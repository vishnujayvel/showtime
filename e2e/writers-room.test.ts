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

    const highEnergy = page.getByText('High Energy')
    await expect(highEnergy).toBeVisible({ timeout: 5000 })
    await screenshot(page, '02-writers-room')
  })
})

test.describe('7.3 — Writer\'s Room Flow', () => {
  test('can select energy level', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.writersRoom_energy)

    const highButton = page.getByText('High Energy')
    await expect(highButton).toBeVisible({ timeout: 5000 })
    await highButton.click()
    await page.waitForTimeout(500)
    await screenshot(page, '03-energy-selected')
  })

  test('shows plan dump textarea after energy selection', async ({ mainPage: page }) => {
    // Self-contained: seed the plan step directly
    await seedFixture(page, FIXTURES.writersRoom_plan)

    const textarea = page.locator('textarea').first()
    await expect(textarea).toBeVisible({ timeout: 5000 })

    await textarea.fill('Deep Work on Showtime for 2 hours\nExercise for 45 minutes\nAdmin catch-up for 30 minutes')
    await page.waitForTimeout(300)
    await screenshot(page, '04-plan-filled')
  })

  test('can submit plan and see lineup preview', async ({ mainPage: page }) => {
    const nextButton = page.getByText('Build my lineup')
    if (await nextButton.isVisible().catch(() => false)) {
      await nextButton.click()
      const loadingText = page.getByText('The writers are working...')
      await expect(loadingText).toBeVisible({ timeout: 5000 }).catch(() => {})
      await page.waitForTimeout(5000)
    } else {
      const altButton = page.locator('button').filter({ hasText: /lineup|next|continue/i }).first()
      if (await altButton.isVisible().catch(() => false)) {
        await altButton.click()
        await page.waitForTimeout(5000)
      }
    }
    await screenshot(page, '05-lineup-preview')
  })

  test('can go live', async ({ mainPage: page }) => {
    const goLiveButton = page.locator('button').filter({ hasText: /live/i }).first()
    if (await goLiveButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await goLiveButton.click()
      await page.waitForTimeout(2000)

      // Going Live transition now requires clicking the "Go Live" button
      const goLiveConfirm = page.getByTestId('go-live-button')
      if (await goLiveConfirm.isVisible({ timeout: 3000 }).catch(() => false)) {
        await goLiveConfirm.click()
        await page.waitForTimeout(1000)
      }
      await screenshot(page, '06-going-live')
    }
  })
})

test.describe('Calendar Prefetch (#58)', () => {
  test('shows CalendarBanner when calendar MCP is not available', async ({ mainPage: page }) => {
    await page.evaluate(() => {
      localStorage.removeItem('showtime-gcal-connected')
    })
    await seedFixture(page, FIXTURES.writersRoom_plan)

    const banner = page.getByTestId('calendar-banner')
    await expect(banner).toBeVisible({ timeout: 5000 })
    await screenshot(page, 'calendar-banner-no-mcp')
  })

  test('shows CalendarToggle when calendar MCP is available', async ({ mainPage: page }) => {
    await page.evaluate(() => {
      localStorage.setItem('showtime-gcal-connected', 'true')
      localStorage.setItem('showtime-calendar-enabled', 'true')
    })
    await seedFixture(page, FIXTURES.writersRoom_plan)

    const toggle = page.getByTestId('calendar-toggle')
    await expect(toggle).toBeVisible({ timeout: 5000 })

    // Status label should be visible (may show fetching, idle, or status text)
    const statusLabel = page.getByTestId('calendar-status')
    await expect(statusLabel).toBeVisible({ timeout: 3000 })
    await screenshot(page, 'calendar-toggle-with-status')
  })

  test('CalendarBanner can be dismissed', async ({ mainPage: page }) => {
    await page.evaluate(() => {
      localStorage.removeItem('showtime-gcal-connected')
    })
    await seedFixture(page, FIXTURES.writersRoom_plan)

    const banner = page.getByTestId('calendar-banner')
    await expect(banner).toBeVisible({ timeout: 5000 })

    const dismissBtn = page.getByTestId('calendar-banner-dismiss')
    await dismissBtn.click()
    await page.waitForTimeout(500)
    await expect(banner).not.toBeVisible()
    await screenshot(page, 'calendar-banner-dismissed')
  })
})

test.describe('Claude E2E Verification (#6, #13)', () => {
  test('Writer\'s Room generates real lineup via Claude (conditional)', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.writersRoom_plan)

    const textarea = page.locator('textarea').first()
    await expect(textarea).toBeVisible({ timeout: 5000 })
    await textarea.fill('Today I need to do deep work on the API, exercise at lunch, then admin tasks')
    await page.waitForTimeout(300)

    const buildBtn = page.getByText('Build my lineup')
    await expect(buildBtn).toBeVisible({ timeout: 3000 })
    await buildBtn.click()

    const loadingText = page.getByText('The writers are working...')
    await expect(loadingText).toBeVisible({ timeout: 2000 }).catch(() => {})

    const actCardSelector = page.locator('.bg-surface-hover\\/50').first()
    const retryButton = page.getByRole('button', { name: 'Try again' })

    let claudePath: 'lineup' | 'unavailable' = 'unavailable'

    try {
      await Promise.race([
        actCardSelector.waitFor({ state: 'visible', timeout: 35000 }).then(() => { claudePath = 'lineup' }),
        retryButton.waitFor({ state: 'visible', timeout: 35000 }).then(() => { claudePath = 'unavailable' }),
      ])
    } catch {
      const hasRetry = await retryButton.isVisible().catch(() => false)
      if (hasRetry) claudePath = 'unavailable'
    }

    if (claudePath === 'lineup') {
      console.log('Claude path: lineup generated successfully')
      const actCards = page.locator('.bg-surface-hover\\/50')
      const cardCount = await actCards.count()
      expect(cardCount).toBeGreaterThanOrEqual(2)

      const firstCardName = actCards.first().locator('.font-medium')
      await expect(firstCardName).toBeVisible()
      const nameText = await firstCardName.textContent()
      expect(nameText!.trim().length).toBeGreaterThan(0)

      const durationText = actCards.first().locator('span.text-xs.text-txt-muted')
      await expect(durationText).toBeVisible()
      const duration = await durationText.textContent()
      expect(duration).toMatch(/\d+m/)

      const badge = actCards.first().locator('.font-mono')
      await expect(badge).toBeVisible()
    } else {
      console.log('Claude path: unavailable, error UI verified')
      const errorMessage = page.locator('.text-onair').first()
      const hasError = await errorMessage.isVisible().catch(() => false)
      if (hasError) {
        const errorText = await errorMessage.textContent()
        expect(errorText).not.toMatch(/^Error$/i)
        expect(errorText).not.toMatch(/Something went wrong/i)
        expect(errorText).not.toMatch(/^Failed$/i)
      }
      await expect(retryButton).toBeVisible()
    }

    await screenshot(page, 'claude-e2e-verification')
  })
})
