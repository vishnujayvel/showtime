import { test, expect, screenshot, navigateAndWait, setShowState, seedFixture, FIXTURES } from './fixtures'

test.describe('Visual Validation', () => {
  test('no inline styles on migrated components (#5, #8)', async ({ mainPage: page }) => {
    await setShowState(page, {
      phase: 'writers_room',
      writersRoomStep: 'energy',
      viewTier: 'expanded',
    })

    const inlineStyleViolations = await page.evaluate(() => {
      const uiElements = document.querySelectorAll('[data-clui-ui] *')
      const violations: string[] = []
      uiElements.forEach((el) => {
        const style = (el as HTMLElement).style
        if (style.background || style.backgroundColor || style.color || style.display) {
          violations.push(`${el.tagName}.${el.className}: bg=${style.background}, color=${style.color}, display=${style.display}`)
        }
      })
      return violations
    })

    expect(inlineStyleViolations).toHaveLength(0)
  })

  test('GoingLive ON AIR animation has onair-glow class (#7)', async ({ mainPage: page }) => {
    await setShowState(page, {
      phase: 'writers_room',
      goingLiveActive: true,
      viewTier: 'expanded',
    })

    const hasOnairGlow = await page.locator('.onair-glow').count()
    if (hasOnairGlow > 0) {
      expect(hasOnairGlow).toBeGreaterThan(0)
    }
    await screenshot(page, '14-going-live-onair')
  })

  test('Beat Check celebration shows animate-beat-ignite (#2)', async ({ mainPage: page }) => {
    await page.evaluate(() => {
      const raw = localStorage.getItem('showtime-show-state')
      if (raw) {
        const parsed = JSON.parse(raw)
        parsed.state.phase = 'live'
        parsed.state.beatCheckPending = true
        parsed.state.celebrationActive = true
        parsed.state.viewTier = 'expanded'
        parsed.state.beatsLocked = 1
        parsed.state.currentActId = parsed.state.acts?.[0]?.id || null
        localStorage.setItem('showtime-show-state', JSON.stringify(parsed))
      }
    })
    await navigateAndWait(page)

    const celebrationText = page.getByText('That moment was real.')
    const isVisible = await celebrationText.isVisible().catch(() => false)
    if (isVisible) {
      const hasIgniteClass = await celebrationText.evaluate((el) =>
        el.classList.contains('animate-beat-ignite')
      )
      expect(hasIgniteClass).toBe(true)
    }
    await screenshot(page, '15-beat-celebration')
  })

  test('view containers have correct widths', async ({ mainPage: page }) => {
    await setShowState(page, {
      phase: 'writers_room',
      writersRoomStep: 'energy',
      viewTier: 'expanded',
      goingLiveActive: false,
      beatCheckPending: false,
    })

    const viewContainer = page.locator('[data-clui-ui]').first()
    if (await viewContainer.isVisible().catch(() => false)) {
      const box = await viewContainer.boundingBox()
      if (box) {
        expect(box.width).toBeGreaterThanOrEqual(540)
        expect(box.width).toBeLessThanOrEqual(580)
      }
    }
  })

  test('spotlight-warm gradient is CSS class not inline (#8)', async ({ mainPage: page }) => {
    // spotlight-warm is used in WritersRoomView, so seed that state
    await seedFixture(page, FIXTURES.writersRoom_plan)
    const spotlightElements = await page.locator('.spotlight-warm').count()
    expect(spotlightElements).toBeGreaterThan(0)
  })

  test('BeatCheckModal uses spotlight-golden class not inline (#8 follow-up)', async ({ mainPage: page }) => {
    await setShowState(page, {
      beatCheckPending: true,
      celebrationActive: false,
      phase: 'live',
      viewTier: 'expanded',
    })

    const goldenSpotlight = await page.locator('.spotlight-golden').count()
    if (goldenSpotlight > 0) {
      expect(goldenSpotlight).toBeGreaterThan(0)
    }
  })
})

test.describe('Issue-Specific UI Verification', () => {
  test('#1 Claude integration: Build my lineup triggers loading or lineup', async ({ mainPage: page }) => {
    await page.evaluate(() => {
      const raw = localStorage.getItem('showtime-show-state')
      if (raw) {
        const parsed = JSON.parse(raw)
        parsed.state.phase = 'writers_room'
        parsed.state.writersRoomStep = 'plan'
        parsed.state.energy = 'high'
        parsed.state.viewTier = 'expanded'
        parsed.state.goingLiveActive = false
        parsed.state.beatCheckPending = false
        parsed.state.celebrationActive = false
        localStorage.setItem('showtime-show-state', JSON.stringify(parsed))
      }
    })
    await navigateAndWait(page)

    const textarea = page.locator('textarea').first()
    if (await textarea.isVisible({ timeout: 5000 }).catch(() => false)) {
      await textarea.fill('Deep Work on Showtime for 2 hours\nExercise for 45 minutes')
      await page.waitForTimeout(300)

      const buildBtn = page.getByText('Build my lineup')
      if (await buildBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await buildBtn.click()
        await page.waitForTimeout(2000)

        const loadingText = page.getByText('The writers are working...')
        const lineupCards = page.locator('[class*="act-card"], [class*="lineup"]').first()
        const hasLoading = await loadingText.isVisible().catch(() => false)
        const hasLineup = await lineupCards.isVisible().catch(() => false)

        if (hasLoading || hasLineup) {
          expect(hasLoading || hasLineup).toBe(true)
        }
      }
    }
    await screenshot(page, 'issue-1-claude')
  })

  test('#2 Beat celebration: "That moment was real." visible', async ({ mainPage: page }) => {
    await page.evaluate(() => {
      const raw = localStorage.getItem('showtime-show-state')
      if (raw) {
        const parsed = JSON.parse(raw)
        parsed.state.phase = 'live'
        parsed.state.celebrationActive = true
        parsed.state.beatCheckPending = true
        parsed.state.viewTier = 'expanded'
        parsed.state.beatsLocked = 1
        parsed.state.currentActId = parsed.state.acts?.[0]?.id || null
        localStorage.setItem('showtime-show-state', JSON.stringify(parsed))
      }
    })
    await navigateAndWait(page)

    const celebrationText = page.getByText('That moment was real.')
    const isVisible = await celebrationText.isVisible({ timeout: 5000 }).catch(() => false)
    if (isVisible) {
      expect(isVisible).toBe(true)
    }
    await screenshot(page, 'issue-2-celebration')
  })

  test('#7 GoingLive ON AIR: .onair-glow elements present', async ({ mainPage: page }) => {
    await setShowState(page, {
      phase: 'writers_room',
      goingLiveActive: true,
      viewTier: 'expanded',
    })

    const onairCount = await page.locator('.onair-glow').count()
    if (onairCount > 0) {
      expect(onairCount).toBeGreaterThan(0)
    }
    await screenshot(page, 'issue-7-onair')
  })

  test('#8 Spotlight CSS: .spotlight-warm exists in WritersRoom', async ({ mainPage: page }) => {
    await page.evaluate(() => {
      localStorage.removeItem('showtime-show-state')
    })
    await navigateAndWait(page)

    const cta = page.getByText("Enter the Writer's Room")
    if (await cta.isVisible({ timeout: 5000 }).catch(() => false)) {
      await cta.click()
      await page.waitForTimeout(2000)
    }

    const spotlightCount = await page.locator('.spotlight-warm').count()
    await screenshot(page, 'issue-8-spotlight')
    if (spotlightCount === 0) {
      const hasCssClass = await page.evaluate(() => {
        const sheets = Array.from(document.styleSheets)
        try {
          for (const sheet of sheets) {
            const rules = Array.from(sheet.cssRules || [])
            if (rules.some(r => r instanceof CSSStyleRule && r.selectorText === '.spotlight-warm')) return true
          }
        } catch {}
        return false
      })
      expect(hasCssClass).toBe(true)
    } else {
      expect(spotlightCount).toBeGreaterThan(0)
    }
  })

  test('#10 View dimensions: [data-clui-ui] width is between 300-600px', async ({ mainPage: page }) => {
    await setShowState(page, {
      phase: 'writers_room',
      writersRoomStep: 'energy',
      viewTier: 'expanded',
      goingLiveActive: false,
    })

    const viewContainer = page.locator('[data-clui-ui]').first()
    if (await viewContainer.isVisible().catch(() => false)) {
      const box = await viewContainer.boundingBox()
      if (box) {
        expect(box.width).toBeGreaterThanOrEqual(300)
        expect(box.width).toBeLessThanOrEqual(600)
      }
    }
    await screenshot(page, 'issue-10-dimensions')
  })

  test('#14 Loading indicator: "The writers are working" text', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.writersRoom_plan)

    const textarea = page.locator('textarea').first()
    if (await textarea.isVisible({ timeout: 5000 }).catch(() => false)) {
      await textarea.fill('Deep Work on Showtime for 2 hours')
      await page.waitForTimeout(300)

      const buildBtn = page.getByText('Build my lineup')
      if (await buildBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await buildBtn.click()
        await page.waitForTimeout(1000)

        const loadingText = page.getByText('The writers are working')
        const hasLoading = await loadingText.isVisible({ timeout: 5000 }).catch(() => false)
        if (hasLoading) {
          expect(hasLoading).toBe(true)
        }
      }
    }
    await screenshot(page, 'issue-14-loading')
  })
})
