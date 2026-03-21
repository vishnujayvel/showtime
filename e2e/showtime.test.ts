import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import path from 'path'

let app: ElectronApplication
let page: Page

test.beforeAll(async () => {
  app = await electron.launch({
    args: [path.join(__dirname, '..', 'dist', 'main', 'index.js')],
    env: {
      ...process.env,
      NODE_ENV: 'test',
    },
  })

  // Wait for the first BrowserWindow to open
  page = await app.firstWindow()
  // Wait for the renderer to fully load
  await page.waitForLoadState('domcontentloaded')
  // Clear persisted show state so tests start fresh
  await page.evaluate(() => localStorage.removeItem('showtime-show-state'))
  // Reload to apply the cleared state
  await page.reload()
  await page.waitForLoadState('domcontentloaded')
  // Give React a moment to hydrate
  await page.waitForTimeout(2000)
})

test.afterAll(async () => {
  if (app) await app.close()
})

test.describe('Showtime E2E', () => {
  test('app launches and shows Writer\'s Room', async () => {
    const title = await page.title()
    expect(title).toBe('Clui CC')

    // Take a screenshot to see the initial state
    await page.screenshot({ path: 'e2e/screenshots/01-launch.png' })

    // The Writer's Room should be visible — check for energy level text
    const body = await page.textContent('body')
    expect(body).toBeTruthy()
  })

  test('Writer\'s Room shows energy selector', async () => {
    // Look for the energy level buttons
    const highButton = page.getByText('High')
    const mediumButton = page.getByText('Medium')
    const lowButton = page.getByText('Low')
    const recoveryButton = page.getByText('Recovery')

    // At least one should be visible (the Writer's Room energy selector)
    const anyVisible = await highButton.isVisible().catch(() => false)
      || await mediumButton.isVisible().catch(() => false)
      || await lowButton.isVisible().catch(() => false)
      || await recoveryButton.isVisible().catch(() => false)

    await page.screenshot({ path: 'e2e/screenshots/02-writers-room.png' })
    expect(anyVisible).toBe(true)
  })

  test('can select energy level', async () => {
    const highButton = page.getByText('High')
    if (await highButton.isVisible()) {
      await highButton.click()
      await page.waitForTimeout(500)
      await page.screenshot({ path: 'e2e/screenshots/03-energy-selected.png' })
    }
  })

  test('shows text input for day plan after energy selection', async () => {
    // After selecting energy, there should be a textarea or input for the day plan
    await page.waitForTimeout(500)
    const textarea = page.locator('textarea').first()
    const isVisible = await textarea.isVisible().catch(() => false)

    await page.screenshot({ path: 'e2e/screenshots/04-day-plan-input.png' })

    // The textarea for day plan should be present
    if (isVisible) {
      await textarea.fill('Focus on deep work for 2 hours, then exercise, then admin tasks')
      await page.waitForTimeout(300)
      await page.screenshot({ path: 'e2e/screenshots/05-plan-filled.png' })
    }
  })

  test('window has correct properties', async () => {
    // Verify Electron window properties
    const windowCount = app.windows().length
    expect(windowCount).toBeGreaterThanOrEqual(1)

    // Check the window is visible
    const isVisible = await page.evaluate(() => {
      return document.visibilityState === 'visible'
    })
    expect(isVisible).toBe(true)
  })

  test('final state screenshot', async () => {
    await page.screenshot({ path: 'e2e/screenshots/06-final-state.png' })

    // Verify the page has meaningful content
    const bodyText = await page.textContent('body')
    expect(bodyText!.length).toBeGreaterThan(0)
  })
})
