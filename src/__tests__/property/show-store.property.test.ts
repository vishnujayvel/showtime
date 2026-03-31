/**
 * Layer 2: fast-check Property-Based Store Testing
 *
 * Command-based model testing that generates random sequences of store actions
 * and verifies invariants hold after EVERY command.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import fc from 'fast-check'
import { useShowStore } from '../../renderer/stores/showStore'
import { resetShowActor } from '../../renderer/machines/showActor'
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

function resetStore() {
  resetShowActor()
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

// ─── Invariants ───

function checkInvariants(): void {
  const s = useShowStore.getState()

  // Phase is always valid
  expect(VALID_PHASES).toContain(s.phase)

  // ViewTier is always valid
  expect(VALID_TIERS).toContain(s.viewTier)

  // Beats are bounded
  expect(s.beatsLocked).toBeGreaterThanOrEqual(0)
  expect(s.beatsLocked).toBeLessThanOrEqual(s.beatThreshold)

  // Acts array is never null/undefined
  expect(Array.isArray(s.acts)).toBe(true)

  // If live, at most one act has status 'active'
  if (s.phase === 'live') {
    const activeCount = s.acts.filter((a) => a.status === 'active').length
    expect(activeCount).toBeLessThanOrEqual(1)
  }

  // If strike, verdict must be set
  if (s.phase === 'strike') {
    expect(s.verdict).not.toBeNull()
  }

  // currentActId, if set, must reference a real act
  if (s.currentActId) {
    const found = s.acts.find((a) => a.id === s.currentActId)
    expect(found).toBeDefined()
  }

  // timerPausedRemaining only during intermission
  if (s.timerPausedRemaining !== null) {
    expect(['intermission']).toContain(s.phase)
  }
}

// ─── Commands ───

type StoreCommand = {
  name: string
  precondition: () => boolean
  run: () => void
}

const commands: (() => StoreCommand)[] = [
  // ENTER_WRITERS_ROOM
  () => ({
    name: 'enterWritersRoom',
    precondition: () => useShowStore.getState().phase === 'no_show',
    run: () => useShowStore.getState().enterWritersRoom(),
  }),

  // SET_LINEUP
  () => ({
    name: 'setLineup',
    precondition: () => useShowStore.getState().phase === 'writers_room',
    run: () => useShowStore.getState().setLineup(sampleLineup),
  }),

  // START_SHOW
  () => ({
    name: 'startShow',
    precondition: () => {
      const s = useShowStore.getState()
      return s.phase === 'writers_room' && s.acts.length > 0
    },
    run: () => useShowStore.getState().startShow(),
  }),

  // COMPLETE_ACT
  () => ({
    name: 'completeAct',
    precondition: () => {
      const s = useShowStore.getState()
      return s.phase === 'live' && s.currentActId !== null
    },
    run: () => {
      const s = useShowStore.getState()
      if (s.currentActId) {
        s.completeAct(s.currentActId)
      }
    },
  }),

  // LOCK_BEAT
  () => ({
    name: 'lockBeat',
    precondition: () => useShowStore.getState().beatCheckPending === true,
    run: () => {
      useShowStore.getState().lockBeat()
      // Advance past celebration timeout
      vi.advanceTimersByTime(2000)
    },
  }),

  // SKIP_BEAT
  () => ({
    name: 'skipBeat',
    precondition: () => useShowStore.getState().beatCheckPending === true,
    run: () => useShowStore.getState().skipBeat(),
  }),

  // ENTER_INTERMISSION
  () => ({
    name: 'enterIntermission',
    precondition: () => useShowStore.getState().phase === 'live',
    run: () => useShowStore.getState().enterIntermission(),
  }),

  // EXIT_INTERMISSION
  () => ({
    name: 'exitIntermission',
    precondition: () => useShowStore.getState().phase === 'intermission',
    run: () => useShowStore.getState().exitIntermission(),
  }),

  // ENTER_DIRECTOR
  () => ({
    name: 'enterDirector',
    precondition: () => useShowStore.getState().phase === 'live',
    run: () => useShowStore.getState().enterDirector(),
  }),

  // EXIT_DIRECTOR
  () => ({
    name: 'exitDirector',
    precondition: () => useShowStore.getState().phase === 'director',
    run: () => useShowStore.getState().exitDirector(),
  }),

  // CALL_SHOW_EARLY
  () => ({
    name: 'callShowEarly',
    precondition: () => useShowStore.getState().phase === 'director',
    run: () => useShowStore.getState().callShowEarly(),
  }),

  // SKIP_TO_NEXT
  () => ({
    name: 'skipToNextAct',
    precondition: () => {
      const s = useShowStore.getState()
      return s.phase === 'director' && s.currentActId !== null
    },
    run: () => useShowStore.getState().skipToNextAct(),
  }),

  // RESET
  () => ({
    name: 'resetShow',
    precondition: () => true, // can always reset
    run: () => useShowStore.getState().resetShow(),
  }),

  // CYCLE_TIER
  () => ({
    name: 'cycleViewTier',
    precondition: () => true,
    run: () => useShowStore.getState().cycleViewTier(),
  }),

  // EXPAND_TIER
  () => ({
    name: 'expandViewTier',
    precondition: () => true,
    run: () => useShowStore.getState().expandViewTier(),
  }),

  // COLLAPSE_TIER
  () => ({
    name: 'collapseViewTier',
    precondition: () => true,
    run: () => useShowStore.getState().collapseViewTier(),
  }),
]

// ─── Arbitrary for command indices ───

const commandIdxArb = fc.integer({ min: 0, max: commands.length - 1 })

// ─── Tests ───

describe('Layer 2: Property-Based Store Tests (fast-check)', () => {
  beforeEach(() => {
    resetStore()
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
          resetStore()

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
          resetStore()

          // Apply random commands
          for (const idx of indices) {
            const cmd = commands[idx]()
            if (cmd.precondition()) {
              cmd.run()
            }
          }

          // Reset and verify clean state
          useShowStore.getState().resetShow()
          const s = useShowStore.getState()
          expect(s.phase).toBe('no_show')
          expect(s.acts).toHaveLength(0)
          expect(s.verdict).toBeNull()
          expect(s.currentActId).toBeNull()
          expect(s.timerEndAt).toBeNull()
          expect(s.beatsLocked).toBe(0)
          expect(s.beatCheckPending).toBe(false)
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
          resetStore()

          for (const op of ops) {
            switch (op) {
              case 'cycle':
                useShowStore.getState().cycleViewTier()
                break
              case 'expand':
                useShowStore.getState().expandViewTier()
                break
              case 'collapse':
                useShowStore.getState().collapseViewTier()
                break
              case 'set':
                useShowStore.getState().setViewTier(
                  VALID_TIERS[Math.floor(Math.random() * VALID_TIERS.length)]
                )
                break
            }

            const tier = useShowStore.getState().viewTier
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
          resetStore()

          for (const idx of indices) {
            const cmd = commands[idx]()
            if (cmd.precondition()) {
              cmd.run()
              const s = useShowStore.getState()
              expect(s.beatsLocked).toBeLessThanOrEqual(s.beatThreshold)
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
          resetStore()

          let prevFinished = 0
          for (const idx of indices) {
            const cmd = commands[idx]()
            if (cmd.precondition()) {
              cmd.run()
              const s = useShowStore.getState()
              const finished = s.acts.filter((a) => a.status === 'completed' || a.status === 'skipped').length
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
    resetStore()
    const store = useShowStore.getState()

    // Enter writers room and set lineup
    store.enterWritersRoom()
    expect(useShowStore.getState().phase).toBe('writers_room')

    useShowStore.getState().setLineup(sampleLineup)
    expect(useShowStore.getState().acts.length).toBe(3)

    // Start show
    useShowStore.getState().startShow()
    expect(useShowStore.getState().phase).toBe('live')

    // Complete all 3 acts with beat skips
    for (let i = 0; i < 3; i++) {
      const s = useShowStore.getState()
      if (s.currentActId) {
        s.completeAct(s.currentActId)
        useShowStore.getState().skipBeat()
      }
    }

    // Should be at strike
    expect(useShowStore.getState().phase).toBe('strike')
    expect(useShowStore.getState().verdict).not.toBeNull()
    checkInvariants()
  })
})
