import { test, expect, screenshot } from './fixtures'

/**
 * Seed machine state in the exact format that getPersistedSnapshot() reads:
 * { stateValue, context, version: 3 (PERSIST_VERSION), savedAt }
 */
async function seedMachineState(page: import('@playwright/test').Page, opts: {
  stateValue: Record<string, unknown>
  context: Record<string, unknown>
}) {
  await page.evaluate(({ stateValue, context }) => {
    const d = new Date()
    const localDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

    const fullContext = {
      energy: 'high',
      acts: [],
      currentActId: null,
      beatsLocked: 0,
      beatThreshold: 3,
      timerEndAt: null,
      timerPausedRemaining: null,
      showDate: localDate,
      showStartedAt: Date.now() - 600000,
      verdict: null,
      viewTier: 'expanded',
      writersRoomStep: 'energy',
      writersRoomEnteredAt: null,
      breathingPauseEndAt: null,
      lineupStatus: 'confirmed',
      editingMidShow: false,
      beatCheckPending: false,
      celebrationActive: false,
      ...context,
    }
    localStorage.setItem(
      'showtime-show-state',
      JSON.stringify({ stateValue, context: fullContext, version: 3, savedAt: Date.now() })
    )
    localStorage.setItem('showtime-onboarding-complete', 'true')
  }, opts)

  await page.reload({ waitUntil: 'commit', timeout: 10000 })
  await page.waitForSelector('#root > *', { timeout: 10000 }).catch(() => {})
}

const STANDARD_ACTS = [
  { id: 'fuse-act-1', name: 'Deep Work', sketch: 'Deep Work', durationMinutes: 45, order: 0, status: 'active', beatLocked: false, startedAt: Date.now() - 600000 },
  { id: 'fuse-act-2', name: 'Exercise', sketch: 'Exercise', durationMinutes: 25, order: 1, status: 'upcoming', beatLocked: false },
]

test.describe('Burning Fuse Progress Bar', () => {
  test('fuse renders in expanded view during live phase', async ({ mainPage: page }) => {
    await seedMachineState(page, {
      stateValue: { phase: { live: 'act_active' }, animation: 'idle', overlay: 'none' },
      context: {
        acts: STANDARD_ACTS,
        currentActId: 'fuse-act-1',
        viewTier: 'expanded',
        timerEndAt: Date.now() + 35 * 60 * 1000,
      },
    })

    const fuse = page.locator('[data-testid="burning-fuse"]')
    await expect(fuse).toBeVisible({ timeout: 5000 })
    expect(await fuse.getAttribute('data-fuse-size')).toBe('expanded')
    expect(await fuse.getAttribute('data-fuse-phase')).toBe('normal')

    await screenshot(page, 'fuse-expanded-normal')
  })

  test('fuse renders in pill view during live phase', async ({ mainPage: page }) => {
    await seedMachineState(page, {
      stateValue: { phase: { live: 'act_active' }, animation: 'idle', overlay: 'none' },
      context: {
        acts: STANDARD_ACTS,
        currentActId: 'fuse-act-1',
        viewTier: 'micro',
        timerEndAt: Date.now() + 35 * 60 * 1000,
      },
    })

    const fuse = page.locator('[data-testid="burning-fuse"]')
    await expect(fuse).toBeVisible({ timeout: 5000 })
    expect(await fuse.getAttribute('data-fuse-size')).toBe('pill')

    await screenshot(page, 'fuse-pill-normal')
  })

  test('fuse shows warning phase when 15-30% remaining', async ({ mainPage: page }) => {
    // 45 min act, 9 min remaining = 20% remaining = warning
    await seedMachineState(page, {
      stateValue: { phase: { live: 'act_active' }, animation: 'idle', overlay: 'none' },
      context: {
        acts: STANDARD_ACTS,
        currentActId: 'fuse-act-1',
        viewTier: 'expanded',
        timerEndAt: Date.now() + 9 * 60 * 1000,
      },
    })

    const fuse = page.locator('[data-testid="burning-fuse"]')
    await expect(fuse).toBeVisible({ timeout: 5000 })
    expect(await fuse.getAttribute('data-fuse-phase')).toBe('warning')

    await screenshot(page, 'fuse-expanded-warning')
  })

  test('fuse shows critical phase with particles when <15% remaining', async ({ mainPage: page }) => {
    // 45 min act, 3 min remaining = ~7% remaining = critical
    await seedMachineState(page, {
      stateValue: { phase: { live: 'act_active' }, animation: 'idle', overlay: 'none' },
      context: {
        acts: STANDARD_ACTS,
        currentActId: 'fuse-act-1',
        viewTier: 'expanded',
        timerEndAt: Date.now() + 3 * 60 * 1000,
      },
    })

    const fuse = page.locator('[data-testid="burning-fuse"]')
    await expect(fuse).toBeVisible({ timeout: 5000 })
    expect(await fuse.getAttribute('data-fuse-phase')).toBe('critical')

    // Expanded view has 3 trail particles
    const particles = page.locator('[data-testid="burning-fuse"] .fuse-particle')
    const count = await particles.count()
    expect(count).toBe(3)

    await screenshot(page, 'fuse-expanded-critical')
  })

  test('ember point visible with wobble animation', async ({ mainPage: page }) => {
    await seedMachineState(page, {
      stateValue: { phase: { live: 'act_active' }, animation: 'idle', overlay: 'none' },
      context: {
        acts: STANDARD_ACTS,
        currentActId: 'fuse-act-1',
        viewTier: 'expanded',
        timerEndAt: Date.now() + 20 * 60 * 1000,
      },
    })

    const ember = page.locator('[data-testid="burning-fuse"] .fuse-ember-point')
    await expect(ember).toBeVisible({ timeout: 5000 })

    await screenshot(page, 'fuse-ember-visible')
  })

  test('fuse not visible during intermission', async ({ mainPage: page }) => {
    await seedMachineState(page, {
      stateValue: { phase: { intermission: 'resting' }, animation: 'idle', overlay: 'none' },
      context: {
        acts: STANDARD_ACTS,
        currentActId: 'fuse-act-1',
        viewTier: 'expanded',
        timerEndAt: null,
      },
    })

    const fuse = page.locator('[data-testid="burning-fuse"]')
    const count = await fuse.count()
    expect(count).toBe(0)

    await screenshot(page, 'fuse-intermission-absent')
  })
})
