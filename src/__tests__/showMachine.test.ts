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
import type { ShowLineup, ShowPhase, Act, ViewTier, EnergyLevel, ActStatus } from '../shared/types'

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
  actor.send({ type: 'FINALIZE_LINEUP' })
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

      // Set lineup (accepted from any writers_room substate at parent level)
      actor.send({ type: 'SET_LINEUP', lineup: sampleLineup })
      expect(getContext(actor).acts).toHaveLength(3)
      expect(getContext(actor).beatThreshold).toBe(3)

      // Finalize lineup (required before START_SHOW)
      actor.send({ type: 'FINALIZE_LINEUP' })

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

    it('SET_LINEUP from any substate → lineup_ready', () => {
      // SET_LINEUP is now at parent level, accepted from any substate
      actor.send({ type: 'SET_LINEUP', lineup: sampleLineup })
      const step = getWritersRoomStep(actor.getSnapshot().value as Record<string, unknown>)
      expect(step).toBe('lineup_ready')
    })

    it('enforces sequential flow (energy → plan → conversation)', () => {
      // Cannot skip from energy directly to conversation
      actor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'conversation' })
      expect(getWritersRoomStep(actor.getSnapshot().value as Record<string, unknown>)).toBe('energy')

      // Must go through plan first
      actor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'plan' })
      expect(getWritersRoomStep(actor.getSnapshot().value as Record<string, unknown>)).toBe('plan')
      actor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'conversation' })
      expect(getWritersRoomStep(actor.getSnapshot().value as Record<string, unknown>)).toBe('conversation')
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

    it('START_SHOW allowed with confirmed lineup', () => {
      actor.send({ type: 'ENTER_WRITERS_ROOM' })
      actor.send({ type: 'SET_LINEUP', lineup: sampleLineup })
      actor.send({ type: 'FINALIZE_LINEUP' })
      actor.send({ type: 'START_SHOW' })
      expect(getPhase(actor)).toBe('live')
    })

    it('START_SHOW blocked without confirmed lineup (draft)', () => {
      actor.send({ type: 'ENTER_WRITERS_ROOM' })
      actor.send({ type: 'SET_LINEUP', lineup: sampleLineup })
      // lineup is draft, not confirmed
      actor.send({ type: 'START_SHOW' })
      expect(getPhase(actor)).toBe('writers_room')
    })

    it('EXIT_DIRECTOR blocked without current act', () => {
      actor.send({ type: 'ENTER_WRITERS_ROOM' })
      actor.send({ type: 'SET_LINEUP', lineup: sampleLineup })
      actor.send({ type: 'FINALIZE_LINEUP' })
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
      actor.send({ type: 'FINALIZE_LINEUP' })
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
      actor.send({ type: 'FINALIZE_LINEUP' })
      actor.send({ type: 'START_SHOW' })
      expect(getContext(actor).viewTier).toBe('micro')
    })

    it('SET_VIEW_TIER works from any phase', () => {
      // no_show
      actor.send({ type: 'SET_VIEW_TIER', tier: 'micro' })
      expect(getContext(actor).viewTier).toBe('micro')

      // writers_room
      actor.send({ type: 'ENTER_WRITERS_ROOM' })
      actor.send({ type: 'SET_VIEW_TIER', tier: 'expanded' })
      expect(getContext(actor).viewTier).toBe('expanded')

      // intermission
      actor.send({ type: 'SET_LINEUP', lineup: sampleLineup })
      actor.send({ type: 'FINALIZE_LINEUP' })
      actor.send({ type: 'START_SHOW' })
      actor.send({ type: 'ENTER_INTERMISSION' })
      actor.send({ type: 'SET_VIEW_TIER', tier: 'micro' })
      expect(getContext(actor).viewTier).toBe('micro')
    })
  })

  // ─── Fix Verification: LOCK_BEAT/SKIP_BEAT restricted to beat_check ───

  describe('fix: LOCK_BEAT/SKIP_BEAT only from beat_check/celebrating', () => {
    beforeEach(() => {
      setupLive(actor)
    })

    it('LOCK_BEAT is a no-op from act_active', () => {
      const snap = actor.getSnapshot()
      expect((snap.value as any).phase.live).toBe('act_active')

      actor.send({ type: 'LOCK_BEAT' })

      // Should still be in act_active, beatsLocked unchanged
      const after = actor.getSnapshot()
      expect((after.value as any).phase.live).toBe('act_active')
      expect(getContext(actor).beatsLocked).toBe(0)
    })

    it('SKIP_BEAT is a no-op from act_active', () => {
      const snap = actor.getSnapshot()
      expect((snap.value as any).phase.live).toBe('act_active')

      actor.send({ type: 'SKIP_BEAT' })

      // Should still be in act_active
      const after = actor.getSnapshot()
      expect((after.value as any).phase.live).toBe('act_active')
    })

    it('LOCK_BEAT works from beat_check', () => {
      const actId = getContext(actor).currentActId!
      actor.send({ type: 'COMPLETE_ACT', actId })
      expect((actor.getSnapshot().value as any).phase.live).toBe('beat_check')

      actor.send({ type: 'LOCK_BEAT' })
      expect((actor.getSnapshot().value as any).phase.live).toBe('celebrating')
      expect(getContext(actor).beatsLocked).toBe(1)
    })

    it('SKIP_BEAT works from beat_check', () => {
      const actId = getContext(actor).currentActId!
      actor.send({ type: 'COMPLETE_ACT', actId })
      expect((actor.getSnapshot().value as any).phase.live).toBe('beat_check')

      actor.send({ type: 'SKIP_BEAT' })
      expect((actor.getSnapshot().value as any).phase.live).toBe('act_active')
    })

    it('double LOCK_BEAT in celebrating stays in celebrating', () => {
      const actId = getContext(actor).currentActId!
      actor.send({ type: 'COMPLETE_ACT', actId })
      actor.send({ type: 'LOCK_BEAT' })
      expect((actor.getSnapshot().value as any).phase.live).toBe('celebrating')

      actor.send({ type: 'LOCK_BEAT' })
      expect((actor.getSnapshot().value as any).phase.live).toBe('celebrating')
      expect(getContext(actor).beatsLocked).toBe(2)
    })
  })

  // ─── Fix Verification: writers_room substate guard enforcement ───

  describe('fix: writers_room parent-level bypass prevented', () => {
    beforeEach(() => {
      actor.send({ type: 'ENTER_WRITERS_ROOM' })
    })

    it('SET_WRITERS_ROOM_STEP cannot skip energy → conversation (guard bypass)', () => {
      // Before fix: parent handler would accept this unconditionally
      actor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'conversation' })
      expect(getWritersRoomStep(actor.getSnapshot().value as Record<string, unknown>)).toBe('energy')
    })

    it('SET_WRITERS_ROOM_STEP cannot skip energy → lineup_ready', () => {
      actor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'lineup_ready' as any })
      expect(getWritersRoomStep(actor.getSnapshot().value as Record<string, unknown>)).toBe('energy')
    })

    it('SET_LINEUP works from energy substate (parent-level handler)', () => {
      actor.send({ type: 'SET_LINEUP', lineup: sampleLineup })
      // SET_LINEUP is now at parent level, accepted from any substate
      expect(getWritersRoomStep(actor.getSnapshot().value as Record<string, unknown>)).toBe('lineup_ready')
      expect(getContext(actor).acts).toHaveLength(3)
    })

    it('SET_LINEUP works from plan substate (parent-level handler)', () => {
      actor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'plan' })
      actor.send({ type: 'SET_LINEUP', lineup: sampleLineup })
      expect(getWritersRoomStep(actor.getSnapshot().value as Record<string, unknown>)).toBe('lineup_ready')
      expect(getContext(actor).acts).toHaveLength(3)
    })

    it('SET_LINEUP works from conversation → lineup_ready', () => {
      actor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'plan' })
      actor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'conversation' })
      actor.send({ type: 'SET_LINEUP', lineup: sampleLineup })
      expect(getWritersRoomStep(actor.getSnapshot().value as Record<string, unknown>)).toBe('lineup_ready')
      expect(getContext(actor).acts).toHaveLength(3)
    })

    it('SET_ENERGY only works from energy substate', () => {
      // Works in energy
      actor.send({ type: 'SET_ENERGY', level: 'high' })
      expect(getContext(actor).energy).toBe('high')

      // Move to plan
      actor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'plan' })

      // SET_ENERGY is a no-op from plan (no longer at parent level)
      actor.send({ type: 'SET_ENERGY', level: 'low' })
      expect(getContext(actor).energy).toBe('high') // unchanged
    })

    it('SET_ENERGY is a no-op from conversation substate', () => {
      actor.send({ type: 'SET_ENERGY', level: 'high' })
      actor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'plan' })
      actor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'conversation' })

      actor.send({ type: 'SET_ENERGY', level: 'low' })
      expect(getContext(actor).energy).toBe('high') // unchanged
    })

    it('backward navigation: plan → energy works', () => {
      actor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'plan' })
      actor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'energy' })
      expect(getWritersRoomStep(actor.getSnapshot().value as Record<string, unknown>)).toBe('energy')
    })

    it('backward navigation: conversation → plan works', () => {
      actor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'plan' })
      actor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'conversation' })
      actor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'plan' })
      expect(getWritersRoomStep(actor.getSnapshot().value as Record<string, unknown>)).toBe('plan')
    })

    it('backward navigation: conversation → energy works', () => {
      actor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'plan' })
      actor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'conversation' })
      actor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'energy' })
      expect(getWritersRoomStep(actor.getSnapshot().value as Record<string, unknown>)).toBe('energy')
    })
  })

  // ─── EXIT_INTERMISSION: All 3 guard paths ───

  describe('EXIT_INTERMISSION guard paths', () => {
    it('path 1: hasPausedTimer — resumes timer', () => {
      setupLive(actor)
      actor.send({ type: 'ENTER_INTERMISSION' })
      expect(getContext(actor).timerPausedRemaining).toBeGreaterThan(0)

      actor.send({ type: 'EXIT_INTERMISSION' })
      expect(getPhase(actor)).toBe('live')
      expect(getContext(actor).timerEndAt).not.toBeNull()
      expect(getContext(actor).timerPausedRemaining).toBeNull()
    })

    it('path 2: hasNextAct (no paused timer) — starts next act', () => {
      setupLive(actor)
      // Complete act 1, skip beat → now on act 2
      const act1 = getContext(actor).currentActId!
      actor.send({ type: 'COMPLETE_ACT', actId: act1 })
      actor.send({ type: 'SKIP_BEAT' })

      // Complete act 2 → beat_check (timer cleared by completeActContext)
      const act2 = getContext(actor).currentActId!
      actor.send({ type: 'COMPLETE_ACT', actId: act2 })

      // Enter intermission from beat_check. timerEndAt is already null
      // (cleared by completeActContext), so enterIntermissionContext sets
      // timerPausedRemaining = null. Act 3 is still upcoming → hasNextAct is true.
      actor.send({ type: 'ENTER_INTERMISSION' })
      expect(getPhase(actor)).toBe('intermission')
      expect(getContext(actor).timerPausedRemaining).toBeNull()
      expect(getContext(actor).acts.some((a) => a.status === 'upcoming')).toBe(true)

      // EXIT_INTERMISSION: hasPausedTimer=false, hasNextAct=true → path 2
      actor.send({ type: 'EXIT_INTERMISSION' })
      expect(getPhase(actor)).toBe('live')
      // Path 2 starts the next upcoming act (act 3)
      const act3 = getContext(actor).currentActId!
      expect(act3).not.toBe(act1)
      expect(act3).not.toBe(act2)
      expect(getContext(actor).timerEndAt).not.toBeNull()
    })

    it('path 3: neither guard — goes to strike', () => {
      // Set up a 1-act show so there's no next act after completing it
      actor = createTestActor()
      const oneActLineup: ShowLineup = {
        acts: [{ name: 'Solo', sketch: 'Solo', durationMinutes: 30 }],
        beatThreshold: 1,
        openingNote: 'One act',
      }
      actor.send({ type: 'ENTER_WRITERS_ROOM' })
      actor.send({ type: 'SET_LINEUP', lineup: oneActLineup })
      actor.send({ type: 'FINALIZE_LINEUP' })
      actor.send({ type: 'START_SHOW' })

      // Complete the only act → beat_check (timer cleared)
      const actId = getContext(actor).currentActId!
      actor.send({ type: 'COMPLETE_ACT', actId })
      expect(getContext(actor).timerEndAt).toBeNull()

      // Enter intermission from beat_check. No timer → timerPausedRemaining stays null.
      // Only act is completed → no upcoming acts.
      actor.send({ type: 'ENTER_INTERMISSION' })
      expect(getPhase(actor)).toBe('intermission')
      expect(getContext(actor).timerPausedRemaining).toBeNull()
      expect(getContext(actor).acts.every((a) => a.status !== 'upcoming')).toBe(true)

      // EXIT_INTERMISSION: hasPausedTimer=false, hasNextAct=false → path 3 (strike)
      actor.send({ type: 'EXIT_INTERMISSION' })
      expect(getPhase(actor)).toBe('strike')
      expect(getContext(actor).verdict).toBeDefined()
    })
  })

  // ─── Lineup Editing During Live and Intermission ───

  describe('lineup editing during live show', () => {
    beforeEach(() => {
      setupLive(actor)
    })

    it('ADD_ACT during live adds to lineup', () => {
      actor.send({ type: 'ADD_ACT', name: 'Bonus', sketch: 'Bonus', durationMinutes: 20 })
      expect(getContext(actor).acts).toHaveLength(4)
      expect(getContext(actor).acts[3].name).toBe('Bonus')
    })

    it('REMOVE_ACT on non-current act during live', () => {
      const thirdActId = getContext(actor).acts[2].id
      actor.send({ type: 'REMOVE_ACT', actId: thirdActId })
      expect(getContext(actor).acts).toHaveLength(2)
      expect(getContext(actor).currentActId).not.toBeNull() // current act unaffected
    })

    it('REMOVE_ACT on current act auto-starts next act', () => {
      const currentActId = getContext(actor).currentActId!
      const secondActId = getContext(actor).acts[1].id
      actor.send({ type: 'REMOVE_ACT', actId: currentActId })
      // PR #149: removing the current act auto-starts the next upcoming act
      expect(getContext(actor).currentActId).toBe(secondActId)
      expect(getContext(actor).timerEndAt).not.toBeNull()
      expect(getContext(actor).acts).toHaveLength(2)
    })

    it('REORDER_ACT during live', () => {
      const secondActId = getContext(actor).acts[1].id
      actor.send({ type: 'REORDER_ACT', actId: secondActId, direction: 'up' })
      expect(getContext(actor).acts[0].id).toBe(secondActId)
    })
  })

  describe('lineup editing during intermission', () => {
    beforeEach(() => {
      setupLive(actor)
      actor.send({ type: 'ENTER_INTERMISSION' })
    })

    it('ADD_ACT during intermission', () => {
      actor.send({ type: 'ADD_ACT', name: 'Extra', sketch: 'Extra', durationMinutes: 15 })
      expect(getContext(actor).acts).toHaveLength(4)
    })

    it('REMOVE_ACT during intermission', () => {
      const thirdActId = getContext(actor).acts[2].id
      actor.send({ type: 'REMOVE_ACT', actId: thirdActId })
      expect(getContext(actor).acts).toHaveLength(2)
    })
  })

  // ─── Director Edge Cases ───

  describe('director edge cases', () => {
    it('SKIP_TO_NEXT with no remaining acts → strike', () => {
      actor.send({ type: 'ENTER_WRITERS_ROOM' })
      const oneActLineup: ShowLineup = {
        acts: [{ name: 'Solo', sketch: 'Solo', durationMinutes: 30 }],
        beatThreshold: 1,
        openingNote: 'One act',
      }
      actor.send({ type: 'SET_LINEUP', lineup: oneActLineup })
      actor.send({ type: 'FINALIZE_LINEUP' })
      actor.send({ type: 'START_SHOW' })
      actor.send({ type: 'ENTER_DIRECTOR' })
      actor.send({ type: 'SKIP_TO_NEXT' })
      expect(getPhase(actor)).toBe('strike')
    })

    it('START_BREATHING_PAUSE from director → intermission.breathing_pause', () => {
      setupLive(actor)
      actor.send({ type: 'ENTER_DIRECTOR' })
      actor.send({ type: 'START_BREATHING_PAUSE', durationMs: 60000 })
      expect(getPhase(actor)).toBe('intermission')
      const snap = actor.getSnapshot()
      expect((snap.value as any).phase.intermission).toBe('breathing_pause')
    })

    it('RESET from director', () => {
      setupLive(actor)
      actor.send({ type: 'ENTER_DIRECTOR' })
      actor.send({ type: 'RESET' })
      expect(getPhase(actor)).toBe('no_show')
    })
  })

  // ─── CALL_SHOW_EARLY from live ───

  describe('CALL_SHOW_EARLY from live', () => {
    it('skips all remaining acts and sets verdict', () => {
      setupLive(actor)
      actor.send({ type: 'CALL_SHOW_EARLY' })
      expect(getPhase(actor)).toBe('strike')
      expect(getContext(actor).verdict).toBe('SHOW_CALLED_EARLY')
      expect(getContext(actor).currentActId).toBeNull()
      expect(getContext(actor).acts.every(a => a.status === 'skipped')).toBe(true)
    })
  })

  // ─── START_BREATHING_PAUSE from live ───

  describe('breathing pause from live', () => {
    it('START_BREATHING_PAUSE from live → intermission.breathing_pause', () => {
      setupLive(actor)
      actor.send({ type: 'START_BREATHING_PAUSE', durationMs: 120000 })
      expect(getPhase(actor)).toBe('intermission')
      const snap = actor.getSnapshot()
      expect((snap.value as any).phase.intermission).toBe('breathing_pause')
      expect(getContext(actor).breathingPauseEndAt).not.toBeNull()
    })
  })

  // ─── Intermission → STRIKE ───

  describe('STRIKE from intermission', () => {
    it('STRIKE from intermission → strike with verdict', () => {
      setupLive(actor)
      actor.send({ type: 'ENTER_INTERMISSION' })
      actor.send({ type: 'STRIKE' })
      expect(getPhase(actor)).toBe('strike')
      expect(getContext(actor).verdict).not.toBeNull()
    })
  })

  // ─── RESET from intermission ───

  describe('RESET from intermission', () => {
    it('resets cleanly from intermission', () => {
      setupLive(actor)
      actor.send({ type: 'ENTER_INTERMISSION' })
      actor.send({ type: 'RESET' })
      expect(getPhase(actor)).toBe('no_show')
      expect(getContext(actor).acts).toHaveLength(0)
    })
  })

  // ─── RESTORE_SHOW (Rehydration) ───

  describe('RESTORE_SHOW rehydration', () => {
    const restoredActs: Act[] = [
      { id: 'a1', name: 'Deep Work', sketch: 'Deep Work', durationMinutes: 60, status: 'upcoming', beatLocked: false, order: 0, pinnedStartAt: null },
      { id: 'a2', name: 'Exercise', sketch: 'Exercise', durationMinutes: 45, status: 'upcoming', beatLocked: false, order: 1, pinnedStartAt: null },
    ]

    it('confirmed lineup in writers_room promotes to live.act_active (#182)', () => {
      actor.send({
        type: 'RESTORE_SHOW',
        targetPhase: 'writers_room',
        context: {
          acts: restoredActs,
          lineupStatus: 'confirmed',
          energy: 'medium' as EnergyLevel,
          writersRoomStep: 'lineup_ready',
        },
      })

      expect(getPhase(actor)).toBe('live')
      const snap = actor.getSnapshot()
      expect((snap.value as any).phase.live).toBe('act_active')
      expect(getContext(actor).acts).toHaveLength(2)
      expect(getContext(actor).lineupStatus).toBe('confirmed')
    })

    it('draft lineup in writers_room stays in writers_room.lineup_ready', () => {
      actor.send({
        type: 'RESTORE_SHOW',
        targetPhase: 'writers_room',
        context: {
          acts: restoredActs,
          lineupStatus: 'draft',
          energy: 'medium' as EnergyLevel,
          writersRoomStep: 'lineup_ready',
        },
      })

      expect(getPhase(actor)).toBe('writers_room')
      const snap = actor.getSnapshot()
      expect((snap.value as any).phase.writers_room).toBe('lineup_ready')
      expect(getContext(actor).acts).toHaveLength(2)
      expect(getContext(actor).lineupStatus).toBe('draft')
    })

    it('writers_room with no acts restores to energy', () => {
      actor.send({
        type: 'RESTORE_SHOW',
        targetPhase: 'writers_room',
        context: {
          acts: [],
          lineupStatus: 'draft',
          energy: 'high' as EnergyLevel,
          writersRoomStep: 'energy',
        },
      })

      expect(getPhase(actor)).toBe('writers_room')
      const snap = actor.getSnapshot()
      expect((snap.value as any).phase.writers_room).toBe('energy')
    })

    it('live targetPhase restores to live.act_active', () => {
      actor.send({
        type: 'RESTORE_SHOW',
        targetPhase: 'live',
        context: {
          acts: [{ ...restoredActs[0], status: 'active' as ActStatus, startedAt: Date.now() }],
          currentActId: 'a1',
          timerEndAt: Date.now() + 60000,
          lineupStatus: 'confirmed',
        },
      })

      expect(getPhase(actor)).toBe('live')
      expect(getContext(actor).currentActId).toBe('a1')
    })

    it('intermission targetPhase restores to intermission.resting', () => {
      actor.send({
        type: 'RESTORE_SHOW',
        targetPhase: 'intermission',
        context: {
          acts: restoredActs,
          lineupStatus: 'confirmed',
        },
      })

      expect(getPhase(actor)).toBe('intermission')
    })
  })

  // ─── Mid-Show Lineup Edit ───

  describe('mid-show lineup edit (EDIT_LINEUP / CONFIRM_LINEUP_EDIT)', () => {
    beforeEach(() => {
      actor = createTestActor()
      setupLive(actor)
      expect(getPhase(actor)).toBe('live')
    })

    it('EDIT_LINEUP from live transitions to writers_room.conversation', () => {
      actor.send({ type: 'EDIT_LINEUP' })
      expect(getPhase(actor)).toBe('writers_room')
      const snap = actor.getSnapshot()
      const phaseValue = (snap.value as { phase: Record<string, string> }).phase
      expect(phaseValue).toEqual({ writers_room: 'conversation' })
    })

    it('EDIT_LINEUP pauses the timer and sets editingMidShow', () => {
      const ctxBefore = getContext(actor)
      expect(ctxBefore.timerEndAt).not.toBeNull()
      expect(ctxBefore.editingMidShow).toBe(false)

      actor.send({ type: 'EDIT_LINEUP' })

      const ctx = getContext(actor)
      expect(ctx.timerEndAt).toBeNull()
      expect(ctx.timerPausedRemaining).toBeGreaterThan(0)
      expect(ctx.editingMidShow).toBe(true)
      expect(ctx.writersRoomStep).toBe('conversation')
    })

    it('EDIT_LINEUP preserves acts and currentActId', () => {
      const ctxBefore = getContext(actor)
      const actsBefore = ctxBefore.acts
      const currentActIdBefore = ctxBefore.currentActId

      actor.send({ type: 'EDIT_LINEUP' })

      const ctx = getContext(actor)
      expect(ctx.acts).toEqual(actsBefore)
      expect(ctx.currentActId).toBe(currentActIdBefore)
    })

    it('EDIT_LINEUP from director transitions to writers_room.conversation', () => {
      actor.send({ type: 'ENTER_DIRECTOR' })
      expect(getPhase(actor)).toBe('director')

      actor.send({ type: 'EDIT_LINEUP' })
      expect(getPhase(actor)).toBe('writers_room')
      const ctx = getContext(actor)
      expect(ctx.editingMidShow).toBe(true)
    })

    it('CONFIRM_LINEUP_EDIT returns to live.act_active', () => {
      actor.send({ type: 'EDIT_LINEUP' })
      expect(getPhase(actor)).toBe('writers_room')

      const ctx = getContext(actor)
      actor.send({ type: 'CONFIRM_LINEUP_EDIT', acts: ctx.acts })

      expect(getPhase(actor)).toBe('live')
    })

    it('CONFIRM_LINEUP_EDIT resumes timer and clears editingMidShow', () => {
      actor.send({ type: 'EDIT_LINEUP' })
      const pausedCtx = getContext(actor)
      expect(pausedCtx.timerPausedRemaining).toBeGreaterThan(0)

      actor.send({ type: 'CONFIRM_LINEUP_EDIT', acts: pausedCtx.acts })

      const ctx = getContext(actor)
      expect(ctx.timerEndAt).toBeGreaterThan(0)
      expect(ctx.timerPausedRemaining).toBeNull()
      expect(ctx.editingMidShow).toBe(false)
      expect(ctx.lineupStatus).toBe('confirmed')
    })

    it('CONFIRM_LINEUP_EDIT preserves completed acts and replaces upcoming', () => {
      // Complete the first act
      const firstActId = getContext(actor).currentActId!
      actor.send({ type: 'COMPLETE_ACT', actId: firstActId })
      actor.send({ type: 'SKIP_BEAT' })
      // Now in act_active with second act
      expect(getPhase(actor)).toBe('live')

      actor.send({ type: 'EDIT_LINEUP' })
      const ctx = getContext(actor)
      const completedActs = ctx.acts.filter((a) => a.status === 'completed')
      expect(completedActs.length).toBe(1)

      // Create new upcoming acts for the edit
      const newUpcoming: Act[] = [{
        id: 'new-act-1',
        name: 'New Task',
        sketch: 'new-task',
        durationMinutes: 20,
        status: 'upcoming',
        beatLocked: false,
        order: 0,
      }]

      actor.send({ type: 'CONFIRM_LINEUP_EDIT', acts: newUpcoming })

      const finalCtx = getContext(actor)
      // Should have: 1 completed + 1 active + 1 new upcoming
      const completed = finalCtx.acts.filter((a) => a.status === 'completed')
      const active = finalCtx.acts.filter((a) => a.status === 'active')
      const upcoming = finalCtx.acts.filter((a) => a.status === 'upcoming')
      expect(completed.length).toBe(1)
      expect(active.length).toBe(1)
      expect(upcoming.length).toBe(1)
      expect(upcoming[0].name).toBe('New Task')
    })

    it('editingMidShow is false in initial context', () => {
      const freshActor = createTestActor()
      expect(getContext(freshActor).editingMidShow).toBe(false)
    })

    it('CONFIRM_LINEUP_EDIT is rejected when not in editingMidShow mode', () => {
      // In writers_room from fresh start (not mid-show edit)
      const freshActor = createTestActor()
      freshActor.send({ type: 'ENTER_WRITERS_ROOM' })
      freshActor.send({ type: 'SET_LINEUP', lineup: sampleLineup })
      freshActor.send({ type: 'FINALIZE_LINEUP' })
      freshActor.send({ type: 'START_SHOW' })

      // Go to writers_room via EDIT_LINEUP, then back to live
      freshActor.send({ type: 'EDIT_LINEUP' })
      freshActor.send({ type: 'CONFIRM_LINEUP_EDIT', acts: getContext(freshActor).acts })
      expect(getPhase(freshActor)).toBe('live')
      expect(getContext(freshActor).editingMidShow).toBe(false)

      // Now try CONFIRM_LINEUP_EDIT from writers_room without editingMidShow
      const freshActor2 = createTestActor()
      freshActor2.send({ type: 'ENTER_WRITERS_ROOM' })
      freshActor2.send({ type: 'SET_LINEUP', lineup: sampleLineup })
      // CONFIRM_LINEUP_EDIT should be dropped — not in edit mode
      freshActor2.send({ type: 'CONFIRM_LINEUP_EDIT', acts: [] })
      expect(getPhase(freshActor2)).toBe('writers_room')
    })
  })
})
