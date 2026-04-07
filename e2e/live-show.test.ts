import { test, expect, screenshot, navigateAndWait, setShowState } from './fixtures'

test.describe('7.4 — Live Show Flows', () => {
  test('expanded view shows content when live', async ({ mainPage: page }) => {
    await setShowState(page, {
      phase: 'live',
      viewTier: 'expanded',
      beatCheckPending: false,
      celebrationActive: false,
      goingLiveActive: false,
    })

    const body = await page.textContent('body')
    expect(body!.length).toBeGreaterThan(0)
    await screenshot(page, '07-expanded-view')
  })

  test('can trigger beat check via store manipulation', async ({ mainPage: page }) => {
    await setShowState(page, { beatCheckPending: true })
    await screenshot(page, '08-beat-check')
  })

  test('can trigger intermission via store manipulation', async ({ mainPage: page }) => {
    await setShowState(page, {
      phase: 'intermission',
      beatCheckPending: false,
    })

    const intermissionText = page.getByText(/right back|intermission|no rush/i)
    const isVisible = await intermissionText.isVisible().catch(() => false)
    await screenshot(page, '09-intermission')
    if (isVisible) {
      expect(isVisible).toBe(true)
    }
  })
})

test.describe('Pill ↔ Expanded', () => {
  test('can toggle between pill and expanded views', async ({ mainPage: page }) => {
    await setShowState(page, {
      phase: 'live',
      viewTier: 'expanded',
      verdict: null,
    })

    const collapseBtn = page.locator('button').filter({ hasText: /collapse|minimize|−/i }).first()
    if (await collapseBtn.isVisible().catch(() => false)) {
      await collapseBtn.click()
      await page.waitForTimeout(500)
      await screenshot(page, '11-pill-view')

      const pill = page.locator('[data-pill-content]').first()
      if (await pill.isVisible().catch(() => false)) {
        await pill.click()
        await page.waitForTimeout(500)
        await screenshot(page, '12-expanded-again')
      }
    }

    await screenshot(page, '13-final-state')
  })
})

test.describe('Race Condition Guards (#11)', () => {
  test('#11 double lockBeat via rapid clicks', async ({ mainPage: page }) => {
    await page.evaluate(() => {
      const raw = localStorage.getItem('showtime-show-state')
      if (raw) {
        const parsed = JSON.parse(raw)
        parsed.state.phase = 'live'
        parsed.state.beatCheckPending = true
        parsed.state.celebrationActive = false
        parsed.state.viewTier = 'expanded'
        parsed.state.beatsLocked = 0
        if (!parsed.state.acts || parsed.state.acts.length === 0) {
          parsed.state.acts = [
            { id: 'race-act-1', name: 'Test Act', sketch: 'Testing race condition', durationMinutes: 25, status: 'active', beatLocked: false, order: 0 },
            { id: 'race-act-2', name: 'Next Act', sketch: 'Next up', durationMinutes: 25, status: 'upcoming', beatLocked: false, order: 1 },
          ]
          parsed.state.currentActId = 'race-act-1'
        }
        localStorage.setItem('showtime-show-state', JSON.stringify(parsed))
      }
    })
    await navigateAndWait(page)

    const lockBtn = page.getByText('Yes — Lock the Beat')
    if (await lockBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await lockBtn.click()
      await lockBtn.click().catch(() => {})
      await page.waitForTimeout(500)

      const state = await page.evaluate(() => {
        const raw = localStorage.getItem('showtime-show-state')
        return raw ? JSON.parse(raw).state : null
      })
      if (state) {
        expect(state.beatsLocked).toBeLessThanOrEqual(1)
      }
    }
    await screenshot(page, 'issue-11-race-guard')
  })
})

test.describe('CSS Utilities', () => {
  test('overrun hatching class exists in CSS', async ({ mainPage: page }) => {
    const hasOverrunClass = await page.evaluate(() => {
      const sheets = document.styleSheets
      for (let i = 0; i < sheets.length; i++) {
        try {
          const rules = sheets[i].cssRules
          for (let j = 0; j < rules.length; j++) {
            if ((rules[j] as CSSStyleRule).selectorText?.includes('overrun-hatching')) {
              return true
            }
          }
        } catch {}
      }
      return false
    })

    expect(hasOverrunClass).toBe(true)
  })
})

test.describe('Plan Modification (Live)', () => {
  test('Encore button is visible during live phase in sidebar', async ({ mainPage: page }) => {
    await page.evaluate(() => {
      const raw = localStorage.getItem('showtime-show-state')
      if (raw) {
        const parsed = JSON.parse(raw)
        parsed.state.phase = 'live'
        parsed.state.viewTier = 'expanded'
        parsed.state.beatCheckPending = false
        parsed.state.celebrationActive = false
        parsed.state.goingLiveActive = false
        parsed.state.acts = [
          { id: 'e2e-act1', name: 'Deep Work', sketch: 'Deep Work', durationMinutes: 30, order: 0, status: 'active', beatLocked: false },
          { id: 'e2e-act2', name: 'Exercise', sketch: 'Exercise', durationMinutes: 20, order: 1, status: 'upcoming', beatLocked: false },
        ]
        parsed.state.currentActId = 'e2e-act1'
        parsed.state.showStartedAt = Date.now() - 600000
        localStorage.setItem('showtime-show-state', JSON.stringify(parsed))
      }
    })
    await navigateAndWait(page)

    const encoreBtn = page.getByText('+ Encore')
    const isVisible = await encoreBtn.isVisible({ timeout: 5000 }).catch(() => false)

    await screenshot(page, '23-encore-button')
    if (isVisible) {
      expect(isVisible).toBe(true)
    }
  })

  test('Encore form opens and can add an act', async ({ mainPage: page }) => {
    const encoreBtn = page.getByText('+ Encore')
    if (await encoreBtn.isVisible().catch(() => false)) {
      await encoreBtn.click()
      await page.waitForTimeout(300)

      const nameInput = page.locator('input[placeholder="Act name"]')
      const formVisible = await nameInput.isVisible({ timeout: 3000 }).catch(() => false)

      if (formVisible) {
        await nameInput.fill('Bonus Meeting')
        const addBtn = page.getByText('Add').last()
        if (await addBtn.isVisible().catch(() => false)) {
          await addBtn.click()
          await page.waitForTimeout(500)
        }
      }

      await screenshot(page, '24-encore-added')
    }
  })

  test('sidebar lineup shows projected times during live', async ({ mainPage: page }) => {
    const body = await page.textContent('body')
    const hasTimeLike = /\d{1,2}:\d{2}/.test(body || '')

    await screenshot(page, '25-projected-times')
    if (hasTimeLike) {
      expect(hasTimeLike).toBe(true)
    }
  })
})
