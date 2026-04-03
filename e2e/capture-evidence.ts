/**
 * Evidence capture script — takes Playwright screenshots of UI fixes.
 * Run: npx playwright test e2e/capture-evidence.ts
 */
import { test } from './fixtures'
import { expect } from '@playwright/test'

test('capture #131 — pill view fallback in no_show phase', async ({ app, mainPage }) => {
  // App starts in no_show / dark studio. Set viewTier to micro (pill).
  await mainPage.evaluate(() => {
    const { showActor } = require('../src/renderer/machines/showActor')
    showActor.send({ type: 'SET_VIEW_TIER', tier: 'micro' })
  }).catch(() => {
    // If require doesn't work in renderer, use the XState hooks via window
  })

  // Alternative: directly manipulate via localStorage + reload
  await mainPage.evaluate(() => {
    localStorage.setItem('showtime-show-state', JSON.stringify({
      state: { phase: 'no_show', viewTier: 'micro' }
    }))
  })
  await mainPage.reload()
  await mainPage.waitForTimeout(2000)

  await mainPage.screenshot({
    path: 'e2e/screenshots/evidence-131-pill-no-show.png',
    fullPage: true,
  })
})

test('capture #131 — pill view in writers_room phase', async ({ app, mainPage }) => {
  // Enter writers room
  await mainPage.evaluate(() => {
    localStorage.setItem('showtime-show-state', JSON.stringify({
      state: { phase: 'writers_room', viewTier: 'micro', writersRoomStep: 'energy' }
    }))
  })
  await mainPage.reload()
  await mainPage.waitForTimeout(2000)

  await mainPage.screenshot({
    path: 'e2e/screenshots/evidence-131-pill-writers-room.png',
    fullPage: true,
  })
})

test('capture #131 — pill view in live phase (normal)', async ({ app, mainPage }) => {
  // Set up a live show with acts
  await mainPage.evaluate(() => {
    localStorage.setItem('showtime-show-state', JSON.stringify({
      state: {
        phase: 'live',
        viewTier: 'micro',
        acts: [
          { id: 'a1', name: 'Deep Work', sketch: 'Focus session', durationMinutes: 30, status: 'active', beatLocked: false, order: 0, startedAt: Date.now() }
        ],
        currentActId: 'a1',
        timerEndAt: Date.now() + 30 * 60 * 1000,
        beatsLocked: 1,
        beatThreshold: 3,
      }
    }))
  })
  await mainPage.reload()
  await mainPage.waitForTimeout(2000)

  await mainPage.screenshot({
    path: 'e2e/screenshots/evidence-131-pill-live.png',
    fullPage: true,
  })
})

test('capture #132 — Writer\'s Room with lineup and reorder controls', async ({ app, mainPage }) => {
  // Set up writers room with a lineup
  await mainPage.evaluate(() => {
    localStorage.setItem('showtime-show-state', JSON.stringify({
      state: {
        phase: 'writers_room',
        viewTier: 'expanded',
        writersRoomStep: 'lineup_ready',
        energy: 'medium',
        acts: [
          { id: 'a1', name: 'Deep Work', sketch: 'Focus on code', durationMinutes: 60, status: 'upcoming', beatLocked: false, order: 0 },
          { id: 'a2', name: 'Walk', sketch: 'Get some exercise', durationMinutes: 30, status: 'upcoming', beatLocked: false, order: 1 },
          { id: 'a3', name: 'Tea Time', sketch: 'Chat with Aseem', durationMinutes: 30, status: 'upcoming', beatLocked: false, order: 2 },
        ],
        beatThreshold: 3,
      }
    }))
  })
  await mainPage.reload()
  await mainPage.waitForTimeout(2000)

  await mainPage.screenshot({
    path: 'e2e/screenshots/evidence-132-lineup-reorder.png',
    fullPage: true,
  })
})

test('capture #130 — expanded view with pinned calendar acts', async ({ app, mainPage }) => {
  const now = Date.now()
  const hour = 60 * 60 * 1000
  await mainPage.evaluate((params) => {
    localStorage.setItem('showtime-show-state', JSON.stringify({
      state: {
        phase: 'live',
        viewTier: 'expanded',
        energy: 'medium',
        acts: [
          { id: 'a1', name: 'Deep Work', sketch: 'Focus session', durationMinutes: 60, status: 'active', beatLocked: false, order: 0, startedAt: params.now, isFlexible: true },
          { id: 'a2', name: 'Tea Time (Aseem)', sketch: 'Catch up', durationMinutes: 60, status: 'upcoming', beatLocked: false, order: 1, pinnedStartAt: params.now + params.hour, isFlexible: false, calendarEventId: 'gcal-123' },
          { id: 'a3', name: 'Catch up (KDR)', sketch: 'Weekly sync', durationMinutes: 60, status: 'upcoming', beatLocked: false, order: 2, pinnedStartAt: params.now + 2 * params.hour, isFlexible: false, calendarEventId: 'gcal-456' },
          { id: 'a4', name: 'Wind down', sketch: 'No screens', durationMinutes: 30, status: 'upcoming', beatLocked: false, order: 3, isFlexible: true },
        ],
        currentActId: 'a1',
        timerEndAt: params.now + 60 * 60 * 1000,
        beatsLocked: 1,
        beatThreshold: 3,
        showStartedAt: params.now,
      }
    }))
  }, { now, hour })
  await mainPage.reload()
  await mainPage.waitForTimeout(2000)

  await mainPage.screenshot({
    path: 'e2e/screenshots/evidence-130-pinned-acts.png',
    fullPage: true,
  })
})
