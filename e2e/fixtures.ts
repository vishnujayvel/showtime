/**
 * Shared Playwright fixtures for Electron E2E tests.
 * Launches the app once per worker and shares it across all test files.
 */
import { test as base, _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import path from 'path'
import os from 'os'
import fs from 'fs'

type ElectronFixtures = {
  app: ElectronApplication
  mainPage: Page
}

export const test = base.extend<{}, ElectronFixtures>({
  app: [async ({}, use, testInfo) => {
    const userDataDir = path.join(os.tmpdir(), `showtime-test-${testInfo.workerIndex}`)
    const app = await electron.launch({
      args: [path.join(__dirname, '..', 'dist', 'main', 'index.js')],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        SHOWTIME_USER_DATA: userDataDir,
        // Position test window on secondary display (beyond primary screen width)
        SHOWTIME_TEST_X: '2000',
        SHOWTIME_TEST_Y: '200',
      },
      timeout: 30000,
    })

    const page = await app.firstWindow()
    // Move test window to secondary display so it doesn't pop up on primary screen
    const bw = await app.browserWindow(page)
    await bw.evaluate((win) => win.setPosition(2000, 200))
    await page.waitForSelector('div', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(3000)

    // Clear persisted show state so tests start from no_show phase
    await page.evaluate(() => {
      localStorage.removeItem('showtime-show-state')
      localStorage.setItem('showtime-onboarding-complete', 'true')
    })
    await navigateAndWaitPage(page)

    await use(app)

    const pid = app.process().pid
    await app.close().catch(() => {})
    if (pid) {
      try { process.kill(pid, 'SIGKILL') } catch {}
    }
    // Clean up isolated userData directory for this worker
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true })
    } catch {}
  }, { scope: 'worker' }],

  mainPage: [async ({ app }, use) => {
    const page = await app.firstWindow()
    await use(page)
  }, { scope: 'worker' }],
})

export { expect } from '@playwright/test'

// ─── Standard Act Sets ───

const STANDARD_ACTS = [
  { id: 'fix-act-1', name: 'Deep Work Session', sketch: 'Deep Work', durationMinutes: 45, order: 0, status: 'active', beatLocked: false },
  { id: 'fix-act-2', name: 'Exercise Break', sketch: 'Exercise', durationMinutes: 25, order: 1, status: 'upcoming', beatLocked: false },
  { id: 'fix-act-3', name: 'Email & Slack', sketch: 'Admin', durationMinutes: 20, order: 2, status: 'upcoming', beatLocked: false },
]

const FIVE_ACTS = [
  { id: 'fix-act-1', name: 'Deep Work Session', sketch: 'Deep Work', durationMinutes: 45, order: 0, status: 'active', beatLocked: false },
  { id: 'fix-act-2', name: 'Exercise Break', sketch: 'Exercise', durationMinutes: 25, order: 1, status: 'upcoming', beatLocked: false },
  { id: 'fix-act-3', name: 'Email & Slack', sketch: 'Admin', durationMinutes: 20, order: 2, status: 'upcoming', beatLocked: false },
  { id: 'fix-act-4', name: 'Creative Writing', sketch: 'Creative', durationMinutes: 30, order: 3, status: 'upcoming', beatLocked: false },
  { id: 'fix-act-5', name: 'Coffee with Sam', sketch: 'Social', durationMinutes: 15, order: 4, status: 'upcoming', beatLocked: false },
]

const COMPLETED_ACTS = [
  { id: 'fix-act-1', name: 'Deep Work Session', sketch: 'Deep Work', durationMinutes: 45, order: 0, status: 'completed', beatLocked: true, startedAt: Date.now() - 3600000, completedAt: Date.now() - 900000 },
  { id: 'fix-act-2', name: 'Exercise Break', sketch: 'Exercise', durationMinutes: 25, order: 1, status: 'completed', beatLocked: true, startedAt: Date.now() - 900000, completedAt: Date.now() - 300000 },
  { id: 'fix-act-3', name: 'Email & Slack', sketch: 'Admin', durationMinutes: 20, order: 2, status: 'completed', beatLocked: false, startedAt: Date.now() - 300000, completedAt: Date.now() - 60000 },
]

// ─── Canonical State Fixtures ───

export const FIXTURES = {
  // Dark Studio
  darkStudio: {
    phase: 'no_show', viewTier: 'expanded',
    acts: [], currentActId: null, beatsLocked: 0, beatThreshold: 3,
    verdict: null, showStartedAt: null,
    goingLiveActive: false, coldOpenActive: false, beatCheckPending: false, celebrationActive: false,
  },

  // Writer's Room steps
  writersRoom_energy: {
    phase: 'writers_room', writersRoomStep: 'energy', energy: null, viewTier: 'expanded',
    acts: [], goingLiveActive: false, beatCheckPending: false, celebrationActive: false,
  },
  writersRoom_plan: {
    phase: 'writers_room', writersRoomStep: 'plan', energy: 'high', viewTier: 'expanded',
    goingLiveActive: false, beatCheckPending: false, celebrationActive: false,
  },
  writersRoom_lineup: {
    phase: 'writers_room', writersRoomStep: 'lineup', energy: 'high', viewTier: 'expanded',
    acts: STANDARD_ACTS, goingLiveActive: false, beatCheckPending: false, celebrationActive: false,
  },

  // Live — each view tier
  live_expanded: {
    phase: 'live', viewTier: 'expanded',
    acts: STANDARD_ACTS, currentActId: 'fix-act-1',
    showStartedAt: Date.now() - 600000, beatsLocked: 0, beatThreshold: 3,
    goingLiveActive: false, beatCheckPending: false, celebrationActive: false,
  },
  live_micro: {
    phase: 'live', viewTier: 'micro',
    acts: STANDARD_ACTS, currentActId: 'fix-act-1',
    showStartedAt: Date.now() - 600000, beatsLocked: 0, beatThreshold: 3,
    goingLiveActive: false, beatCheckPending: false, celebrationActive: false,
  },
  live_compact: {
    phase: 'live', viewTier: 'compact',
    acts: STANDARD_ACTS, currentActId: 'fix-act-1',
    showStartedAt: Date.now() - 600000, beatsLocked: 0, beatThreshold: 3,
    goingLiveActive: false, beatCheckPending: false, celebrationActive: false,
  },
  live_dashboard: {
    phase: 'live', viewTier: 'dashboard',
    acts: FIVE_ACTS, currentActId: 'fix-act-1',
    showStartedAt: Date.now() - 600000, beatsLocked: 1, beatThreshold: 3,
    goingLiveActive: false, beatCheckPending: false, celebrationActive: false,
  },

  // Intermission
  intermission: {
    phase: 'intermission', viewTier: 'expanded',
    acts: STANDARD_ACTS, currentActId: 'fix-act-1',
    showStartedAt: Date.now() - 1800000, beatsLocked: 1, beatThreshold: 3,
    goingLiveActive: false, beatCheckPending: false, celebrationActive: false,
  },

  // Strike verdicts
  strike_dayWon: {
    phase: 'strike', viewTier: 'expanded', verdict: 'DAY_WON',
    acts: COMPLETED_ACTS, beatsLocked: 3, beatThreshold: 3,
    showStartedAt: Date.now() - 7200000,
    goingLiveActive: false, beatCheckPending: false, celebrationActive: false,
  },
  strike_solidShow: {
    phase: 'strike', viewTier: 'expanded', verdict: 'SOLID_SHOW',
    acts: COMPLETED_ACTS, beatsLocked: 2, beatThreshold: 3,
    showStartedAt: Date.now() - 7200000,
    goingLiveActive: false, beatCheckPending: false, celebrationActive: false,
  },
  strike_goodEffort: {
    phase: 'strike', viewTier: 'expanded', verdict: 'GOOD_EFFORT',
    acts: COMPLETED_ACTS, beatsLocked: 1, beatThreshold: 3,
    showStartedAt: Date.now() - 7200000,
    goingLiveActive: false, beatCheckPending: false, celebrationActive: false,
  },
  strike_calledEarly: {
    phase: 'strike', viewTier: 'expanded', verdict: 'SHOW_CALLED_EARLY',
    acts: [
      { ...STANDARD_ACTS[0], status: 'completed', beatLocked: true, startedAt: Date.now() - 3600000, completedAt: Date.now() - 1800000 },
      STANDARD_ACTS[1],
      STANDARD_ACTS[2],
    ],
    beatsLocked: 1, beatThreshold: 3,
    showStartedAt: Date.now() - 3600000,
    goingLiveActive: false, beatCheckPending: false, celebrationActive: false,
  },
} as const

// ─── Expected Window Dimensions (matches main/window.ts VIEW_DIMENSIONS) ───

export const VIEW_DIMENSIONS: Record<string, { width: number; height: number }> = {
  pill: { width: 320, height: 64 },
  compact: { width: 340, height: 140 },
  dashboard: { width: 400, height: 320 },
  expanded: { width: 560, height: 620 },
  full: { width: 560, height: 740 },
}

/** Take screenshot without waiting for web fonts */
export async function screenshot(page: Page, name: string) {
  try {
    await page.screenshot({ path: `e2e/screenshots/${name}.png`, timeout: 5000 })
  } catch {}
}

/** Navigate without waiting for full "load" (hangs on font loading) */
export async function navigateAndWait(page: Page) {
  await navigateAndWaitPage(page)
}

async function navigateAndWaitPage(page: Page) {
  const url = page.url()
  await page.goto(url, { waitUntil: 'commit', timeout: 10000 })
  await page.waitForTimeout(3000)
}

/** Set show state via localStorage manipulation and reload */
export async function setShowState(page: Page, stateOverrides: Record<string, unknown>) {
  await page.evaluate((overrides) => {
    const raw = localStorage.getItem('showtime-show-state')
    if (raw) {
      const parsed = JSON.parse(raw)
      Object.assign(parsed.state, overrides)
      localStorage.setItem('showtime-show-state', JSON.stringify(parsed))
    }
  }, stateOverrides)
  await navigateAndWaitPage(page)
}

/**
 * Seed a complete state from a FIXTURES entry (creates state from scratch).
 * Unlike setShowState which merges, this replaces the entire state.
 */
export async function seedFixture(page: Page, fixture: Readonly<Record<string, unknown>>) {
  await page.evaluate((state) => {
    const fullState = {
      state: {
        phase: 'no_show',
        energy: null,
        acts: [],
        currentActId: null,
        beatsLocked: 0,
        beatThreshold: 3,
        timerEndAt: null,
        timerPausedRemaining: null,
        showDate: new Date().toISOString().slice(0, 10),
        showStartedAt: null,
        verdict: null,
        viewTier: 'expanded',
        writersRoomStep: 'energy',
        writersRoomEnteredAt: null,
        breathingPauseEndAt: null,
        claudeSessionId: null,
        coldOpenActive: false,
        goingLiveActive: false,
        beatCheckPending: false,
        celebrationActive: false,
        ...state,
      },
      version: 0,
    }
    localStorage.setItem('showtime-show-state', JSON.stringify(fullState))
    localStorage.setItem('showtime-onboarding-complete', 'true')
  }, fixture)
  await navigateAndWaitPage(page)
}

/**
 * Seed state with a mocked clock hour. Installs an addInitScript that overrides
 * Date.prototype.getHours before React boots, then seeds state and navigates.
 */
export async function seedWithMockHour(page: Page, fixture: Record<string, unknown>, mockHour: number) {
  // Set mock hour flag in localStorage (read by init script on next navigation)
  await page.evaluate(({ state, hour }) => {
    localStorage.setItem('__test_mock_hour', String(hour))

    const fullState = {
      state: {
        phase: 'no_show',
        energy: null,
        acts: [],
        currentActId: null,
        beatsLocked: 0,
        beatThreshold: 3,
        timerEndAt: null,
        timerPausedRemaining: null,
        showDate: new Date().toISOString().slice(0, 10),
        showStartedAt: null,
        verdict: null,
        viewTier: 'expanded',
        writersRoomStep: 'energy',
        writersRoomEnteredAt: null,
        breathingPauseEndAt: null,
        claudeSessionId: null,
        coldOpenActive: false,
        goingLiveActive: false,
        beatCheckPending: false,
        celebrationActive: false,
        ...state,
      },
      version: 0,
    }
    localStorage.setItem('showtime-show-state', JSON.stringify(fullState))
    localStorage.setItem('showtime-onboarding-complete', 'true')
  }, { state: fixture, hour: mockHour })
  await navigateAndWaitPage(page)
}

/**
 * Install the mock-hour init script on the page.
 * Must be called once before using seedWithMockHour (typically in beforeAll).
 * The init script checks localStorage for __test_mock_hour and patches Date.prototype.getHours.
 */
export async function installMockHourScript(page: Page) {
  await page.addInitScript(() => {
    const hourStr = localStorage.getItem('__test_mock_hour')
    if (hourStr !== null) {
      const hour = parseInt(hourStr, 10)
      if (!isNaN(hour)) {
        Date.prototype.getHours = function () { return hour }
      }
    }
  })
}

/**
 * Clear the mock hour so subsequent tests aren't affected.
 */
export async function clearMockHour(page: Page) {
  await page.evaluate(() => {
    localStorage.removeItem('__test_mock_hour')
  })
}
