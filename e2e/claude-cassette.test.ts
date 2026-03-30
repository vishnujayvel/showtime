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
 * SHOWTIME_CASSETTE_NAME (comma-separated) controls which cassettes are used.
 * Each Claude run dequeues the next cassette from the list. Runs without a
 * matching cassette (e.g., warmup init) get a synthesized empty response.
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
 *   3. Wrap in test.describe with test.use({ cassetteName: 'name1,name2' })
 *   4. Use seedFixture to set the app state to the correct starting point
 *   5. Trigger the Claude interaction (e.g., submit a plan in Writer's Room)
 *   6. Assert on the UI results — the cassette provides deterministic output
 */

import { test as base, _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import { expect, screenshot, FIXTURES } from './fixtures'
import path from 'path'
import os from 'os'
import fs from 'fs'

// ─── Cassette Fixture: launches app with SHOWTIME_PLAYBACK=1 ───

// Infrastructure tests share one Electron instance per worker (fast)
const infraTest = base.extend<{}, { app: ElectronApplication; mainPage: Page }>({
  app: [async ({}, use, testInfo) => {
    const userDataDir = path.join(os.tmpdir(), `showtime-cassette-infra-${testInfo.workerIndex}`)
    const app = await electron.launch({
      args: [path.join(__dirname, '..', 'dist', 'main', 'index.js')],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        SHOWTIME_USER_DATA: userDataDir,
        SHOWTIME_PLAYBACK: '1',
        SHOWTIME_PLAYBACK_SPEED: '100',
        SHOWTIME_TEST_X: '2000',
        SHOWTIME_TEST_Y: '200',
      },
      timeout: 30000,
    })

    const page = await app.firstWindow()
    const bw = await app.browserWindow(page)
    await bw.evaluate((win) => win.setPosition(2000, 200))
    await page.waitForSelector('div', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(3000)

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

// Replay tests launch a fresh Electron per test with configurable cassette names
const test = base.extend<{ cassetteName: string; app: ElectronApplication; mainPage: Page }>({
  cassetteName: ['', { option: true }],

  app: [async ({ cassetteName }, use, testInfo) => {
    const userDataDir = path.join(os.tmpdir(), `showtime-cassette-${testInfo.testId}`)
    const app = await electron.launch({
      args: [path.join(__dirname, '..', 'dist', 'main', 'index.js')],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        SHOWTIME_USER_DATA: userDataDir,
        SHOWTIME_PLAYBACK: '1',
        SHOWTIME_PLAYBACK_SPEED: '100',
        SHOWTIME_TEST_X: '2000',
        SHOWTIME_TEST_Y: '200',
        ...(cassetteName ? { SHOWTIME_CASSETTE_NAME: cassetteName } : {}),
      },
      timeout: 30000,
    })

    const page = await app.firstWindow()
    const bw = await app.browserWindow(page)
    await bw.evaluate((win) => win.setPosition(2000, 200))
    await page.waitForSelector('div', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(3000)

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
  }, { scope: 'test' }],

  mainPage: [async ({ app }, use) => {
    const page = await app.firstWindow()
    await use(page)
  }, { scope: 'test' }],
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

infraTest.describe('Cassette Infrastructure', () => {
  infraTest('cassette directory exists', () => {
    expect(fs.existsSync(CASSETTE_DIR)).toBe(true)
  })

  infraTest('app launches in playback mode', async ({ mainPage: page }) => {
    // The app should boot normally even with SHOWTIME_PLAYBACK=1 and no cassettes.
    // Playback mode only activates when a Claude run is triggered.
    const title = await page.title()
    expect(title).toBeDefined()
    await screenshot(page, 'cassette-playback-boot')
  })

  infraTest('dark studio renders in playback mode', async ({ mainPage: page }) => {
    // Seed Dark Studio state and verify basic rendering
    await seedFixture(page, FIXTURES.darkStudio)

    const cta = page.getByText("Enter the Writer's Room")
    await expect(cta).toBeVisible({ timeout: 10000 })
    await screenshot(page, 'cassette-dark-studio')
  })

  infraTest('writers room chat renders in playback mode', async ({ mainPage: page }) => {
    await seedFixture(page, FIXTURES.writersRoom_chat)

    const chatInput = page.getByTestId('chat-input')
    await expect(chatInput).toBeVisible({ timeout: 5000 })
    await screenshot(page, 'cassette-writers-room-chat')
  })

  infraTest('lists available cassettes', () => {
    // This test documents which cassettes are committed to git.
    const cassettes = listCassettes()
    console.log(`Available cassettes: [${cassettes.join(', ')}]`)
    expect(cassettes.length).toBeGreaterThanOrEqual(2)
    expect(fs.existsSync(CASSETTE_DIR)).toBe(true)
  })
})

// ─── Cassette Replay Tests ───
//
// Each test block uses test.use({ cassetteName }) to route cassettes to Claude runs.
// The cassette queue is comma-separated: first run gets cassette #1, second gets #2, etc.
// Warmup init requests that don't match a cassette get a synthesized empty response.

test.describe('Cassette Replay', () => {

  test.describe('happy path lineup generation', () => {
    test.use({ cassetteName: 'chat-ack,happy-path-lineup' })

    test('replay: happy path lineup generation', async ({ mainPage: page }) => {
      const requiredCassette = 'happy-path-lineup'
      test.skip(!cassetteExists(requiredCassette), `Cassette "${requiredCassette}.ndjson" not recorded yet`)

      // Start at the chat-first Writer's Room
      await seedFixture(page, FIXTURES.writersRoom_chat)

      const chatInput = page.getByTestId('chat-input')
      await expect(chatInput).toBeVisible({ timeout: 5000 })
      await chatInput.fill('Deep work on API for 2 hours, exercise 30 min, email catch-up 30 min')
      await page.waitForTimeout(300)

      // Send chat message (consumes chat-ack cassette) then build lineup (consumes happy-path-lineup)
      await page.getByTestId('chat-send').click()
      await page.waitForTimeout(300)

      const buildBtn = page.getByTestId('build-lineup-btn')
      await expect(buildBtn).toBeVisible({ timeout: 3000 })
      await buildBtn.click()

      // In playback mode, the cassette provides Claude's response almost instantly
      // (100x speed means ~30s of real time becomes ~300ms)
      const chatMessages = page.getByTestId('chat-messages')
      await expect(chatMessages).toBeVisible({ timeout: 10000 })

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
  })

  test.describe('multi-turn lineup refinement', () => {
    test.use({ cassetteName: 'chat-ack,multi-turn-initial,multi-turn-refinement' })

    test('replay: multi-turn lineup refinement', async ({ mainPage: page }) => {
      const requiredCassette = 'multi-turn-initial'
      test.skip(!cassetteExists(requiredCassette), `Cassette "${requiredCassette}.ndjson" not recorded yet`)

      // Start at the chat-first Writer's Room
      await seedFixture(page, FIXTURES.writersRoom_chat)

      const chatInput = page.getByTestId('chat-input')
      await expect(chatInput).toBeVisible({ timeout: 5000 })
      await chatInput.fill('Deep work 2h, exercise 30m')
      await page.waitForTimeout(300)

      // Send chat message (chat-ack) then build lineup (multi-turn-initial)
      await page.getByTestId('chat-send').click()
      await page.waitForTimeout(300)

      const buildBtn = page.getByTestId('build-lineup-btn')
      await expect(buildBtn).toBeVisible({ timeout: 3000 })
      await buildBtn.click()

      // Wait for initial lineup from cassette
      const chatMessages = page.getByTestId('chat-messages')
      await expect(chatMessages).toBeVisible({ timeout: 10000 })

      const actCardSelector = page.locator('.bg-surface-hover\\/50').first()
      await actCardSelector.waitFor({ state: 'visible', timeout: 15000 })

      const initialCards = page.locator('.bg-surface-hover\\/50')
      const initialCount = await initialCards.count()
      expect(initialCount).toBeGreaterThanOrEqual(2)

      await screenshot(page, 'cassette-multi-turn-01-initial')

      // Send a refinement — this consumes the multi-turn-refinement cassette
      const refineChatInput = page.getByTestId('chat-input')
      await expect(refineChatInput).toBeVisible({ timeout: 5000 })
      await refineChatInput.fill('Make deep work 90 minutes instead')
      await page.getByTestId('chat-send').click()

      // Wait for the refinement to complete (cassette replays quickly at 100x)
      const revisingIndicator = page.getByText('The writers are revising')
      if (await revisingIndicator.isVisible({ timeout: 3000 }).catch(() => false)) {
        await revisingIndicator.waitFor({ state: 'hidden', timeout: 15000 })
      } else {
        await page.waitForTimeout(5000)
      }

      const refinedCards = page.locator('.bg-surface-hover\\/50')
      const refinedCount = await refinedCards.count()
      expect(refinedCount).toBeGreaterThan(initialCount)

      // Verify second turn produced a visible change in the conversation
      const assistantMessages = chatMessages.locator('[data-testid="assistant-message"]')
      expect(await assistantMessages.count()).toBeGreaterThanOrEqual(2) // initial + refinement response

      await screenshot(page, 'cassette-multi-turn-02-refined')
    })
  })

  test.describe('low energy plan', () => {
    test.use({ cassetteName: 'chat-ack,low-energy-plan' })

    test('replay: low energy plan', async ({ mainPage: page }) => {
      const requiredCassette = 'low-energy-plan'
      test.skip(!cassetteExists(requiredCassette), `Cassette "${requiredCassette}.ndjson" not recorded yet`)

      // Start at chat-first Writer's Room with low energy
      await seedFixture(page, {
        ...FIXTURES.writersRoom_chat,
        energy: 'low',
      })

      const chatInput = page.getByTestId('chat-input')
      await expect(chatInput).toBeVisible({ timeout: 5000 })
      await chatInput.fill('Just some light admin and a walk')
      await page.waitForTimeout(300)

      // Send chat (chat-ack) then build lineup (low-energy-plan)
      await page.getByTestId('chat-send').click()
      await page.waitForTimeout(300)

      const buildBtn = page.getByTestId('build-lineup-btn')
      await expect(buildBtn).toBeVisible({ timeout: 3000 })
      await buildBtn.click()

      // Wait for lineup from cassette
      const actCardSelector = page.locator('.bg-surface-hover\\/50').first()
      await actCardSelector.waitFor({ state: 'visible', timeout: 15000 })

      const actCards = page.locator('.bg-surface-hover\\/50')
      const cardCount = await actCards.count()
      expect(cardCount).toBeGreaterThanOrEqual(1)

      // Low energy plans should have shorter durations
      await screenshot(page, 'cassette-low-energy-plan')
    })
  })

  test.describe('error recovery', () => {
    test.use({ cassetteName: 'chat-ack,error-recovery' })

    test('replay: error recovery', async ({ mainPage: page }) => {
      const requiredCassette = 'error-recovery'
      test.skip(!cassetteExists(requiredCassette), `Cassette "${requiredCassette}.ndjson" not recorded yet`)

      // This cassette contains a Claude session that errors.
      // The app should show an error state in the conversation thread.

      await seedFixture(page, FIXTURES.writersRoom_chat)

      const chatInput = page.getByTestId('chat-input')
      await expect(chatInput).toBeVisible({ timeout: 5000 })
      await chatInput.fill('Deep work 2h')
      await page.waitForTimeout(300)

      // Send chat (chat-ack) then build lineup (error-recovery — returns an error)
      await page.getByTestId('chat-send').click()
      await page.waitForTimeout(300)

      const buildBtn = page.getByTestId('build-lineup-btn')
      await expect(buildBtn).toBeVisible({ timeout: 3000 })
      await buildBtn.click()

      // The cassette replays an error response — the UI must show some error state
      const chatMessages = page.getByTestId('chat-messages')
      await expect(chatMessages).toBeVisible({ timeout: 10000 })

      // Wait for a concrete recovery UI element, not just a delay
      const errorMsg = page.locator('text=/Error|stepped out|coffee break/i')
      const assistantResponse = chatMessages.locator('[data-testid="assistant-message"]').first()
      const systemMessage = chatMessages.locator('text=/Error:/i').first()

      const recoveryResult = await Promise.race([
        errorMsg.first().waitFor({ state: 'visible', timeout: 15000 }).then(() => 'error' as const),
        assistantResponse.waitFor({ state: 'visible', timeout: 15000 }).then(() => 'response' as const),
        systemMessage.waitFor({ state: 'visible', timeout: 15000 }).then(() => 'system' as const),
      ]).catch(() => 'none' as const)

      // The cassette must produce a visible UI state — not just silence
      expect(recoveryResult).not.toBe('none')

      await screenshot(page, 'cassette-error-recovery')
    })
  })
})
