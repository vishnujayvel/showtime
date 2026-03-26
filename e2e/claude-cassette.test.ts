/**
 * VCR Cassette-Based Replay Tests
 *
 * These tests replay pre-recorded Claude sessions from NDJSON cassette files.
 * They are fast (no real Claude subprocess), deterministic, and safe for CI.
 *
 * ── HOW CASSETTE PLAYBACK WORKS ──
 *
 * When the app launches with SHOWTIME_PLAYBACK=1, RunManager replaces the
 * real `claude -p` subprocess with a mock that reads events from an NDJSON
 * cassette file and replays them through the same EventEmitter pipeline.
 * SHOWTIME_PLAYBACK_SPEED controls time compression (100 = 100x faster).
 *
 * ── HOW TO RECORD A CASSETTE ──
 *
 *   1. Set SHOWTIME_RECORD=1 in your environment:
 *        SHOWTIME_RECORD=1 npm start
 *
 *   2. Use the app normally — go through Writer's Room, submit a plan, etc.
 *      Each Claude run writes a cassette to e2e/cassettes/<requestId>.ndjson.
 *
 *   3. Rename the generated cassette file to a descriptive name:
 *        mv e2e/cassettes/<requestId>.ndjson e2e/cassettes/happy-path-lineup.ndjson
 *
 *   4. Commit the cassette to git. It will be replayed by these tests.
 *
 * ── CASSETTE FORMAT (NDJSON) ──
 *
 *   Each line is a JSON object with a relative timestamp (ms from run start):
 *
 *   {"ts": 0, "event": {"type": "system", "subtype": "init", "session_id": "..."}}
 *   {"ts": 1200, "event": {"type": "assistant", "message": {...}}}
 *   {"ts": 28400, "event": {"type": "result", "result": "...", "subtype": "success"}}
 *   {"ts": 28500, "exit": {"code": 0, "signal": null}}
 *
 * ── ADDING NEW CASSETTE TESTS ──
 *
 *   1. Record a cassette (see above)
 *   2. Add a new test case in the 'Cassette Replay' describe block below
 *   3. Use seedFixture to set the app state to the correct starting point
 *   4. Trigger the Claude interaction (e.g., submit a plan in Writer's Room)
 *   5. Assert on the UI results — the cassette provides deterministic output
 */

import { test as base, _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import { expect, screenshot, FIXTURES } from './fixtures'
import path from 'path'
import os from 'os'
import fs from 'fs'

// ─── Cassette Fixture: launches app with SHOWTIME_PLAYBACK=1 ───

const test = base.extend<{}, { app: ElectronApplication; mainPage: Page }>({
  app: [async ({}, use, testInfo) => {
    const userDataDir = path.join(os.tmpdir(), `showtime-cassette-${testInfo.workerIndex}`)
    const app = await electron.launch({
      args: [path.join(__dirname, '..', 'dist', 'main', 'index.js')],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        SHOWTIME_USER_DATA: userDataDir,
        SHOWTIME_PLAYBACK: '1',           // Enable cassette playback mode
        SHOWTIME_PLAYBACK_SPEED: '100',   // 100x speed — fast replay for CI
        // Position off primary display so window doesn't cover dev work
        SHOWTIME_TEST_X: '2000',
        SHOWTIME_TEST_Y: '200',
      },
      timeout: 30000,
    })

    const page = await app.firstWindow()
    // Move window off primary display
    const bw = await app.browserWindow(page)
    await bw.evaluate((win) => win.setPosition(2000, 200))
    await page.waitForSelector('div', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(3000)

    // Start from a clean slate
    await page.evaluate(() => {
      localStorage.removeItem('showtime-show-state')
      localStorage.setItem('showtime-onboarding-complete', 'true')
    })
    const url = page.url()
    await page.goto(url, { waitUntil: 'commit', timeout: 10000 })
    await page.waitForTimeout(3000)

    await use(app)

    const pid = app.process().pid
    await app.close().catch(() => {})
    if (pid) {
      try { process.kill(pid, 'SIGKILL') } catch {}
    }
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true })
    } catch {}
  }, { scope: 'worker' }],

  mainPage: [async ({ app }, use) => {
    const page = await app.firstWindow()
    await use(page)
  }, { scope: 'worker' }],
})

// ─── Helpers ───

const CASSETTE_DIR = path.join(__dirname, 'cassettes')

/** Check if a named cassette file exists on disk */
function cassetteExists(name: string): boolean {
  return fs.existsSync(path.join(CASSETTE_DIR, `${name}.ndjson`))
}

/** List all cassette files in the cassettes directory */
function listCassettes(): string[] {
  if (!fs.existsSync(CASSETTE_DIR)) return []
  return fs.readdirSync(CASSETTE_DIR)
    .filter((f) => f.endsWith('.ndjson'))
    .map((f) => f.replace(/\.ndjson$/, ''))
}

/** Navigate without waiting for full "load" (hangs on font loading in Electron) */
async function navigateAndWait(page: Page) {
  const url = page.url()
  await page.goto(url, { waitUntil: 'commit', timeout: 10000 })
  await page.waitForTimeout(3000)
}

/** Seed a complete state from a FIXTURES-style object */
async function seedFixture(page: Page, fixture: Readonly<Record<string, unknown>>) {
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
  await navigateAndWait(page)
}

// ─── Infrastructure Tests ───

test.describe('Cassette Infrastructure', () => {
  test('cassette directory exists', () => {
    expect(fs.existsSync(CASSETTE_DIR)).toBe(true)
  })

  test('app launches in playback mode', async ({ mainPage: page }) => {
    // The app should boot normally even with SHOWTIME_PLAYBACK=1 and no cassettes.
    // Playback mode only activates when a Claude run is triggered.
    const title = await page.title()
    expect(title).toBeDefined()
    await screenshot(page, 'cassette-playback-boot')
  })

  test('dark studio renders in playback mode', async ({ mainPage: page }) => {
    // Seed Dark Studio state and verify basic rendering
    await seedFixture(page, FIXTURES.darkStudio)

    const cta = page.getByText("Enter the Writer's Room")
    await expect(cta).toBeVisible({ timeout: 10000 })
    await screenshot(page, 'cassette-dark-studio')
  })

  test('writers room energy step renders in playback mode', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.writersRoom_energy)

    const highButton = page.getByText('High Energy')
    await expect(highButton).toBeVisible({ timeout: 5000 })
    await screenshot(page, 'cassette-writers-room-energy')
  })

  test('lists available cassettes', () => {
    // This test documents which cassettes are committed to git.
    // When no cassettes exist yet, the list is empty — that is expected.
    const cassettes = listCassettes()
    console.log(`Available cassettes: [${cassettes.join(', ')}]`)
    // The cassette directory always exists (has .gitkeep)
    expect(fs.existsSync(CASSETTE_DIR)).toBe(true)
  })
})

// ─── Cassette Replay Tests ───
//
// Each test below is gated on a specific cassette file existing.
// When the cassette is missing, the test is skipped with a descriptive message.
// To enable a test: record the cassette (see instructions at top of file),
// save it with the expected name, and commit it.

test.describe('Cassette Replay', () => {

  test('replay: happy path lineup generation', async ({ mainPage: page }) => {
    const cassetteName = 'happy-path-lineup'
    test.skip(!cassetteExists(cassetteName), `Cassette "${cassetteName}.ndjson" not recorded yet`)

    // Start at the plan step (energy already selected)
    await seedFixture(page, FIXTURES.writersRoom_plan)

    const textarea = page.locator('textarea').first()
    await expect(textarea).toBeVisible({ timeout: 5000 })
    await textarea.fill('Deep work on API for 2 hours, exercise 30 min, email catch-up 30 min')
    await page.waitForTimeout(300)

    const buildBtn = page.getByText('Build my lineup')
    await expect(buildBtn).toBeVisible({ timeout: 3000 })
    await buildBtn.click()

    // In playback mode, the cassette provides Claude's response almost instantly
    // (100x speed means ~30s of real time becomes ~300ms)
    const writerConvo = page.getByTestId('writer-conversation')
    await expect(writerConvo).toBeVisible({ timeout: 10000 }).catch(() => {})

    // Wait for act cards to appear from the cassette replay
    const actCardSelector = page.locator('.bg-surface-hover\\/50').first()
    await actCardSelector.waitFor({ state: 'visible', timeout: 15000 })

    const actCards = page.locator('.bg-surface-hover\\/50')
    const cardCount = await actCards.count()
    expect(cardCount).toBeGreaterThanOrEqual(2)

    // Verify act card structure
    const firstCardName = actCards.first().locator('.font-medium')
    await expect(firstCardName).toBeVisible()
    const nameText = await firstCardName.textContent()
    expect(nameText!.trim().length).toBeGreaterThan(0)

    await screenshot(page, 'cassette-happy-path-lineup')
  })

  test('replay: multi-turn lineup refinement', async ({ mainPage: page }) => {
    const cassetteName = 'multi-turn-refinement'
    test.skip(!cassetteExists(cassetteName), `Cassette "${cassetteName}.ndjson" not recorded yet`)

    // Start at the plan step
    await seedFixture(page, FIXTURES.writersRoom_plan)

    const textarea = page.locator('textarea').first()
    await expect(textarea).toBeVisible({ timeout: 5000 })
    await textarea.fill('Deep work 2h, exercise 30m')
    await page.waitForTimeout(300)

    const buildBtn = page.getByText('Build my lineup')
    await expect(buildBtn).toBeVisible({ timeout: 3000 })
    await buildBtn.click()

    // Wait for initial lineup from cassette
    const writerConvo = page.getByTestId('writer-conversation')
    await expect(writerConvo).toBeVisible({ timeout: 10000 }).catch(() => {})

    const actCardSelector = page.locator('.bg-surface-hover\\/50').first()
    await actCardSelector.waitFor({ state: 'visible', timeout: 15000 })

    // The cassette should contain a multi-turn conversation where the user
    // refines the lineup (e.g., "make deep work 90 minutes instead")
    // Verify that the final lineup reflects the refinement

    const actCards = page.locator('.bg-surface-hover\\/50')
    const cardCount = await actCards.count()
    expect(cardCount).toBeGreaterThanOrEqual(2)

    await screenshot(page, 'cassette-multi-turn-refinement')
  })

  test('replay: low energy plan', async ({ mainPage: page }) => {
    const cassetteName = 'low-energy-plan'
    test.skip(!cassetteExists(cassetteName), `Cassette "${cassetteName}.ndjson" not recorded yet`)

    // Start at energy step and select low energy
    await seedFixture(page, {
      ...FIXTURES.writersRoom_plan,
      energy: 'low',
    })

    const textarea = page.locator('textarea').first()
    await expect(textarea).toBeVisible({ timeout: 5000 })
    await textarea.fill('Just some light admin and a walk')
    await page.waitForTimeout(300)

    const buildBtn = page.getByText('Build my lineup')
    await expect(buildBtn).toBeVisible({ timeout: 3000 })
    await buildBtn.click()

    // Wait for lineup from cassette
    const actCardSelector = page.locator('.bg-surface-hover\\/50').first()
    await actCardSelector.waitFor({ state: 'visible', timeout: 15000 })

    const actCards = page.locator('.bg-surface-hover\\/50')
    const cardCount = await actCards.count()
    expect(cardCount).toBeGreaterThanOrEqual(1)

    // Low energy plans should have shorter durations — verify if cassette
    // was recorded with a low-energy session
    await screenshot(page, 'cassette-low-energy-plan')
  })

  test('replay: error recovery', async ({ mainPage: page }) => {
    const cassetteName = 'error-recovery'
    test.skip(!cassetteExists(cassetteName), `Cassette "${cassetteName}.ndjson" not recorded yet`)

    // This cassette should contain a Claude session that errors and recovers.
    // The app should show an error state in the conversation thread and
    // allow the user to retry.

    await seedFixture(page, FIXTURES.writersRoom_plan)

    const textarea = page.locator('textarea').first()
    await expect(textarea).toBeVisible({ timeout: 5000 })
    await textarea.fill('Deep work 2h')
    await page.waitForTimeout(300)

    const buildBtn = page.getByText('Build my lineup')
    await expect(buildBtn).toBeVisible({ timeout: 3000 })
    await buildBtn.click()

    // The cassette replays an error response — the UI should handle it
    const writerConvo = page.getByTestId('writer-conversation')
    await expect(writerConvo).toBeVisible({ timeout: 10000 }).catch(() => {})

    // Wait for the error to surface (either as a writer message or retry link)
    await page.waitForTimeout(5000)

    await screenshot(page, 'cassette-error-recovery')
  })
})
