/**
 * E2E tests for SettingsView.
 *
 * Settings is opened via IPC (Cmd+, or tray menu) and renders as a full-screen
 * overlay with preferences for theme, sound, calendar sync, and show reset.
 */
import { test, expect, screenshot, seedFixture, FIXTURES } from './fixtures'

test.describe('Settings View', () => {
  test('settings can be opened via IPC event', async ({ app, mainPage: page }) => {
    // Seed into Dark Studio so we have a stable starting view
    await seedFixture(page, FIXTURES.darkStudio)
    await screenshot(page, 'settings-01-before-open')

    // Trigger settings open via IPC (same mechanism as Cmd+, and tray menu)
    const bw = await app.browserWindow(page)
    await bw.evaluate((win) => {
      win.webContents.send('showtime:open-settings')
    })

    // The settings view should render with the PREFERENCES title bar
    const preferencesLabel = page.locator('text=PREFERENCES')
    await expect(preferencesLabel).toBeVisible({ timeout: 5000 })
    await screenshot(page, 'settings-02-opened')
  })

  test('settings UI renders all expected sections', async ({ app, mainPage: page }) => {
    // Seed and open settings
    await seedFixture(page, FIXTURES.darkStudio)
    const bw = await app.browserWindow(page)
    await bw.evaluate((win) => {
      win.webContents.send('showtime:open-settings')
    })
    await page.waitForTimeout(500)

    // Verify the PREFERENCES header
    await expect(page.locator('text=PREFERENCES')).toBeVisible({ timeout: 5000 })

    // Calendar Sync section
    const calendarLabel = page.locator('text=CALENDAR SYNC')
    await expect(calendarLabel).toBeVisible({ timeout: 3000 })

    // Sound toggle
    const soundLabel = page.getByText('Sound', { exact: false })
    await expect(soundLabel.first()).toBeVisible({ timeout: 3000 })

    // Theme buttons (dark, light, system)
    const themeLabel = page.getByText('Theme', { exact: false })
    await expect(themeLabel.first()).toBeVisible({ timeout: 3000 })

    const darkButton = page.locator('button', { hasText: 'dark' })
    const lightButton = page.locator('button', { hasText: 'light' })
    const systemButton = page.locator('button', { hasText: 'system' })
    await expect(darkButton).toBeVisible({ timeout: 3000 })
    await expect(lightButton).toBeVisible({ timeout: 3000 })
    await expect(systemButton).toBeVisible({ timeout: 3000 })

    // Reset Show section
    const resetLabel = page.getByText('Reset Show')
    await expect(resetLabel.first()).toBeVisible({ timeout: 3000 })

    // Footer with version info
    const versionText = page.locator('text=/Showtime v/')
    await expect(versionText).toBeVisible({ timeout: 3000 })

    const tagline = page.getByText('An ADHD-friendly day planner')
    await expect(tagline).toBeVisible({ timeout: 3000 })

    await screenshot(page, 'settings-03-all-sections')
  })

  test('settings Back button returns to previous view', async ({ app, mainPage: page }) => {
    // Seed into Dark Studio and open settings
    await seedFixture(page, FIXTURES.darkStudio)
    const bw = await app.browserWindow(page)
    await bw.evaluate((win) => {
      win.webContents.send('showtime:open-settings')
    })
    await page.waitForTimeout(500)

    // Verify settings is showing
    await expect(page.locator('text=PREFERENCES')).toBeVisible({ timeout: 5000 })

    // Click the Back button
    const backBtn = page.locator('button', { hasText: 'Back' })
    await expect(backBtn).toBeVisible({ timeout: 3000 })
    await backBtn.click()

    // Settings should be gone — verify PREFERENCES label is no longer visible
    await expect(page.locator('text=PREFERENCES')).toBeHidden({ timeout: 3000 })

    // Dark Studio should be back — the "Enter the Writer's Room" button is visible
    const enterBtn = page.getByTestId('enter-writers-room')
    await expect(enterBtn).toBeVisible({ timeout: 5000 })
    await screenshot(page, 'settings-04-back-to-dark-studio')
  })

  test('settings opens from live phase too', async ({ app, mainPage: page }) => {
    // Seed into live expanded to verify settings works from any phase
    await seedFixture(page, FIXTURES.live_expanded)
    const bw = await app.browserWindow(page)
    await bw.evaluate((win) => {
      win.webContents.send('showtime:open-settings')
    })
    await page.waitForTimeout(500)

    // Settings overlay should appear on top of live view
    await expect(page.locator('text=PREFERENCES')).toBeVisible({ timeout: 5000 })
    await screenshot(page, 'settings-05-from-live-phase')

    // Close and verify live view returns
    const backBtn = page.locator('button', { hasText: 'Back' })
    await backBtn.click()
    await page.waitForTimeout(500)

    const preferencesGone = await page.locator('text=PREFERENCES').isVisible().catch(() => false)
    expect(preferencesGone).toBe(false)
    await screenshot(page, 'settings-06-back-to-live')
  })

  test('theme buttons can be clicked', async ({ app, mainPage: page }) => {
    // Open settings
    await seedFixture(page, FIXTURES.darkStudio)
    const bw = await app.browserWindow(page)
    await bw.evaluate((win) => {
      win.webContents.send('showtime:open-settings')
    })
    await page.waitForTimeout(500)
    await expect(page.locator('text=PREFERENCES')).toBeVisible({ timeout: 5000 })

    // Click the "light" theme button
    const lightButton = page.locator('button', { hasText: 'light' })
    await lightButton.click()

    // The light button should now have the active accent styling (bg-accent)
    // Verify it is still visible (click didn't break anything)
    await expect(lightButton).toBeVisible()
    await screenshot(page, 'settings-07-theme-light')

    // Switch back to dark
    const darkButton = page.locator('button', { hasText: 'dark' })
    await darkButton.click()
    await expect(darkButton).toBeVisible()
    await screenshot(page, 'settings-08-theme-dark')
  })
})
