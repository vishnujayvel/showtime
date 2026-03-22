import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useShowStore } from '../renderer/stores/showStore'
import { useTimer } from '../renderer/hooks/useTimer'

function resetStore() {
  useShowStore.setState({
    phase: 'live',
    energy: 'high',
    acts: [
      { id: 'a1', name: 'Deep Work', sketch: 'Deep Work', durationMinutes: 30, status: 'active', beatLocked: false, order: 0 },
    ],
    currentActId: 'a1',
    beatsLocked: 0,
    beatThreshold: 3,
    timerEndAt: null,
    timerPausedRemaining: null,
    claudeSessionId: null,
    showDate: new Date().toISOString().slice(0, 10),
    verdict: null,
    viewTier: 'expanded',
    beatCheckPending: false,
    goingLiveActive: false,
    writersRoomStep: 'energy',
    writersRoomEnteredAt: null,
    breathingPauseEndAt: null,
  })
}

describe('useTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetStore()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns zeroed state when no timer is set', () => {
    // No current act and no timer → fully zeroed
    useShowStore.setState({ currentActId: null, timerEndAt: null })
    const { result } = renderHook(() => useTimer())
    expect(result.current.minutes).toBe(0)
    expect(result.current.seconds).toBe(0)
    expect(result.current.isRunning).toBe(false)
    expect(result.current.isComplete).toBe(false)
    expect(result.current.totalSeconds).toBe(0)
    expect(result.current.progress).toBe(0)
  })

  it('calculates remaining time from timerEndAt', () => {
    const now = Date.now()
    // Set timer to end 10 minutes from now
    useShowStore.setState({ timerEndAt: now + 10 * 60 * 1000 })

    const { result } = renderHook(() => useTimer())
    expect(result.current.minutes).toBe(10)
    expect(result.current.seconds).toBe(0)
    expect(result.current.isRunning).toBe(true)
    expect(result.current.isComplete).toBe(false)
  })

  it('counts down as time passes', () => {
    const now = Date.now()
    useShowStore.setState({ timerEndAt: now + 5 * 60 * 1000 })

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

  it('marks timer as complete when time runs out (no currentActId)', () => {
    const now = Date.now()
    // No currentActId so completeAct won't reset timerEndAt
    useShowStore.setState({ timerEndAt: now + 2000, currentActId: null })

    const { result } = renderHook(() => useTimer())
    expect(result.current.isRunning).toBe(true)

    // Advance past the end
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(result.current.isComplete).toBe(true)
    expect(result.current.isRunning).toBe(false)
    expect(result.current.totalSeconds).toBe(0)
  })

  it('calls completeAct when timer expires', () => {
    const now = Date.now()
    useShowStore.setState({ timerEndAt: now + 1000 })

    renderHook(() => useTimer())

    act(() => {
      vi.advanceTimersByTime(2000)
    })

    // The act should have been completed by the hook
    const state = useShowStore.getState()
    const act1 = state.acts.find((a) => a.id === 'a1')
    expect(act1?.status).toBe('completed')
  })

  it('calculates progress correctly', () => {
    const now = Date.now()
    // Act is 30 min, set timer to end in 15 min (half elapsed)
    useShowStore.setState({ timerEndAt: now + 15 * 60 * 1000 })

    const { result } = renderHook(() => useTimer())
    // 30 min total, 15 min remaining = 15 min elapsed = 50% progress
    expect(result.current.progress).toBeCloseTo(0.5, 1)
  })

  it('clamps progress to 0-1 range', () => {
    const now = Date.now()
    // Timer already expired
    useShowStore.setState({ timerEndAt: now - 1000 })

    const { result } = renderHook(() => useTimer())
    expect(result.current.progress).toBeLessThanOrEqual(1)
  })

  it('updates when timerEndAt changes', () => {
    const now = Date.now()
    useShowStore.setState({ timerEndAt: now + 10 * 60 * 1000 })

    const { result, rerender } = renderHook(() => useTimer())
    expect(result.current.minutes).toBe(10)

    // Extend timer by 5 minutes
    act(() => {
      useShowStore.setState({ timerEndAt: now + 15 * 60 * 1000 })
    })
    rerender()
    expect(result.current.minutes).toBe(15)
  })

  it('returns not running when timerEndAt is null', () => {
    useShowStore.setState({ timerEndAt: null })

    const { result } = renderHook(() => useTimer())
    expect(result.current.isRunning).toBe(false)
    expect(result.current.isComplete).toBe(false)
  })
})
