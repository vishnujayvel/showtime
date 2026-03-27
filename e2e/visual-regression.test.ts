import { test, expect, FIXTURES, seedFixture } from './fixtures'

test.describe('Visual Regression Screenshots', () => {

  test('DarkStudio visual', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.darkStudio)
    await expect(page).toHaveScreenshot('dark-studio.png', {
      maxDiffPixelRatio: 0.05,
      timeout: 10000,
    })
  })

  test('WritersRoom chat visual', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.writersRoom_chat)
    await expect(page).toHaveScreenshot('writers-room-chat.png', {
      maxDiffPixelRatio: 0.05,
      timeout: 10000,
    })
  })

  test('WritersRoom with lineup visual', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.writersRoom_withLineup)
    await expect(page).toHaveScreenshot('writers-room-with-lineup.png', {
      maxDiffPixelRatio: 0.05,
      timeout: 10000,
    })
  })

  test('ExpandedView live visual', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.live_expanded)
    await expect(page).toHaveScreenshot('expanded-live.png', {
      maxDiffPixelRatio: 0.05,
      timeout: 10000,
    })
  })

  test('CompactView live visual', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.live_compact)
    await expect(page).toHaveScreenshot('compact-live.png', {
      maxDiffPixelRatio: 0.05,
      timeout: 10000,
    })
  })

  test('DashboardView live visual', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.live_dashboard)
    await expect(page).toHaveScreenshot('dashboard-live.png', {
      maxDiffPixelRatio: 0.05,
      timeout: 10000,
    })
  })

  test('PillView live visual', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.live_micro)
    await expect(page).toHaveScreenshot('pill-live.png', {
      maxDiffPixelRatio: 0.05,
      timeout: 10000,
    })
  })

  test('Intermission visual', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.intermission)
    await expect(page).toHaveScreenshot('intermission.png', {
      maxDiffPixelRatio: 0.05,
      timeout: 10000,
    })
  })

  test('Strike DAY_WON visual', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.strike_dayWon)
    await expect(page).toHaveScreenshot('strike-day-won.png', {
      maxDiffPixelRatio: 0.05,
      timeout: 10000,
    })
  })

  test('Strike SOLID_SHOW visual', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.strike_solidShow)
    await expect(page).toHaveScreenshot('strike-solid-show.png', {
      maxDiffPixelRatio: 0.05,
      timeout: 10000,
    })
  })

  test('Strike GOOD_EFFORT visual', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.strike_goodEffort)
    await expect(page).toHaveScreenshot('strike-good-effort.png', {
      maxDiffPixelRatio: 0.05,
      timeout: 10000,
    })
  })

  test('Strike SHOW_CALLED_EARLY visual', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.strike_calledEarly)
    await expect(page).toHaveScreenshot('strike-called-early.png', {
      maxDiffPixelRatio: 0.05,
      timeout: 10000,
    })
  })
})
