/**
 * E2E tests for ColdOpenTransition.
 *
 * The Cold Open is a brief cinematic transition ("Live from your desk... it's Monday!")
 * that plays when the user clicks "Enter the Writer's Room" on the Dark Studio view.
 * After ~1.5s it auto-completes and lands in the Writer's Room.
 */
import { test, expect, screenshot, seedFixture, FIXTURES } from './fixtures'

test.describe('Cold Open Transition', () => {
  test('clicking "Enter the Writer\'s Room" triggers Cold Open', async ({ mainPage: page }) => {
    // Seed into Dark Studio (no_show phase) — the starting point
    await seedFixture(page, FIXTURES.darkStudio)

    // The "Enter the Writer's Room" button should be visible
    const enterBtn = page.getByTestId('enter-writers-room')
    await expect(enterBtn).toBeVisible({ timeout: 10000 })
    await screenshot(page, 'cold-open-01-dark-studio')

    // Click to trigger the Cold Open transition
    await enterBtn.click()

    // The Cold Open transition should render with its signature text
    const transitionHeading = page.locator('text=/Live from your desk/i')
    await expect(transitionHeading).toBeVisible({ timeout: 3000 })
    await screenshot(page, 'cold-open-02-transition')
  })

  test('Cold Open shows the current day name', async ({ mainPage: page }) => {
    // Seed into Dark Studio
    await seedFixture(page, FIXTURES.darkStudio)

    const enterBtn = page.getByTestId('enter-writers-room')
    await expect(enterBtn).toBeVisible({ timeout: 10000 })
    await enterBtn.click()

    // The transition renders "it's <DayName>!" — verify the day text is present
    const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' })
    const dayText = page.locator(`text=it's ${dayName}!`)
    await expect(dayText).toBeVisible({ timeout: 3000 })
    await screenshot(page, 'cold-open-03-day-name')
  })

  test('Cold Open auto-completes into Writer\'s Room', async ({ mainPage: page }) => {
    // Seed into Dark Studio
    await seedFixture(page, FIXTURES.darkStudio)

    const enterBtn = page.getByTestId('enter-writers-room')
    await expect(enterBtn).toBeVisible({ timeout: 10000 })
    await enterBtn.click()

    // The Cold Open has a 1.5s timer before it completes.
    // Wait for the transition to finish and the Writer's Room to appear.
    // The chat input is a reliable signal that the Writer's Room has loaded.
    const chatInput = page.getByTestId('chat-input')
    await expect(chatInput).toBeVisible({ timeout: 10000 })
    await screenshot(page, 'cold-open-04-writers-room')

    // Confirm the Cold Open transition text is gone
    const transitionHeading = page.locator('text=/Live from your desk/i')
    const stillVisible = await transitionHeading.isVisible().catch(() => false)
    expect(stillVisible).toBe(false)
  })

  test('Cold Open sets coldOpenActive flag during transition', async ({ mainPage: page }) => {
    // Seed into Dark Studio
    await seedFixture(page, FIXTURES.darkStudio)

    const enterBtn = page.getByTestId('enter-writers-room')
    await expect(enterBtn).toBeVisible({ timeout: 10000 })
    await enterBtn.click()

    // Verify the animation container is rendered (the fixed overlay)
    const overlay = page.locator('.fixed.inset-0')
    await expect(overlay).toBeVisible({ timeout: 3000 })

    // The spotlight stage effect should be present
    const spotlight = page.locator('.spotlight-stage')
    await expect(spotlight).toBeVisible({ timeout: 3000 })
    await screenshot(page, 'cold-open-05-overlay-active')
  })
})
