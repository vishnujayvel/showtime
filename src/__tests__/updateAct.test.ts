/**
 * Unit tests for the UPDATE_ACT event in the XState v5 show machine.
 *
 * UPDATE_ACT updates an act's name and/or duration in-place.
 * It is accepted during writers_room (lineup editing) and live phases.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createActor } from 'xstate'
import {
  showMachine,
  createInitialContext,
  getPhaseFromState,
  type ShowMachineContext,
} from '../renderer/machines/showMachine'
import type { ShowPhase, ShowLineup } from '../shared/types'

// ─── Helpers ───

const sampleLineup: ShowLineup = {
  acts: [
    { name: 'Deep Work', sketch: 'Deep Work', durationMinutes: 30 },
    { name: 'Exercise', sketch: 'Exercise', durationMinutes: 45 },
  ],
  beatThreshold: 3,
  openingNote: '',
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

/** Advance actor into writers_room with a lineup set. */
function setupWritersRoom(actor: ReturnType<typeof createTestActor>) {
  actor.send({ type: 'ENTER_WRITERS_ROOM' })
  actor.send({ type: 'SET_ENERGY', level: 'high' })
  actor.send({ type: 'SET_LINEUP', lineup: sampleLineup })
}

/** Advance actor into the live phase. */
function setupLive(actor: ReturnType<typeof createTestActor>) {
  setupWritersRoom(actor)
  actor.send({ type: 'FINALIZE_LINEUP' })
  actor.send({ type: 'START_SHOW' })
}

// ─── Tests ───

describe('UPDATE_ACT', () => {
  let actor: ReturnType<typeof createTestActor>

  beforeEach(() => {
    actor = createTestActor()
  })

  // ─── Writers Room ───

  describe('during writers_room', () => {
    beforeEach(() => {
      setupWritersRoom(actor)
    })

    it('changes act name', () => {
      const actId = getContext(actor).acts[0].id
      actor.send({ type: 'UPDATE_ACT', actId, name: 'Focused Coding' })

      const updated = getContext(actor).acts.find((a) => a.id === actId)!
      expect(updated.name).toBe('Focused Coding')
      // duration should remain unchanged
      expect(updated.durationMinutes).toBe(30)
    })

    it('changes act duration', () => {
      const actId = getContext(actor).acts[0].id
      actor.send({ type: 'UPDATE_ACT', actId, durationMinutes: 60 })

      const updated = getContext(actor).acts.find((a) => a.id === actId)!
      expect(updated.durationMinutes).toBe(60)
      // name should remain unchanged
      expect(updated.name).toBe('Deep Work')
    })

    it('changes both name and duration', () => {
      const actId = getContext(actor).acts[1].id
      actor.send({ type: 'UPDATE_ACT', actId, name: 'Yoga', durationMinutes: 20 })

      const updated = getContext(actor).acts.find((a) => a.id === actId)!
      expect(updated.name).toBe('Yoga')
      expect(updated.durationMinutes).toBe(20)
    })

    it('with only name leaves duration unchanged', () => {
      const actId = getContext(actor).acts[1].id
      const originalDuration = getContext(actor).acts[1].durationMinutes
      actor.send({ type: 'UPDATE_ACT', actId, name: 'Running' })

      const updated = getContext(actor).acts.find((a) => a.id === actId)!
      expect(updated.name).toBe('Running')
      expect(updated.durationMinutes).toBe(originalDuration)
    })

    it('with only duration leaves name unchanged', () => {
      const actId = getContext(actor).acts[0].id
      const originalName = getContext(actor).acts[0].name
      actor.send({ type: 'UPDATE_ACT', actId, durationMinutes: 90 })

      const updated = getContext(actor).acts.find((a) => a.id === actId)!
      expect(updated.name).toBe(originalName)
      expect(updated.durationMinutes).toBe(90)
    })

    it('with nonexistent actId is a no-op', () => {
      const actsBefore = getContext(actor).acts.map((a) => ({ ...a }))
      actor.send({ type: 'UPDATE_ACT', actId: 'nonexistent-id', name: 'Ghost' })

      const actsAfter = getContext(actor).acts
      expect(actsAfter).toHaveLength(actsBefore.length)
      actsAfter.forEach((act, i) => {
        expect(act.name).toBe(actsBefore[i].name)
        expect(act.durationMinutes).toBe(actsBefore[i].durationMinutes)
      })
    })

    it('does not affect other acts', () => {
      const actId = getContext(actor).acts[0].id
      const otherAct = getContext(actor).acts[1]
      actor.send({ type: 'UPDATE_ACT', actId, name: 'Changed', durationMinutes: 99 })

      const otherAfter = getContext(actor).acts.find((a) => a.id === otherAct.id)!
      expect(otherAfter.name).toBe(otherAct.name)
      expect(otherAfter.durationMinutes).toBe(otherAct.durationMinutes)
    })
  })

  // ─── Live Phase ───

  describe('during live phase', () => {
    beforeEach(() => {
      setupLive(actor)
    })

    it('is in live phase', () => {
      expect(getPhase(actor)).toBe('live')
    })

    it('changes act name during live', () => {
      const actId = getContext(actor).acts[1].id
      actor.send({ type: 'UPDATE_ACT', actId, name: 'Cardio' })

      const updated = getContext(actor).acts.find((a) => a.id === actId)!
      expect(updated.name).toBe('Cardio')
      expect(updated.durationMinutes).toBe(45)
    })

    it('changes act duration during live', () => {
      const actId = getContext(actor).acts[0].id
      actor.send({ type: 'UPDATE_ACT', actId, durationMinutes: 15 })

      const updated = getContext(actor).acts.find((a) => a.id === actId)!
      expect(updated.durationMinutes).toBe(15)
      expect(updated.name).toBe('Deep Work')
    })

    it('with nonexistent actId during live is a no-op', () => {
      const actsBefore = getContext(actor).acts.map((a) => ({ ...a }))
      actor.send({ type: 'UPDATE_ACT', actId: 'does-not-exist', durationMinutes: 999 })

      const actsAfter = getContext(actor).acts
      actsAfter.forEach((act, i) => {
        expect(act.name).toBe(actsBefore[i].name)
        expect(act.durationMinutes).toBe(actsBefore[i].durationMinutes)
      })
    })
  })
})
