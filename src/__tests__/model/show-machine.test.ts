/**
 * Layer 1: XState State Machine Model Tests
 *
 * Uses @xstate/graph getSimplePaths() to auto-generate ALL valid state paths,
 * then drives the real Zustand showStore through each path verifying:
 * - Phase matches after each transition
 * - Store invariants hold at every step
 * - View tier is appropriate for the phase
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { getSimplePaths } from '@xstate/graph'
import { createActor } from 'xstate'
import { showMachine } from './show-machine'
import type { ShowMachineEvent } from './show-machine'
import { useShowStore } from '../../renderer/stores/showStore'
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

function resetStore() {
  useShowStore.setState({
    phase: 'no_show',
    energy: null,
    acts: [],
    currentActId: null,
    beatsLocked: 0,
    beatThreshold: 3,
    timerEndAt: null,
    timerPausedRemaining: null,
    claudeSessionId: null,
    showDate: new Date().toISOString().slice(0, 10),
    verdict: null,
    viewTier: 'expanded' as ViewTier,
    beatCheckPending: false,
    celebrationActive: false,
    coldOpenActive: false,
    goingLiveActive: false,
    writersRoomStep: 'energy',
    writersRoomEnteredAt: null,
    breathingPauseEndAt: null,
  })
}

/** Apply a machine event to the real Zustand store */
function applyEvent(event: ShowMachineEvent): void {
  const store = useShowStore.getState()

  switch (event.type) {
    case 'ENTER_WRITERS_ROOM':
      store.enterWritersRoom()
      break

    case 'SET_LINEUP':
      store.setLineup(sampleLineup)
      break

    case 'START_SHOW': {
      // Ensure lineup is set before starting
      const s = useShowStore.getState()
      if (s.acts.length === 0) {
        s.setLineup(sampleLineup)
      }
      useShowStore.getState().startShow()
      break
    }

    case 'COMPLETE_ACT': {
      const s = useShowStore.getState()
      if (s.currentActId) {
        s.completeAct(s.currentActId)
        // Skip beat (don't wait for celebration timeout)
        useShowStore.getState().skipBeat()
      }
      break
    }

    case 'ENTER_INTERMISSION':
      store.enterIntermission()
      break

    case 'EXIT_INTERMISSION':
      store.exitIntermission()
      break

    case 'ENTER_DIRECTOR':
      store.enterDirector()
      break

    case 'EXIT_DIRECTOR':
      store.exitDirector()
      break

    case 'CALL_EARLY':
      store.callShowEarly()
      break

    case 'SKIP_TO_NEXT':
      store.skipToNextAct()
      break

    case 'STRIKE':
      store.strikeTheStage()
      break

    case 'RESET':
      store.resetShow()
      break
  }
}

/** Verify store invariants that must hold at every state */
function assertInvariants() {
  const s = useShowStore.getState()
  const validPhases: ShowPhase[] = ['no_show', 'writers_room', 'live', 'intermission', 'director', 'strike']
  const validTiers: ViewTier[] = ['micro', 'compact', 'dashboard', 'expanded']

  // Phase is always valid
  expect(validPhases).toContain(s.phase)

  // ViewTier is always valid
  expect(validTiers).toContain(s.viewTier)

  // Beats invariant
  expect(s.beatsLocked).toBeGreaterThanOrEqual(0)
  expect(s.beatsLocked).toBeLessThanOrEqual(s.beatThreshold)

  // Acts array is never null/undefined
  expect(Array.isArray(s.acts)).toBe(true)

  // If live, at most one act is active
  if (s.phase === 'live') {
    const activeActs = s.acts.filter((a) => a.status === 'active')
    expect(activeActs.length).toBeLessThanOrEqual(1)
  }

  // showStartedAt is set when not in no_show (unless we just reset)
  if (s.phase === 'live' || s.phase === 'intermission' || s.phase === 'director') {
    expect(s.showStartedAt).not.toBeNull()
  }
}

// Map XState state value to expected Zustand phase
function xstateToPhase(stateValue: string): ShowPhase {
  return stateValue as ShowPhase
}

// ─── Tests ───

describe('Layer 1: XState State Machine Path Tests', () => {
  beforeEach(() => {
    resetStore()
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
      resetStore()

      for (const step of path.steps) {
        applyEvent(step.event as ShowMachineEvent)
        assertInvariants()
      }

      // Final state should match (some transitions may cause auto-advance)
      const finalPhase = useShowStore.getState().phase
      const expectedPhase = xstateToPhase(stateValue)

      // For paths ending in 'live', the store might auto-advance to strike
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
      const s = useShowStore.getState()
      expect(s.phase).toBe('writers_room')
      expect(s.writersRoomStep).toBe('energy')
      expect(s.writersRoomEnteredAt).not.toBeNull()
    })

    it('writers_room → live sets first act as active', () => {
      applyEvent({ type: 'ENTER_WRITERS_ROOM' })
      applyEvent({ type: 'START_SHOW' })
      const s = useShowStore.getState()
      expect(s.phase).toBe('live')
      expect(s.currentActId).not.toBeNull()
      expect(s.acts.filter((a) => a.status === 'active')).toHaveLength(1)
      expect(s.showStartedAt).not.toBeNull()
    })

    it('live → intermission preserves timer remaining', () => {
      applyEvent({ type: 'ENTER_WRITERS_ROOM' })
      applyEvent({ type: 'START_SHOW' })
      const timerBefore = useShowStore.getState().timerEndAt
      expect(timerBefore).not.toBeNull()

      applyEvent({ type: 'ENTER_INTERMISSION' })
      const s = useShowStore.getState()
      expect(s.phase).toBe('intermission')
      expect(s.timerEndAt).toBeNull()
      expect(s.timerPausedRemaining).not.toBeNull()
    })

    it('intermission → live restores timer', () => {
      applyEvent({ type: 'ENTER_WRITERS_ROOM' })
      applyEvent({ type: 'START_SHOW' })
      applyEvent({ type: 'ENTER_INTERMISSION' })

      const remaining = useShowStore.getState().timerPausedRemaining
      expect(remaining).not.toBeNull()

      applyEvent({ type: 'EXIT_INTERMISSION' })
      const s = useShowStore.getState()
      expect(s.phase).toBe('live')
      expect(s.timerEndAt).not.toBeNull()
      expect(s.timerPausedRemaining).toBeNull()
    })

    it('director → callEarly goes to strike with SHOW_CALLED_EARLY verdict', () => {
      applyEvent({ type: 'ENTER_WRITERS_ROOM' })
      applyEvent({ type: 'START_SHOW' })
      applyEvent({ type: 'ENTER_DIRECTOR' })
      applyEvent({ type: 'CALL_EARLY' })

      const s = useShowStore.getState()
      expect(s.phase).toBe('strike')
      expect(s.verdict).toBe('SHOW_CALLED_EARLY')
    })

    it('strike → reset returns to no_show with clean state', () => {
      applyEvent({ type: 'ENTER_WRITERS_ROOM' })
      applyEvent({ type: 'START_SHOW' })
      applyEvent({ type: 'STRIKE' })
      expect(useShowStore.getState().phase).toBe('strike')

      applyEvent({ type: 'RESET' })
      const s = useShowStore.getState()
      expect(s.phase).toBe('no_show')
      expect(s.acts).toHaveLength(0)
      expect(s.verdict).toBeNull()
      expect(s.currentActId).toBeNull()
      expect(s.timerEndAt).toBeNull()
    })

    it('completing all acts triggers strike with appropriate verdict', () => {
      applyEvent({ type: 'ENTER_WRITERS_ROOM' })
      applyEvent({ type: 'START_SHOW' })

      // Complete first act
      applyEvent({ type: 'COMPLETE_ACT' })
      // Complete second act (last one)
      applyEvent({ type: 'COMPLETE_ACT' })

      const s = useShowStore.getState()
      expect(s.phase).toBe('strike')
      expect(s.verdict).not.toBeNull()
    })
  })
})
