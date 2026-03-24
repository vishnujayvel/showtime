import { test, expect, screenshot, seedFixture, FIXTURES } from './fixtures'

test.describe('Temporal Copy (#29)', () => {
  test('Writer\'s Room plan text uses temporal label, not hardcoded "tonight"', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.writersRoom_plan)

    // The paragraph should NOT contain "tonight"
    const bodyText = await page.textContent('body')
    const planSection = bodyText || ''

    // Check that the old "tonight's lineup" text is not present
    expect(planSection).not.toContain("tonight's lineup")

    // Should contain one of the temporal labels
    const hasTemporalLabel = planSection.includes("today's lineup")
      || planSection.includes("your next lineup")
      || planSection.includes("tomorrow's lineup")
    expect(hasTemporalLabel).toBe(true)

    await screenshot(page, 'temporal-plan-label')
  })

  test('Lineup panel header uses temporal label', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.writersRoom_lineup)

    const bodyText = await page.textContent('body')
    const content = bodyText || ''

    // Should NOT contain "TONIGHT'S LINEUP" or "Tonight's Lineup"
    expect(content.toUpperCase()).not.toContain("TONIGHT'S LINEUP")

    // Should contain temporal variant
    const hasTemporalHeader = content.toUpperCase().includes("TODAY'S LINEUP")
      || content.toUpperCase().includes("YOUR NEXT LINEUP")
      || content.toUpperCase().includes("TOMORROW'S LINEUP")
    expect(hasTemporalHeader).toBe(true)

    await screenshot(page, 'temporal-lineup-header')
  })
})
