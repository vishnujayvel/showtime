/**
 * Capture lineup evidence — injects state using the correct persistence format,
 * then screenshots the lineup with reorder controls and pinned acts.
 */
import { _electron as electron } from 'playwright'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '..')
const ssDir = path.join(rootDir, 'e2e', 'screenshots')

async function main() {
  const userDataDir = path.join(os.tmpdir(), 'showtime-lineup-' + Date.now())
  const now = Date.now()
  const hour = 60 * 60 * 1000

  console.log('Launching Showtime with pre-built lineup...')

  const app = await electron.launch({
    args: [path.join(rootDir, 'dist', 'main', 'index.js')],
    env: { ...process.env, NODE_ENV: 'test', SHOWTIME_USER_DATA: userDataDir },
    timeout: 30000,
  })

  const page = await app.firstWindow()
  await page.waitForSelector('#root > *', { timeout: 15000 }).catch(() => {})

  // Inject state in the CORRECT persistence format: { stateValue, context }
  await page.evaluate((params) => {
    localStorage.setItem('showtime-onboarding-complete', 'true')
    localStorage.setItem('showtime-show-state', JSON.stringify({
      stateValue: { phase: { writers_room: 'lineup_ready' }, animation: 'idle' },
      context: {
        energy: 'medium',
        acts: [
          { id: 'a1', name: 'Deep Work', sketch: 'Focus on XState migration', durationMinutes: 60, status: 'upcoming', beatLocked: false, order: 0, isFlexible: true },
          { id: 'a2', name: 'Walk with Steven', sketch: 'Get some exercise', durationMinutes: 30, status: 'upcoming', beatLocked: false, order: 1, isFlexible: true },
          { id: 'a3', name: 'Tea Time (Aseem)', sketch: 'Catch up over chai', durationMinutes: 60, status: 'upcoming', beatLocked: false, order: 2, pinnedStartAt: params.now + 2 * params.hour, isFlexible: false, calendarEventId: 'gcal-tea-aseem' },
          { id: 'a4', name: 'Catch up (KDR)', sketch: 'Weekly sync', durationMinutes: 60, status: 'upcoming', beatLocked: false, order: 3, pinnedStartAt: params.now + 3 * params.hour, isFlexible: false, calendarEventId: 'gcal-kdr' },
          { id: 'a5', name: 'Wind down', sketch: 'No screens, journal', durationMinutes: 30, status: 'upcoming', beatLocked: false, order: 4, isFlexible: true },
        ],
        currentActId: null,
        beatsLocked: 0,
        beatThreshold: 3,
        timerEndAt: null,
        timerPausedRemaining: null,
        showDate: new Date().toISOString().slice(0, 10),
        showStartedAt: null,
        verdict: null,
        viewTier: 'expanded',
        writersRoomStep: 'lineup_ready',
        writersRoomEnteredAt: params.now - 300000,
        breathingPauseEndAt: null,
      },
      savedAt: params.now,
    }))
  }, { now, hour })

  await page.reload()
  await page.waitForTimeout(3000)

  const bw = await app.browserWindow(page)
  await bw.evaluate(win => win.setSize(560, 680))
  await page.waitForTimeout(500)

  // Screenshot Writer's Room with lineup ready
  console.log('1. Writer\'s Room with lineup (reorder controls #132)...')
  await page.screenshot({ path: `${ssDir}/evidence-132-lineup-reorder.png` })

  // Now inject live state with pinned acts
  console.log('2. Live show with pinned calendar acts (#130)...')
  await page.evaluate((params) => {
    localStorage.setItem('showtime-show-state', JSON.stringify({
      stateValue: { phase: { live: 'act_active' }, animation: 'idle' },
      context: {
        energy: 'medium',
        acts: [
          { id: 'a1', name: 'Deep Work', sketch: 'Focus session', durationMinutes: 60, status: 'active', beatLocked: false, order: 0, startedAt: params.now, isFlexible: true },
          { id: 'a2', name: 'Walk with Steven', sketch: 'Exercise', durationMinutes: 30, status: 'upcoming', beatLocked: false, order: 1, isFlexible: true },
          { id: 'a3', name: 'Tea Time (Aseem)', sketch: 'Catch up', durationMinutes: 60, status: 'upcoming', beatLocked: false, order: 2, pinnedStartAt: params.now + params.hour, isFlexible: false, calendarEventId: 'gcal-123' },
          { id: 'a4', name: 'Catch up (KDR)', sketch: 'Weekly sync', durationMinutes: 60, status: 'upcoming', beatLocked: false, order: 3, pinnedStartAt: params.now + 2 * params.hour, isFlexible: false, calendarEventId: 'gcal-456' },
        ],
        currentActId: 'a1',
        beatsLocked: 1,
        beatThreshold: 3,
        timerEndAt: params.now + 60 * 60 * 1000,
        timerPausedRemaining: null,
        showDate: new Date().toISOString().slice(0, 10),
        showStartedAt: params.now,
        verdict: null,
        viewTier: 'expanded',
        writersRoomStep: 'lineup_ready',
        writersRoomEnteredAt: params.now - 600000,
        breathingPauseEndAt: null,
      },
      savedAt: params.now,
    }))
  }, { now, hour })

  await page.reload()
  await page.waitForTimeout(3000)
  await page.screenshot({ path: `${ssDir}/evidence-130-pinned-acts-live.png` })

  // Pill view during live
  console.log('3. Pill view during live show...')
  await bw.evaluate(win => win.setSize(320, 64))
  await page.waitForTimeout(1000)
  await page.screenshot({ path: `${ssDir}/evidence-131-pill-live-with-content.png` })

  console.log('\nAll lineup evidence captured!')
  await app.close().catch(() => {})
}

main().catch(e => { console.error('Error:', e.message); process.exit(1) })
