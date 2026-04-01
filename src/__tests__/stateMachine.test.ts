import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { showActor, resetShowActor } from '../renderer/machines/showActor'
import { getPhaseFromState } from '../renderer/machines/showMachine'
import type { ShowLineup, ShowPhase } from '../shared/types'

/** Helper to get current phase from the actor */
function phase(): ShowPhase {
  return getPhaseFromState(showActor.getSnapshot().value as Record<string, unknown>)
}

/** Helper to get actor context */
function ctx() {
  return showActor.getSnapshot().context
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

/** Navigate actor to writers_room with lineup set */
function setupLineup() {
  showActor.send({ type: 'ENTER_WRITERS_ROOM' })
  showActor.send({ type: 'SET_ENERGY', level: 'high' })
  showActor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'plan' })
  showActor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'conversation' })
  showActor.send({ type: 'SET_LINEUP', lineup })
}

/** Navigate actor to live phase */
function goLive() {
  setupLineup()
  showActor.send({ type: 'START_SHOW' })
}

describe('state machine transitions', () => {
  beforeEach(() => resetShowActor())

  it('follows happy path: no_show → writers_room → live → strike', () => {
    vi.useFakeTimers()
    const phases: ShowPhase[] = []

    // no_show → set energy
    phases.push(phase())
    showActor.send({ type: 'ENTER_WRITERS_ROOM' })
    showActor.send({ type: 'SET_ENERGY', level: 'high' })

    // → writers_room (via setLineup)
    showActor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'plan' })
    showActor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'conversation' })
    showActor.send({ type: 'SET_LINEUP', lineup })
    phases.push(phase())

    // → live (via startShow)
    showActor.send({ type: 'START_SHOW' })
    phases.push(phase())

    // Complete all acts with beat locks (advance timers for celebration delay)
    for (let i = 0; i < 3; i++) {
      const actId = ctx().currentActId!
      showActor.send({ type: 'COMPLETE_ACT', actId })
      showActor.send({ type: 'LOCK_BEAT' })
      vi.advanceTimersByTime(1800)
    }
    phases.push(phase())

    expect(phases).toEqual(['no_show', 'writers_room', 'live', 'strike'])
    vi.useRealTimers()
  })

  it('supports intermission mid-show: live → intermission → live', () => {
    goLive()
    expect(phase()).toBe('live')

    showActor.send({ type: 'ENTER_INTERMISSION' })
    expect(phase()).toBe('intermission')
    expect(ctx().timerPausedRemaining).toBeGreaterThan(0)

    showActor.send({ type: 'EXIT_INTERMISSION' })
    expect(phase()).toBe('live')
    expect(ctx().timerEndAt).toBeGreaterThan(Date.now() - 1000)
  })

  it('supports director mode: live → director → live', () => {
    goLive()

    showActor.send({ type: 'ENTER_DIRECTOR' })
    expect(phase()).toBe('director')

    showActor.send({ type: 'EXIT_DIRECTOR' })
    expect(phase()).toBe('live')
  })

  it('director callShowEarly: live → director → strike', () => {
    goLive()

    showActor.send({ type: 'ENTER_DIRECTOR' })
    showActor.send({ type: 'CALL_SHOW_EARLY' })
    expect(phase()).toBe('strike')
    expect(ctx().verdict).toBeDefined()
  })

  it('skip all acts leads to strike', () => {
    goLive()

    const acts = ctx().acts
    showActor.send({ type: 'SKIP_ACT', actId: acts[0].id })
    showActor.send({ type: 'SKIP_ACT', actId: acts[1].id })
    showActor.send({ type: 'SKIP_ACT', actId: acts[2].id })

    expect(phase()).toBe('strike')
  })

  it('reset from strike returns to no_show', () => {
    goLive()
    showActor.send({ type: 'CALL_SHOW_EARLY' })
    expect(phase()).toBe('strike')

    showActor.send({ type: 'RESET' })
    expect(phase()).toBe('no_show')
    expect(ctx().acts).toHaveLength(0)
    expect(ctx().verdict).toBeNull()
    expect(ctx().energy).toBeNull()
  })

  it('timer state preserved across intermission', () => {
    goLive()

    const timerBefore = ctx().timerEndAt!
    const now = Date.now()
    const expectedRemaining = timerBefore - now

    showActor.send({ type: 'ENTER_INTERMISSION' })
    const paused = ctx().timerPausedRemaining!

    // Paused remaining should be close to expected (within 100ms tolerance)
    expect(Math.abs(paused - expectedRemaining)).toBeLessThan(100)

    showActor.send({ type: 'EXIT_INTERMISSION' })
    const timerAfter = ctx().timerEndAt!

    // New timer end should be roughly now + paused remaining
    expect(Math.abs(timerAfter - (Date.now() + paused))).toBeLessThan(100)
  })

  it('beat tracking accumulates across acts', () => {
    vi.useFakeTimers()
    goLive()

    // Act 1: lock beat
    showActor.send({ type: 'COMPLETE_ACT', actId: ctx().currentActId! })
    showActor.send({ type: 'LOCK_BEAT' })
    vi.advanceTimersByTime(1800)
    expect(ctx().beatsLocked).toBe(1)

    // Act 2: skip beat
    showActor.send({ type: 'COMPLETE_ACT', actId: ctx().currentActId! })
    showActor.send({ type: 'SKIP_BEAT' })
    expect(ctx().beatsLocked).toBe(1)

    // Act 3: lock beat → triggers strike
    showActor.send({ type: 'COMPLETE_ACT', actId: ctx().currentActId! })
    showActor.send({ type: 'LOCK_BEAT' })
    vi.advanceTimersByTime(1800)
    expect(ctx().beatsLocked).toBe(2)
    expect(phase()).toBe('strike')
    vi.useRealTimers()
  })

  it('extendAct adds 15 minutes during live', () => {
    goLive()

    const before = ctx().timerEndAt!
    showActor.send({ type: 'EXTEND_ACT', minutes: 15 })
    const after = ctx().timerEndAt!

    expect(after - before).toBe(15 * 60 * 1000)
  })

  it('lineup editing before startShow', () => {
    setupLineup()
    const acts = ctx().acts

    // Reorder: move "Workout" up
    showActor.send({ type: 'REORDER_ACT', actId: acts[1].id, direction: 'up' })
    expect(ctx().acts[0].name).toBe('Workout')

    // Remove "Emails"
    showActor.send({ type: 'REMOVE_ACT', actId: acts[2].id })
    expect(ctx().acts).toHaveLength(2)

    // Add new act
    showActor.send({ type: 'ADD_ACT', name: 'Creative Writing', sketch: 'Creative', durationMinutes: 40 })
    expect(ctx().acts).toHaveLength(3)
    expect(ctx().acts[2].name).toBe('Creative Writing')

    // Start show — first act should be "Workout" (reordered)
    showActor.send({ type: 'START_SHOW' })
    expect(ctx().acts[0].status).toBe('active')
    expect(ctx().acts[0].name).toBe('Workout')
  })
})
