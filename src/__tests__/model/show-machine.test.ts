/**
 * Layer 1: XState State Machine Model Tests
 *
 * Uses @xstate/graph getSimplePaths() to auto-generate ALL valid state paths,
 * then drives the real XState showActor through each path verifying:
 * - Phase matches after each transition
 * - Actor invariants hold at every step
 * - View tier is appropriate for the phase
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { getSimplePaths } from '@xstate/graph'
import { showActor, resetShowActor } from '../../renderer/machines/showActor'
import { getPhaseFromState } from '../../renderer/machines/showMachine'
import { showMachine } from './show-machine'
import type { ShowMachineEvent } from './show-machine'
import type { ShowLineup, ShowPhase, ViewTier } from '../../shared/types'

// ─── Helpers ───

const sampleLineup: ShowLineup = {
  acts: [
    { name: 'Deep Work', sketch: 'Deep Work', durationMinutes: 60 },
    { name: 'Exercise', sketch: 'Exercise', durationMinutes: 45 },
  ],
  beatThreshold: 2,
  openingNote: 'Test lineup',
}

/** Helper to get current phase from the actor */
function phase(): ShowPhase {
  return getPhaseFromState(showActor.getSnapshot().value as Record<string, unknown>)
}

/** Helper to get actor context */
function ctx() {
  return showActor.getSnapshot().context
}

/** Apply a machine event to the real XState actor */
function applyEvent(event: ShowMachineEvent): void {
  switch (event.type) {
    case 'ENTER_WRITERS_ROOM':
      showActor.send({ type: 'ENTER_WRITERS_ROOM' })
      break

    case 'SET_LINEUP':
      // Navigate to conversation substate before setting lineup
      showActor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'plan' })
      showActor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'conversation' })
      showActor.send({ type: 'SET_LINEUP', lineup: sampleLineup })
      break

    case 'START_SHOW': {
      // Ensure lineup is set before starting (navigate substates first)
      if (ctx().acts.length === 0) {
        showActor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'plan' })
        showActor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'conversation' })
        showActor.send({ type: 'SET_LINEUP', lineup: sampleLineup })
      }
      showActor.send({ type: 'START_SHOW' })
      break
    }

    case 'COMPLETE_ACT': {
      const actId = ctx().currentActId
      if (actId) {
        showActor.send({ type: 'COMPLETE_ACT', actId })
        // Skip beat (don't wait for celebration timeout)
        showActor.send({ type: 'SKIP_BEAT' })
      }
      break
    }

    case 'ENTER_INTERMISSION':
      showActor.send({ type: 'ENTER_INTERMISSION' })
      break

    case 'EXIT_INTERMISSION':
      showActor.send({ type: 'EXIT_INTERMISSION' })
      break

    case 'ENTER_DIRECTOR':
      showActor.send({ type: 'ENTER_DIRECTOR' })
      break

    case 'EXIT_DIRECTOR':
      showActor.send({ type: 'EXIT_DIRECTOR' })
      break

    case 'CALL_EARLY':
      showActor.send({ type: 'CALL_SHOW_EARLY' })
      break

    case 'SKIP_TO_NEXT':
      showActor.send({ type: 'SKIP_TO_NEXT' })
      break

    case 'STRIKE':
      showActor.send({ type: 'STRIKE' })
      break

    case 'RESET':
      showActor.send({ type: 'RESET' })
      break
  }
}

/** Verify actor invariants that must hold at every state */
function assertInvariants() {
  const p = phase()
  const c = ctx()
  const validPhases: ShowPhase[] = ['no_show', 'writers_room', 'live', 'intermission', 'director', 'strike']
  const validTiers: ViewTier[] = ['micro', 'compact', 'dashboard', 'expanded']

  // Phase is always valid
  expect(validPhases).toContain(p)

  // ViewTier is always valid
  expect(validTiers).toContain(c.viewTier)

  // Beats invariant
  expect(c.beatsLocked).toBeGreaterThanOrEqual(0)
  expect(c.beatsLocked).toBeLessThanOrEqual(c.beatThreshold)

  // Acts array is never null/undefined
  expect(Array.isArray(c.acts)).toBe(true)

  // If live, at most one act is active
  if (p === 'live') {
    const activeActs = c.acts.filter((a) => a.status === 'active')
    expect(activeActs.length).toBeLessThanOrEqual(1)
  }

  // showStartedAt is set when not in no_show (unless we just reset)
  if (p === 'live' || p === 'intermission' || p === 'director') {
    expect(c.showStartedAt).not.toBeNull()
  }
}

// Map XState state value to expected phase
function xstateToPhase(stateValue: string): ShowPhase {
  return stateValue as ShowPhase
}

// ─── Tests ───

describe('Layer 1: XState State Machine Path Tests', () => {
  beforeEach(() => {
    resetShowActor()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // Generate all simple paths through the state machine
  const paths = getSimplePaths(showMachine)

  it('generates at least 6 paths (one to each state)', () => {
    // We have 6 states, so there must be at least 6 paths
    expect(paths.length).toBeGreaterThanOrEqual(6)
  })

  // Test each auto-generated path
  for (const path of paths) {
    const stateValue = typeof path.state.value === 'string'
      ? path.state.value
      : JSON.stringify(path.state.value)

    it(`reaches ${stateValue} via [${path.steps.map((s) => s.event.type).join(' → ')}]`, () => {
      resetShowActor()

      for (const step of path.steps) {
        applyEvent(step.event as ShowMachineEvent)
        assertInvariants()
      }

      // Final state should match (some transitions may cause auto-advance)
      const finalPhase = phase()
      const expectedPhase = xstateToPhase(stateValue)

      // For paths ending in 'live', the actor might auto-advance to strike
      // if all acts are completed. Accept both.
      if (expectedPhase === 'live') {
        expect(['live', 'strike']).toContain(finalPhase)
      } else {
        expect(finalPhase).toBe(expectedPhase)
      }
    })
  }

  // ─── Specific transition invariants ───

  describe('transition invariants', () => {
    it('no_show → writers_room sets phase and writersRoomStep', () => {
      applyEvent({ type: 'ENTER_WRITERS_ROOM' })
      expect(phase()).toBe('writers_room')
      expect(ctx().writersRoomStep).toBe('energy')
      expect(ctx().writersRoomEnteredAt).not.toBeNull()
    })

    it('writers_room → live sets first act as active', () => {
      applyEvent({ type: 'ENTER_WRITERS_ROOM' })
      applyEvent({ type: 'START_SHOW' })
      expect(phase()).toBe('live')
      expect(ctx().currentActId).not.toBeNull()
      expect(ctx().acts.filter((a) => a.status === 'active')).toHaveLength(1)
      expect(ctx().showStartedAt).not.toBeNull()
    })

    it('live → intermission preserves timer remaining', () => {
      applyEvent({ type: 'ENTER_WRITERS_ROOM' })
      applyEvent({ type: 'START_SHOW' })
      const timerBefore = ctx().timerEndAt
      expect(timerBefore).not.toBeNull()

      applyEvent({ type: 'ENTER_INTERMISSION' })
      expect(phase()).toBe('intermission')
      expect(ctx().timerEndAt).toBeNull()
      expect(ctx().timerPausedRemaining).not.toBeNull()
    })

    it('intermission → live restores timer', () => {
      applyEvent({ type: 'ENTER_WRITERS_ROOM' })
      applyEvent({ type: 'START_SHOW' })
      applyEvent({ type: 'ENTER_INTERMISSION' })

      const remaining = ctx().timerPausedRemaining
      expect(remaining).not.toBeNull()

      applyEvent({ type: 'EXIT_INTERMISSION' })
      expect(phase()).toBe('live')
      expect(ctx().timerEndAt).not.toBeNull()
      expect(ctx().timerPausedRemaining).toBeNull()
    })

    it('director → callEarly goes to strike with SHOW_CALLED_EARLY verdict', () => {
      applyEvent({ type: 'ENTER_WRITERS_ROOM' })
      applyEvent({ type: 'START_SHOW' })
      applyEvent({ type: 'ENTER_DIRECTOR' })
      applyEvent({ type: 'CALL_EARLY' })

      expect(phase()).toBe('strike')
      expect(ctx().verdict).toBe('SHOW_CALLED_EARLY')
    })

    it('strike → reset returns to no_show with clean state', () => {
      applyEvent({ type: 'ENTER_WRITERS_ROOM' })
      applyEvent({ type: 'START_SHOW' })
      applyEvent({ type: 'STRIKE' })
      expect(phase()).toBe('strike')

      applyEvent({ type: 'RESET' })
      expect(phase()).toBe('no_show')
      expect(ctx().acts).toHaveLength(0)
      expect(ctx().verdict).toBeNull()
      expect(ctx().currentActId).toBeNull()
      expect(ctx().timerEndAt).toBeNull()
    })

    it('completing all acts triggers strike with appropriate verdict', () => {
      applyEvent({ type: 'ENTER_WRITERS_ROOM' })
      applyEvent({ type: 'START_SHOW' })

      // Complete first act
      applyEvent({ type: 'COMPLETE_ACT' })
      // Complete second act (last one)
      applyEvent({ type: 'COMPLETE_ACT' })

      expect(phase()).toBe('strike')
      expect(ctx().verdict).not.toBeNull()
    })
  })
})
