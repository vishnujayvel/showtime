import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { showActor, resetShowActor } from '../renderer/machines/showActor'
import { getPhaseFromState } from '../renderer/machines/showMachine'
import type { ShowLineup } from '../shared/types'

/** Helper to get current phase from the actor */
function phase() {
  return getPhaseFromState(showActor.getSnapshot().value as Record<string, unknown>)
}

/** Helper to get actor context */
function ctx() {
  return showActor.getSnapshot().context
}

/** Navigate actor to live phase with given beatThreshold */
function goLive(beatThreshold: number) {
  const lineup: ShowLineup = {
    acts: [
      { name: 'Act 1', sketch: 'Deep Work', durationMinutes: 30 },
    ],
    beatThreshold,
    openingNote: 'Test',
  }
  showActor.send({ type: 'ENTER_WRITERS_ROOM' })
  showActor.send({ type: 'SET_ENERGY', level: 'high' })
  showActor.send({ type: 'SET_LINEUP', lineup })
  showActor.send({ type: 'START_SHOW' })
}

describe('verdict calculation edge cases', () => {
  beforeEach(() => resetShowActor())

  // Exhaustive verdict boundary tests with threshold = 5
  describe('with beatThreshold = 5', () => {
    it('DAY_WON: 5/5 beats', () => {
      goLive(5)
      showActor.send({ type: '_PATCH_CONTEXT', patch: { beatsLocked: 5, beatThreshold: 5 } })
      showActor.send({ type: 'STRIKE' })
      expect(ctx().verdict).toBe('DAY_WON')
    })

    it('DAY_WON: 6/5 beats (over threshold)', () => {
      goLive(5)
      showActor.send({ type: '_PATCH_CONTEXT', patch: { beatsLocked: 6, beatThreshold: 5 } })
      showActor.send({ type: 'STRIKE' })
      expect(ctx().verdict).toBe('DAY_WON')
    })

    it('SOLID_SHOW: 4/5 beats (one short)', () => {
      goLive(5)
      showActor.send({ type: '_PATCH_CONTEXT', patch: { beatsLocked: 4, beatThreshold: 5 } })
      showActor.send({ type: 'STRIKE' })
      expect(ctx().verdict).toBe('SOLID_SHOW')
    })

    it('GOOD_EFFORT: 3/5 beats (ceil(5/2) = 3)', () => {
      goLive(5)
      showActor.send({ type: '_PATCH_CONTEXT', patch: { beatsLocked: 3, beatThreshold: 5 } })
      showActor.send({ type: 'STRIKE' })
      expect(ctx().verdict).toBe('GOOD_EFFORT')
    })

    it('SHOW_CALLED_EARLY: 2/5 beats (below half)', () => {
      goLive(5)
      showActor.send({ type: '_PATCH_CONTEXT', patch: { beatsLocked: 2, beatThreshold: 5 } })
      showActor.send({ type: 'STRIKE' })
      expect(ctx().verdict).toBe('SHOW_CALLED_EARLY')
    })

    it('SHOW_CALLED_EARLY: 0/5 beats', () => {
      goLive(5)
      showActor.send({ type: '_PATCH_CONTEXT', patch: { beatsLocked: 0, beatThreshold: 5 } })
      showActor.send({ type: 'STRIKE' })
      expect(ctx().verdict).toBe('SHOW_CALLED_EARLY')
    })
  })

  describe('with beatThreshold = 1', () => {
    it('DAY_WON: 1/1 beats', () => {
      goLive(1)
      showActor.send({ type: '_PATCH_CONTEXT', patch: { beatsLocked: 1, beatThreshold: 1 } })
      showActor.send({ type: 'STRIKE' })
      expect(ctx().verdict).toBe('DAY_WON')
    })

    it('SOLID_SHOW: 0/1 beats (one short = 0)', () => {
      goLive(1)
      showActor.send({ type: '_PATCH_CONTEXT', patch: { beatsLocked: 0, beatThreshold: 1 } })
      showActor.send({ type: 'STRIKE' })
      // 0 === 1 - 1 = SOLID_SHOW
      expect(ctx().verdict).toBe('SOLID_SHOW')
    })
  })

  describe('with beatThreshold = 2', () => {
    it('DAY_WON: 2/2', () => {
      goLive(2)
      showActor.send({ type: '_PATCH_CONTEXT', patch: { beatsLocked: 2, beatThreshold: 2 } })
      showActor.send({ type: 'STRIKE' })
      expect(ctx().verdict).toBe('DAY_WON')
    })

    it('SOLID_SHOW: 1/2 (one short)', () => {
      goLive(2)
      showActor.send({ type: '_PATCH_CONTEXT', patch: { beatsLocked: 1, beatThreshold: 2 } })
      showActor.send({ type: 'STRIKE' })
      expect(ctx().verdict).toBe('SOLID_SHOW')
    })

    it('SHOW_CALLED_EARLY: 0/2', () => {
      goLive(2)
      showActor.send({ type: '_PATCH_CONTEXT', patch: { beatsLocked: 0, beatThreshold: 2 } })
      showActor.send({ type: 'STRIKE' })
      // 0 === 2-1? No. 0 >= ceil(2/2)=1? No. → SHOW_CALLED_EARLY
      expect(ctx().verdict).toBe('SHOW_CALLED_EARLY')
    })
  })

  describe('with beatThreshold = 4', () => {
    it('GOOD_EFFORT: 2/4 (ceil(4/2) = 2)', () => {
      goLive(4)
      showActor.send({ type: '_PATCH_CONTEXT', patch: { beatsLocked: 2, beatThreshold: 4 } })
      showActor.send({ type: 'STRIKE' })
      expect(ctx().verdict).toBe('GOOD_EFFORT')
    })

    it('SHOW_CALLED_EARLY: 1/4', () => {
      goLive(4)
      showActor.send({ type: '_PATCH_CONTEXT', patch: { beatsLocked: 1, beatThreshold: 4 } })
      showActor.send({ type: 'STRIKE' })
      expect(ctx().verdict).toBe('SHOW_CALLED_EARLY')
    })
  })
})

describe('full show flow → verdict', () => {
  beforeEach(() => resetShowActor())

  it('complete show with all beats locked → DAY_WON', () => {
    vi.useFakeTimers()
    const lineup: ShowLineup = {
      acts: [
        { name: 'Act 1', sketch: 'Deep Work', durationMinutes: 30 },
        { name: 'Act 2', sketch: 'Exercise', durationMinutes: 30 },
      ],
      beatThreshold: 2,
      openingNote: 'Test',
    }

    showActor.send({ type: 'ENTER_WRITERS_ROOM' })
    showActor.send({ type: 'SET_ENERGY', level: 'high' })
    showActor.send({ type: 'SET_LINEUP', lineup })
    showActor.send({ type: 'START_SHOW' })

    // Complete act 1, lock beat
    const act1Id = ctx().currentActId!
    showActor.send({ type: 'COMPLETE_ACT', actId: act1Id })
    showActor.send({ type: 'LOCK_BEAT' })
    vi.advanceTimersByTime(1800)

    // Complete act 2, lock beat → triggers strikeTheStage
    const act2Id = ctx().currentActId!
    showActor.send({ type: 'COMPLETE_ACT', actId: act2Id })
    showActor.send({ type: 'LOCK_BEAT' })
    vi.advanceTimersByTime(1800)

    expect(phase()).toBe('strike')
    expect(ctx().verdict).toBe('DAY_WON')
    expect(ctx().beatsLocked).toBe(2)
    vi.useRealTimers()
  })

  it('complete show with no beats locked → SHOW_CALLED_EARLY', () => {
    const lineup: ShowLineup = {
      acts: [
        { name: 'Act 1', sketch: 'Deep Work', durationMinutes: 30 },
      ],
      beatThreshold: 1,
      openingNote: 'Test',
    }

    showActor.send({ type: 'ENTER_WRITERS_ROOM' })
    showActor.send({ type: 'SET_ENERGY', level: 'high' })
    showActor.send({ type: 'SET_LINEUP', lineup })
    showActor.send({ type: 'START_SHOW' })

    const act1Id = ctx().currentActId!
    showActor.send({ type: 'COMPLETE_ACT', actId: act1Id })
    showActor.send({ type: 'SKIP_BEAT' })

    expect(phase()).toBe('strike')
    // 0/1: 0 === 1-1=0 → SOLID_SHOW (not SHOW_CALLED_EARLY!)
    expect(ctx().verdict).toBe('SOLID_SHOW')
  })

  it('call show early from director mode → verdict reflects partial progress', () => {
    vi.useFakeTimers()
    const lineup: ShowLineup = {
      acts: [
        { name: 'Act 1', sketch: 'Deep Work', durationMinutes: 30 },
        { name: 'Act 2', sketch: 'Exercise', durationMinutes: 30 },
        { name: 'Act 3', sketch: 'Admin', durationMinutes: 30 },
      ],
      beatThreshold: 3,
      openingNote: 'Test',
    }

    showActor.send({ type: 'ENTER_WRITERS_ROOM' })
    showActor.send({ type: 'SET_ENERGY', level: 'high' })
    showActor.send({ type: 'SET_LINEUP', lineup })
    showActor.send({ type: 'START_SHOW' })

    // Complete one act, lock one beat
    const act1Id = ctx().currentActId!
    showActor.send({ type: 'COMPLETE_ACT', actId: act1Id })
    showActor.send({ type: 'LOCK_BEAT' })
    vi.advanceTimersByTime(1800)

    // Enter director mode and call show early
    showActor.send({ type: 'ENTER_DIRECTOR' })
    showActor.send({ type: 'CALL_SHOW_EARLY' })

    expect(phase()).toBe('strike')
    expect(ctx().beatsLocked).toBe(1)
    // 1/3: Not (1>=3), Not (1===2), Not (1>=2). → SHOW_CALLED_EARLY
    expect(ctx().verdict).toBe('SHOW_CALLED_EARLY')
    vi.useRealTimers()
  })
})
