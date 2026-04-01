/**
 * Standalone evidence capture — launches Electron via Playwright, interacts with UI, takes screenshots.
 * Run: node e2e/capture-evidence.mjs
 */
import { _electron as electron } from 'playwright'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '..')

async function main() {
  console.log('Launching Showtime...')
  const userDataDir = path.join(os.tmpdir(), 'showtime-evidence-' + Date.now())

  const app = await electron.launch({
    args: [path.join(rootDir, 'dist', 'main', 'index.js')],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      SHOWTIME_USER_DATA: userDataDir,
    },
    timeout: 30000,
  })

  const page = await app.firstWindow()
  await page.waitForSelector('#root > *', { timeout: 15000 }).catch(() => {})

  // Skip onboarding
  await page.evaluate(() => {
    localStorage.setItem('showtime-onboarding-complete', 'true')
  })
  await page.reload()
  await page.waitForTimeout(2000)

  // --- Dark Studio (initial state) ---
  console.log('1. Capturing Dark Studio...')
  await page.screenshot({ path: 'e2e/screenshots/evidence-dark-studio.png' })

  // --- Click "Enter the Writer's Room" ---
  console.log('2. Entering Writer\'s Room...')
  const wrButton = page.getByText("Enter the Writer's Room")
  if (await wrButton.isVisible()) {
    await wrButton.click()
    await page.waitForTimeout(2000)
    console.log('   Capturing Writer\'s Room...')
    await page.screenshot({ path: 'e2e/screenshots/evidence-writers-room.png' })

    // --- Select energy level ---
    const mediumBtn = page.getByText('Medium')
    if (await mediumBtn.isVisible().catch(() => false)) {
      await mediumBtn.click()
      await page.waitForTimeout(1000)
      console.log('   Capturing energy selection...')
      await page.screenshot({ path: 'e2e/screenshots/evidence-writers-room-energy.png' })
    }
  }

  // --- Now test pill view: set localStorage to simulate live + micro ---
  console.log('3. Simulating live show in pill view...')
  const now = Date.now()
  await page.evaluate((now) => {
    // Inject state via localStorage (Zustand persist reads this)
    localStorage.setItem('showtime-show-state', JSON.stringify({
      state: {
        phase: 'live',
        energy: 'medium',
        viewTier: 'micro',
        acts: [
          { id: 'a1', name: 'Deep Work', sketch: 'Focus session', durationMinutes: 30, status: 'active', beatLocked: false, order: 0, startedAt: now },
          { id: 'a2', name: 'Tea Time (Aseem)', sketch: 'Catch up', durationMinutes: 60, status: 'upcoming', beatLocked: false, order: 1, pinnedStartAt: now + 3600000, isFlexible: false },
          { id: 'a3', name: 'Walk', sketch: 'Exercise', durationMinutes: 30, status: 'upcoming', beatLocked: false, order: 2, isFlexible: true },
        ],
        currentActId: 'a1',
        timerEndAt: now + 30 * 60 * 1000,
        beatsLocked: 1,
        beatThreshold: 3,
        showDate: new Date().toISOString().slice(0, 10),
        showStartedAt: now,
        beatCheckPending: false,
        celebrationActive: false,
      }
    }))
  }, now)
  await page.reload()
  await page.waitForTimeout(3000)
  console.log('   Capturing pill view (live phase)...')
  await page.screenshot({ path: 'e2e/screenshots/evidence-131-pill-live.png' })

  // --- Switch to expanded to show lineup with pinned acts ---
  console.log('4. Simulating expanded view with pinned acts...')
  await page.evaluate((now) => {
    localStorage.setItem('showtime-show-state', JSON.stringify({
      state: {
        phase: 'live',
        energy: 'medium',
        viewTier: 'expanded',
        acts: [
          { id: 'a1', name: 'Deep Work', sketch: 'Focus session', durationMinutes: 30, status: 'active', beatLocked: false, order: 0, startedAt: now },
          { id: 'a2', name: 'Tea Time (Aseem)', sketch: 'Catch up', durationMinutes: 60, status: 'upcoming', beatLocked: false, order: 1, pinnedStartAt: now + 3600000, isFlexible: false, calendarEventId: 'gcal-123' },
          { id: 'a3', name: 'Catch up (KDR)', sketch: 'Weekly sync', durationMinutes: 60, status: 'upcoming', beatLocked: false, order: 2, pinnedStartAt: now + 7200000, isFlexible: false, calendarEventId: 'gcal-456' },
          { id: 'a4', name: 'Wind down', sketch: 'No screens', durationMinutes: 30, status: 'upcoming', beatLocked: false, order: 3, isFlexible: true },
        ],
        currentActId: 'a1',
        timerEndAt: now + 30 * 60 * 1000,
        beatsLocked: 1,
        beatThreshold: 3,
        showDate: new Date().toISOString().slice(0, 10),
        showStartedAt: now,
        beatCheckPending: false,
        celebrationActive: false,
      }
    }))
  }, now)
  await page.reload()
  await page.waitForTimeout(3000)
  console.log('   Capturing expanded view with pinned calendar acts...')
  await page.screenshot({ path: 'e2e/screenshots/evidence-130-pinned-acts.png' })

  // --- Test pill in no_show (the original bug) ---
  console.log('5. Simulating pill in no_show phase (was the empty bug)...')
  await page.evaluate(() => {
    localStorage.setItem('showtime-show-state', JSON.stringify({
      state: {
        phase: 'no_show',
        viewTier: 'micro',
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
        beatCheckPending: false,
        celebrationActive: false,
      }
    }))
  })
  await page.reload()
  await page.waitForTimeout(3000)
  console.log('   Capturing pill in no_show (should show fallback, not empty)...')
  await page.screenshot({ path: 'e2e/screenshots/evidence-131-pill-no-show.png' })

  console.log('\nAll evidence screenshots captured!')
  await app.close().catch(() => {})
}

main().catch(e => {
  console.error('Error:', e.message)
  process.exit(1)
})
