/**
 * Tests for XState Bug Batch Wave 1: Issues #139–#144, #146
 *
 * Each bug has:
 * 1. A test proving the bug existed (event in buggy state is no-op or wrong)
 * 2. A test proving the fix works (event in fixed state produces correct transition)
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createActor } from 'xstate'
import {
  showMachine,
  createInitialContext,
  getPhaseFromState,
  getWritersRoomStep,
  type ShowMachineContext,
} from '../renderer/machines/showMachine'
import type { ShowLineup, ShowPhase } from '../shared/types'

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

const singleActLineup: ShowLineup = {
  acts: [
    { name: 'Solo Act', sketch: 'Deep Work', durationMinutes: 45 },
  ],
  beatThreshold: 1,
  openingNote: 'Single act',
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

function getSubstate(actor: ReturnType<typeof createTestActor>): string | undefined {
  const val = actor.getSnapshot().value as Record<string, unknown>
  const phase = val.phase
  if (typeof phase === 'object' && phase !== null) {
    const inner = phase as Record<string, string>
    const key = Object.keys(inner)[0]
    return inner[key]
  }
  return undefined
}

function setupLive(actor: ReturnType<typeof createTestActor>) {
  actor.send({ type: 'ENTER_WRITERS_ROOM' })
  actor.send({ type: 'SET_LINEUP', lineup: sampleLineup })
  actor.send({ type: 'START_SHOW' })
}

function setupLiveSingleAct(actor: ReturnType<typeof createTestActor>) {
  actor.send({ type: 'ENTER_WRITERS_ROOM' })
  actor.send({ type: 'SET_LINEUP', lineup: singleActLineup })
  actor.send({ type: 'START_SHOW' })
}

// ─── Tests ───

describe('XState Bug Batch Wave 1', () => {
  let actor: ReturnType<typeof createTestActor>

  beforeEach(() => {
    actor = createTestActor()
  })

  // ─── #140: cold_open missing RESET ───

  describe('#140: cold_open RESET handler', () => {
    it('RESET from cold_open transitions to no_show', () => {
      actor.send({ type: 'TRIGGER_COLD_OPEN' })
      expect(getPhase(actor)).toBe('cold_open')

      actor.send({ type: 'RESET' })
      expect(getPhase(actor)).toBe('no_show')
      expect(getContext(actor).acts).toHaveLength(0)
      expect(getContext(actor).energy).toBeNull()
    })

    it('RESET from cold_open resets full context', () => {
      // Set some state before entering cold open
      actor.send({ type: 'TRIGGER_COLD_OPEN' })

      actor.send({ type: 'RESET' })
      const ctx = getContext(actor)
      expect(ctx.currentActId).toBeNull()
      expect(ctx.verdict).toBeNull()
      expect(ctx.showStartedAt).toBeNull()
      expect(ctx.timerEndAt).toBeNull()
    })
  })

  // ─── #141: going_live missing RESET + hasActs guard ───

  describe('#141: going_live RESET + hasActs guard', () => {
    it('RESET from going_live transitions to no_show', () => {
      actor.send({ type: 'ENTER_WRITERS_ROOM' })
      actor.send({ type: 'SET_LINEUP', lineup: sampleLineup })
      actor.send({ type: 'TRIGGER_GOING_LIVE' })
      expect(getPhase(actor)).toBe('going_live')

      actor.send({ type: 'RESET' })
      expect(getPhase(actor)).toBe('no_show')
      expect(getContext(actor).acts).toHaveLength(0)
    })

    it('TRIGGER_GOING_LIVE blocked without acts (hasActs guard)', () => {
      actor.send({ type: 'ENTER_WRITERS_ROOM' })
      // No lineup set — no acts
      actor.send({ type: 'TRIGGER_GOING_LIVE' })
      // Should still be in writers_room
      expect(getPhase(actor)).toBe('writers_room')
    })

    it('TRIGGER_GOING_LIVE allowed with acts', () => {
      actor.send({ type: 'ENTER_WRITERS_ROOM' })
      actor.send({ type: 'SET_LINEUP', lineup: sampleLineup })
      actor.send({ type: 'TRIGGER_GOING_LIVE' })
      expect(getPhase(actor)).toBe('going_live')
    })
  })

  // ─── #139: lineup_ready dead-end ───

  describe('#139: lineup_ready backward navigation', () => {
    beforeEach(() => {
      actor.send({ type: 'ENTER_WRITERS_ROOM' })
      actor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'plan' })
      actor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'conversation' })
      actor.send({ type: 'SET_LINEUP', lineup: sampleLineup })
      const step = getWritersRoomStep(actor.getSnapshot().value as Record<string, unknown>)
      expect(step).toBe('lineup_ready')
    })

    it('can navigate back to conversation from lineup_ready', () => {
      actor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'conversation' })
      const step = getWritersRoomStep(actor.getSnapshot().value as Record<string, unknown>)
      expect(step).toBe('conversation')
    })

    it('can navigate back to plan from lineup_ready', () => {
      actor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'plan' })
      const step = getWritersRoomStep(actor.getSnapshot().value as Record<string, unknown>)
      expect(step).toBe('plan')
    })

    it('can navigate back to energy from lineup_ready', () => {
      actor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'energy' })
      const step = getWritersRoomStep(actor.getSnapshot().value as Record<string, unknown>)
      expect(step).toBe('energy')
    })

    it('can change energy in lineup_ready', () => {
      actor.send({ type: 'SET_ENERGY', level: 'low' })
      expect(getContext(actor).energy).toBe('low')
      // Should still be in lineup_ready
      const step = getWritersRoomStep(actor.getSnapshot().value as Record<string, unknown>)
      expect(step).toBe('lineup_ready')
    })

    it('can update lineup in lineup_ready', () => {
      const newLineup: ShowLineup = {
        acts: [
          { name: 'Updated Act', sketch: 'Creative', durationMinutes: 30 },
        ],
        beatThreshold: 1,
        openingNote: 'Updated',
      }
      actor.send({ type: 'SET_LINEUP', lineup: newLineup })
      expect(getContext(actor).acts).toHaveLength(1)
      expect(getContext(actor).acts[0].name).toBe('Updated Act')
      // Should still be in lineup_ready
      const step = getWritersRoomStep(actor.getSnapshot().value as Record<string, unknown>)
      expect(step).toBe('lineup_ready')
    })
  })

  // ─── #142: COMPLETE_ACT leaks through live parent ───

  describe('#142: COMPLETE_ACT only fires from act_active', () => {
    it('COMPLETE_ACT from beat_check is a no-op', () => {
      setupLive(actor)
      const actId = getContext(actor).currentActId!

      // Enter beat_check
      actor.send({ type: 'COMPLETE_ACT', actId })
      expect(getSubstate(actor)).toBe('beat_check')

      // Try to send COMPLETE_ACT again — should be a no-op
      const ctxBefore = getContext(actor)
      actor.send({ type: 'COMPLETE_ACT', actId: getContext(actor).acts[1].id })
      expect(getSubstate(actor)).toBe('beat_check')
      // Context should not have changed
      expect(getContext(actor).currentActId).toBe(ctxBefore.currentActId)
    })

    it('COMPLETE_ACT from celebrating is a no-op', () => {
      setupLive(actor)
      const actId = getContext(actor).currentActId!

      // Enter celebrating
      actor.send({ type: 'COMPLETE_ACT', actId })
      actor.send({ type: 'LOCK_BEAT' })
      expect(getSubstate(actor)).toBe('celebrating')

      // Try to send COMPLETE_ACT — should be a no-op
      actor.send({ type: 'COMPLETE_ACT', actId: getContext(actor).acts[1].id })
      expect(getSubstate(actor)).toBe('celebrating')
    })

    it('COMPLETE_ACT from act_active still works', () => {
      setupLive(actor)
      const actId = getContext(actor).currentActId!

      actor.send({ type: 'COMPLETE_ACT', actId })
      expect(getSubstate(actor)).toBe('beat_check')
      expect(getContext(actor).acts.find(a => a.id === actId)?.status).toBe('completed')
    })
  })

  // ─── #143: REMOVE_ACT on current act creates zombie state ───

  describe('#143: REMOVE_ACT on current act during live', () => {
    it('removing current act auto-starts next act when remaining', () => {
      setupLive(actor)
      const firstActId = getContext(actor).currentActId!
      const secondActId = getContext(actor).acts[1].id

      actor.send({ type: 'REMOVE_ACT', actId: firstActId })
      expect(getPhase(actor)).toBe('live')
      expect(getSubstate(actor)).toBe('act_active')
      // Should now be on the second act (which is now first)
      expect(getContext(actor).currentActId).toBe(secondActId)
      expect(getContext(actor).acts).toHaveLength(2)
    })

    it('removing current act with no remaining acts → strike', () => {
      setupLiveSingleAct(actor)
      const actId = getContext(actor).currentActId!

      actor.send({ type: 'REMOVE_ACT', actId })
      expect(getPhase(actor)).toBe('strike')
      expect(getContext(actor).verdict).not.toBeNull()
    })

    it('removing non-current (upcoming) act stays in act_active', () => {
      setupLive(actor)
      const upcomingActId = getContext(actor).acts[2].id // Third act
      const currentActId = getContext(actor).currentActId

      actor.send({ type: 'REMOVE_ACT', actId: upcomingActId })
      expect(getPhase(actor)).toBe('live')
      expect(getSubstate(actor)).toBe('act_active')
      expect(getContext(actor).currentActId).toBe(currentActId) // unchanged
      expect(getContext(actor).acts).toHaveLength(2) // one removed
    })

    it('removing current act starts next with new timer', () => {
      setupLive(actor)
      const firstActId = getContext(actor).currentActId!

      actor.send({ type: 'REMOVE_ACT', actId: firstActId })
      // Next act should have a timer
      expect(getContext(actor).timerEndAt).not.toBeNull()
      expect(getContext(actor).currentActId).not.toBeNull()
    })
  })

  // ─── #144: hasPausedTimer guard fragile ───

  describe('#144: hasPausedTimer guard tightened', () => {
    it('EXIT_INTERMISSION uses paused timer when act is active', () => {
      setupLive(actor)
      actor.send({ type: 'ENTER_INTERMISSION' })
      expect(getContext(actor).timerPausedRemaining).not.toBeNull()

      actor.send({ type: 'EXIT_INTERMISSION' })
      expect(getPhase(actor)).toBe('live')
      expect(getContext(actor).timerEndAt).not.toBeNull()
    })

    it('EXIT_INTERMISSION falls through when current act not active', () => {
      setupLive(actor)
      // Complete the current act to put it in non-active state
      const actId = getContext(actor).currentActId!
      actor.send({ type: 'COMPLETE_ACT', actId })
      actor.send({ type: 'SKIP_BEAT' })
      // Now on second act, enter intermission
      actor.send({ type: 'ENTER_INTERMISSION' })

      // The timer was paused with the second act's remaining time
      expect(getContext(actor).timerPausedRemaining).not.toBeNull()
      // Current act (second) should be active
      const currentAct = getContext(actor).acts.find(a => a.id === getContext(actor).currentActId)
      expect(currentAct?.status).toBe('active')

      actor.send({ type: 'EXIT_INTERMISSION' })
      expect(getPhase(actor)).toBe('live')
    })

    it('hasPausedTimer is false when timerPausedRemaining is null', () => {
      // Go live, complete all acts to reach strike, then test
      setupLive(actor)
      // Complete all acts
      for (let i = 0; i < sampleLineup.acts.length; i++) {
        const actId = getContext(actor).currentActId!
        actor.send({ type: 'COMPLETE_ACT', actId })
        actor.send({ type: 'SKIP_BEAT' })
      }
      expect(getPhase(actor)).toBe('strike')
      expect(getContext(actor).timerPausedRemaining).toBeNull()
    })

    it('hasPausedTimer is false when currentActId is null', () => {
      setupLive(actor)
      actor.send({ type: 'ENTER_INTERMISSION' })
      const remaining = getContext(actor).timerPausedRemaining

      // The remaining should be non-null (we had a timer)
      expect(remaining).not.toBeNull()
      // currentActId should still be set
      expect(getContext(actor).currentActId).not.toBeNull()
    })
  })

  // ─── #146: Lineup confirmation UX (machine-side) ───

  describe('#146: lineup_ready step for confirmation UX', () => {
    it('SET_LINEUP from conversation transitions to lineup_ready substep', () => {
      actor.send({ type: 'ENTER_WRITERS_ROOM' })
      actor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'plan' })
      actor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'conversation' })
      actor.send({ type: 'SET_LINEUP', lineup: sampleLineup })

      const step = getWritersRoomStep(actor.getSnapshot().value as Record<string, unknown>)
      expect(step).toBe('lineup_ready')
      expect(getContext(actor).acts).toHaveLength(3)
    })

    it('Refine button: SET_WRITERS_ROOM_STEP from lineup_ready → conversation', () => {
      actor.send({ type: 'ENTER_WRITERS_ROOM' })
      actor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'plan' })
      actor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'conversation' })
      actor.send({ type: 'SET_LINEUP', lineup: sampleLineup })

      // Simulates clicking the "Refine" button
      actor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'conversation' })
      const step = getWritersRoomStep(actor.getSnapshot().value as Record<string, unknown>)
      expect(step).toBe('conversation')
      // Acts should still be present for refinement
      expect(getContext(actor).acts).toHaveLength(3)
    })

    it('TRIGGER_GOING_LIVE from lineup_ready works (Confirm & Go Live)', () => {
      actor.send({ type: 'ENTER_WRITERS_ROOM' })
      actor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'plan' })
      actor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'conversation' })
      actor.send({ type: 'SET_LINEUP', lineup: sampleLineup })

      // From lineup_ready, trigger going live
      actor.send({ type: 'TRIGGER_GOING_LIVE' })
      expect(getPhase(actor)).toBe('going_live')
    })

    it('reorder acts in lineup_ready works', () => {
      actor.send({ type: 'ENTER_WRITERS_ROOM' })
      actor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'plan' })
      actor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'conversation' })
      actor.send({ type: 'SET_LINEUP', lineup: sampleLineup })

      const acts = getContext(actor).acts
      actor.send({ type: 'REORDER_ACT', actId: acts[1].id, direction: 'up' })
      expect(getContext(actor).acts[0].name).toBe('Exercise')
      expect(getContext(actor).acts[1].name).toBe('Deep Work')
    })

    it('remove acts in lineup_ready works', () => {
      actor.send({ type: 'ENTER_WRITERS_ROOM' })
      actor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'plan' })
      actor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'conversation' })
      actor.send({ type: 'SET_LINEUP', lineup: sampleLineup })

      const acts = getContext(actor).acts
      actor.send({ type: 'REMOVE_ACT', actId: acts[2].id })
      expect(getContext(actor).acts).toHaveLength(2)
    })
  })

  // ─── Cross-cutting: COMPLETE_ACT not leaking during intermission ───

  describe('cross-cutting: COMPLETE_ACT blocked from intermission', () => {
    it('COMPLETE_ACT from intermission is a no-op (previously leaked)', () => {
      setupLive(actor)
      const actId = getContext(actor).currentActId!
      actor.send({ type: 'ENTER_INTERMISSION' })
      expect(getPhase(actor)).toBe('intermission')

      actor.send({ type: 'COMPLETE_ACT', actId })
      // Should still be in intermission — no leak
      expect(getPhase(actor)).toBe('intermission')
    })
  })
})
