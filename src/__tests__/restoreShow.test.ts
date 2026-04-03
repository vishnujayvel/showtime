/**
 * Unit tests for the RESTORE_SHOW (auto-resume) event.
 *
 * RESTORE_SHOW transitions from no_show to a target phase with full context
 * restoration, enabling app relaunch to resume a previously active show.
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
import type { ShowPhase, Act, ShowLineup } from '../shared/types'

// ─── Helpers ───

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

function makeActs(count: number): Act[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `act-${i + 1}`,
    name: `Act ${i + 1}`,
    sketch: `Sketch ${i + 1}`,
    durationMinutes: 30 + i * 15,
    status: 'upcoming' as const,
    beatLocked: false,
    order: i,
  }))
}

function makeLiveActs(): Act[] {
  const acts = makeActs(3)
  acts[0].status = 'active'
  acts[0].startedAt = Date.now() - 600_000
  return acts
}

const sampleLineup: ShowLineup = {
  acts: [
    { name: 'Deep Work', sketch: 'Deep Work', durationMinutes: 60 },
    { name: 'Exercise', sketch: 'Exercise', durationMinutes: 45 },
    { name: 'Admin', sketch: 'Admin', durationMinutes: 30 },
  ],
  beatThreshold: 3,
  openingNote: 'Test lineup',
}

// ─── Tests ───

describe('RESTORE_SHOW (auto-resume)', () => {
  let actor: ReturnType<typeof createTestActor>

  beforeEach(() => {
    actor = createTestActor()
  })

  // ─── 1. Restore to writers_room ───

  describe('no_show → writers_room.lineup_ready', () => {
    it('restores to writers_room with acts and energy', () => {
      const acts = makeActs(3)
      actor.send({
        type: 'RESTORE_SHOW',
        targetPhase: 'writers_room',
        context: {
          energy: 'high',
          acts,
          writersRoomStep: 'lineup_ready',
          lineupStatus: 'confirmed',
          beatThreshold: 3,
        },
      })

      expect(getPhase(actor)).toBe('writers_room')
      const step = getWritersRoomStep(actor.getSnapshot().value as Record<string, unknown>)
      expect(step).toBe('lineup_ready')

      const ctx = getContext(actor)
      expect(ctx.energy).toBe('high')
      expect(ctx.acts).toHaveLength(3)
      expect(ctx.lineupStatus).toBe('confirmed')
      expect(ctx.beatThreshold).toBe(3)
    })

    it('restores writers_room with medium energy', () => {
      actor.send({
        type: 'RESTORE_SHOW',
        targetPhase: 'writers_room',
        context: {
          energy: 'medium',
          acts: makeActs(2),
          writersRoomStep: 'lineup_ready',
          lineupStatus: 'draft',
        },
      })

      expect(getPhase(actor)).toBe('writers_room')
      const ctx = getContext(actor)
      expect(ctx.energy).toBe('medium')
      expect(ctx.acts).toHaveLength(2)
      expect(ctx.lineupStatus).toBe('draft')
    })
  })

  // ─── 2. Restore to live ───

  describe('no_show → live.act_active', () => {
    it('restores to live with acts, currentActId, and timerEndAt', () => {
      const acts = makeLiveActs()
      const timerEndAt = Date.now() + 1_800_000 // 30 min from now

      actor.send({
        type: 'RESTORE_SHOW',
        targetPhase: 'live',
        context: {
          energy: 'high',
          acts,
          currentActId: 'act-1',
          timerEndAt,
          showStartedAt: Date.now() - 600_000,
          showDate: new Date().toISOString().slice(0, 10),
          beatsLocked: 0,
          beatThreshold: 3,
          viewTier: 'micro',
        },
      })

      expect(getPhase(actor)).toBe('live')
      const snap = actor.getSnapshot()
      expect((snap.value as any).phase.live).toBe('act_active')

      const ctx = getContext(actor)
      expect(ctx.currentActId).toBe('act-1')
      expect(ctx.timerEndAt).toBe(timerEndAt)
      expect(ctx.acts).toHaveLength(3)
      expect(ctx.energy).toBe('high')
      expect(ctx.showStartedAt).not.toBeNull()
      expect(ctx.viewTier).toBe('micro')
    })

    it('restores to live mid-show with beats already locked', () => {
      const acts = makeLiveActs()
      acts[0].status = 'completed'
      acts[0].beatLocked = true
      acts[0].completedAt = Date.now() - 300_000
      acts[1].status = 'active'
      acts[1].startedAt = Date.now() - 120_000
      const timerEndAt = Date.now() + 1_500_000

      actor.send({
        type: 'RESTORE_SHOW',
        targetPhase: 'live',
        context: {
          energy: 'medium',
          acts,
          currentActId: 'act-2',
          timerEndAt,
          beatsLocked: 1,
          beatThreshold: 3,
          showStartedAt: Date.now() - 1_800_000,
        },
      })

      expect(getPhase(actor)).toBe('live')
      const ctx = getContext(actor)
      expect(ctx.currentActId).toBe('act-2')
      expect(ctx.beatsLocked).toBe(1)
      expect(ctx.acts[0].status).toBe('completed')
      expect(ctx.acts[0].beatLocked).toBe(true)
      expect(ctx.acts[1].status).toBe('active')
    })
  })

  // ─── 3. Restore to intermission ───

  describe('no_show → intermission.resting', () => {
    it('restores to intermission with paused timer', () => {
      const acts = makeLiveActs()
      const pausedRemaining = 900_000 // 15 min left

      actor.send({
        type: 'RESTORE_SHOW',
        targetPhase: 'intermission',
        context: {
          energy: 'low',
          acts,
          currentActId: 'act-1',
          timerEndAt: null,
          timerPausedRemaining: pausedRemaining,
          beatsLocked: 0,
          beatThreshold: 3,
          showStartedAt: Date.now() - 2_400_000,
        },
      })

      expect(getPhase(actor)).toBe('intermission')
      const snap = actor.getSnapshot()
      expect((snap.value as any).phase.intermission).toBe('resting')

      const ctx = getContext(actor)
      expect(ctx.energy).toBe('low')
      expect(ctx.timerPausedRemaining).toBe(pausedRemaining)
      expect(ctx.timerEndAt).toBeNull()
      expect(ctx.currentActId).toBe('act-1')
    })

    it('restores to intermission with no paused timer (between acts)', () => {
      const acts = makeLiveActs()
      acts[0].status = 'completed'
      acts[0].completedAt = Date.now() - 60_000
      acts[1].status = 'upcoming'

      actor.send({
        type: 'RESTORE_SHOW',
        targetPhase: 'intermission',
        context: {
          energy: 'high',
          acts,
          currentActId: null,
          timerEndAt: null,
          timerPausedRemaining: null,
          beatsLocked: 1,
          showStartedAt: Date.now() - 3_600_000,
        },
      })

      expect(getPhase(actor)).toBe('intermission')
      const ctx = getContext(actor)
      expect(ctx.timerPausedRemaining).toBeNull()
      expect(ctx.beatsLocked).toBe(1)
    })
  })

  // ─── 4. Restore to strike ───

  describe('no_show → strike', () => {
    it('restores to strike with verdict and completed acts', () => {
      const acts = makeLiveActs()
      acts.forEach((a) => {
        a.status = 'completed'
        a.completedAt = Date.now() - 60_000
        a.beatLocked = true
      })

      actor.send({
        type: 'RESTORE_SHOW',
        targetPhase: 'strike',
        context: {
          energy: 'high',
          acts,
          currentActId: null,
          beatsLocked: 3,
          beatThreshold: 3,
          verdict: 'DAY_WON',
          showStartedAt: Date.now() - 7_200_000,
          showDate: new Date().toISOString().slice(0, 10),
        },
      })

      expect(getPhase(actor)).toBe('strike')
      const ctx = getContext(actor)
      expect(ctx.verdict).toBe('DAY_WON')
      expect(ctx.beatsLocked).toBe(3)
      expect(ctx.acts).toHaveLength(3)
      expect(ctx.acts.every((a) => a.status === 'completed')).toBe(true)
    })

    it('restores to strike with SHOW_CALLED_EARLY verdict', () => {
      const acts = makeLiveActs()
      acts.forEach((a) => {
        a.status = 'skipped'
      })

      actor.send({
        type: 'RESTORE_SHOW',
        targetPhase: 'strike',
        context: {
          energy: 'recovery',
          acts,
          currentActId: null,
          beatsLocked: 0,
          beatThreshold: 3,
          verdict: 'SHOW_CALLED_EARLY',
        },
      })

      expect(getPhase(actor)).toBe('strike')
      const ctx = getContext(actor)
      expect(ctx.verdict).toBe('SHOW_CALLED_EARLY')
      expect(ctx.beatsLocked).toBe(0)
      expect(ctx.energy).toBe('recovery')
    })
  })

  // ─── 5. Restore with invalid/empty context ───

  describe('RESTORE_SHOW with edge-case context', () => {
    it('does not crash with empty context object', () => {
      actor.send({
        type: 'RESTORE_SHOW',
        targetPhase: 'live',
        context: {},
      })

      // Should transition to live.act_active (context spread won't override defaults
      // with undefined, just uses the initial context values)
      expect(getPhase(actor)).toBe('live')
      const ctx = getContext(actor)
      // Initial defaults preserved since empty context was spread
      expect(ctx.acts).toHaveLength(0)
      expect(ctx.currentActId).toBeNull()
    })

    it('does not crash with minimal writers_room context', () => {
      actor.send({
        type: 'RESTORE_SHOW',
        targetPhase: 'writers_room',
        context: { energy: 'low' },
      })

      expect(getPhase(actor)).toBe('writers_room')
      const ctx = getContext(actor)
      expect(ctx.energy).toBe('low')
      expect(ctx.acts).toHaveLength(0)
    })

    it('does not crash with minimal strike context', () => {
      actor.send({
        type: 'RESTORE_SHOW',
        targetPhase: 'strike',
        context: { verdict: 'GOOD_EFFORT' },
      })

      expect(getPhase(actor)).toBe('strike')
      expect(getContext(actor).verdict).toBe('GOOD_EFFORT')
    })

    it('does not crash with minimal intermission context', () => {
      actor.send({
        type: 'RESTORE_SHOW',
        targetPhase: 'intermission',
        context: {},
      })

      expect(getPhase(actor)).toBe('intermission')
    })

    it('preserves non-overridden fields from initial context', () => {
      actor.send({
        type: 'RESTORE_SHOW',
        targetPhase: 'live',
        context: {
          energy: 'high',
          // Not setting beatThreshold — should remain default 3
        },
      })

      expect(getPhase(actor)).toBe('live')
      const ctx = getContext(actor)
      expect(ctx.energy).toBe('high')
      expect(ctx.beatThreshold).toBe(3) // default preserved
      expect(ctx.beatsLocked).toBe(0) // default preserved
      expect(ctx.celebrationActive).toBe(false) // default preserved
    })
  })

  // ─── 6. RESTORE_SHOW ignored when not in no_show ───

  describe('RESTORE_SHOW is only accepted from no_show', () => {
    it('ignored when in writers_room', () => {
      actor.send({ type: 'ENTER_WRITERS_ROOM' })
      expect(getPhase(actor)).toBe('writers_room')

      actor.send({
        type: 'RESTORE_SHOW',
        targetPhase: 'live',
        context: {
          energy: 'high',
          acts: makeLiveActs(),
          currentActId: 'act-1',
          timerEndAt: Date.now() + 1_800_000,
        },
      })

      // Should still be in writers_room — RESTORE_SHOW is a no-op
      expect(getPhase(actor)).toBe('writers_room')
    })

    it('ignored when in live', () => {
      actor.send({ type: 'ENTER_WRITERS_ROOM' })
      actor.send({ type: 'SET_LINEUP', lineup: sampleLineup })
      actor.send({ type: 'FINALIZE_LINEUP' })
      actor.send({ type: 'START_SHOW' })
      expect(getPhase(actor)).toBe('live')

      actor.send({
        type: 'RESTORE_SHOW',
        targetPhase: 'strike',
        context: { verdict: 'DAY_WON' },
      })

      // Should still be in live
      expect(getPhase(actor)).toBe('live')
      expect(getContext(actor).verdict).toBeNull()
    })

    it('ignored when in intermission', () => {
      actor.send({ type: 'ENTER_WRITERS_ROOM' })
      actor.send({ type: 'SET_LINEUP', lineup: sampleLineup })
      actor.send({ type: 'FINALIZE_LINEUP' })
      actor.send({ type: 'START_SHOW' })
      actor.send({ type: 'ENTER_INTERMISSION' })
      expect(getPhase(actor)).toBe('intermission')

      actor.send({
        type: 'RESTORE_SHOW',
        targetPhase: 'writers_room',
        context: { energy: 'low' },
      })

      // Should still be in intermission
      expect(getPhase(actor)).toBe('intermission')
    })

    it('ignored when in strike', () => {
      actor.send({ type: 'ENTER_WRITERS_ROOM' })
      actor.send({ type: 'SET_LINEUP', lineup: sampleLineup })
      actor.send({ type: 'FINALIZE_LINEUP' })
      actor.send({ type: 'START_SHOW' })
      actor.send({ type: 'STRIKE' })
      expect(getPhase(actor)).toBe('strike')

      actor.send({
        type: 'RESTORE_SHOW',
        targetPhase: 'live',
        context: {
          acts: makeLiveActs(),
          currentActId: 'act-1',
        },
      })

      // Should still be in strike
      expect(getPhase(actor)).toBe('strike')
    })
  })

  // ─── 7. Restore to director ───

  describe('no_show → director', () => {
    it('restores to director phase', () => {
      const acts = makeLiveActs()

      actor.send({
        type: 'RESTORE_SHOW',
        targetPhase: 'director',
        context: {
          energy: 'high',
          acts,
          currentActId: 'act-1',
          timerEndAt: null,
          timerPausedRemaining: 900_000,
          showStartedAt: Date.now() - 3_600_000,
        },
      })

      expect(getPhase(actor)).toBe('director')
      const ctx = getContext(actor)
      expect(ctx.currentActId).toBe('act-1')
      expect(ctx.acts).toHaveLength(3)
    })
  })

  // ─── 8. Restored state allows further transitions ───

  describe('transitions work after restore', () => {
    it('restored live show can complete acts', () => {
      const acts = makeLiveActs()

      actor.send({
        type: 'RESTORE_SHOW',
        targetPhase: 'live',
        context: {
          energy: 'high',
          acts,
          currentActId: 'act-1',
          timerEndAt: Date.now() + 1_800_000,
          beatThreshold: 3,
          showStartedAt: Date.now() - 600_000,
        },
      })

      expect(getPhase(actor)).toBe('live')

      // Complete the current act
      actor.send({ type: 'COMPLETE_ACT', actId: 'act-1' })
      const snap = actor.getSnapshot()
      expect((snap.value as any).phase.live).toBe('beat_check')

      // Lock beat
      actor.send({ type: 'LOCK_BEAT' })
      expect(getContext(actor).beatsLocked).toBe(1)

      // Celebration done advances to next act
      actor.send({ type: 'CELEBRATION_DONE' })
      expect(getContext(actor).currentActId).toBe('act-2')
    })

    it('restored intermission can exit back to live', () => {
      const acts = makeLiveActs()

      actor.send({
        type: 'RESTORE_SHOW',
        targetPhase: 'intermission',
        context: {
          energy: 'medium',
          acts,
          currentActId: 'act-1',
          timerPausedRemaining: 1_200_000,
          timerEndAt: null,
          showStartedAt: Date.now() - 1_800_000,
        },
      })

      expect(getPhase(actor)).toBe('intermission')

      // Exit intermission should resume live
      actor.send({ type: 'EXIT_INTERMISSION' })
      expect(getPhase(actor)).toBe('live')
      expect(getContext(actor).timerEndAt).not.toBeNull()
      expect(getContext(actor).timerPausedRemaining).toBeNull()
    })

    it('restored strike can reset to no_show', () => {
      actor.send({
        type: 'RESTORE_SHOW',
        targetPhase: 'strike',
        context: {
          verdict: 'SOLID_SHOW',
          beatsLocked: 2,
          beatThreshold: 3,
        },
      })

      expect(getPhase(actor)).toBe('strike')

      actor.send({ type: 'RESET' })
      expect(getPhase(actor)).toBe('no_show')
      expect(getContext(actor).verdict).toBeNull()
      expect(getContext(actor).acts).toHaveLength(0)
    })

    it('restored writers_room can start show after finalize', () => {
      const acts = makeActs(2)

      actor.send({
        type: 'RESTORE_SHOW',
        targetPhase: 'writers_room',
        context: {
          energy: 'high',
          acts,
          lineupStatus: 'confirmed',
          writersRoomStep: 'lineup_ready',
        },
      })

      expect(getPhase(actor)).toBe('writers_room')

      // Should be able to start show since lineup is confirmed and acts exist
      actor.send({ type: 'START_SHOW' })
      expect(getPhase(actor)).toBe('live')
      expect(getContext(actor).currentActId).not.toBeNull()
    })
  })
})
