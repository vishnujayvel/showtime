import { test, expect, screenshot, FIXTURES, seedWithMockHour, installMockHourScript, clearMockHour } from './fixtures'

test.describe('Temporal Copy — Clock-Mocked DOM Assertions', () => {
  test.beforeAll(async ({ mainPage: page }) => {
    await installMockHourScript(page)
  })

  test.afterEach(async ({ mainPage: page }) => {
    await clearMockHour(page)
  })

  // ─── Dark Studio ───

  test('morning (9 AM): DarkStudio says "Today\'s show"', async ({ mainPage: page }) => {
    await seedWithMockHour(page, FIXTURES.darkStudio, 9)

    await expect(page.getByText("Today's show")).toBeVisible({ timeout: 5000 })
    await expect(page.getByText("Tonight's show")).not.toBeVisible()
    await expect(page.getByText("Tomorrow's show")).not.toBeVisible()

    await screenshot(page, 'temporal-dark-studio-morning')
  })

  test('afternoon (14:00): DarkStudio says "Today\'s show"', async ({ mainPage: page }) => {
    await seedWithMockHour(page, FIXTURES.darkStudio, 14)

    // Between noon and 6 PM, still "Today's show" in DarkStudio (heading)
    await expect(page.getByText("Today's show")).toBeVisible({ timeout: 5000 })
    await expect(page.getByText("Tomorrow's show")).not.toBeVisible()

    await screenshot(page, 'temporal-dark-studio-afternoon')
  })

  test('evening (20:00): DarkStudio says "Tomorrow\'s show"', async ({ mainPage: page }) => {
    await seedWithMockHour(page, FIXTURES.darkStudio, 20)

    await expect(page.getByText("Tomorrow's show")).toBeVisible({ timeout: 5000 })
    await expect(page.getByText("Today's show")).not.toBeVisible()
    await expect(page.getByText("Tonight's show")).not.toBeVisible()

    await screenshot(page, 'temporal-dark-studio-evening')
  })

  // ─── Writer's Room ───

  test('morning (9 AM): WritersRoom plan says "today\'s lineup"', async ({ mainPage: page }) => {
    await seedWithMockHour(page, FIXTURES.writersRoom_plan, 9)

    const bodyText = await page.textContent('body')
    expect(bodyText).toContain("today's")
    expect(bodyText).not.toContain("tonight's")

    await screenshot(page, 'temporal-writers-room-morning')
  })

  test('afternoon (14:00): WritersRoom plan says "your next lineup"', async ({ mainPage: page }) => {
    await seedWithMockHour(page, FIXTURES.writersRoom_plan, 14)

    const bodyText = await page.textContent('body')
    expect(bodyText).toContain('your next')
    expect(bodyText).not.toContain("tonight's")

    await screenshot(page, 'temporal-writers-room-afternoon')
  })

  test('evening (20:00): WritersRoom plan says "tomorrow\'s lineup"', async ({ mainPage: page }) => {
    await seedWithMockHour(page, FIXTURES.writersRoom_plan, 20)

    const bodyText = await page.textContent('body')
    expect(bodyText).toContain("tomorrow's")
    expect(bodyText).not.toContain("tonight's")

    await screenshot(page, 'temporal-writers-room-evening')
  })

  // ─── Lineup Header ───

  test('morning (9 AM): Lineup header says "TODAY\'S LINEUP"', async ({ mainPage: page }) => {
    await seedWithMockHour(page, FIXTURES.writersRoom_lineup, 9)

    const bodyText = (await page.textContent('body'))?.toUpperCase() || ''
    expect(bodyText).toContain("TODAY'S LINEUP")
    expect(bodyText).not.toContain("TONIGHT'S LINEUP")

    await screenshot(page, 'temporal-lineup-header-morning')
  })

  test('evening (20:00): Lineup header says "TOMORROW\'S LINEUP"', async ({ mainPage: page }) => {
    await seedWithMockHour(page, FIXTURES.writersRoom_lineup, 20)

    const bodyText = (await page.textContent('body'))?.toUpperCase() || ''
    expect(bodyText).toContain("TOMORROW'S LINEUP")
    expect(bodyText).not.toContain("TONIGHT'S LINEUP")

    await screenshot(page, 'temporal-lineup-header-evening')
  })

  // ─── Never "tonight" anywhere ───

  test('no view ever shows hardcoded "tonight"', async ({ mainPage: page }) => {
    // Test across multiple phases
    for (const hour of [9, 14, 20]) {
      for (const fixture of [FIXTURES.darkStudio, FIXTURES.writersRoom_plan, FIXTURES.writersRoom_lineup]) {
        await seedWithMockHour(page, fixture, hour)
        const bodyText = (await page.textContent('body'))?.toLowerCase() || ''
        expect(bodyText).not.toContain("tonight's lineup")
        expect(bodyText).not.toContain("tonight's show")
      }
    }
  })
})
