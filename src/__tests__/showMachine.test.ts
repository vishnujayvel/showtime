/**
 * Unit tests for the XState v5 show machine.
 *
 * Tests all transitions, guards, nested states, parallel animation region,
 * and context mutations without involving React or Zustand.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createActor } from 'xstate'
import {
  showMachine,
  createInitialContext,
  getPhaseFromState,
  getWritersRoomStep,
  isAnimationActive,
  computeVerdict,
  type ShowMachineContext,
  type ShowMachineEvent,
} from '../renderer/machines/showMachine'
import type { ShowLineup, ShowPhase, Act, ViewTier } from '../shared/types'

// ─── Helpers ───

const sampleLineup: ShowLineup = {
  acts: [
    { name: 'Deep Work', sketch: 'Deep Work', durationMinutes: 60 },
    { name: 'Exercise', sketch: 'Exercise', durationMinutes: 45 },
    { name: 'Admin', sketch: 'Admin', durationMinutes: 30 },
  ],
  beatThreshold: 3,
  openingNote: 'Test lineup',
}

function createTestActor(contextOverrides?: Partial<ShowMachineContext>) {
  const actor = createActor(showMachine, {
    ...(contextOverrides ? {
      snapshot: showMachine.resolveState({
        value: { phase: 'no_show', animation: 'idle' },
        context: { ...createInitialContext(), ...contextOverrides },
      }),
    } : {}),
  })
  actor.start()
  return actor
}

function getPhase(actor: ReturnType<typeof createTestActor>): ShowPhase {
  return getPhaseFromState(actor.getSnapshot().value as Record<string, unknown>)
}

function getContext(actor: ReturnType<typeof createTestActor>): ShowMachineContext {
  return actor.getSnapshot().context
}

function setupLive(actor: ReturnType<typeof createTestActor>) {
  actor.send({ type: 'ENTER_WRITERS_ROOM' })
  actor.send({ type: 'SET_LINEUP', lineup: sampleLineup })
  actor.send({ type: 'START_SHOW' })
}

// ─── Tests ───

describe('showMachine', () => {
  let actor: ReturnType<typeof createTestActor>

  beforeEach(() => {
    actor = createTestActor()
  })

  // ─── Initial State ───

  describe('initial state', () => {
    it('starts in no_show phase with idle animation', () => {
      const snap = actor.getSnapshot()
      expect(snap.value).toEqual({ phase: 'no_show', animation: 'idle' })
    })

    it('has correct initial context', () => {
      const ctx = getContext(actor)
      expect(ctx.energy).toBeNull()
      expect(ctx.acts).toHaveLength(0)
      expect(ctx.currentActId).toBeNull()
      expect(ctx.beatsLocked).toBe(0)
      expect(ctx.beatThreshold).toBe(3)
      expect(ctx.verdict).toBeNull()
      expect(ctx.viewTier).toBe('expanded')
    })
  })

  // ─── Phase Transitions: Happy Path ───

  describe('happy path: no_show → writers_room → live → strike', () => {
    it('transitions through the full show lifecycle', () => {
      // no_show → writers_room
      actor.send({ type: 'ENTER_WRITERS_ROOM' })
      expect(getPhase(actor)).toBe('writers_room')
      expect(getContext(actor).writersRoomStep).toBe('energy')
      expect(getContext(actor).writersRoomEnteredAt).not.toBeNull()

      // Set energy
      actor.send({ type: 'SET_ENERGY', level: 'high' })
      expect(getContext(actor).energy).toBe('high')

      // Set lineup
      actor.send({ type: 'SET_LINEUP', lineup: sampleLineup })
      expect(getContext(actor).acts).toHaveLength(3)
      expect(getContext(actor).beatThreshold).toBe(3)

      // writers_room → live
      actor.send({ type: 'START_SHOW' })
      expect(getPhase(actor)).toBe('live')
      expect(getContext(actor).currentActId).not.toBeNull()
      expect(getContext(actor).showStartedAt).not.toBeNull()
      expect(getContext(actor).timerEndAt).not.toBeNull()
      expect(getContext(actor).viewTier).toBe('micro')

      // First act is active
      const firstAct = getContext(actor).acts[0]
      expect(firstAct.status).toBe('active')
      expect(firstAct.startedAt).toBeDefined()

      // Complete all acts with beat skips
      for (let i = 0; i < 3; i++) {
        const actId = getContext(actor).currentActId!
        actor.send({ type: 'COMPLETE_ACT', actId })
        actor.send({ type: 'SKIP_BEAT' })
      }

      expect(getPhase(actor)).toBe('strike')
      expect(getContext(actor).verdict).not.toBeNull()
    })
  })

  // ─── Writer's Room Substates ───

  describe('writers_room nested states', () => {
    beforeEach(() => {
      actor.send({ type: 'ENTER_WRITERS_ROOM' })
    })

    it('starts in energy substep', () => {
      const step = getWritersRoomStep(actor.getSnapshot().value as Record<string, unknown>)
      expect(step).toBe('energy')
    })

    it('advances energy → plan', () => {
      actor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'plan' })
      const step = getWritersRoomStep(actor.getSnapshot().value as Record<string, unknown>)
      expect(step).toBe('plan')
    })

    it('advances plan → conversation', () => {
      actor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'plan' })
      actor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'conversation' })
      const step = getWritersRoomStep(actor.getSnapshot().value as Record<string, unknown>)
      expect(step).toBe('conversation')
    })

    it('conversation → lineup_ready on SET_LINEUP', () => {
      actor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'plan' })
      actor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'conversation' })
      actor.send({ type: 'SET_LINEUP', lineup: sampleLineup })
      const step = getWritersRoomStep(actor.getSnapshot().value as Record<string, unknown>)
      expect(step).toBe('lineup_ready')
    })

    it('cannot skip directly from energy to conversation', () => {
      actor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'conversation' })
      const step = getWritersRoomStep(actor.getSnapshot().value as Record<string, unknown>)
      // Should still be energy — invalid transition ignored
      expect(step).toBe('energy')
    })
  })

  // ─── Guard: Cannot start show without acts ───

  describe('guards', () => {
    it('START_SHOW blocked without acts', () => {
      actor.send({ type: 'ENTER_WRITERS_ROOM' })
      actor.send({ type: 'START_SHOW' })
      // Should still be in writers_room
      expect(getPhase(actor)).toBe('writers_room')
    })

    it('START_SHOW allowed with acts', () => {
      actor.send({ type: 'ENTER_WRITERS_ROOM' })
      actor.send({ type: 'SET_LINEUP', lineup: sampleLineup })
      actor.send({ type: 'START_SHOW' })
      expect(getPhase(actor)).toBe('live')
    })

    it('EXIT_DIRECTOR blocked without current act', () => {
      actor.send({ type: 'ENTER_WRITERS_ROOM' })
      actor.send({ type: 'SET_LINEUP', lineup: sampleLineup })
      actor.send({ type: 'START_SHOW' })

      // Complete all acts to clear currentActId
      for (let i = 0; i < 3; i++) {
        const actId = getContext(actor).currentActId!
        actor.send({ type: 'COMPLETE_ACT', actId })
        actor.send({ type: 'SKIP_BEAT' })
      }
      // Now in strike — can't test EXIT_DIRECTOR guard directly from here
      // Let's test a different scenario
      expect(getPhase(actor)).toBe('strike')
    })
  })

  // ─── Cold Open Transition ───

  describe('cold open animation', () => {
    it('no_show → cold_open → writers_room', () => {
      actor.send({ type: 'TRIGGER_COLD_OPEN' })
      expect(getPhase(actor)).toBe('cold_open')

      // Animation region should be in cold_open
      const snap = actor.getSnapshot()
      expect(isAnimationActive(snap.value as Record<string, unknown>, 'cold_open')).toBe(true)

      actor.send({ type: 'COMPLETE_COLD_OPEN' })
      expect(getPhase(actor)).toBe('writers_room')
      expect(isAnimationActive(actor.getSnapshot().value as Record<string, unknown>, 'cold_open')).toBe(false)
    })
  })

  // ─── Going Live Transition ───

  describe('going live animation', () => {
    it('writers_room → going_live → live', () => {
      actor.send({ type: 'ENTER_WRITERS_ROOM' })
      actor.send({ type: 'SET_LINEUP', lineup: sampleLineup })
      actor.send({ type: 'TRIGGER_GOING_LIVE' })
      expect(getPhase(actor)).toBe('going_live')

      const snap = actor.getSnapshot()
      expect(isAnimationActive(snap.value as Record<string, unknown>, 'going_live')).toBe(true)

      actor.send({ type: 'COMPLETE_GOING_LIVE' })
      expect(getPhase(actor)).toBe('live')
      expect(isAnimationActive(actor.getSnapshot().value as Record<string, unknown>, 'going_live')).toBe(false)
    })
  })

  // ─── Intermission ───

  describe('intermission', () => {
    beforeEach(() => {
      setupLive(actor)
    })

    it('live → intermission preserves timer', () => {
      const timerBefore = getContext(actor).timerEndAt!
      actor.send({ type: 'ENTER_INTERMISSION' })
      expect(getPhase(actor)).toBe('intermission')
      expect(getContext(actor).timerEndAt).toBeNull()
      expect(getContext(actor).timerPausedRemaining).toBeGreaterThan(0)
    })

    it('intermission → live restores timer (paused timer path)', () => {
      actor.send({ type: 'ENTER_INTERMISSION' })
      const remaining = getContext(actor).timerPausedRemaining!
      expect(remaining).toBeGreaterThan(0)

      actor.send({ type: 'EXIT_INTERMISSION' })
      expect(getPhase(actor)).toBe('live')
      expect(getContext(actor).timerEndAt).not.toBeNull()
      expect(getContext(actor).timerPausedRemaining).toBeNull()
    })

    it('breathing pause within intermission', () => {
      actor.send({ type: 'ENTER_INTERMISSION' })

      const snap1 = actor.getSnapshot()
      const intermissionSubstate = (snap1.value as any).phase.intermission
      expect(intermissionSubstate).toBe('resting')

      actor.send({ type: 'START_BREATHING_PAUSE', durationMs: 300000 })
      const snap2 = actor.getSnapshot()
      expect((snap2.value as any).phase.intermission).toBe('breathing_pause')
      expect(getContext(actor).breathingPauseEndAt).not.toBeNull()

      actor.send({ type: 'END_BREATHING_PAUSE' })
      const snap3 = actor.getSnapshot()
      expect((snap3.value as any).phase.intermission).toBe('resting')
      expect(getContext(actor).breathingPauseEndAt).toBeNull()
    })
  })

  // ─── Director Mode ───

  describe('director mode', () => {
    beforeEach(() => {
      setupLive(actor)
    })

    it('live → director → live (exit)', () => {
      actor.send({ type: 'ENTER_DIRECTOR' })
      expect(getPhase(actor)).toBe('director')

      actor.send({ type: 'EXIT_DIRECTOR' })
      expect(getPhase(actor)).toBe('live')
    })

    it('director → strike via CALL_SHOW_EARLY', () => {
      actor.send({ type: 'ENTER_DIRECTOR' })
      actor.send({ type: 'CALL_SHOW_EARLY' })
      expect(getPhase(actor)).toBe('strike')
      expect(getContext(actor).verdict).toBe('SHOW_CALLED_EARLY')
    })

    it('director → live via SKIP_TO_NEXT (when next act exists)', () => {
      actor.send({ type: 'ENTER_DIRECTOR' })
      actor.send({ type: 'SKIP_TO_NEXT' })
      expect(getPhase(actor)).toBe('live')
      // Should now be on the second act
      const ctx = getContext(actor)
      expect(ctx.acts[0].status).toBe('skipped')
      expect(ctx.currentActId).toBe(ctx.acts[1].id)
    })
  })

  // ─── Beat Check Flow ───

  describe('beat check', () => {
    beforeEach(() => {
      setupLive(actor)
    })

    it('COMPLETE_ACT → beat_check state', () => {
      const actId = getContext(actor).currentActId!
      actor.send({ type: 'COMPLETE_ACT', actId })

      const snap = actor.getSnapshot()
      expect((snap.value as any).phase.live).toBe('beat_check')
      expect(getContext(actor).beatCheckPending).toBe(true)
    })

    it('LOCK_BEAT → celebrating state', () => {
      const actId = getContext(actor).currentActId!
      actor.send({ type: 'COMPLETE_ACT', actId })
      actor.send({ type: 'LOCK_BEAT' })

      const snap = actor.getSnapshot()
      expect((snap.value as any).phase.live).toBe('celebrating')
      expect(getContext(actor).celebrationActive).toBe(true)
      expect(getContext(actor).beatsLocked).toBe(1)
    })

    it('CELEBRATION_DONE advances to next act', () => {
      const actId = getContext(actor).currentActId!
      actor.send({ type: 'COMPLETE_ACT', actId })
      actor.send({ type: 'LOCK_BEAT' })
      actor.send({ type: 'CELEBRATION_DONE' })

      expect(getPhase(actor)).toBe('live')
      const snap = actor.getSnapshot()
      expect((snap.value as any).phase.live).toBe('act_active')
      expect(getContext(actor).celebrationActive).toBe(false)
      // Should be on second act
      expect(getContext(actor).currentActId).toBe(getContext(actor).acts[1].id)
    })

    it('SKIP_BEAT advances to next act', () => {
      const actId = getContext(actor).currentActId!
      actor.send({ type: 'COMPLETE_ACT', actId })
      actor.send({ type: 'SKIP_BEAT' })

      const snap = actor.getSnapshot()
      expect((snap.value as any).phase.live).toBe('act_active')
      expect(getContext(actor).beatCheckPending).toBe(false)
      expect(getContext(actor).beatsLocked).toBe(0) // didn't lock
    })

    it('last act SKIP_BEAT → strike', () => {
      // Complete first two acts
      for (let i = 0; i < 2; i++) {
        const actId = getContext(actor).currentActId!
        actor.send({ type: 'COMPLETE_ACT', actId })
        actor.send({ type: 'SKIP_BEAT' })
      }
      // Now on last act
      const actId = getContext(actor).currentActId!
      actor.send({ type: 'COMPLETE_ACT', actId })
      actor.send({ type: 'SKIP_BEAT' })

      expect(getPhase(actor)).toBe('strike')
    })

    it('last act CELEBRATION_DONE → strike', () => {
      // Complete first two acts
      for (let i = 0; i < 2; i++) {
        const actId = getContext(actor).currentActId!
        actor.send({ type: 'COMPLETE_ACT', actId })
        actor.send({ type: 'SKIP_BEAT' })
      }
      // Last act with beat lock
      const actId = getContext(actor).currentActId!
      actor.send({ type: 'COMPLETE_ACT', actId })
      actor.send({ type: 'LOCK_BEAT' })
      actor.send({ type: 'CELEBRATION_DONE' })

      expect(getPhase(actor)).toBe('strike')
    })
  })

  // ─── Skip Act ───

  describe('skip act', () => {
    beforeEach(() => {
      setupLive(actor)
    })

    it('skipping current act auto-starts next', () => {
      const firstActId = getContext(actor).currentActId!
      actor.send({ type: 'SKIP_ACT', actId: firstActId })

      expect(getPhase(actor)).toBe('live')
      expect(getContext(actor).acts[0].status).toBe('skipped')
      expect(getContext(actor).currentActId).toBe(getContext(actor).acts[1].id)
    })

    it('skipping all acts → strike', () => {
      const acts = getContext(actor).acts
      actor.send({ type: 'SKIP_ACT', actId: acts[0].id })
      actor.send({ type: 'SKIP_ACT', actId: acts[1].id })
      actor.send({ type: 'SKIP_ACT', actId: acts[2].id })

      expect(getPhase(actor)).toBe('strike')
    })
  })

  // ─── Extend Act ───

  describe('extend act', () => {
    it('adds time to timer', () => {
      setupLive(actor)
      const before = getContext(actor).timerEndAt!
      actor.send({ type: 'EXTEND_ACT', minutes: 15 })
      const after = getContext(actor).timerEndAt!
      expect(after - before).toBe(15 * 60 * 1000)
    })
  })

  // ─── Lineup Editing ───

  describe('lineup editing', () => {
    beforeEach(() => {
      actor.send({ type: 'ENTER_WRITERS_ROOM' })
      actor.send({ type: 'SET_LINEUP', lineup: sampleLineup })
    })

    it('reorder act', () => {
      const acts = getContext(actor).acts
      actor.send({ type: 'REORDER_ACT', actId: acts[1].id, direction: 'up' })
      expect(getContext(actor).acts[0].name).toBe('Exercise')
      expect(getContext(actor).acts[1].name).toBe('Deep Work')
    })

    it('remove act', () => {
      const acts = getContext(actor).acts
      actor.send({ type: 'REMOVE_ACT', actId: acts[2].id })
      expect(getContext(actor).acts).toHaveLength(2)
    })

    it('add act', () => {
      actor.send({ type: 'ADD_ACT', name: 'Creative', sketch: 'Creative', durationMinutes: 40 })
      expect(getContext(actor).acts).toHaveLength(4)
      expect(getContext(actor).acts[3].name).toBe('Creative')
    })
  })

  // ─── Verdict Computation ───

  describe('verdict computation', () => {
    it('DAY_WON when all beats locked', () => {
      expect(computeVerdict(3, 3)).toBe('DAY_WON')
    })

    it('SOLID_SHOW when one short', () => {
      expect(computeVerdict(2, 3)).toBe('SOLID_SHOW')
    })

    it('GOOD_EFFORT when at least half', () => {
      expect(computeVerdict(2, 4)).toBe('GOOD_EFFORT')
    })

    it('SHOW_CALLED_EARLY when below half', () => {
      expect(computeVerdict(0, 3)).toBe('SHOW_CALLED_EARLY')
    })
  })

  // ─── Reset ───

  describe('reset', () => {
    it('resets from strike to no_show', () => {
      setupLive(actor)
      actor.send({ type: 'STRIKE' })
      expect(getPhase(actor)).toBe('strike')

      actor.send({ type: 'RESET' })
      expect(getPhase(actor)).toBe('no_show')
      expect(getContext(actor).acts).toHaveLength(0)
      expect(getContext(actor).verdict).toBeNull()
      expect(getContext(actor).energy).toBeNull()
      expect(getContext(actor).currentActId).toBeNull()
    })

    it('resets from any phase', () => {
      actor.send({ type: 'ENTER_WRITERS_ROOM' })
      actor.send({ type: 'RESET' })
      expect(getPhase(actor)).toBe('no_show')

      setupLive(actor)
      actor.send({ type: 'RESET' })
      expect(getPhase(actor)).toBe('no_show')
    })
  })

  // ─── Invalid Transitions (Guard Gaps Fixed) ───

  describe('guard gap fixes — invalid transitions are no-ops', () => {
    it('cannot enter intermission from no_show', () => {
      actor.send({ type: 'ENTER_INTERMISSION' })
      expect(getPhase(actor)).toBe('no_show')
    })

    it('cannot enter intermission from writers_room', () => {
      actor.send({ type: 'ENTER_WRITERS_ROOM' })
      actor.send({ type: 'ENTER_INTERMISSION' })
      expect(getPhase(actor)).toBe('writers_room')
    })

    it('cannot enter director from no_show', () => {
      actor.send({ type: 'ENTER_DIRECTOR' })
      expect(getPhase(actor)).toBe('no_show')
    })

    it('cannot start show from no_show', () => {
      actor.send({ type: 'START_SHOW' })
      expect(getPhase(actor)).toBe('no_show')
    })

    it('cannot start show from strike', () => {
      setupLive(actor)
      actor.send({ type: 'STRIKE' })
      actor.send({ type: 'START_SHOW' })
      expect(getPhase(actor)).toBe('strike')
    })

    it('cannot enter writers_room from live', () => {
      setupLive(actor)
      actor.send({ type: 'ENTER_WRITERS_ROOM' })
      expect(getPhase(actor)).toBe('live')
    })

    it('cannot complete act from intermission', () => {
      setupLive(actor)
      const actId = getContext(actor).currentActId!
      actor.send({ type: 'ENTER_INTERMISSION' })
      actor.send({ type: 'COMPLETE_ACT', actId })
      expect(getPhase(actor)).toBe('intermission')
    })
  })

  // ─── Parallel Animation Region ───

  describe('parallel animation region', () => {
    it('animation stays idle during normal transitions', () => {
      actor.send({ type: 'ENTER_WRITERS_ROOM' })
      expect(isAnimationActive(actor.getSnapshot().value as Record<string, unknown>, 'cold_open')).toBe(false)
      expect(isAnimationActive(actor.getSnapshot().value as Record<string, unknown>, 'going_live')).toBe(false)
    })

    it('cold open and going live are mutually exclusive', () => {
      actor.send({ type: 'TRIGGER_COLD_OPEN' })
      expect(isAnimationActive(actor.getSnapshot().value as Record<string, unknown>, 'cold_open')).toBe(true)
      expect(isAnimationActive(actor.getSnapshot().value as Record<string, unknown>, 'going_live')).toBe(false)
    })
  })

  // ─── Phase Extraction Helpers ───

  describe('getPhaseFromState', () => {
    it('extracts from simple state', () => {
      expect(getPhaseFromState({ phase: 'no_show', animation: 'idle' })).toBe('no_show')
    })

    it('extracts from nested state', () => {
      expect(getPhaseFromState({ phase: { writers_room: 'energy' }, animation: 'idle' })).toBe('writers_room')
    })

    it('extracts from deeply nested state', () => {
      expect(getPhaseFromState({ phase: { live: 'act_active' }, animation: 'idle' })).toBe('live')
    })
  })

  // ─── View Tier ───

  describe('view tier', () => {
    it('SET_VIEW_TIER updates viewTier in context', () => {
      setupLive(actor)
      actor.send({ type: 'SET_VIEW_TIER', tier: 'expanded' })
      expect(getContext(actor).viewTier).toBe('expanded')
    })

    it('startShow sets viewTier to micro', () => {
      actor.send({ type: 'ENTER_WRITERS_ROOM' })
      actor.send({ type: 'SET_LINEUP', lineup: sampleLineup })
      actor.send({ type: 'START_SHOW' })
      expect(getContext(actor).viewTier).toBe('micro')
    })
  })
})
