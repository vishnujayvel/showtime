import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { showActor, resetShowActor } from '../renderer/machines/showActor'
import { getPhaseFromState } from '../renderer/machines/showMachine'
import type { ShowLineup } from '../shared/types'

/** Helper to get current phase from the actor */
function phase() {
  return getPhaseFromState(showActor.getSnapshot().value as Record<string, unknown>)
}

/** Helper to get actor context */
function ctx() {
  return showActor.getSnapshot().context
}

const sampleLineup: ShowLineup = {
  acts: [
    { name: 'Morning Deep Work', sketch: 'Deep Work', durationMinutes: 60 },
    { name: 'Exercise Block', sketch: 'Exercise', durationMinutes: 45 },
    { name: 'Admin Catch-up', sketch: 'Admin', durationMinutes: 30 },
  ],
  beatThreshold: 3,
  openingNote: 'Solid lineup!',
}

/** Navigate actor to writers_room with lineup set */
function setupLineup() {
  showActor.send({ type: 'ENTER_WRITERS_ROOM' })
  showActor.send({ type: 'SET_ENERGY', level: 'high' })
  showActor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'plan' })
  showActor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'conversation' })
  showActor.send({ type: 'SET_LINEUP', lineup: sampleLineup })
}

/** Navigate actor to live phase */
function goLive() {
  setupLineup()
  showActor.send({ type: 'START_SHOW' })
}

describe('showActor', () => {
  beforeEach(() => {
    resetShowActor()
    vi.clearAllMocks()
  })

  // ─── Initial State ───

  describe('initial state', () => {
    it('starts in no_show phase', () => {
      expect(phase()).toBe('no_show')
    })

    it('has no energy selected', () => {
      expect(ctx().energy).toBeNull()
    })

    it('has no acts', () => {
      expect(ctx().acts).toHaveLength(0)
    })

    it('has default beat threshold of 3', () => {
      expect(ctx().beatThreshold).toBe(3)
    })

    it('has no verdict', () => {
      expect(ctx().verdict).toBeNull()
    })
  })

  // ─── Writer's Room ───

  describe('SET_ENERGY', () => {
    it('sets energy level', () => {
      showActor.send({ type: 'ENTER_WRITERS_ROOM' })
      showActor.send({ type: 'SET_ENERGY', level: 'high' })
      expect(ctx().energy).toBe('high')
    })

    it('can change energy level', () => {
      showActor.send({ type: 'ENTER_WRITERS_ROOM' })
      showActor.send({ type: 'SET_ENERGY', level: 'high' })
      showActor.send({ type: 'SET_ENERGY', level: 'low' })
      expect(ctx().energy).toBe('low')
    })
  })

  describe('SET_LINEUP', () => {
    it('creates acts from lineup', () => {
      setupLineup()

      expect(ctx().acts).toHaveLength(3)
      expect(ctx().acts[0].name).toBe('Morning Deep Work')
      expect(ctx().acts[0].sketch).toBe('Deep Work')
      expect(ctx().acts[0].durationMinutes).toBe(60)
      expect(ctx().acts[0].status).toBe('upcoming')
      expect(ctx().acts[0].beatLocked).toBe(false)
    })

    it('sets beat threshold from lineup', () => {
      setupLineup()
      expect(ctx().beatThreshold).toBe(3)
    })

    it('phase stays in writers_room', () => {
      setupLineup()
      expect(phase()).toBe('writers_room')
    })

    it('assigns sequential order to acts', () => {
      setupLineup()
      const acts = ctx().acts
      expect(acts[0].order).toBe(0)
      expect(acts[1].order).toBe(1)
      expect(acts[2].order).toBe(2)
    })

    it('generates unique IDs for acts', () => {
      setupLineup()
      const acts = ctx().acts
      const ids = new Set(acts.map((a) => a.id))
      expect(ids.size).toBe(3)
    })
  })

  // ─── START_SHOW ───

  describe('START_SHOW', () => {
    it('does nothing with no acts', () => {
      showActor.send({ type: 'ENTER_WRITERS_ROOM' })
      showActor.send({ type: 'START_SHOW' })
      expect(phase()).toBe('writers_room')
    })

    it('transitions to live phase', () => {
      goLive()
      expect(phase()).toBe('live')
    })

    it('sets first act as active', () => {
      goLive()

      expect(ctx().currentActId).toBe(ctx().acts[0].id)
      expect(ctx().acts[0].status).toBe('active')
      expect(ctx().acts[0].startedAt).toBeDefined()
    })

    it('sets timer for first act duration', () => {
      const before = Date.now()
      goLive()
      const after = Date.now()

      const timerEnd = ctx().timerEndAt!
      // 60 min act = 3,600,000 ms
      expect(timerEnd).toBeGreaterThanOrEqual(before + 60 * 60 * 1000)
      expect(timerEnd).toBeLessThanOrEqual(after + 60 * 60 * 1000)
    })

    it('collapses to pill view', () => {
      goLive()
      expect(ctx().viewTier).toBe('micro')
    })

    it('leaves other acts as upcoming', () => {
      goLive()
      const acts = ctx().acts
      expect(acts[1].status).toBe('upcoming')
      expect(acts[2].status).toBe('upcoming')
    })
  })

  // ─── COMPLETE_ACT ───

  describe('COMPLETE_ACT', () => {
    beforeEach(() => {
      goLive()
    })

    it('marks act as completed', () => {
      const actId = ctx().currentActId!
      showActor.send({ type: 'COMPLETE_ACT', actId })

      const act = ctx().acts.find((a) => a.id === actId)
      expect(act?.status).toBe('completed')
      expect(act?.completedAt).toBeDefined()
    })

    it('clears timer', () => {
      const actId = ctx().currentActId!
      showActor.send({ type: 'COMPLETE_ACT', actId })

      expect(ctx().timerEndAt).toBeNull()
      expect(ctx().timerPausedRemaining).toBeNull()
    })

    it('triggers beat check', () => {
      const actId = ctx().currentActId!
      showActor.send({ type: 'COMPLETE_ACT', actId })
      expect(ctx().beatCheckPending).toBe(true)
    })
  })

  // ─── SKIP_ACT ───

  describe('SKIP_ACT', () => {
    beforeEach(() => {
      goLive()
    })

    it('marks act as skipped', () => {
      const actId = ctx().currentActId!
      showActor.send({ type: 'SKIP_ACT', actId })

      const act = ctx().acts.find((a) => a.id === actId)
      expect(act?.status).toBe('skipped')
    })

    it('auto-starts next act when skipping active act', () => {
      const firstId = ctx().currentActId!
      showActor.send({ type: 'SKIP_ACT', actId: firstId })

      expect(ctx().currentActId).not.toBe(firstId)
      expect(ctx().currentActId).toBe(ctx().acts[1].id)
      expect(ctx().acts[1].status).toBe('active')
    })

    it('strikes stage when skipping last upcoming act', () => {
      const acts = ctx().acts
      // Skip first two, third will be auto-started then we skip that
      showActor.send({ type: 'SKIP_ACT', actId: acts[0].id })
      showActor.send({ type: 'SKIP_ACT', actId: acts[1].id })
      showActor.send({ type: 'SKIP_ACT', actId: acts[2].id })

      expect(phase()).toBe('strike')
    })
  })

  // ─── EXTEND_ACT ───

  describe('EXTEND_ACT', () => {
    it('adds time to timer', () => {
      goLive()

      const timerBefore = ctx().timerEndAt!
      showActor.send({ type: 'EXTEND_ACT', minutes: 15 })
      const timerAfter = ctx().timerEndAt!

      expect(timerAfter - timerBefore).toBe(15 * 60 * 1000)
    })

    it('does nothing when no timer is active', () => {
      showActor.send({ type: 'EXTEND_ACT', minutes: 15 })
      expect(ctx().timerEndAt).toBeNull()
    })
  })

  // ─── Beat Tracking ───

  describe('LOCK_BEAT', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      goLive()
      const actId = ctx().currentActId!
      showActor.send({ type: 'COMPLETE_ACT', actId })
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('increments beatsLocked', () => {
      showActor.send({ type: 'LOCK_BEAT' })
      expect(ctx().beatsLocked).toBe(1)
    })

    it('clears beatCheckPending after celebration delay', () => {
      expect(ctx().beatCheckPending).toBe(true)
      showActor.send({ type: 'LOCK_BEAT' })
      // During celebration, beatCheckPending stays true
      expect(ctx().celebrationActive).toBe(true)
      vi.advanceTimersByTime(1800)
      expect(ctx().beatCheckPending).toBe(false)
      expect(ctx().celebrationActive).toBe(false)
    })

    it('marks act as beat-locked', () => {
      const actId = ctx().currentActId!
      showActor.send({ type: 'LOCK_BEAT' })
      const act = ctx().acts.find((a) => a.id === actId)
      expect(act?.beatLocked).toBe(true)
    })

    it('starts next act after locking', () => {
      showActor.send({ type: 'LOCK_BEAT' })
      vi.advanceTimersByTime(1800)
      expect(ctx().acts[1].status).toBe('active')
    })
  })

  describe('LOCK_BEAT race condition guards', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      goLive()
      const actId = ctx().currentActId!
      showActor.send({ type: 'COMPLETE_ACT', actId })
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('cancels first timeout when lockBeat called twice (double-click)', () => {
      showActor.send({ type: 'LOCK_BEAT' })
      expect(ctx().beatsLocked).toBe(1)

      // Call lockBeat again before timeout fires (simulates double-click)
      showActor.send({ type: 'LOCK_BEAT' })
      expect(ctx().beatsLocked).toBe(2)

      // Only one timeout should fire — advance past the 1800ms window
      vi.advanceTimersByTime(1800)

      // Should not have called startAct twice — only one next act should be active
      const activeActs = ctx().acts.filter((a) => a.status === 'active')
      expect(activeActs.length).toBeLessThanOrEqual(1)
    })

    it('does not advance when phase changes during celebration', () => {
      showActor.send({ type: 'LOCK_BEAT' })
      expect(ctx().celebrationActive).toBe(true)

      // Change phase during celebration (e.g., user enters intermission)
      showActor.send({ type: 'ENTER_INTERMISSION' })

      vi.advanceTimersByTime(1800)

      // Should NOT have advanced to next act — XState machine ignores
      // CELEBRATION_DONE from intermission (only valid from celebrating)
      expect(phase()).toBe('intermission')
    })

    it('resetShow cancels celebration timeout', () => {
      showActor.send({ type: 'LOCK_BEAT' })
      expect(ctx().celebrationActive).toBe(true)

      // Reset during celebration
      showActor.send({ type: 'RESET' })
      expect(ctx().celebrationActive).toBe(false)
      expect(phase()).toBe('no_show')

      // Advance past the celebration window — should not crash or change state
      vi.advanceTimersByTime(1800)
      expect(phase()).toBe('no_show')
      expect(ctx().acts).toHaveLength(0)
    })

    it('celebration timeout fires CELEBRATION_DONE after 1800ms', () => {
      showActor.send({ type: 'LOCK_BEAT' })
      expect(ctx().celebrationActive).toBe(true)

      vi.advanceTimersByTime(1800)

      // Celebration timeout fires CELEBRATION_DONE which clears celebrationActive
      expect(ctx().celebrationActive).toBe(false)
    })
  })

  describe('SKIP_BEAT', () => {
    beforeEach(() => {
      goLive()
      const actId = ctx().currentActId!
      showActor.send({ type: 'COMPLETE_ACT', actId })
    })

    it('clears beatCheckPending without incrementing beats', () => {
      showActor.send({ type: 'SKIP_BEAT' })
      expect(ctx().beatCheckPending).toBe(false)
      expect(ctx().beatsLocked).toBe(0)
    })

    it('starts next act after skipping', () => {
      showActor.send({ type: 'SKIP_BEAT' })
      expect(ctx().acts[1].status).toBe('active')
    })
  })

  // ─── Intermission ───

  describe('ENTER_INTERMISSION', () => {
    it('transitions to intermission phase', () => {
      goLive()
      showActor.send({ type: 'ENTER_INTERMISSION' })
      expect(phase()).toBe('intermission')
    })

    it('pauses timer by storing remaining time', () => {
      goLive()

      showActor.send({ type: 'ENTER_INTERMISSION' })

      expect(ctx().timerEndAt).toBeNull()
      expect(ctx().timerPausedRemaining).toBeGreaterThan(0)
    })
  })

  describe('EXIT_INTERMISSION', () => {
    it('resumes timer with remaining time', () => {
      goLive()
      showActor.send({ type: 'ENTER_INTERMISSION' })

      const paused = ctx().timerPausedRemaining!
      const before = Date.now()
      showActor.send({ type: 'EXIT_INTERMISSION' })

      expect(phase()).toBe('live')
      const timerEnd = ctx().timerEndAt!
      expect(timerEnd).toBeGreaterThanOrEqual(before + paused - 50) // 50ms tolerance
    })
  })

  // ─── Director Mode ───

  describe('ENTER_DIRECTOR', () => {
    it('transitions to director phase', () => {
      goLive()
      showActor.send({ type: 'ENTER_DIRECTOR' })
      expect(phase()).toBe('director')
    })
  })

  describe('EXIT_DIRECTOR', () => {
    it('returns to live when act is active', () => {
      goLive()
      showActor.send({ type: 'ENTER_DIRECTOR' })
      showActor.send({ type: 'EXIT_DIRECTOR' })
      expect(phase()).toBe('live')
    })

    it('returns to live when exiting director with active act', () => {
      goLive()
      showActor.send({ type: 'ENTER_DIRECTOR' })
      // currentActId is set from goLive, so EXIT_DIRECTOR should succeed
      expect(ctx().currentActId).not.toBeNull()
      showActor.send({ type: 'EXIT_DIRECTOR' })
      expect(phase()).toBe('live')
    })
  })

  describe('CALL_SHOW_EARLY', () => {
    it('skips all remaining acts', () => {
      goLive()
      showActor.send({ type: 'CALL_SHOW_EARLY' })

      const acts = ctx().acts
      expect(acts.every((a) => a.status === 'skipped')).toBe(true)
    })

    it('transitions to strike phase', () => {
      goLive()
      showActor.send({ type: 'CALL_SHOW_EARLY' })
      expect(phase()).toBe('strike')
    })

    it('clears timer', () => {
      goLive()
      showActor.send({ type: 'CALL_SHOW_EARLY' })
      expect(ctx().timerEndAt).toBeNull()
    })
  })

  // ─── Lineup Editing ───

  describe('REORDER_ACT', () => {
    beforeEach(() => {
      setupLineup()
    })

    it('moves act up', () => {
      const acts = ctx().acts
      showActor.send({ type: 'REORDER_ACT', actId: acts[1].id, direction: 'up' })

      const reordered = ctx().acts
      expect(reordered[0].name).toBe('Exercise Block')
      expect(reordered[1].name).toBe('Morning Deep Work')
    })

    it('moves act down', () => {
      const acts = ctx().acts
      showActor.send({ type: 'REORDER_ACT', actId: acts[0].id, direction: 'down' })

      const reordered = ctx().acts
      expect(reordered[0].name).toBe('Exercise Block')
      expect(reordered[1].name).toBe('Morning Deep Work')
    })

    it('does nothing at boundaries', () => {
      const acts = ctx().acts
      showActor.send({ type: 'REORDER_ACT', actId: acts[0].id, direction: 'up' })

      const reordered = ctx().acts
      expect(reordered[0].name).toBe('Morning Deep Work')
    })
  })

  describe('REMOVE_ACT', () => {
    it('removes act and re-indexes order', () => {
      setupLineup()
      const acts = ctx().acts
      showActor.send({ type: 'REMOVE_ACT', actId: acts[1].id })

      const remaining = ctx().acts
      expect(remaining).toHaveLength(2)
      expect(remaining[0].order).toBe(0)
      expect(remaining[1].order).toBe(1)
    })
  })

  describe('ADD_ACT', () => {
    it('appends act with correct order', () => {
      setupLineup()
      showActor.send({ type: 'ADD_ACT', name: 'New Act', sketch: 'Creative', durationMinutes: 30 })

      const acts = ctx().acts
      expect(acts).toHaveLength(4)
      expect(acts[3].name).toBe('New Act')
      expect(acts[3].sketch).toBe('Creative')
      expect(acts[3].order).toBe(3)
      expect(acts[3].status).toBe('upcoming')
    })
  })

  // ─── Strike the Stage ───

  describe('STRIKE', () => {
    beforeEach(() => {
      goLive()
    })

    it('sets verdict based on beats locked vs threshold', () => {
      showActor.send({ type: 'STRIKE' })
      // With 0 beats locked, 3 threshold → SHOW_CALLED_EARLY
      expect(ctx().verdict).toBe('SHOW_CALLED_EARLY')
    })

    it('transitions to strike phase', () => {
      showActor.send({ type: 'STRIKE' })
      expect(phase()).toBe('strike')
    })

    it('expands view', () => {
      showActor.send({ type: 'STRIKE' })
      expect(ctx().viewTier).toBe('expanded')
    })
  })

  // ─── Navigation (view tier) ───

  describe('toggleExpanded (via SET_VIEW_TIER)', () => {
    it('toggles between micro and expanded', () => {
      expect(ctx().viewTier).toBe('expanded')
      showActor.send({ type: 'SET_VIEW_TIER', tier: 'micro' })
      expect(ctx().viewTier).toBe('micro')
      showActor.send({ type: 'SET_VIEW_TIER', tier: 'expanded' })
      expect(ctx().viewTier).toBe('expanded')
    })
  })

  describe('viewTier navigation', () => {
    it('SET_VIEW_TIER sets directly', () => {
      showActor.send({ type: 'SET_VIEW_TIER', tier: 'dashboard' })
      expect(ctx().viewTier).toBe('dashboard')
    })
  })

  // ─── Reset ───

  describe('RESET', () => {
    it('resets to initial state', () => {
      goLive()
      showActor.send({ type: 'RESET' })

      expect(phase()).toBe('no_show')
      expect(ctx().energy).toBeNull()
      expect(ctx().acts).toHaveLength(0)
      expect(ctx().verdict).toBeNull()
      expect(ctx().beatsLocked).toBe(0)
      expect(ctx().viewTier).toBe('expanded')
    })
  })

  // ─── Writer's Room Steps ───

  describe('ENTER_WRITERS_ROOM', () => {
    it('sets phase to writers_room', () => {
      showActor.send({ type: 'ENTER_WRITERS_ROOM' })
      expect(phase()).toBe('writers_room')
    })

    it('sets step to energy', () => {
      showActor.send({ type: 'ENTER_WRITERS_ROOM' })
      expect(ctx().writersRoomStep).toBe('energy')
    })

    it('records entry timestamp', () => {
      const before = Date.now()
      showActor.send({ type: 'ENTER_WRITERS_ROOM' })
      const after = Date.now()
      const entered = ctx().writersRoomEnteredAt!
      expect(entered).toBeGreaterThanOrEqual(before)
      expect(entered).toBeLessThanOrEqual(after)
    })
  })

  describe('SET_WRITERS_ROOM_STEP', () => {
    it('changes the writers room step', () => {
      showActor.send({ type: 'ENTER_WRITERS_ROOM' })
      showActor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'plan' })
      expect(ctx().writersRoomStep).toBe('plan')
    })

    it('supports conversation step', () => {
      showActor.send({ type: 'ENTER_WRITERS_ROOM' })
      showActor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'plan' })
      showActor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'conversation' })
      expect(ctx().writersRoomStep).toBe('conversation')
    })
  })

  // ─── Cold Open Transition ───

  describe('TRIGGER_COLD_OPEN / COMPLETE_COLD_OPEN', () => {
    it('triggers cold open and completes to writers room', () => {
      showActor.send({ type: 'TRIGGER_COLD_OPEN' })
      expect(phase()).toBe('cold_open')

      showActor.send({ type: 'COMPLETE_COLD_OPEN' })
      expect(phase()).toBe('writers_room')
    })
  })

  // ─── Going Live Transition ───

  describe('TRIGGER_GOING_LIVE / COMPLETE_GOING_LIVE', () => {
    it('triggers going live and completes to live', () => {
      setupLineup()
      showActor.send({ type: 'TRIGGER_GOING_LIVE' })
      expect(phase()).toBe('going_live')

      showActor.send({ type: 'COMPLETE_GOING_LIVE' })
      expect(phase()).toBe('live')
    })
  })

  // ─── Breathing Pause ───

  describe('START_BREATHING_PAUSE / END_BREATHING_PAUSE', () => {
    it('pauses timer and sets breathing pause end time', () => {
      goLive()
      const before = Date.now()
      showActor.send({ type: 'START_BREATHING_PAUSE' })
      expect(phase()).toBe('intermission')
      expect(ctx().breathingPauseEndAt).toBeGreaterThanOrEqual(before + 5 * 60 * 1000 - 50)
      expect(ctx().timerEndAt).toBeNull()
      expect(ctx().timerPausedRemaining).toBeGreaterThan(0)
    })

    it('accepts custom duration', () => {
      goLive()
      const before = Date.now()
      showActor.send({ type: 'START_BREATHING_PAUSE', durationMs: 60000 }) // 1 minute
      expect(ctx().breathingPauseEndAt).toBeGreaterThanOrEqual(before + 60000 - 50)
    })

    it('clears breathing pause end time', () => {
      goLive()
      showActor.send({ type: 'START_BREATHING_PAUSE' })
      showActor.send({ type: 'END_BREATHING_PAUSE' })
      expect(ctx().breathingPauseEndAt).toBeNull()
    })
  })

  // ─── Selectors ───

  describe('selectCurrentAct (via ctx)', () => {
    beforeEach(() => {
      goLive()
    })

    it('returns active act', () => {
      const c = ctx()
      const current = c.acts.find((a) => a.id === c.currentActId)
      expect(current?.name).toBe('Morning Deep Work')
      expect(current?.status).toBe('active')
    })
  })
})
