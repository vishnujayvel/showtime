import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useShowStore } from '../renderer/stores/showStore'
import type { ShowLineup } from '../shared/types'

// Reset store
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
    isExpanded: true,
    beatCheckPending: false,
    celebrationActive: false,
  })
}

describe('verdict calculation edge cases', () => {
  beforeEach(() => resetStore())

  // Exhaustive verdict boundary tests with threshold = 5
  describe('with beatThreshold = 5', () => {
    it('DAY_WON: 5/5 beats', () => {
      useShowStore.setState({ beatsLocked: 5, beatThreshold: 5, phase: 'live' })
      useShowStore.getState().strikeTheStage()
      expect(useShowStore.getState().verdict).toBe('DAY_WON')
    })

    it('DAY_WON: 6/5 beats (over threshold)', () => {
      useShowStore.setState({ beatsLocked: 6, beatThreshold: 5, phase: 'live' })
      useShowStore.getState().strikeTheStage()
      expect(useShowStore.getState().verdict).toBe('DAY_WON')
    })

    it('SOLID_SHOW: 4/5 beats (one short)', () => {
      useShowStore.setState({ beatsLocked: 4, beatThreshold: 5, phase: 'live' })
      useShowStore.getState().strikeTheStage()
      expect(useShowStore.getState().verdict).toBe('SOLID_SHOW')
    })

    it('GOOD_EFFORT: 3/5 beats (ceil(5/2) = 3)', () => {
      useShowStore.setState({ beatsLocked: 3, beatThreshold: 5, phase: 'live' })
      useShowStore.getState().strikeTheStage()
      expect(useShowStore.getState().verdict).toBe('GOOD_EFFORT')
    })

    it('SHOW_CALLED_EARLY: 2/5 beats (below half)', () => {
      useShowStore.setState({ beatsLocked: 2, beatThreshold: 5, phase: 'live' })
      useShowStore.getState().strikeTheStage()
      expect(useShowStore.getState().verdict).toBe('SHOW_CALLED_EARLY')
    })

    it('SHOW_CALLED_EARLY: 0/5 beats', () => {
      useShowStore.setState({ beatsLocked: 0, beatThreshold: 5, phase: 'live' })
      useShowStore.getState().strikeTheStage()
      expect(useShowStore.getState().verdict).toBe('SHOW_CALLED_EARLY')
    })
  })

  describe('with beatThreshold = 1', () => {
    it('DAY_WON: 1/1 beats', () => {
      useShowStore.setState({ beatsLocked: 1, beatThreshold: 1, phase: 'live' })
      useShowStore.getState().strikeTheStage()
      expect(useShowStore.getState().verdict).toBe('DAY_WON')
    })

    it('SOLID_SHOW: 0/1 beats (one short = 0)', () => {
      useShowStore.setState({ beatsLocked: 0, beatThreshold: 1, phase: 'live' })
      useShowStore.getState().strikeTheStage()
      // 0 === 1 - 1 = SOLID_SHOW
      expect(useShowStore.getState().verdict).toBe('SOLID_SHOW')
    })
  })

  describe('with beatThreshold = 2', () => {
    it('DAY_WON: 2/2', () => {
      useShowStore.setState({ beatsLocked: 2, beatThreshold: 2, phase: 'live' })
      useShowStore.getState().strikeTheStage()
      expect(useShowStore.getState().verdict).toBe('DAY_WON')
    })

    it('SOLID_SHOW: 1/2 (one short)', () => {
      useShowStore.setState({ beatsLocked: 1, beatThreshold: 2, phase: 'live' })
      useShowStore.getState().strikeTheStage()
      expect(useShowStore.getState().verdict).toBe('SOLID_SHOW')
    })

    it('SHOW_CALLED_EARLY: 0/2', () => {
      useShowStore.setState({ beatsLocked: 0, beatThreshold: 2, phase: 'live' })
      useShowStore.getState().strikeTheStage()
      // 0 === 2-1? No. 0 >= ceil(2/2)=1? No. → SHOW_CALLED_EARLY
      expect(useShowStore.getState().verdict).toBe('SHOW_CALLED_EARLY')
    })
  })

  describe('with beatThreshold = 4', () => {
    it('GOOD_EFFORT: 2/4 (ceil(4/2) = 2)', () => {
      useShowStore.setState({ beatsLocked: 2, beatThreshold: 4, phase: 'live' })
      useShowStore.getState().strikeTheStage()
      expect(useShowStore.getState().verdict).toBe('GOOD_EFFORT')
    })

    it('SHOW_CALLED_EARLY: 1/4', () => {
      useShowStore.setState({ beatsLocked: 1, beatThreshold: 4, phase: 'live' })
      useShowStore.getState().strikeTheStage()
      expect(useShowStore.getState().verdict).toBe('SHOW_CALLED_EARLY')
    })
  })
})

describe('full show flow → verdict', () => {
  beforeEach(() => resetStore())

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

    useShowStore.getState().setLineup(lineup)
    useShowStore.getState().startShow()

    // Complete act 1, lock beat
    const act1Id = useShowStore.getState().currentActId!
    useShowStore.getState().completeAct(act1Id)
    useShowStore.getState().lockBeat()
    vi.advanceTimersByTime(1800)

    // Complete act 2, lock beat → triggers strikeTheStage
    const act2Id = useShowStore.getState().currentActId!
    useShowStore.getState().completeAct(act2Id)
    useShowStore.getState().lockBeat()
    vi.advanceTimersByTime(1800)

    expect(useShowStore.getState().phase).toBe('strike')
    expect(useShowStore.getState().verdict).toBe('DAY_WON')
    expect(useShowStore.getState().beatsLocked).toBe(2)
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

    useShowStore.getState().setLineup(lineup)
    useShowStore.getState().startShow()

    const act1Id = useShowStore.getState().currentActId!
    useShowStore.getState().completeAct(act1Id)
    useShowStore.getState().skipBeat()

    expect(useShowStore.getState().phase).toBe('strike')
    // 0/1: 0 === 1-1=0 → SOLID_SHOW (not SHOW_CALLED_EARLY!)
    expect(useShowStore.getState().verdict).toBe('SOLID_SHOW')
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

    useShowStore.getState().setLineup(lineup)
    useShowStore.getState().startShow()

    // Complete one act, lock one beat
    const act1Id = useShowStore.getState().currentActId!
    useShowStore.getState().completeAct(act1Id)
    useShowStore.getState().lockBeat()
    vi.advanceTimersByTime(1800)

    // Enter director mode and call show early
    useShowStore.getState().enterDirector()
    useShowStore.getState().callShowEarly()

    expect(useShowStore.getState().phase).toBe('strike')
    expect(useShowStore.getState().beatsLocked).toBe(1)
    // 1/3: Not (1>=3), Not (1===2), Not (1>=2). → SHOW_CALLED_EARLY
    expect(useShowStore.getState().verdict).toBe('SHOW_CALLED_EARLY')
    vi.useRealTimers()
  })
})
