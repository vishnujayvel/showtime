import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { showActor, resetShowActor } from '../renderer/machines/showActor'
import { useTimer } from '../renderer/hooks/useTimer'

/**
 * Drive the XState actor from no_show → live with a single act,
 * then return the generated act ID so tests can reference it.
 */
function setupLiveShowWithAct(durationMinutes = 30): string {
  showActor.send({ type: 'ENTER_WRITERS_ROOM' })
  showActor.send({ type: 'SET_ENERGY', level: 'high' })
  showActor.send({
    type: 'SET_LINEUP',
    lineup: {
      acts: [{ name: 'Deep Work', sketch: 'Deep Work', durationMinutes }],
      beatThreshold: 3,
    },
  })
  showActor.send({ type: 'FINALIZE_LINEUP' })
  showActor.send({ type: 'START_SHOW' })

  const ctx = showActor.getSnapshot().context
  return ctx.currentActId!
}

describe('useTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetShowActor()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns zeroed state when no timer is set', () => {
    // Actor is in no_show phase, no act, no timer
    const { result } = renderHook(() => useTimer())
    expect(result.current.minutes).toBe(0)
    expect(result.current.seconds).toBe(0)
    expect(result.current.isRunning).toBe(false)
    expect(result.current.isComplete).toBe(false)
    expect(result.current.totalSeconds).toBe(0)
    expect(result.current.progress).toBe(0)
  })

  it('calculates remaining time from timerEndAt', () => {
    // Set up a live show with a 10-minute act
    setupLiveShowWithAct(10)

    const { result } = renderHook(() => useTimer())
    // The act just started, so ~10 minutes remaining
    expect(result.current.minutes).toBe(10)
    expect(result.current.seconds).toBe(0)
    expect(result.current.isRunning).toBe(true)
    expect(result.current.isComplete).toBe(false)
  })

  it('counts down as time passes', () => {
    setupLiveShowWithAct(5)

    const { result } = renderHook(() => useTimer())
    expect(result.current.minutes).toBe(5)

    // Advance 1 second
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current.minutes).toBe(4)
    expect(result.current.seconds).toBe(59)
    expect(result.current.totalSeconds).toBe(299)
  })

  it('calls completeAct when timer expires', () => {
    // Use a very short act (1 second = round up to 1 minute isn't practical,
    // so we'll use 1-minute act and advance past it)
    const actId = setupLiveShowWithAct(1)

    renderHook(() => useTimer())

    // Advance past the 1-minute timer
    act(() => {
      vi.advanceTimersByTime(61_000)
    })

    // The act should have been completed by the hook sending COMPLETE_ACT
    const ctx = showActor.getSnapshot().context
    const completedAct = ctx.acts.find((a) => a.id === actId)
    expect(completedAct?.status).toBe('completed')
  })

  it('calculates progress correctly', () => {
    setupLiveShowWithAct(30)

    const { result } = renderHook(() => useTimer())
    // Just started, progress should be ~0
    expect(result.current.progress).toBeCloseTo(0, 1)

    // Advance 15 minutes (half the act)
    act(() => {
      vi.advanceTimersByTime(15 * 60 * 1000)
    })
    expect(result.current.progress).toBeCloseTo(0.5, 1)
  })

  it('clamps progress to 0-1 range', () => {
    setupLiveShowWithAct(1)

    // Advance past the timer end
    act(() => {
      vi.advanceTimersByTime(2 * 60 * 1000)
    })

    const { result } = renderHook(() => useTimer())
    expect(result.current.progress).toBeLessThanOrEqual(1)
  })

  it('returns not running when in no_show phase (no timer)', () => {
    // Actor reset to no_show, no timer
    const { result } = renderHook(() => useTimer())
    expect(result.current.isRunning).toBe(false)
    expect(result.current.isComplete).toBe(false)
  })
})
