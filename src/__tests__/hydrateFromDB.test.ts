/**
 * Integration tests for hydrateFromDB() pipeline.
 *
 * Unlike restoreShow.test.ts which tests RESTORE_SHOW directly,
 * these tests mock window.showtime.dataHydrate() and verify the full
 * hydration pipeline: DB snapshot → dbActToMachineAct → RESTORE_SHOW → machine state.
 *
 * Covers:
 * - Paused timer round-trip
 * - Strike skip (hydrateFromDB returns false)
 * - Confirmed lineup promotion (#182)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  hydrateFromDB,
  showActor,
  resetShowActor,
  getPhaseFromState,
} from '../renderer/machines/showActor'
import type { ShowStateSnapshot, ActSnapshot } from '../shared/types'

// ─── Helpers ───

function getPhase(): string {
  return getPhaseFromState(
    showActor.getSnapshot().value as Record<string, unknown>
  )
}

function getContext() {
  return showActor.getSnapshot().context
}

const TODAY = new Date().toISOString().slice(0, 10)

function makeActSnapshots(count: number): ActSnapshot[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `act-${i + 1}`,
    name: `Act ${i + 1}`,
    sketch: `Sketch ${i + 1}`,
    plannedDurationMs: (30 + i * 15) * 60 * 1000,
    sortOrder: i,
    status: 'pending',
    beatLocked: 0,
  }))
}

function makeLiveActSnapshots(): ActSnapshot[] {
  const acts = makeActSnapshots(3)
  acts[0].status = 'active'
  acts[0].actualStartAt = Date.now() - 600_000 // started 10 min ago
  return acts
}

function mockHydrate(snapshot: ShowStateSnapshot | null) {
  vi.mocked(window.showtime.dataHydrate).mockResolvedValue(snapshot)
}

// ─── Tests ───

describe('hydrateFromDB() integration', () => {
  beforeEach(() => {
    resetShowActor()
    vi.mocked(window.showtime.dataHydrate).mockReset()
  })

  // ─── Basic pipeline ───

  describe('basic pipeline', () => {
    it('returns false when dataHydrate returns null', async () => {
      mockHydrate(null)

      const result = await hydrateFromDB()

      expect(result).toBe(false)
      expect(getPhase()).toBe('no_show')
    })

    it('returns false when snapshot has no acts', async () => {
      mockHydrate({ showId: TODAY, phase: 'live', acts: [] })

      const result = await hydrateFromDB()

      expect(result).toBe(false)
      expect(getPhase()).toBe('no_show')
    })

    it('returns false when actor is not in no_show', async () => {
      showActor.send({ type: 'ENTER_WRITERS_ROOM' })
      expect(getPhase()).toBe('writers_room')

      mockHydrate({
        showId: TODAY,
        phase: 'live',
        acts: makeLiveActSnapshots(),
      })

      const result = await hydrateFromDB()

      expect(result).toBe(false)
      expect(getPhase()).toBe('writers_room')
    })

    it('hydrates a live show from DB snapshot', async () => {
      const acts = makeLiveActSnapshots()

      mockHydrate({
        showId: TODAY,
        phase: 'live',
        energy: 'high',
        beatsLocked: 1,
        beatThreshold: 3,
        startedAt: Date.now() - 1_800_000,
        acts,
      })

      const result = await hydrateFromDB()

      expect(result).toBe(true)
      expect(getPhase()).toBe('live')

      const ctx = getContext()
      expect(ctx.energy).toBe('high')
      expect(ctx.beatsLocked).toBe(1)
      expect(ctx.currentActId).toBe('act-1')
      expect(ctx.acts).toHaveLength(3)
      expect(ctx.acts[0].status).toBe('active')
      expect(ctx.timerEndAt).not.toBeNull()
    })
  })

  // ─── Paused timer round-trip ───

  describe('paused timer round-trip', () => {
    it('applies grace period when active act timer has expired', async () => {
      const acts = makeLiveActSnapshots()
      // Act started 2 hours ago with 30 min duration — timer long expired
      acts[0].actualStartAt = Date.now() - 7_200_000
      acts[0].plannedDurationMs = 30 * 60 * 1000

      mockHydrate({
        showId: TODAY,
        phase: 'live',
        energy: 'medium',
        acts,
      })

      const result = await hydrateFromDB()

      expect(result).toBe(true)
      expect(getPhase()).toBe('live')

      const ctx = getContext()
      // Expired timer gets grace period: now + 60s
      expect(ctx.timerEndAt).not.toBeNull()
      expect(ctx.timerEndAt!).toBeGreaterThan(Date.now())
      expect(ctx.timerEndAt! - Date.now()).toBeLessThanOrEqual(61_000)
    })

    it('reconstructs non-expired timer from startedAt + duration', async () => {
      const startedAt = Date.now() - 300_000 // 5 min ago
      const durationMs = 30 * 60 * 1000 // 30 min

      const acts = makeLiveActSnapshots()
      acts[0].actualStartAt = startedAt
      acts[0].plannedDurationMs = durationMs

      mockHydrate({
        showId: TODAY,
        phase: 'live',
        energy: 'high',
        acts,
      })

      const result = await hydrateFromDB()

      expect(result).toBe(true)

      const ctx = getContext()
      // Timer = startedAt + duration
      expect(ctx.timerEndAt).toBe(startedAt + durationMs)
    })

    it('sets timerPausedRemaining to null on intermission hydration', async () => {
      // This documents current behavior: paused timer state is lost.
      // Fix B (PRD Fix B) will address this to reconstruct timerPausedRemaining.
      const acts = makeLiveActSnapshots()

      mockHydrate({
        showId: TODAY,
        phase: 'intermission',
        energy: 'low',
        acts,
      })

      const result = await hydrateFromDB()

      expect(result).toBe(true)
      expect(getPhase()).toBe('intermission')

      const ctx = getContext()
      expect(ctx.timerPausedRemaining).toBeNull()
    })

    it('sets timerEndAt to null when no active act exists', async () => {
      const acts = makeActSnapshots(3)
      // All pending — no active act
      acts[0].status = 'completed'
      acts[0].actualEndAt = Date.now() - 60_000

      mockHydrate({
        showId: TODAY,
        phase: 'intermission',
        energy: 'medium',
        acts,
      })

      const result = await hydrateFromDB()

      expect(result).toBe(true)

      const ctx = getContext()
      expect(ctx.timerEndAt).toBeNull()
      expect(ctx.currentActId).toBeNull()
    })
  })

  // ─── Strike skip ───

  describe('strike skip', () => {
    it('returns false for strike phase', async () => {
      const acts = makeActSnapshots(3)
      acts.forEach((a) => {
        a.status = 'completed'
        a.actualEndAt = Date.now() - 60_000
        a.beatLocked = 1
      })

      mockHydrate({
        showId: TODAY,
        phase: 'strike',
        energy: 'high',
        verdict: 'DAY_WON',
        beatsLocked: 3,
        beatThreshold: 3,
        acts,
      })

      const result = await hydrateFromDB()

      expect(result).toBe(false)
      expect(getPhase()).toBe('no_show')
    })

    it('returns false for no_show phase in DB', async () => {
      mockHydrate({
        showId: TODAY,
        phase: 'no_show',
        acts: makeActSnapshots(2),
      })

      const result = await hydrateFromDB()

      expect(result).toBe(false)
      expect(getPhase()).toBe('no_show')
    })
  })

  // ─── Confirmed lineup promotion (#182) ───

  describe('confirmed lineup promotion (#182)', () => {
    it('promotes writers_room with acts to live', async () => {
      const acts = makeActSnapshots(3)

      mockHydrate({
        showId: TODAY,
        phase: 'writers_room',
        energy: 'high',
        acts,
      })

      const result = await hydrateFromDB()

      expect(result).toBe(true)
      // writers_room + acts.length > 0 → hasConfirmedLineup → promotes to live
      expect(getPhase()).toBe('live')

      const ctx = getContext()
      expect(ctx.acts).toHaveLength(3)
      expect(ctx.lineupStatus).toBe('confirmed')
      expect(ctx.energy).toBe('high')
    })

    it('promotes writers_room with single act', async () => {
      mockHydrate({
        showId: TODAY,
        phase: 'writers_room',
        energy: 'low',
        acts: makeActSnapshots(1),
      })

      const result = await hydrateFromDB()

      expect(result).toBe(true)
      expect(getPhase()).toBe('live')
      expect(getContext().acts).toHaveLength(1)
    })

    it('sets viewTier to micro for promoted live phase', async () => {
      mockHydrate({
        showId: TODAY,
        phase: 'writers_room',
        energy: 'medium',
        acts: makeActSnapshots(2),
      })

      const result = await hydrateFromDB()

      expect(result).toBe(true)
      expect(getPhase()).toBe('live')
      expect(getContext().viewTier).toBe('micro')
    })
  })

  // ─── ActSnapshot → Act conversion ───

  describe('ActSnapshot → Act conversion via pipeline', () => {
    it('converts DB fields to machine Act format', async () => {
      mockHydrate({
        showId: TODAY,
        phase: 'live',
        acts: [
          {
            id: 'deep-work',
            name: 'Deep Work',
            sketch: 'Focus session',
            plannedDurationMs: 3_600_000, // 60 min
            sortOrder: 0,
            status: 'active',
            beatLocked: 1,
            actualStartAt: Date.now() - 300_000,
            actualEndAt: null,
            plannedStartAt: Date.now() - 600_000,
          },
        ],
      })

      const result = await hydrateFromDB()

      expect(result).toBe(true)

      const act = getContext().acts[0]
      expect(act.id).toBe('deep-work')
      expect(act.name).toBe('Deep Work')
      expect(act.sketch).toBe('Focus session')
      expect(act.durationMinutes).toBe(60)
      expect(act.status).toBe('active')
      expect(act.beatLocked).toBe(true)
      expect(act.order).toBe(0)
      expect(act.startedAt).toBeDefined()
    })

    it('maps "pending" DB status to "upcoming" machine status', async () => {
      mockHydrate({
        showId: TODAY,
        phase: 'live',
        acts: [
          {
            id: 'admin',
            name: 'Admin',
            sketch: 'Emails',
            plannedDurationMs: 1_800_000,
            sortOrder: 0,
            status: 'pending',
            beatLocked: 0,
          },
        ],
      })

      const result = await hydrateFromDB()

      expect(result).toBe(true)
      expect(getContext().acts[0].status).toBe('upcoming')
    })

    it('preserves completed act state through pipeline', async () => {
      const completedAt = Date.now() - 120_000
      const startedAt = Date.now() - 2_400_000

      mockHydrate({
        showId: TODAY,
        phase: 'live',
        acts: [
          {
            id: 'done-act',
            name: 'Done',
            sketch: 'Finished',
            plannedDurationMs: 1_800_000,
            sortOrder: 0,
            status: 'completed',
            beatLocked: 1,
            actualStartAt: startedAt,
            actualEndAt: completedAt,
          },
          {
            id: 'next-act',
            name: 'Next',
            sketch: 'Up next',
            plannedDurationMs: 1_800_000,
            sortOrder: 1,
            status: 'active',
            beatLocked: 0,
            actualStartAt: Date.now() - 60_000,
          },
        ],
      })

      const result = await hydrateFromDB()

      expect(result).toBe(true)

      const ctx = getContext()
      expect(ctx.acts[0].status).toBe('completed')
      expect(ctx.acts[0].beatLocked).toBe(true)
      expect(ctx.acts[0].completedAt).toBe(completedAt)
      expect(ctx.acts[0].startedAt).toBe(startedAt)
      expect(ctx.acts[1].status).toBe('active')
      expect(ctx.currentActId).toBe('next-act')
    })
  })

  // ─── Error handling ───

  describe('error handling', () => {
    it('returns false when dataHydrate throws', async () => {
      vi.mocked(window.showtime.dataHydrate).mockRejectedValue(
        new Error('DB connection failed')
      )

      const result = await hydrateFromDB()

      expect(result).toBe(false)
      expect(getPhase()).toBe('no_show')
    })
  })
})
