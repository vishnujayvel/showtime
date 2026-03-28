import { test, expect, screenshot, navigateAndWait } from './fixtures'

test.describe('7.1 — App Launch', () => {
  test('window opens and is visible', async ({ mainPage: page }) => {
    const isVisible = await page.evaluate(() => document.visibilityState === 'visible')
    expect(isVisible).toBe(true)
  })

  test('renders Dark Studio view (no_show phase)', async ({ mainPage: page }) => {
    const cta = page.getByText("Enter the Writer's Room")
    await expect(cta).toBeVisible({ timeout: 10000 })
    await screenshot(page, '01-dark-studio')
  })
})

test.describe('Electron Main Process (#3, #4, #9, #10)', () => {
  test('#4 window is always-on-top', async ({ app, mainPage: page }) => {
    const bwHandle = await app.browserWindow(page)
    const isOnTop = await bwHandle.evaluate((bw) => bw.isAlwaysOnTop())
    expect(isOnTop).toBe(true)
  })

  test('#4 window background is transparent', async ({ app, mainPage: page }) => {
    const bwHandle = await app.browserWindow(page)
    const bgColor = await bwHandle.evaluate((bw) => bw.getBackgroundColor())
    expect(bgColor).toMatch(/^#0{6}(00)?$/)
  })

  test('#10 window uses content-tight sizing', async ({ app, mainPage: page }) => {
    await page.evaluate(() => {
      localStorage.removeItem('showtime-show-state')
      localStorage.setItem('showtime-onboarding-complete', 'true')
    })
    await navigateAndWait(page)

    const cta = page.getByText("Enter the Writer's Room")
    await expect(cta).toBeVisible({ timeout: 10000 })
    await page.waitForTimeout(1000)

    const bwHandle = await app.browserWindow(page)
    const bounds = await bwHandle.evaluate((bw) => bw.getBounds())
    expect(bounds.width).toBe(560)
    expect(bounds.height).toBe(740)
  })

  test('#3 tray menu labels match idle state', async ({ app }) => {
    const labels = await app.evaluate(async () => {
      return (global as any).__trayMenuLabels || []
    })
    expect(labels).toContain('SHOWTIME')
    expect(labels).toContain('No show running')
    expect(labels).toContain("Enter Writer's Room")
    expect(labels).toContain('Past Shows')
    expect(labels).toContain('Quit Showtime')
  })
})

test.describe('Dynamic Window Bounds (#10)', () => {
  test('window resizes to match view content', async ({ app, mainPage: page }) => {
    await page.evaluate(() => {
      localStorage.setItem('showtime-onboarding-complete', 'true')
      localStorage.removeItem('showtime-show-state')
    })
    await navigateAndWait(page)
    await page.waitForTimeout(500)

    const bwHandle = await app.browserWindow(page)
    const bounds = await bwHandle.evaluate((bw) => bw.getBounds())
    expect(bounds.width).toBe(560)
    expect([620, 740]).toContain(bounds.height)

    const cta = page.getByText("Enter the Writer's Room")
    if (await cta.isVisible({ timeout: 5000 }).catch(() => false)) {
      await cta.click()
      await page.waitForTimeout(1000)
    }

    const boundsAfter = await bwHandle.evaluate((bw) => bw.getBounds())
    expect(boundsAfter.width).toBe(560)
    expect(boundsAfter.height).toBe(740)
  })
})
