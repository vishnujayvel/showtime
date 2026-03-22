import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useShowStore } from '../renderer/stores/showStore'
import type { ShowLineup, ShowPhase } from '../shared/types'

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
    viewTier: 'expanded',
    beatCheckPending: false,
    celebrationActive: false,
  })
}

const lineup: ShowLineup = {
  acts: [
    { name: 'Focus Sprint', sketch: 'Deep Work', durationMinutes: 45 },
    { name: 'Workout', sketch: 'Exercise', durationMinutes: 30 },
    { name: 'Emails', sketch: 'Admin', durationMinutes: 20 },
  ],
  beatThreshold: 3,
  openingNote: 'Let\'s rock!',
}

describe('state machine transitions', () => {
  beforeEach(() => resetStore())

  it('follows happy path: no_show → writers_room → live → strike', () => {
    vi.useFakeTimers()
    const phases: ShowPhase[] = []

    // no_show → set energy
    phases.push(useShowStore.getState().phase)
    useShowStore.getState().setEnergy('high')

    // → writers_room (via setLineup)
    useShowStore.getState().setLineup(lineup)
    phases.push(useShowStore.getState().phase)

    // → live (via startShow)
    useShowStore.getState().startShow()
    phases.push(useShowStore.getState().phase)

    // Complete all acts with beat locks (advance timers for celebration delay)
    for (let i = 0; i < 3; i++) {
      const actId = useShowStore.getState().currentActId!
      useShowStore.getState().completeAct(actId)
      useShowStore.getState().lockBeat()
      vi.advanceTimersByTime(1800)
    }
    phases.push(useShowStore.getState().phase)

    expect(phases).toEqual(['no_show', 'writers_room', 'live', 'strike'])
    vi.useRealTimers()
  })

  it('supports intermission mid-show: live → intermission → live', () => {
    useShowStore.getState().setLineup(lineup)
    useShowStore.getState().startShow()
    expect(useShowStore.getState().phase).toBe('live')

    useShowStore.getState().enterIntermission()
    expect(useShowStore.getState().phase).toBe('intermission')
    expect(useShowStore.getState().timerPausedRemaining).toBeGreaterThan(0)

    useShowStore.getState().exitIntermission()
    expect(useShowStore.getState().phase).toBe('live')
    expect(useShowStore.getState().timerEndAt).toBeGreaterThan(Date.now() - 1000)
  })

  it('supports director mode: live → director → live', () => {
    useShowStore.getState().setLineup(lineup)
    useShowStore.getState().startShow()

    useShowStore.getState().enterDirector()
    expect(useShowStore.getState().phase).toBe('director')

    useShowStore.getState().exitDirector()
    expect(useShowStore.getState().phase).toBe('live')
  })

  it('director callShowEarly: live → director → strike', () => {
    useShowStore.getState().setLineup(lineup)
    useShowStore.getState().startShow()

    useShowStore.getState().enterDirector()
    useShowStore.getState().callShowEarly()
    expect(useShowStore.getState().phase).toBe('strike')
    expect(useShowStore.getState().verdict).toBeDefined()
  })

  it('skip all acts leads to strike', () => {
    useShowStore.getState().setLineup(lineup)
    useShowStore.getState().startShow()

    const acts = useShowStore.getState().acts
    useShowStore.getState().skipAct(acts[0].id)
    useShowStore.getState().skipAct(acts[1].id)
    useShowStore.getState().skipAct(acts[2].id)

    expect(useShowStore.getState().phase).toBe('strike')
  })

  it('reset from strike returns to no_show', () => {
    useShowStore.getState().setLineup(lineup)
    useShowStore.getState().startShow()
    useShowStore.getState().callShowEarly()
    expect(useShowStore.getState().phase).toBe('strike')

    useShowStore.getState().resetShow()
    expect(useShowStore.getState().phase).toBe('no_show')
    expect(useShowStore.getState().acts).toHaveLength(0)
    expect(useShowStore.getState().verdict).toBeNull()
    expect(useShowStore.getState().energy).toBeNull()
  })

  it('timer state preserved across intermission', () => {
    useShowStore.getState().setLineup(lineup)
    useShowStore.getState().startShow()

    const timerBefore = useShowStore.getState().timerEndAt!
    const now = Date.now()
    const expectedRemaining = timerBefore - now

    useShowStore.getState().enterIntermission()
    const paused = useShowStore.getState().timerPausedRemaining!

    // Paused remaining should be close to expected (within 100ms tolerance)
    expect(Math.abs(paused - expectedRemaining)).toBeLessThan(100)

    useShowStore.getState().exitIntermission()
    const timerAfter = useShowStore.getState().timerEndAt!

    // New timer end should be roughly now + paused remaining
    expect(Math.abs(timerAfter - (Date.now() + paused))).toBeLessThan(100)
  })

  it('beat tracking accumulates across acts', () => {
    vi.useFakeTimers()
    useShowStore.getState().setLineup(lineup)
    useShowStore.getState().startShow()

    // Act 1: lock beat
    useShowStore.getState().completeAct(useShowStore.getState().currentActId!)
    useShowStore.getState().lockBeat()
    vi.advanceTimersByTime(1800)
    expect(useShowStore.getState().beatsLocked).toBe(1)

    // Act 2: skip beat
    useShowStore.getState().completeAct(useShowStore.getState().currentActId!)
    useShowStore.getState().skipBeat()
    expect(useShowStore.getState().beatsLocked).toBe(1)

    // Act 3: lock beat → triggers strike
    useShowStore.getState().completeAct(useShowStore.getState().currentActId!)
    useShowStore.getState().lockBeat()
    vi.advanceTimersByTime(1800)
    expect(useShowStore.getState().beatsLocked).toBe(2)
    expect(useShowStore.getState().phase).toBe('strike')
    vi.useRealTimers()
  })

  it('extendAct adds 15 minutes during live', () => {
    useShowStore.getState().setLineup(lineup)
    useShowStore.getState().startShow()

    const before = useShowStore.getState().timerEndAt!
    useShowStore.getState().extendAct(15)
    const after = useShowStore.getState().timerEndAt!

    expect(after - before).toBe(15 * 60 * 1000)
  })

  it('lineup editing before startShow', () => {
    useShowStore.getState().setLineup(lineup)
    const acts = useShowStore.getState().acts

    // Reorder: move "Workout" up
    useShowStore.getState().reorderAct(acts[1].id, 'up')
    expect(useShowStore.getState().acts[0].name).toBe('Workout')

    // Remove "Emails"
    useShowStore.getState().removeAct(acts[2].id)
    expect(useShowStore.getState().acts).toHaveLength(2)

    // Add new act
    useShowStore.getState().addAct('Creative Writing', 'Creative', 40)
    expect(useShowStore.getState().acts).toHaveLength(3)
    expect(useShowStore.getState().acts[2].name).toBe('Creative Writing')

    // Start show — first act should be "Workout" (reordered)
    useShowStore.getState().startShow()
    expect(useShowStore.getState().acts[0].status).toBe('active')
    expect(useShowStore.getState().acts[0].name).toBe('Workout')
  })
})
