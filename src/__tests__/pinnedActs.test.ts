/**
 * Part C: Fixed vs flexible time windows — pinned acts (#130)
 *
 * Tests that the XState machine correctly stores pinnedStartAt and calendarEventId
 * when SET_LINEUP is dispatched with calendar-sourced acts.
 */
import { describe, it, expect } from 'vitest'
import { createActor } from 'xstate'
import {
  showMachine,
  createInitialContext,
  getPhaseFromState,
  type ShowMachineContext,
} from '../renderer/machines/showMachine'
import type { ShowLineup, ShowPhase } from '../shared/types'

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

function getContext(actor: ReturnType<typeof createTestActor>): ShowMachineContext {
  return actor.getSnapshot().context
}

describe('Pinned Acts (Fixed Time Windows)', () => {
  const pinnedLineup: ShowLineup = {
    acts: [
      { name: 'Deep Work', sketch: 'Deep Work', durationMinutes: 60 },
      {
        name: 'Team Standup',
        sketch: 'Admin',
        durationMinutes: 30,
        pinnedStartAt: 1711800000000,
        calendarEventId: 'cal-123',
      },
      { name: 'Exercise', sketch: 'Exercise', durationMinutes: 45 },
    ],
    beatThreshold: 3,
    openingNote: 'Test pinned lineup',
  }

  it('stores pinnedStartAt and calendarEventId from SET_LINEUP', () => {
    const actor = createTestActor()
    actor.send({ type: 'ENTER_WRITERS_ROOM' })
    actor.send({ type: 'SET_LINEUP', lineup: pinnedLineup })

    const acts = getContext(actor).acts
    expect(acts).toHaveLength(3)

    // First act: flexible
    expect(acts[0].pinnedStartAt).toBeNull()
    expect(acts[0].calendarEventId).toBeNull()

    // Second act: pinned from calendar
    expect(acts[1].pinnedStartAt).toBe(1711800000000)
    expect(acts[1].calendarEventId).toBe('cal-123')

    // Third act: flexible
    expect(acts[2].pinnedStartAt).toBeNull()
    expect(acts[2].calendarEventId).toBeNull()
  })

  it('handles lineup with no pinned acts (all null)', () => {
    const flexibleLineup: ShowLineup = {
      acts: [
        { name: 'Task 1', sketch: 'Deep Work', durationMinutes: 30 },
        { name: 'Task 2', sketch: 'Admin', durationMinutes: 20 },
      ],
      beatThreshold: 2,
      openingNote: 'All flexible',
    }

    const actor = createTestActor()
    actor.send({ type: 'ENTER_WRITERS_ROOM' })
    actor.send({ type: 'SET_LINEUP', lineup: flexibleLineup })

    const acts = getContext(actor).acts
    expect(acts.every(a => a.pinnedStartAt === null)).toBe(true)
    expect(acts.every(a => a.calendarEventId === null)).toBe(true)
  })
})
