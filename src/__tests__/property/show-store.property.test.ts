/**
 * Layer 2: fast-check Property-Based Actor Testing
 *
 * Command-based model testing that generates random sequences of actor events
 * and verifies invariants hold after EVERY command.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import fc from 'fast-check'
import { showActor, resetShowActor } from '../../renderer/machines/showActor'
import { getPhaseFromState } from '../../renderer/machines/showMachine'
import type { ShowPhase, ViewTier, ShowLineup } from '../../shared/types'

// ─── Helpers ───

const VALID_PHASES: ShowPhase[] = ['no_show', 'writers_room', 'live', 'intermission', 'director', 'strike']
const VALID_TIERS: ViewTier[] = ['micro', 'compact', 'dashboard', 'expanded']

const sampleLineup: ShowLineup = {
  acts: [
    { name: 'Deep Work', sketch: 'Deep', durationMinutes: 60 },
    { name: 'Exercise', sketch: 'Exercise', durationMinutes: 45 },
    { name: 'Admin', sketch: 'Admin', durationMinutes: 30 },
  ],
  beatThreshold: 3,
  openingNote: 'Test',
}

/** Helper to get current phase from the actor */
function phase(): ShowPhase {
  return getPhaseFromState(showActor.getSnapshot().value as Record<string, unknown>)
}

/** Helper to get actor context */
function ctx() {
  return showActor.getSnapshot().context
}

// ─── Invariants ───

function checkInvariants(): void {
  const p = phase()
  const c = ctx()

  // Phase is always valid
  expect(VALID_PHASES).toContain(p)

  // ViewTier is always valid
  expect(VALID_TIERS).toContain(c.viewTier)

  // Beats are bounded
  expect(c.beatsLocked).toBeGreaterThanOrEqual(0)
  expect(c.beatsLocked).toBeLessThanOrEqual(c.beatThreshold)

  // Acts array is never null/undefined
  expect(Array.isArray(c.acts)).toBe(true)

  // If live, at most one act has status 'active'
  if (p === 'live') {
    const activeCount = c.acts.filter((a) => a.status === 'active').length
    expect(activeCount).toBeLessThanOrEqual(1)
  }

  // If strike, verdict must be set
  if (p === 'strike') {
    expect(c.verdict).not.toBeNull()
  }

  // currentActId, if set, must reference a real act
  if (c.currentActId) {
    const found = c.acts.find((a) => a.id === c.currentActId)
    expect(found).toBeDefined()
  }

  // timerPausedRemaining only during intermission
  if (c.timerPausedRemaining !== null) {
    expect(['intermission']).toContain(p)
  }
}

// ─── Commands ───

type ActorCommand = {
  name: string
  precondition: () => boolean
  run: () => void
}

const commands: (() => ActorCommand)[] = [
  // ENTER_WRITERS_ROOM
  () => ({
    name: 'enterWritersRoom',
    precondition: () => phase() === 'no_show',
    run: () => showActor.send({ type: 'ENTER_WRITERS_ROOM' }),
  }),

  // SET_LINEUP (navigate to conversation substate first)
  () => ({
    name: 'setLineup',
    precondition: () => phase() === 'writers_room',
    run: () => {
      showActor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'plan' })
      showActor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'conversation' })
      showActor.send({ type: 'SET_LINEUP', lineup: sampleLineup })
    },
  }),

  // START_SHOW
  () => ({
    name: 'startShow',
    precondition: () => {
      return phase() === 'writers_room' && ctx().acts.length > 0
    },
    run: () => showActor.send({ type: 'START_SHOW' }),
  }),

  // COMPLETE_ACT
  () => ({
    name: 'completeAct',
    precondition: () => {
      return phase() === 'live' && ctx().currentActId !== null
    },
    run: () => {
      const actId = ctx().currentActId
      if (actId) {
        showActor.send({ type: 'COMPLETE_ACT', actId })
      }
    },
  }),

  // LOCK_BEAT
  () => ({
    name: 'lockBeat',
    precondition: () => ctx().beatCheckPending === true,
    run: () => {
      showActor.send({ type: 'LOCK_BEAT' })
      // Advance past celebration timeout
      vi.advanceTimersByTime(2000)
    },
  }),

  // SKIP_BEAT
  () => ({
    name: 'skipBeat',
    precondition: () => ctx().beatCheckPending === true,
    run: () => showActor.send({ type: 'SKIP_BEAT' }),
  }),

  // ENTER_INTERMISSION
  () => ({
    name: 'enterIntermission',
    precondition: () => phase() === 'live',
    run: () => showActor.send({ type: 'ENTER_INTERMISSION' }),
  }),

  // EXIT_INTERMISSION
  () => ({
    name: 'exitIntermission',
    precondition: () => phase() === 'intermission',
    run: () => showActor.send({ type: 'EXIT_INTERMISSION' }),
  }),

  // ENTER_DIRECTOR
  () => ({
    name: 'enterDirector',
    precondition: () => phase() === 'live',
    run: () => showActor.send({ type: 'ENTER_DIRECTOR' }),
  }),

  // EXIT_DIRECTOR
  () => ({
    name: 'exitDirector',
    precondition: () => phase() === 'director',
    run: () => showActor.send({ type: 'EXIT_DIRECTOR' }),
  }),

  // CALL_SHOW_EARLY
  () => ({
    name: 'callShowEarly',
    precondition: () => phase() === 'director',
    run: () => showActor.send({ type: 'CALL_SHOW_EARLY' }),
  }),

  // SKIP_TO_NEXT
  () => ({
    name: 'skipToNextAct',
    precondition: () => {
      return phase() === 'director' && ctx().currentActId !== null
    },
    run: () => showActor.send({ type: 'SKIP_TO_NEXT' }),
  }),

  // RESET
  () => ({
    name: 'resetShow',
    precondition: () => true, // can always reset
    run: () => showActor.send({ type: 'RESET' }),
  }),

  // SET_VIEW_TIER (cycle-like)
  () => ({
    name: 'cycleViewTier',
    precondition: () => true,
    run: () => {
      const tiers: ViewTier[] = ['micro', 'compact', 'dashboard', 'expanded']
      const current = ctx().viewTier
      const idx = tiers.indexOf(current)
      const next = tiers[(idx + 1) % tiers.length]
      showActor.send({ type: 'SET_VIEW_TIER', tier: next })
    },
  }),

  // SET_VIEW_TIER (expand-like)
  () => ({
    name: 'expandViewTier',
    precondition: () => true,
    run: () => {
      const tiers: ViewTier[] = ['micro', 'compact', 'dashboard', 'expanded']
      const current = ctx().viewTier
      const idx = tiers.indexOf(current)
      const next = tiers[Math.min(idx + 1, tiers.length - 1)]
      showActor.send({ type: 'SET_VIEW_TIER', tier: next })
    },
  }),

  // SET_VIEW_TIER (collapse-like)
  () => ({
    name: 'collapseViewTier',
    precondition: () => true,
    run: () => {
      const tiers: ViewTier[] = ['micro', 'compact', 'dashboard', 'expanded']
      const current = ctx().viewTier
      const idx = tiers.indexOf(current)
      const next = tiers[Math.max(idx - 1, 0)]
      showActor.send({ type: 'SET_VIEW_TIER', tier: next })
    },
  }),
]

// ─── Arbitrary for command indices ───

const commandIdxArb = fc.integer({ min: 0, max: commands.length - 1 })

// ─── Tests ───

describe('Layer 2: Property-Based Actor Tests (fast-check)', () => {
  beforeEach(() => {
    resetShowActor()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('invariants hold after any sequence of valid commands (100 runs × 50 steps)', () => {
    fc.assert(
      fc.property(
        fc.array(commandIdxArb, { minLength: 1, maxLength: 50 }),
        (indices) => {
          resetShowActor()

          for (const idx of indices) {
            const cmd = commands[idx]()
            if (cmd.precondition()) {
              cmd.run()
              checkInvariants()
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('reset always returns to clean no_show state regardless of prior state', () => {
    fc.assert(
      fc.property(
        fc.array(commandIdxArb, { minLength: 1, maxLength: 30 }),
        (indices) => {
          resetShowActor()

          // Apply random commands
          for (const idx of indices) {
            const cmd = commands[idx]()
            if (cmd.precondition()) {
              cmd.run()
            }
          }

          // Reset and verify clean state
          showActor.send({ type: 'RESET' })
          expect(phase()).toBe('no_show')
          expect(ctx().acts).toHaveLength(0)
          expect(ctx().verdict).toBeNull()
          expect(ctx().currentActId).toBeNull()
          expect(ctx().timerEndAt).toBeNull()
          expect(ctx().beatsLocked).toBe(0)
          expect(ctx().beatCheckPending).toBe(false)
        }
      ),
      { numRuns: 50 }
    )
  })

  it('viewTier is always valid after any sequence of tier operations', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom('cycle', 'expand', 'collapse', 'set'), { minLength: 1, maxLength: 100 }),
        (ops) => {
          resetShowActor()

          const tiers: ViewTier[] = ['micro', 'compact', 'dashboard', 'expanded']

          for (const op of ops) {
            const current = ctx().viewTier
            const idx = tiers.indexOf(current)
            switch (op) {
              case 'cycle':
                showActor.send({ type: 'SET_VIEW_TIER', tier: tiers[(idx + 1) % tiers.length] })
                break
              case 'expand':
                showActor.send({ type: 'SET_VIEW_TIER', tier: tiers[Math.min(idx + 1, tiers.length - 1)] })
                break
              case 'collapse':
                showActor.send({ type: 'SET_VIEW_TIER', tier: tiers[Math.max(idx - 1, 0)] })
                break
              case 'set':
                showActor.send({ type: 'SET_VIEW_TIER', tier: tiers[(idx + 2) % tiers.length] })
                break
            }

            const tier = ctx().viewTier
            expect(VALID_TIERS).toContain(tier)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('beatsLocked never exceeds beatThreshold through any command sequence', () => {
    fc.assert(
      fc.property(
        fc.array(commandIdxArb, { minLength: 1, maxLength: 50 }),
        (indices) => {
          resetShowActor()

          for (const idx of indices) {
            const cmd = commands[idx]()
            if (cmd.precondition()) {
              cmd.run()
              const c = ctx()
              expect(c.beatsLocked).toBeLessThanOrEqual(c.beatThreshold)
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('completing acts always progresses (act count with completed/skipped never decreases)', () => {
    fc.assert(
      fc.property(
        fc.array(commandIdxArb, { minLength: 5, maxLength: 40 }),
        (indices) => {
          resetShowActor()

          let prevFinished = 0
          for (const idx of indices) {
            const cmd = commands[idx]()
            if (cmd.precondition()) {
              cmd.run()
              const finished = ctx().acts.filter((a) => a.status === 'completed' || a.status === 'skipped').length
              // Can only reset finished count via resetShow
              if (cmd.name !== 'resetShow' && cmd.name !== 'callShowEarly') {
                expect(finished).toBeGreaterThanOrEqual(prevFinished)
              }
              prevFinished = finished
            }
          }
        }
      ),
      { numRuns: 50 }
    )
  })

  it('the full happy path (writers_room → live → complete all → strike) works', () => {
    resetShowActor()

    // Enter writers room and set lineup
    showActor.send({ type: 'ENTER_WRITERS_ROOM' })
    expect(phase()).toBe('writers_room')

    showActor.send({ type: 'SET_ENERGY', level: 'high' })
    showActor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'plan' })
    showActor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'conversation' })
    showActor.send({ type: 'SET_LINEUP', lineup: sampleLineup })
    expect(ctx().acts.length).toBe(3)

    // Start show
    showActor.send({ type: 'START_SHOW' })
    expect(phase()).toBe('live')

    // Complete all 3 acts with beat skips
    for (let i = 0; i < 3; i++) {
      const actId = ctx().currentActId
      if (actId) {
        showActor.send({ type: 'COMPLETE_ACT', actId })
        showActor.send({ type: 'SKIP_BEAT' })
      }
    }

    // Should be at strike
    expect(phase()).toBe('strike')
    expect(ctx().verdict).not.toBeNull()
    checkInvariants()
  })
})
