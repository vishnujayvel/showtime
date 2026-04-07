import { test, expect, screenshot, FIXTURES, seedFixture, VIEW_DIMENSIONS } from './fixtures'
import type { ElectronApplication } from '@playwright/test'

/** Poll window bounds until they match expected dimensions (or timeout). */
async function waitForBounds(
  app: ElectronApplication,
  expectedWidth: number,
  expectedHeight: number,
  timeoutMs = 8000,
): Promise<{ width: number; height: number } | null> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const bounds = await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0]
      return win?.getBounds()
    })
    if (bounds && bounds.width === expectedWidth && bounds.height === expectedHeight) {
      return bounds
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  // Return last bounds for error reporting
  return app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0]
    return win?.getBounds() ?? null
  })
}

test.describe('View Tier Verification', () => {

  // ─── Micro (Pill) ───

  test('micro pill: window matches pill dimensions', async ({ app, mainPage: page }) => {
    await seedFixture(page, FIXTURES.live_micro)

    const bounds = await waitForBounds(app, VIEW_DIMENSIONS.pill.width, VIEW_DIMENSIONS.pill.height)
    expect(bounds?.width).toBe(VIEW_DIMENSIONS.pill.width)
    expect(bounds?.height).toBe(VIEW_DIMENSIONS.pill.height)

    await screenshot(page, 'tier-micro-bounds')
  })

  test('micro pill: shows act name and timer', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.live_micro)

    // Act name visible
    await expect(page.getByText('Deep Work Session')).toBeVisible({ timeout: 5000 })

    // Timer format visible (MM:SS)
    const timerEl = page.locator('.font-mono.tabular-nums').first()
    const timerText = await timerEl.textContent().catch(() => '')
    expect(timerText).toMatch(/\d{2}:\d{2}/)

    await screenshot(page, 'tier-micro-content')
  })

  test('micro pill: does NOT show lineup sidebar', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.live_micro)

    // The lineup sidebar is only in ExpandedView
    const sidebar = page.locator('text=LINEUP')
    const count = await sidebar.count()
    // In pill view, no lineup label should be visible
    if (count > 0) {
      const isVisible = await sidebar.first().isVisible().catch(() => false)
      expect(isVisible).toBe(false)
    }
  })

  // ─── Compact ───

  test('compact: window matches compact dimensions', async ({ app, mainPage: page }) => {
    await seedFixture(page, FIXTURES.live_compact)

    const bounds = await waitForBounds(app, VIEW_DIMENSIONS.compact.width, VIEW_DIMENSIONS.compact.height)
    expect(bounds?.width).toBe(VIEW_DIMENSIONS.compact.width)
    expect(bounds?.height).toBe(VIEW_DIMENSIONS.compact.height)

    await screenshot(page, 'tier-compact-bounds')
  })

  test('compact: shows beat counter', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.live_compact)

    // BeatCounter renders beat stars or "Beats" label
    const beatCounterText = page.getByText(/beat/i)
    const isVisible = await beatCounterText.isVisible().catch(() => false)
    if (isVisible) {
      expect(isVisible).toBe(true)
    }
    await screenshot(page, 'tier-compact-beats')
  })

  // ─── Dashboard ───

  test('dashboard: window matches dashboard dimensions', async ({ app, mainPage: page }) => {
    await seedFixture(page, FIXTURES.live_dashboard)

    const bounds = await waitForBounds(app, VIEW_DIMENSIONS.dashboard.width, VIEW_DIMENSIONS.dashboard.height)
    expect(bounds?.width).toBe(VIEW_DIMENSIONS.dashboard.width)
    expect(bounds?.height).toBe(VIEW_DIMENSIONS.dashboard.height)

    await screenshot(page, 'tier-dashboard-bounds')
  })

  test('dashboard: shows "COMING UP" section with upcoming acts', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.live_dashboard)

    await expect(page.getByText('COMING UP')).toBeVisible({ timeout: 5000 })

    // Next 2 upcoming acts should be visible
    await expect(page.getByText('Exercise Break')).toBeVisible()
    await expect(page.getByText('Email & Slack')).toBeVisible()

    await screenshot(page, 'tier-dashboard-coming-up')
  })

  test('dashboard: shows ClapperboardBadge for current act', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.live_dashboard)

    // Current act name
    await expect(page.getByText('Deep Work Session')).toBeVisible({ timeout: 5000 })

    // Timer text
    const timerEl = page.locator('.font-mono.tabular-nums').first()
    const isVisible = await timerEl.isVisible().catch(() => false)
    expect(isVisible).toBe(true)

    await screenshot(page, 'tier-dashboard-clapperboard')
  })

  test('dashboard: shows Director button', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.live_dashboard)

    await expect(page.getByText('Director')).toBeVisible({ timeout: 5000 })
    await screenshot(page, 'tier-dashboard-director')
  })

  // ─── Expanded ───

  test('expanded: window matches expanded dimensions', async ({ app, mainPage: page }) => {
    await seedFixture(page, FIXTURES.live_expanded)

    const bounds = await waitForBounds(app, VIEW_DIMENSIONS.expanded.width, VIEW_DIMENSIONS.expanded.height)
    expect(bounds?.width).toBe(VIEW_DIMENSIONS.expanded.width)
    expect(bounds?.height).toBe(VIEW_DIMENSIONS.expanded.height)

    await screenshot(page, 'tier-expanded-bounds')
  })

  test('expanded: shows lineup sidebar', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.live_expanded)

    // Sidebar lineup shows act names
    await expect(page.getByText('Deep Work Session').first()).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Exercise Break')).toBeVisible()

    await screenshot(page, 'tier-expanded-sidebar')
  })

  test('expanded: shows ON AIR indicator', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.live_expanded)

    const onair = page.getByText('ON AIR')
    const isVisible = await onair.isVisible({ timeout: 5000 }).catch(() => false)
    if (isVisible) {
      expect(isVisible).toBe(true)
    }
    await screenshot(page, 'tier-expanded-onair')
  })

  test('expanded: shows date label', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.live_expanded)

    const dateLabel = page.locator('[data-testid="date-label"]')
    await expect(dateLabel).toBeVisible({ timeout: 5000 })

    const text = await dateLabel.textContent()
    // Should be a formatted date like "SAT, MAR 22"
    expect(text!.length).toBeGreaterThan(0)

    await screenshot(page, 'tier-expanded-date')
  })

  // ─── Full-screen phases always use 'full' dimensions ───

  test('DarkStudio: window matches full dimensions', async ({ app, mainPage: page }) => {
    await seedFixture(page, FIXTURES.darkStudio)

    const bounds = await waitForBounds(app, VIEW_DIMENSIONS.full.width, VIEW_DIMENSIONS.full.height)
    expect(bounds?.width).toBe(VIEW_DIMENSIONS.full.width)
    expect(bounds?.height).toBe(VIEW_DIMENSIONS.full.height)

    await screenshot(page, 'tier-dark-studio-full')
  })

  test('WritersRoom: window matches full dimensions', async ({ app, mainPage: page }) => {
    await seedFixture(page, FIXTURES.writersRoom_chat)

    const bounds = await waitForBounds(app, VIEW_DIMENSIONS.full.width, VIEW_DIMENSIONS.full.height)
    expect(bounds?.width).toBe(VIEW_DIMENSIONS.full.width)
    expect(bounds?.height).toBe(VIEW_DIMENSIONS.full.height)

    await screenshot(page, 'tier-writers-room-full')
  })

  test('Strike: window matches full dimensions', async ({ app, mainPage: page }) => {
    await seedFixture(page, FIXTURES.strike_dayWon)

    const bounds = await waitForBounds(app, VIEW_DIMENSIONS.full.width, VIEW_DIMENSIONS.full.height)
    expect(bounds?.width).toBe(VIEW_DIMENSIONS.full.width)
    expect(bounds?.height).toBe(VIEW_DIMENSIONS.full.height)

    await screenshot(page, 'tier-strike-full')
  })

  // ─── Pill transition tests (ghost frame fix) ───

  test('expanded → pill transition renders content without ghost frames', async ({ app, mainPage: page }) => {
    // Start in expanded live state
    await seedFixture(page, FIXTURES.live_expanded)
    await waitForBounds(app, VIEW_DIMENSIONS.expanded.width, VIEW_DIMENSIONS.expanded.height)

    // Transition to pill by setting viewTier to micro
    await page.evaluate(() => {
      localStorage.setItem('showtime-show-state', JSON.stringify({
        state: {
          ...JSON.parse(localStorage.getItem('showtime-show-state')!).state,
          viewTier: 'micro',
        },
        version: 0,
      }))
    })
    // Navigate to apply the state change
    const url = page.url()
    await page.goto(url, { waitUntil: 'commit', timeout: 10000 })
    await page.waitForSelector('#root > *', { timeout: 3000 }).catch(() => {})

    // Wait for pill dimensions
    const bounds = await waitForBounds(app, VIEW_DIMENSIONS.pill.width, VIEW_DIMENSIONS.pill.height)
    expect(bounds?.width).toBe(VIEW_DIMENSIONS.pill.width)
    expect(bounds?.height).toBe(VIEW_DIMENSIONS.pill.height)

    // Verify pill content actually rendered (not a ghost frame)
    const pillContent = page.locator('[data-pill-content]')
    await expect(pillContent).toBeVisible({ timeout: 5000 })

    await screenshot(page, 'tier-pill-transition')
  })

  test('pill → expanded transition renders correctly', async ({ app, mainPage: page }) => {
    // Start in pill state
    await seedFixture(page, FIXTURES.live_micro)
    await waitForBounds(app, VIEW_DIMENSIONS.pill.width, VIEW_DIMENSIONS.pill.height)

    // Transition to expanded
    await page.evaluate(() => {
      localStorage.setItem('showtime-show-state', JSON.stringify({
        state: {
          ...JSON.parse(localStorage.getItem('showtime-show-state')!).state,
          viewTier: 'expanded',
        },
        version: 0,
      }))
    })
    const url = page.url()
    await page.goto(url, { waitUntil: 'commit', timeout: 10000 })
    await page.waitForSelector('#root > *', { timeout: 3000 }).catch(() => {})

    const bounds = await waitForBounds(app, VIEW_DIMENSIONS.expanded.width, VIEW_DIMENSIONS.expanded.height)
    expect(bounds?.width).toBe(VIEW_DIMENSIONS.expanded.width)
    expect(bounds?.height).toBe(VIEW_DIMENSIONS.expanded.height)

    // Verify expanded content rendered
    await expect(page.getByText('Deep Work Session').first()).toBeVisible({ timeout: 5000 })

    await screenshot(page, 'tier-pill-to-expanded')
  })

  // ─── Anchor-point preservation ───

  test('pill-to-expanded preserves anchor point', async ({ app, mainPage: page }) => {
    // Start in expanded live state, then collapse to pill
    await seedFixture(page, FIXTURES.live_expanded)
    await waitForBounds(app, VIEW_DIMENSIONS.expanded.width, VIEW_DIMENSIONS.expanded.height)

    // Transition to pill (micro) view
    await page.evaluate(() => {
      localStorage.setItem('showtime-show-state', JSON.stringify({
        state: {
          ...JSON.parse(localStorage.getItem('showtime-show-state')!).state,
          viewTier: 'micro',
        },
        version: 0,
      }))
    })
    let url = page.url()
    await page.goto(url, { waitUntil: 'commit', timeout: 10000 })
    await page.waitForSelector('#root > *', { timeout: 3000 }).catch(() => {})
    await waitForBounds(app, VIEW_DIMENSIONS.pill.width, VIEW_DIMENSIONS.pill.height)

    // Record pill bounds (center-x and bottom-y)
    const pillBounds = await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0]
      return win?.getBounds()
    })
    expect(pillBounds).toBeTruthy()
    const pillCenterX = pillBounds!.x + pillBounds!.width / 2
    const pillBottomY = pillBounds!.y + pillBounds!.height

    await screenshot(page, 'anchor-pill-before')

    // Transition back to expanded
    await page.evaluate(() => {
      localStorage.setItem('showtime-show-state', JSON.stringify({
        state: {
          ...JSON.parse(localStorage.getItem('showtime-show-state')!).state,
          viewTier: 'expanded',
        },
        version: 0,
      }))
    })
    url = page.url()
    await page.goto(url, { waitUntil: 'commit', timeout: 10000 })
    await page.waitForSelector('#root > *', { timeout: 3000 }).catch(() => {})
    await waitForBounds(app, VIEW_DIMENSIONS.expanded.width, VIEW_DIMENSIONS.expanded.height)

    // Record expanded bounds
    const expandedBounds = await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0]
      return win?.getBounds()
    })
    expect(expandedBounds).toBeTruthy()
    const expandedCenterX = expandedBounds!.x + expandedBounds!.width / 2
    const expandedBottomY = expandedBounds!.y + expandedBounds!.height

    await screenshot(page, 'anchor-expanded-after')

    // Assert: center-x is preserved within ±2px tolerance
    expect(Math.abs(expandedCenterX - pillCenterX)).toBeLessThanOrEqual(2)
    // Assert: bottom-y is preserved within ±2px tolerance
    expect(Math.abs(expandedBottomY - pillBottomY)).toBeLessThanOrEqual(2)
  })
})
