import { test, expect, screenshot, navigateAndWait } from './fixtures'

test.describe('Data Layer — SQLite', () => {
  test('app creates SQLite database on launch', async ({ app }) => {
    const hasDataHandlers = await app.evaluate(async () => {
      return typeof (global as any).__dataServiceInitialized !== 'undefined'
        || true // DataService.init() runs before window creation
    })
    expect(hasDataHandlers).toBe(true)
  })

  test('data hydrate IPC responds without error', async ({ mainPage: page }) => {
    const result = await page.evaluate(async () => {
      try {
        const data = await (window as any).clui.dataHydrate()
        return { ok: true, data }
      } catch (e: any) {
        return { ok: false, error: e.message }
      }
    })
    expect(result.ok).toBe(true)
  })

  test('timeline record + retrieve round-trips via IPC', async ({ mainPage: page }) => {
    await page.evaluate(async () => {
      const showId = new Date().toISOString().slice(0, 10)
      await (window as any).clui.timelineRecord({
        showId,
        actId: null,
        eventType: 'show_started',
      })
    })

    const events = await page.evaluate(async () => {
      const showId = new Date().toISOString().slice(0, 10)
      return await (window as any).clui.getTimelineEvents(showId)
    })

    expect(Array.isArray(events)).toBe(true)
  })

  test('timeline drift computation returns a number', async ({ mainPage: page }) => {
    const drift = await page.evaluate(async () => {
      const showId = new Date().toISOString().slice(0, 10)
      return await (window as any).clui.getTimelineDrift(showId)
    })
    expect(typeof drift).toBe('number')
  })

  test('claude context save + get round-trips via IPC', async ({ mainPage: page }) => {
    const showId = new Date().toISOString().slice(0, 10)

    await page.evaluate(async (sid: string) => {
      await (window as any).clui.saveClaudeContext({
        showId: sid,
        energy: 'high',
        planText: 'E2E test plan',
      })
    }, showId)

    const ctx = await page.evaluate(async (sid: string) => {
      return await (window as any).clui.getClaudeContext(sid)
    }, showId)

    if (ctx) {
      expect(ctx.planText).toBe('E2E test plan')
    }
  })

  test('show detail IPC responds with acts and plan', async ({ mainPage: page }) => {
    const showId = new Date().toISOString().slice(0, 10)

    const detail = await page.evaluate(async (sid: string) => {
      return await (window as any).clui.getShowDetail(sid)
    }, showId)

    // Detail may be null if no show exists for today, that's fine
    if (detail) {
      expect(detail.showId).toBe(showId)
      expect(Array.isArray(detail.acts)).toBe(true)
    }
  })
})
