/**
 * Targeted reproduction for issue #74: Go Live button not working
 *
 * Seeds the app into conversation step with acts, then verifies
 * clicking "WE'RE LIVE!" triggers the Going Live transition.
 */
import { test, expect, screenshot, seedFixture, FIXTURES } from './fixtures'

const STANDARD_ACTS = [
  { id: 'fix-act-1', name: 'Deep Focus Block', sketch: 'Deep Work', durationMinutes: 45, order: 0, status: 'upcoming', beatLocked: false },
  { id: 'fix-act-2', name: 'Exercise', sketch: 'Exercise', durationMinutes: 30, order: 1, status: 'upcoming', beatLocked: false },
  { id: 'fix-act-3', name: 'Email & Slack', sketch: 'Admin', durationMinutes: 20, order: 2, status: 'upcoming', beatLocked: false },
]

test.describe('Issue #74 — Go Live Button', () => {
  test('WE\'RE LIVE button triggers GoingLiveTransition', async ({ mainPage: page }) => {
    // Seed with conversation step + populated acts (the state when lineup is visible)
    await seedFixture(page, {
      phase: 'writers_room',
      writersRoomStep: 'conversation',
      energy: 'high',
      viewTier: 'expanded',
      acts: STANDARD_ACTS,
      goingLiveActive: false,
      coldOpenActive: false,
      beatCheckPending: false,
      celebrationActive: false,
    })

    // Verify the button exists and is visible
    const wereLiveButton = page.locator('button').filter({ hasText: /WE.*RE LIVE/i })
    await expect(wereLiveButton).toBeVisible({ timeout: 5000 })
    await screenshot(page, 'repro-74-01-before-click')

    // Verify button is not disabled
    const isDisabled = await wereLiveButton.isDisabled()
    expect(isDisabled).toBe(false)

    // Click the button
    await wereLiveButton.click()
    await page.waitForTimeout(500)

    // The GoingLiveTransition should now be visible
    await screenshot(page, 'repro-74-02-after-click')

    // Check for the Going Live transition elements
    const onAirIndicator = page.locator('.onair-glow')
    const goLiveConfirmButton = page.getByTestId('go-live-button')

    // The transition has a 1.8s delay before showing the confirm button
    // First check if the transition overlay appeared at all
    const transitionText = page.locator('text=/Live from your desk/i')
    const transitionVisible = await transitionText.isVisible({ timeout: 3000 }).catch(() => false)

    console.log('GoingLiveTransition visible:', transitionVisible)

    if (!transitionVisible) {
      // DEBUG: Check what state the app is in
      const bodyText = await page.textContent('body')
      console.log('Body text (first 500 chars):', bodyText?.slice(0, 500))

      // Check store state
      const storeState = await page.evaluate(() => {
        const raw = localStorage.getItem('showtime-show-state')
        return raw ? JSON.parse(raw) : null
      })
      console.log('Store state phase:', storeState?.state?.phase)
      console.log('Store state goingLiveActive:', storeState?.state?.goingLiveActive)

      // Also check in-memory state via window
      const memState = await page.evaluate(() => {
        // @ts-ignore - accessing zustand store directly
        const store = document.querySelector('[data-testid="showtime-app"]')
        return {
          bodyClasses: document.body.className,
          appExists: !!store,
        }
      })
      console.log('In-memory state:', memState)
    }

    expect(transitionVisible).toBe(true)

    // Wait for the "Go Live" confirm button to appear (1.8s delay)
    await expect(goLiveConfirmButton).toBeVisible({ timeout: 5000 })
    await screenshot(page, 'repro-74-03-go-live-button')

    // Click confirm
    await goLiveConfirmButton.click()
    await page.waitForTimeout(1000)

    // Should now be in live phase
    await screenshot(page, 'repro-74-04-live')

    // Verify we're in the live phase by checking for live UI elements
    const pill = page.locator('[data-testid="showtime-app"]')
    await expect(pill).toBeVisible()
  })

  test('stale lineup fixture does NOT show button', async ({ mainPage: page }) => {
    // This uses the old 'lineup' step value — should NOT render the button
    // because the step 'lineup' doesn't exist in the current code
    await seedFixture(page, {
      phase: 'writers_room',
      writersRoomStep: 'lineup',  // stale value!
      energy: 'high',
      viewTier: 'expanded',
      acts: STANDARD_ACTS,
      goingLiveActive: false,
      coldOpenActive: false,
      beatCheckPending: false,
      celebrationActive: false,
    })

    // The button should NOT be visible because 'lineup' step has no render path
    const wereLiveButton = page.locator('button').filter({ hasText: /WE.*RE LIVE/i })
    const isVisible = await wereLiveButton.isVisible({ timeout: 3000 }).catch(() => false)

    console.log('Button visible with stale lineup step:', isVisible)
    await screenshot(page, 'repro-74-stale-lineup-step')

    // We expect the button NOT to be visible — this confirms the stale fixture issue
    expect(isVisible).toBe(false)
  })
})
