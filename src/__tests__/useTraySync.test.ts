import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useShowStore } from '../renderer/stores/showStore'
import type { TrayShowState } from '../shared/types'

function resetShowStore(overrides: Record<string, unknown> = {}) {
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
    showStartedAt: null,
    verdict: null,
    viewTier: 'expanded',
    beatCheckPending: false,
    goingLiveActive: false,
    writersRoomStep: 'energy',
    writersRoomEnteredAt: null,
    breathingPauseEndAt: null,
    ...overrides,
  })
}

describe('useTraySync', () => {
  let updateTrayState: ReturnType<typeof vi.fn>
  let updateTrayTimer: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    resetShowStore()

    updateTrayState = vi.fn()
    updateTrayTimer = vi.fn()
    Object.assign(window.clui, { updateTrayState, updateTrayTimer })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('sends tray state immediately on mount', async () => {
    const { useTraySync } = await import('../renderer/hooks/useTraySync')
    renderHook(() => useTraySync())

    expect(updateTrayState).toHaveBeenCalledOnce()
    const sentState: TrayShowState = updateTrayState.mock.calls[0][0]
    expect(sentState.phase).toBe('no_show')
    expect(sentState.currentActName).toBeNull()
    expect(sentState.timerSeconds).toBeNull()
    expect(sentState.beatsLocked).toBe(0)
    expect(sentState.beatThreshold).toBe(3)
    expect(sentState.totalActs).toBe(0)
    expect(sentState.nextActs).toEqual([])
  })

  it('sends full tray state when phase changes', async () => {
    const { useTraySync } = await import('../renderer/hooks/useTraySync')
    renderHook(() => useTraySync())
    updateTrayState.mockClear()

    act(() => {
      useShowStore.setState({ phase: 'writers_room' })
    })

    expect(updateTrayState).toHaveBeenCalledOnce()
    expect(updateTrayState.mock.calls[0][0].phase).toBe('writers_room')
  })

  it('sends full tray state when currentActId changes', async () => {
    const { useTraySync } = await import('../renderer/hooks/useTraySync')

    resetShowStore({
      phase: 'live',
      acts: [
        { id: 'a1', name: 'Deep Work', sketch: 'Deep Work', durationMinutes: 30, status: 'active', beatLocked: false, order: 0 },
        { id: 'a2', name: 'Admin', sketch: 'Admin', durationMinutes: 15, status: 'upcoming', beatLocked: false, order: 1 },
      ],
      currentActId: 'a1',
      timerEndAt: Date.now() + 30 * 60 * 1000,
    })

    renderHook(() => useTraySync())
    updateTrayState.mockClear()

    act(() => {
      useShowStore.setState({ currentActId: 'a2' })
    })

    expect(updateTrayState).toHaveBeenCalledOnce()
    expect(updateTrayState.mock.calls[0][0].currentActName).toBe('Admin')
  })

  it('sends full tray state when beatsLocked changes', async () => {
    const { useTraySync } = await import('../renderer/hooks/useTraySync')
    renderHook(() => useTraySync())
    updateTrayState.mockClear()

    act(() => {
      useShowStore.setState({ beatsLocked: 2 })
    })

    expect(updateTrayState).toHaveBeenCalledOnce()
    expect(updateTrayState.mock.calls[0][0].beatsLocked).toBe(2)
  })

  it('includes timerSeconds calculated from timerEndAt', async () => {
    const { useTraySync } = await import('../renderer/hooks/useTraySync')
    const now = Date.now()
    resetShowStore({
      phase: 'live',
      timerEndAt: now + 10 * 60 * 1000, // 10 minutes from now
      acts: [
        { id: 'a1', name: 'Focus', sketch: 'Deep Work', durationMinutes: 30, status: 'active', beatLocked: false, order: 0 },
      ],
      currentActId: 'a1',
    })

    renderHook(() => useTraySync())

    const sentState: TrayShowState = updateTrayState.mock.calls[0][0]
    expect(sentState.timerSeconds).toBe(600) // 10 * 60
  })

  it('includes nextActs with up to 2 upcoming acts', async () => {
    const { useTraySync } = await import('../renderer/hooks/useTraySync')
    resetShowStore({
      phase: 'live',
      acts: [
        { id: 'a1', name: 'Act 1', sketch: 'Deep Work', durationMinutes: 25, status: 'active', beatLocked: false, order: 0 },
        { id: 'a2', name: 'Act 2', sketch: 'Exercise', durationMinutes: 15, status: 'upcoming', beatLocked: false, order: 1 },
        { id: 'a3', name: 'Act 3', sketch: 'Admin', durationMinutes: 10, status: 'upcoming', beatLocked: false, order: 2 },
        { id: 'a4', name: 'Act 4', sketch: 'Creative', durationMinutes: 20, status: 'upcoming', beatLocked: false, order: 3 },
      ],
      currentActId: 'a1',
      timerEndAt: Date.now() + 25 * 60 * 1000,
    })

    renderHook(() => useTraySync())

    const sentState: TrayShowState = updateTrayState.mock.calls[0][0]
    expect(sentState.nextActs).toHaveLength(2)
    expect(sentState.nextActs[0].name).toBe('Act 2')
    expect(sentState.nextActs[1].name).toBe('Act 3')
    expect(sentState.actIndex).toBe(0)
    expect(sentState.totalActs).toBe(4)
  })

  it('starts timer interval when mounting during live phase with timerEndAt', async () => {
    const { useTraySync } = await import('../renderer/hooks/useTraySync')
    resetShowStore({
      phase: 'live',
      timerEndAt: Date.now() + 5 * 60 * 1000,
      acts: [
        { id: 'a1', name: 'Focus', sketch: 'Deep Work', durationMinutes: 5, status: 'active', beatLocked: false, order: 0 },
      ],
      currentActId: 'a1',
    })

    renderHook(() => useTraySync())
    updateTrayTimer.mockClear()

    // Advance 1 second — the 1s interval should fire
    vi.advanceTimersByTime(1000)

    expect(updateTrayTimer).toHaveBeenCalledOnce()
    // Should be roughly 299 seconds (5 min - 1s)
    const seconds = updateTrayTimer.mock.calls[0][0]
    expect(seconds).toBeGreaterThanOrEqual(298)
    expect(seconds).toBeLessThanOrEqual(300)
  })

  it('starts timer interval when phase transitions to live', async () => {
    const { useTraySync } = await import('../renderer/hooks/useTraySync')
    resetShowStore({ phase: 'writers_room' })

    renderHook(() => useTraySync())
    updateTrayTimer.mockClear()

    // Transition to live with a timer
    act(() => {
      useShowStore.setState({
        phase: 'live',
        timerEndAt: Date.now() + 10 * 60 * 1000,
      })
    })

    // Advance 1s to trigger interval
    vi.advanceTimersByTime(1000)

    expect(updateTrayTimer).toHaveBeenCalled()
  })

  it('starts timer interval when phase transitions to director', async () => {
    const { useTraySync } = await import('../renderer/hooks/useTraySync')
    resetShowStore({ phase: 'writers_room' })

    renderHook(() => useTraySync())
    updateTrayTimer.mockClear()

    act(() => {
      useShowStore.setState({
        phase: 'director',
        timerEndAt: Date.now() + 5 * 60 * 1000,
      })
    })

    vi.advanceTimersByTime(1000)

    expect(updateTrayTimer).toHaveBeenCalled()
  })

  it('stops timer interval when phase changes away from live/director', async () => {
    const { useTraySync } = await import('../renderer/hooks/useTraySync')
    resetShowStore({
      phase: 'live',
      timerEndAt: Date.now() + 5 * 60 * 1000,
      acts: [
        { id: 'a1', name: 'Focus', sketch: 'Deep Work', durationMinutes: 5, status: 'active', beatLocked: false, order: 0 },
      ],
      currentActId: 'a1',
    })

    renderHook(() => useTraySync())

    // Verify interval is running
    updateTrayTimer.mockClear()
    vi.advanceTimersByTime(1000)
    expect(updateTrayTimer).toHaveBeenCalled()

    // Transition to intermission (no timer interval)
    updateTrayTimer.mockClear()
    act(() => {
      useShowStore.setState({ phase: 'intermission', timerEndAt: null })
    })

    // Advance time — timer interval should have stopped
    updateTrayTimer.mockClear()
    vi.advanceTimersByTime(3000)
    expect(updateTrayTimer).not.toHaveBeenCalled()
  })

  it('sends full tray state when timerEndAt changes', async () => {
    const { useTraySync } = await import('../renderer/hooks/useTraySync')
    resetShowStore({
      phase: 'live',
      timerEndAt: Date.now() + 10 * 60 * 1000,
      acts: [
        { id: 'a1', name: 'Focus', sketch: 'Deep Work', durationMinutes: 10, status: 'active', beatLocked: false, order: 0 },
      ],
      currentActId: 'a1',
    })

    renderHook(() => useTraySync())
    updateTrayState.mockClear()

    // Extend timer by 5 minutes
    act(() => {
      useShowStore.setState({ timerEndAt: Date.now() + 15 * 60 * 1000 })
    })

    expect(updateTrayState).toHaveBeenCalledOnce()
    expect(updateTrayState.mock.calls[0][0].timerSeconds).toBeGreaterThanOrEqual(899)
  })

  it('does not send tray update when unrelated store fields change', async () => {
    const { useTraySync } = await import('../renderer/hooks/useTraySync')
    renderHook(() => useTraySync())
    updateTrayState.mockClear()

    // Change something the hook doesn't watch (e.g. viewTier)
    act(() => {
      useShowStore.setState({ viewTier: 'compact' })
    })

    expect(updateTrayState).not.toHaveBeenCalled()
  })

  it('cleans up interval on unmount', async () => {
    const { useTraySync } = await import('../renderer/hooks/useTraySync')
    resetShowStore({
      phase: 'live',
      timerEndAt: Date.now() + 5 * 60 * 1000,
      acts: [
        { id: 'a1', name: 'Focus', sketch: 'Deep Work', durationMinutes: 5, status: 'active', beatLocked: false, order: 0 },
      ],
      currentActId: 'a1',
    })

    const { unmount } = renderHook(() => useTraySync())

    updateTrayTimer.mockClear()
    unmount()

    // After unmount, interval should not fire
    vi.advanceTimersByTime(3000)
    expect(updateTrayTimer).not.toHaveBeenCalled()
  })

  it('sends currentActCategory as sketch value', async () => {
    const { useTraySync } = await import('../renderer/hooks/useTraySync')
    resetShowStore({
      phase: 'live',
      acts: [
        { id: 'a1', name: 'Morning Focus', sketch: 'Deep Work', durationMinutes: 25, status: 'active', beatLocked: false, order: 0 },
      ],
      currentActId: 'a1',
      timerEndAt: Date.now() + 25 * 60 * 1000,
    })

    renderHook(() => useTraySync())

    const sentState: TrayShowState = updateTrayState.mock.calls[0][0]
    expect(sentState.currentActCategory).toBe('Deep Work')
  })

  it('does not call updateTrayTimer when timerEndAt is null during live phase', async () => {
    const { useTraySync } = await import('../renderer/hooks/useTraySync')
    resetShowStore({
      phase: 'live',
      timerEndAt: null,
      acts: [
        { id: 'a1', name: 'Focus', sketch: 'Deep Work', durationMinutes: 5, status: 'active', beatLocked: false, order: 0 },
      ],
      currentActId: 'a1',
    })

    renderHook(() => useTraySync())
    updateTrayTimer.mockClear()

    vi.advanceTimersByTime(3000)

    // No timer interval should have been started (timerEndAt is null)
    expect(updateTrayTimer).not.toHaveBeenCalled()
  })
})
