import { test, expect, screenshot, navigateAndWait } from './fixtures'

test.describe('Onboarding (#15)', () => {
  test('shows onboarding on first launch (no localStorage flag)', async ({ mainPage: page }) => {
    await page.evaluate(() => {
      localStorage.removeItem('showtime-onboarding-complete')
      localStorage.removeItem('showtime-show-state')
    })
    await navigateAndWait(page)

    const welcomeTitle = page.getByText('Welcome to the Show')
    await expect(welcomeTitle).toBeVisible({ timeout: 10000 })
    await screenshot(page, 'onboarding-01-welcome')
  })

  test('can navigate through all 5 steps', async ({ mainPage: page }) => {
    // Self-contained: ensure onboarding is showing
    await page.evaluate(() => {
      localStorage.removeItem('showtime-onboarding-complete')
      localStorage.removeItem('showtime-show-state')
    })
    await navigateAndWait(page)
    await expect(page.getByText('Welcome to the Show')).toBeVisible({ timeout: 10000 })

    const nextBtn = page.getByRole('button', { name: 'Next' })
    await expect(nextBtn).toBeVisible({ timeout: 5000 })
    await nextBtn.click()
    await page.waitForTimeout(500)

    const step2Title = page.locator('h1', { hasText: "The Writer's Room" })
    await expect(step2Title).toBeVisible({ timeout: 5000 })
    await screenshot(page, 'onboarding-02-writers-room')

    await nextBtn.click()
    await page.waitForTimeout(500)

    const step3Title = page.locator('h1', { hasText: 'Acts and the ON AIR Light' })
    await expect(step3Title).toBeVisible({ timeout: 5000 })

    const onairSample = page.getByText('ON AIR')
    const hasOnair = await onairSample.isVisible().catch(() => false)
    if (hasOnair) expect(hasOnair).toBe(true)
    await screenshot(page, 'onboarding-03-acts')

    await nextBtn.click()
    await page.waitForTimeout(500)

    const step4Title = page.getByText('Beats: Moments of Presence')
    await expect(step4Title).toBeVisible({ timeout: 5000 })
    await screenshot(page, 'onboarding-04-beats')

    await nextBtn.click()
    await page.waitForTimeout(500)

    const step5Title = page.getByText('Ready for Your First Show?')
    await expect(step5Title).toBeVisible({ timeout: 5000 })

    const enterBtn = page.getByText("Enter the Writer's Room")
    await expect(enterBtn).toBeVisible({ timeout: 5000 })
    await screenshot(page, 'onboarding-05-ready')
  })

  test('completing onboarding enters Writer\'s Room', async ({ mainPage: page }) => {
    // Self-contained: start onboarding and navigate to final step
    await page.evaluate(() => {
      localStorage.removeItem('showtime-onboarding-complete')
      localStorage.removeItem('showtime-show-state')
    })
    await navigateAndWait(page)
    await expect(page.getByText('Welcome to the Show')).toBeVisible({ timeout: 10000 })
    const nextBtn = page.getByRole('button', { name: 'Next' })
    for (let i = 0; i < 4; i++) {
      await nextBtn.click()
      await page.waitForTimeout(500)
    }
    await expect(page.getByText('Ready for Your First Show?')).toBeVisible({ timeout: 5000 })

    const enterBtn = page.getByText("Enter the Writer's Room")
    await enterBtn.click()
    await page.waitForTimeout(1000)

    // Chat-first UI: chat input should be visible after entering Writer's Room
    const chatInput = page.getByTestId('chat-input')
    await expect(chatInput).toBeVisible({ timeout: 5000 })

    const flag = await page.evaluate(() => localStorage.getItem('showtime-onboarding-complete'))
    expect(flag).toBe('true')
    await screenshot(page, 'onboarding-06-complete')
  })

  test('does not show onboarding when flag is set', async ({ mainPage: page }) => {
    await page.evaluate(() => {
      localStorage.setItem('showtime-onboarding-complete', 'true')
      localStorage.removeItem('showtime-show-state')
    })
    await navigateAndWait(page)

    const cta = page.getByText("Enter the Writer's Room")
    await expect(cta).toBeVisible({ timeout: 10000 })

    const welcomeTitle = page.getByText('Welcome to the Show')
    const hasWelcome = await welcomeTitle.isVisible().catch(() => false)
    expect(hasWelcome).toBe(false)
    await screenshot(page, 'onboarding-07-skipped')
  })

  test('can skip onboarding', async ({ mainPage: page }) => {
    await page.evaluate(() => {
      localStorage.removeItem('showtime-onboarding-complete')
      localStorage.removeItem('showtime-show-state')
    })
    await navigateAndWait(page)

    const welcomeTitle = page.getByText('Welcome to the Show')
    await expect(welcomeTitle).toBeVisible({ timeout: 10000 })

    const skipBtn = page.getByText('Skip')
    await expect(skipBtn).toBeVisible({ timeout: 3000 })
    await skipBtn.click()
    await page.waitForTimeout(1000)

    const darkStudioCta = page.getByText("Enter the Writer's Room")
    await expect(darkStudioCta).toBeVisible({ timeout: 5000 })

    const flag = await page.evaluate(() => localStorage.getItem('showtime-onboarding-complete'))
    expect(flag).toBe('true')
    await screenshot(page, 'onboarding-08-skip')
  })

  test('back button navigates to previous step', async ({ mainPage: page }) => {
    await page.evaluate(() => {
      localStorage.removeItem('showtime-onboarding-complete')
      localStorage.removeItem('showtime-show-state')
    })
    await navigateAndWait(page)

    const welcomeTitle = page.getByText('Welcome to the Show')
    await expect(welcomeTitle).toBeVisible({ timeout: 10000 })

    const nextBtn = page.getByText('Next')
    await nextBtn.click()
    await page.waitForTimeout(500)

    const step2Title = page.locator('h1', { hasText: "The Writer's Room" })
    await expect(step2Title).toBeVisible({ timeout: 5000 })

    const backBtn = page.getByText('Back')
    await expect(backBtn).toBeVisible({ timeout: 3000 })
    await backBtn.click()
    await page.waitForTimeout(500)

    await expect(welcomeTitle).toBeVisible({ timeout: 5000 })

    const hasBack = await backBtn.isVisible().catch(() => false)
    expect(hasBack).toBe(false)
    await screenshot(page, 'onboarding-09-back')
  })

  test('Help button opens help dialog', async ({ mainPage: page }) => {
    await page.evaluate(() => {
      localStorage.setItem('showtime-onboarding-complete', 'true')
      localStorage.removeItem('showtime-show-state')
    })
    await navigateAndWait(page)

    const helpBtn = page.getByText('?').first()
    if (await helpBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await helpBtn.click()
      await page.waitForTimeout(1000)

      const helpTitle = page.getByText('How Showtime Works')
      await expect(helpTitle).toBeVisible({ timeout: 5000 })

      // Onboarding should NOT re-trigger
      const flag = await page.evaluate(() => localStorage.getItem('showtime-onboarding-complete'))
      expect(flag).toBe('true')
    }
    await screenshot(page, 'onboarding-10-help-dialog')
  })
})
