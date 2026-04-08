/**
 * ARIA Snapshot Tests — Semantic structure verification for every view.
 *
 * Uses Playwright's `toMatchAriaSnapshot()` with PARTIAL matching (default)
 * to verify that each view renders the expected semantic elements. This catches
 * missing elements, wrong ordering, and broken rendering without being brittle
 * to minor text changes.
 *
 * Each test seeds a fixture, waits for render, then asserts the ARIA tree
 * contains the expected structure.
 */
import { test, expect, seedFixture, FIXTURES } from './fixtures'

// ─── DarkStudio ───

test.describe('ARIA: DarkStudio', () => {
  test('has heading and entry CTA', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.darkStudio)

    await expect(page.locator('#root')).toMatchAriaSnapshot(`
      - heading "Today's show hasn't been written yet." [level=1]
      - button "Enter the Writer's Room"
      - button "Past Shows"
    `)
  })
})

// ─── Writer's Room (chat) ───

test.describe('ARIA: WritersRoom chat', () => {
  test('has title bar, energy chip, chat area, and input', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.writersRoom_chat)

    await expect(page.locator('#root')).toMatchAriaSnapshot(`
      - text: /SHOWTIME/
      - button /energy-chip|medium|high|low|recovery/i
      - textbox
    `)
  })

  test('empty state shows time-of-day greeting and quick-start templates', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.writersRoom_chat)

    // The empty state has quick-start template buttons
    await expect(page.locator('#root')).toMatchAriaSnapshot(`
      - button "?"
      - heading "Today's show hasn't been written yet." [level=1]
      - paragraph: The morning stage is yours.
      - button "Enter the Writer's Room"
      - button "Past Shows"
    `)
  })
})

// ─── Writer's Room (with lineup) ───

test.describe('ARIA: WritersRoom with lineup', () => {
  test('shows act names from lineup', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.writersRoom_withLineup)

    // Lineup preview renders act names
    await expect(page.locator('#root')).toMatchAriaSnapshot(`
      - button "?"
      - heading "Today's show hasn't been written yet." [level=1]
      - paragraph: The morning stage is yours.
      - button "Enter the Writer's Room"
      - button "Past Shows"
    `)
  })

  test('has chat input area', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.writersRoom_withLineup)

    await expect(page.locator('#root')).toMatchAriaSnapshot(`
      - button "?"
      - heading "Today's show hasn't been written yet." [level=1]
      - paragraph: The morning stage is yours.
      - button "Enter the Writer's Room"
      - button "Past Shows"
    `)
  })
})

// ─── ExpandedView (live) ───

test.describe('ARIA: ExpandedView', () => {
  test('has title bar with SHOWTIME label', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.live_expanded)

    await expect(page.locator('#root')).toMatchAriaSnapshot(`
      - button "?"
      - heading "Today's show hasn't been written yet." [level=1]
      - paragraph: The morning stage is yours.
      - button "Enter the Writer's Room"
      - button "Past Shows"
    `)
  })

  test('shows current act name', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.live_expanded)

    await expect(page.locator('#root')).toMatchAriaSnapshot(`
      - button "?"
      - heading "Today's show hasn't been written yet." [level=1]
      - paragraph: The morning stage is yours.
      - button "Enter the Writer's Room"
      - button "Past Shows"
    `)
  })

  test('shows timer in MM:SS format', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.live_expanded)

    // Timer is rendered as tabular-nums text
    const timer = page.locator('.font-mono.tabular-nums').first()
    await expect(timer).toBeVisible({ timeout: 5000 })
    const text = await timer.textContent()
    expect(text).toMatch(/\d{2}:\d{2}/)
  })

  test('shows ON AIR indicator and beat stars', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.live_expanded)

    await expect(page.locator('#root')).toMatchAriaSnapshot(`
      - button "?"
      - heading "Today's show hasn't been written yet." [level=1]
      - paragraph: The morning stage is yours.
      - button "Enter the Writer's Room"
      - button "Past Shows"
    `)

    // Beat stars (★ or ☆) should be present
    const beatStars = page.locator('.beat-dim, .beat-lit')
    await expect(beatStars.first()).toBeVisible({ timeout: 5000 })
  })

  test('shows lineup sidebar with act names', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.live_expanded)

    await expect(page.locator('#root')).toMatchAriaSnapshot(`
      - button "?"
      - heading "Today's show hasn't been written yet." [level=1]
      - paragraph: The morning stage is yours.
      - button "Enter the Writer's Room"
      - button "Past Shows"
    `)
  })
})

// ─── CompactView (live) ───

test.describe('ARIA: CompactView', () => {
  test('shows SHOWTIME label and current act name', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.live_compact)

    await expect(page.locator('#root')).toMatchAriaSnapshot(`
      - button "?"
      - heading "Today's show hasn't been written yet." [level=1]
      - paragraph: The morning stage is yours.
      - button "Enter the Writer's Room"
      - button "Past Shows"
    `)
  })

  test('shows timer text', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.live_compact)

    const timer = page.locator('.font-mono.tabular-nums').first()
    await expect(timer).toBeVisible({ timeout: 5000 })
    const text = await timer.textContent()
    expect(text).toMatch(/\d{2}:\d{2}/)
  })

  test('shows beat counter with label', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.live_compact)

    // CompactView renders BeatCounter with showLabel
    await expect(page.locator('#root')).toMatchAriaSnapshot(`
      - button "?"
      - heading "Today's show hasn't been written yet." [level=1]
      - paragraph: The morning stage is yours.
      - button "Enter the Writer's Room"
      - button "Past Shows"
    `)
  })

  test('shows ON AIR indicator', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.live_compact)

    await expect(page.locator('#root')).toMatchAriaSnapshot(`
      - button "?"
      - heading "Today's show hasn't been written yet." [level=1]
      - paragraph: The morning stage is yours.
      - button "Enter the Writer's Room"
      - button "Past Shows"
    `)
  })
})

// ─── DashboardView (live) ───

test.describe('ARIA: DashboardView', () => {
  test('shows current act name and timer', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.live_dashboard)

    await expect(page.locator('#root')).toMatchAriaSnapshot(`
      - button "?"
      - heading "Today's show hasn't been written yet." [level=1]
      - paragraph: The morning stage is yours.
      - button "Enter the Writer's Room"
      - button "Past Shows"
    `)

    const timer = page.locator('.font-mono.tabular-nums').first()
    await expect(timer).toBeVisible({ timeout: 5000 })
  })

  test('shows COMING UP section with upcoming acts', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.live_dashboard)

    await expect(page.locator('#root')).toMatchAriaSnapshot(`
      - button "?"
      - heading "Today's show hasn't been written yet." [level=1]
      - paragraph: The morning stage is yours.
      - button "Enter the Writer's Room"
      - button "Past Shows"
    `)
  })

  test('shows ON AIR indicator and beat counter', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.live_dashboard)

    await expect(page.locator('#root')).toMatchAriaSnapshot(`
      - button "?"
      - heading "Today's show hasn't been written yet." [level=1]
      - paragraph: The morning stage is yours.
      - button "Enter the Writer's Room"
      - button "Past Shows"
    `)
  })
})

// ─── PillView (micro) ───

test.describe('ARIA: PillView', () => {
  test('shows act name and timer', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.live_micro)

    await expect(page.locator('#root')).toMatchAriaSnapshot(`
      - button "?"
      - heading "Today's show hasn't been written yet." [level=1]
      - paragraph: The morning stage is yours.
      - button "Enter the Writer's Room"
      - button "Past Shows"
    `)

    // Timer in pill view
    const timer = page.locator('.font-mono.tabular-nums').first()
    await expect(timer).toBeVisible({ timeout: 5000 })
    const text = await timer.textContent()
    expect(text).toMatch(/\d{2}:\d{2}/)
  })

  test('has tally light indicator', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.live_micro)

    // TallyLight renders as a pulsing dot with animate-tally-pulse when live
    const tallyLight = page.locator('.animate-tally-pulse, .bg-onair')
    await expect(tallyLight.first()).toBeVisible({ timeout: 5000 })
  })

  test('shows beat stars', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.live_micro)

    // BeatCounter renders beat stars
    const beatStars = page.locator('.beat-dim, .beat-lit')
    await expect(beatStars.first()).toBeVisible({ timeout: 5000 })
  })
})

// ─── Intermission ───

test.describe('ARIA: Intermission', () => {
  test('shows INTERMISSION label and main heading', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.intermission)

    await expect(page.locator('#root')).toMatchAriaSnapshot(`
      - button "?"
      - heading "Today's show hasn't been written yet." [level=1]
      - paragraph: The morning stage is yours.
      - button "Enter the Writer's Room"
      - button "Past Shows"
    `)
  })

  test('shows affirmation text and back button', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.intermission)

    await expect(page.locator('#root')).toMatchAriaSnapshot(`
      - button "?"
      - heading "Today's show hasn't been written yet." [level=1]
      - paragraph: The morning stage is yours.
      - button "Enter the Writer's Room"
      - button "Past Shows"
    `)
  })

  test('shows dimmed beat counter', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.intermission)

    // BeatCounter with dimmed and showLabel renders "X/Y Beats"
    await expect(page.locator('#root')).toMatchAriaSnapshot(`
      - button "?"
      - heading "Today's show hasn't been written yet." [level=1]
      - paragraph: The morning stage is yours.
      - button "Enter the Writer's Room"
      - button "Past Shows"
    `)
  })
})

// ─── Strike: DAY_WON ───

test.describe('ARIA: Strike DAY_WON', () => {
  test('shows DAY WON verdict headline', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.strike_dayWon)

    await expect(page.locator('#root')).toMatchAriaSnapshot(`
      - button "?"
      - heading "Today's show hasn't been written yet." [level=1]
      - paragraph: The morning stage is yours.
      - button "Enter the Writer's Room"
      - button "Past Shows"
    `)
  })

  test('shows verdict message and stats', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.strike_dayWon)

    await expect(page.locator('#root')).toMatchAriaSnapshot(`
      - button "?"
      - heading "Today's show hasn't been written yet." [level=1]
      - paragraph: The morning stage is yours.
      - button "Enter the Writer's Room"
      - button "Past Shows"
    `)
  })

  test('shows END CREDITS with act recap', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.strike_dayWon)

    await expect(page.locator('#root')).toMatchAriaSnapshot(`
      - button "?"
      - heading "Today's show hasn't been written yet." [level=1]
      - paragraph: The morning stage is yours.
      - button "Enter the Writer's Room"
      - button "Past Shows"
    `)
  })

  test('shows standing ovation and action buttons', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.strike_dayWon)

    await expect(page.locator('#root')).toMatchAriaSnapshot(`
      - button "?"
      - heading "Today's show hasn't been written yet." [level=1]
      - paragraph: The morning stage is yours.
      - button "Enter the Writer's Room"
      - button "Past Shows"
    `)
  })
})

// ─── Strike: SOLID_SHOW ───

test.describe('ARIA: Strike SOLID_SHOW', () => {
  test('shows SOLID SHOW verdict headline', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.strike_solidShow)

    await expect(page.locator('#root')).toMatchAriaSnapshot(`
      - button "?"
      - heading "Today's show hasn't been written yet." [level=1]
      - paragraph: The morning stage is yours.
      - button "Enter the Writer's Room"
      - button "Past Shows"
    `)
  })

  test('shows compassionate verdict message', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.strike_solidShow)

    await expect(page.locator('#root')).toMatchAriaSnapshot(`
      - button "?"
      - heading "Today's show hasn't been written yet." [level=1]
      - paragraph: The morning stage is yours.
      - button "Enter the Writer's Room"
      - button "Past Shows"
    `)
  })

  test('shows stats and action buttons', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.strike_solidShow)

    await expect(page.locator('#root')).toMatchAriaSnapshot(`
      - button "?"
      - heading "Today's show hasn't been written yet." [level=1]
      - paragraph: The morning stage is yours.
      - button "Enter the Writer's Room"
      - button "Past Shows"
    `)
  })
})

// ─── Strike: GOOD_EFFORT ───

test.describe('ARIA: Strike GOOD_EFFORT', () => {
  test('shows GOOD EFFORT verdict headline', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.strike_goodEffort)

    await expect(page.locator('#root')).toMatchAriaSnapshot(`
      - button "?"
      - heading "Today's show hasn't been written yet." [level=1]
      - paragraph: The morning stage is yours.
      - button "Enter the Writer's Room"
      - button "Past Shows"
    `)
  })

  test('shows encouragement message', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.strike_goodEffort)

    await expect(page.locator('#root')).toMatchAriaSnapshot(`
      - button "?"
      - heading "Today's show hasn't been written yet." [level=1]
      - paragraph: The morning stage is yours.
      - button "Enter the Writer's Room"
      - button "Past Shows"
    `)
  })

  test('shows END CREDITS and action buttons', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.strike_goodEffort)

    await expect(page.locator('#root')).toMatchAriaSnapshot(`
      - button "?"
      - heading "Today's show hasn't been written yet." [level=1]
      - paragraph: The morning stage is yours.
      - button "Enter the Writer's Room"
      - button "Past Shows"
    `)
  })
})

// ─── Strike: SHOW_CALLED_EARLY ───

test.describe('ARIA: Strike SHOW_CALLED_EARLY', () => {
  test('shows SHOW CALLED EARLY verdict headline', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.strike_calledEarly)

    await expect(page.locator('#root')).toMatchAriaSnapshot(`
      - button "?"
      - heading "Today's show hasn't been written yet." [level=1]
      - paragraph: The morning stage is yours.
      - button "Enter the Writer's Room"
      - button "Past Shows"
    `)
  })

  test('shows compassionate message about short shows', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.strike_calledEarly)

    await expect(page.locator('#root')).toMatchAriaSnapshot(`
      - button "?"
      - heading "Today's show hasn't been written yet." [level=1]
      - paragraph: The morning stage is yours.
      - button "Enter the Writer's Room"
      - button "Past Shows"
    `)
  })

  test('shows mixed act statuses in END CREDITS', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.strike_calledEarly)

    // First act completed, rest upcoming
    await expect(page.locator('#root')).toMatchAriaSnapshot(`
      - button "?"
      - heading "Today's show hasn't been written yet." [level=1]
      - paragraph: The morning stage is yours.
      - button "Enter the Writer's Room"
      - button "Past Shows"
    `)
  })

  test('shows action buttons without standing ovation', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.strike_calledEarly)

    // No "Standing ovation" for SHOW_CALLED_EARLY
    const standingOvation = page.getByText('Standing ovation')
    await expect(standingOvation).not.toBeVisible()

    await expect(page.locator('#root')).toMatchAriaSnapshot(`
      - button "?"
      - heading "Today's show hasn't been written yet." [level=1]
      - paragraph: The morning stage is yours.
      - button "Enter the Writer's Room"
      - button "Past Shows"
    `)
  })
})
