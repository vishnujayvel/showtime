/**
 * Unit tests for the XState inspect callback's drop detection logic.
 *
 * The show machine uses a two-layer drop detection strategy:
 * - Layer 0: Wildcard `'*': { actions: 'logDroppedEvent' }` at root catches
 *   events with no phase-specific handler. snapshot.can() returns TRUE for these
 *   because the wildcard action runs.
 * - Layer 1: inspect callback uses snapshot.can() to catch events with explicit
 *   no-op handlers (e.g. `RESET: {}` in no_show) where can() returns FALSE
 *   because no transition or action fires (the no-op overrides the wildcard).
 *
 * Together, both layers cover all "dropped" events.
 */
import { describe, it, expect, vi } from 'vitest'
import { createActor, type InspectionEvent } from 'xstate'
import {
  showMachine,
  createInitialContext,
  getPhaseFromState,
} from '../renderer/machines/showMachine'

// ─── Helpers ───

function createTestActor() {
  const actor = createActor(showMachine)
  actor.start()
  return actor
}

// ─── Tests ───

describe('inspect drop detection (Layer 1)', () => {
  describe('snapshot.can() correctly reflects two-layer design', () => {
    it('returns true for TRIGGER_COLD_OPEN in no_show (has specific handler)', () => {
      const actor = createTestActor()
      const snapshot = actor.getSnapshot()
      expect(snapshot.can({ type: 'TRIGGER_COLD_OPEN' })).toBe(true)
      actor.stop()
    })

    it('returns true for events caught by root wildcard handler (Layer 0)', () => {
      const actor = createTestActor()
      const snapshot = actor.getSnapshot()
      // These events have no phase-specific handler in no_show,
      // so the root wildcard '* → logDroppedEvent' catches them.
      // snapshot.can() returns true because the wildcard action runs.
      expect(snapshot.can({ type: 'START_SHOW' })).toBe(true)
      expect(snapshot.can({ type: 'COMPLETE_ACT' })).toBe(true)
      expect(snapshot.can({ type: 'LOCK_BEAT' })).toBe(true)
      expect(snapshot.can({ type: 'ENTER_INTERMISSION' })).toBe(true)
      expect(snapshot.can({ type: 'STRIKE' })).toBe(true)
      actor.stop()
    })

    it('returns true for RESET in no_show (overlay region handles it)', () => {
      const actor = createTestActor()
      const snapshot = actor.getSnapshot()
      // RESET in no_show phase is `RESET: {}` (no-op), but the parallel
      // overlay region has `RESET: '.none'`, so can() returns true.
      expect(snapshot.can({ type: 'RESET' })).toBe(true)
      actor.stop()
    })

    it('returns true for RESTORE_SHOW in no_show (has specific handler)', () => {
      const actor = createTestActor()
      const snapshot = actor.getSnapshot()
      expect(snapshot.can({
        type: 'RESTORE_SHOW',
        targetPhase: 'live',
        context: createInitialContext(),
      })).toBe(true)
      actor.stop()
    })
  })

  describe('inspect callback fires for events', () => {
    it('calls inspect with @xstate.event for sent events', () => {
      const inspectSpy = vi.fn()
      const actor = createActor(showMachine, {
        inspect: inspectSpy,
      })
      actor.start()

      actor.send({ type: 'TRIGGER_COLD_OPEN' })

      const eventCalls = inspectSpy.mock.calls.filter(
        ([e]: [InspectionEvent]) => e.type === '@xstate.event'
      )
      expect(eventCalls.length).toBeGreaterThan(0)

      const coldOpenCall = eventCalls.find(
        ([e]: [InspectionEvent]) =>
          e.type === '@xstate.event' && (e as any).event?.type === 'TRIGGER_COLD_OPEN'
      )
      expect(coldOpenCall).toBeDefined()

      actor.stop()
    })

    it('wildcard-caught events do not change phase (Layer 0 logs them)', () => {
      const actor = createActor(showMachine)
      actor.start()

      // COMPLETE_ACT in no_show → caught by wildcard, no phase change
      actor.send({ type: 'COMPLETE_ACT' })
      const phase = getPhaseFromState(actor.getSnapshot().value as Record<string, unknown>)
      expect(phase).toBe('no_show')

      actor.stop()
    })

    it('RESET in no_show is handled by overlay region (can() returns true)', () => {
      const actor = createActor(showMachine)
      actor.start()

      // RESET in no_show phase is a no-op, but overlay region handles it
      expect(actor.getSnapshot().can({ type: 'RESET' })).toBe(true)

      // Sending it still doesn't crash or change phase
      actor.send({ type: 'RESET' })
      const phase = getPhaseFromState(actor.getSnapshot().value as Record<string, unknown>)
      expect(phase).toBe('no_show')

      actor.stop()
    })
  })

  describe('Layer 0 and Layer 1 coverage', () => {
    it('Layer 0 (wildcard) catches events with no specific handler', () => {
      const actor = createTestActor()
      // These events hit the wildcard → logDroppedEvent fires
      // can() returns true because the wildcard action executes
      expect(actor.getSnapshot().can({ type: 'LOCK_BEAT' })).toBe(true)
      expect(actor.getSnapshot().can({ type: 'ENTER_INTERMISSION' })).toBe(true)
      expect(actor.getSnapshot().can({ type: 'STRIKE' })).toBe(true)
      actor.stop()
    })

    it('RESET in no_show is now handled (overlay region has RESET handler)', () => {
      const actor = createTestActor()
      // RESET in no_show phase is a no-op, but the parallel overlay region
      // has RESET: '.none', so can() returns true
      expect(actor.getSnapshot().can({ type: 'RESET' })).toBe(true)
      actor.stop()
    })
  })
})

describe('devInspector module', () => {
  it('forwardToDevInspector is a no-op when inspector not initialized', async () => {
    const { forwardToDevInspector } = await import('../renderer/machines/devInspector')
    // Should not throw — just a no-op
    expect(() => {
      forwardToDevInspector({
        type: '@xstate.event',
        rootId: 'test',
        actorRef: {} as any,
        sourceRef: undefined,
        event: { type: 'TEST' },
      } as InspectionEvent)
    }).not.toThrow()
  })
})
