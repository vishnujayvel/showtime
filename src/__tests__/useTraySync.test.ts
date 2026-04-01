import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { showActor, resetShowActor } from '../renderer/machines/showActor'
import { getPhaseFromState } from '../renderer/machines/showMachine'
import type { TrayShowState, ShowLineup } from '../shared/types'

/** Helper to get actor context */
function ctx() {
  return showActor.getSnapshot().context
}

/** Helper to get current phase */
function phase() {
  return getPhaseFromState(showActor.getSnapshot().value as Record<string, unknown>)
}

/** Set up actor in live phase with given acts and options */
function goLiveWithActs(overrides?: {
  acts?: Array<{ name: string; sketch: string; durationMinutes: number }>,
  beatThreshold?: number,
}) {
  const lineup: ShowLineup = {
    acts: overrides?.acts ?? [
      { name: 'Deep Work', sketch: 'Deep Work', durationMinutes: 30 },
    ],
    beatThreshold: overrides?.beatThreshold ?? 3,
    openingNote: 'Test',
  }
  showActor.send({ type: 'ENTER_WRITERS_ROOM' })
  showActor.send({ type: 'SET_ENERGY', level: 'high' })
  showActor.send({ type: 'SET_LINEUP', lineup })
  showActor.send({ type: 'START_SHOW' })
}

describe('useTraySync', () => {
  let updateTrayState: ReturnType<typeof vi.fn>
  let updateTrayTimer: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    resetShowActor()

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
      showActor.send({ type: 'ENTER_WRITERS_ROOM' })
    })

    expect(updateTrayState).toHaveBeenCalledOnce()
    expect(updateTrayState.mock.calls[0][0].phase).toBe('writers_room')
  })

  it('sends full tray state when currentActId changes', async () => {
    const { useTraySync } = await import('../renderer/hooks/useTraySync')

    goLiveWithActs({
      acts: [
        { name: 'Deep Work', sketch: 'Deep Work', durationMinutes: 30 },
        { name: 'Admin', sketch: 'Admin', durationMinutes: 15 },
      ],
    })

    renderHook(() => useTraySync())
    updateTrayState.mockClear()

    act(() => {
      // Skip the current act to move to the next one
      const actId = ctx().currentActId!
      showActor.send({ type: 'SKIP_ACT', actId })
    })

    expect(updateTrayState).toHaveBeenCalled()
    const lastCall = updateTrayState.mock.calls[updateTrayState.mock.calls.length - 1][0]
    expect(lastCall.currentActName).toBe('Admin')
  })

  it('sends full tray state when beatsLocked changes', async () => {
    const { useTraySync } = await import('../renderer/hooks/useTraySync')

    goLiveWithActs()
    renderHook(() => useTraySync())
    updateTrayState.mockClear()

    act(() => {
      // Complete act to enter beat_check, then lock beat to increment beatsLocked
      const actId = showActor.getSnapshot().context.currentActId!
      showActor.send({ type: 'COMPLETE_ACT', actId })
      showActor.send({ type: 'LOCK_BEAT' })
    })

    expect(updateTrayState).toHaveBeenCalled()
    const lastCall = updateTrayState.mock.calls[updateTrayState.mock.calls.length - 1][0]
    expect(lastCall.beatsLocked).toBe(1)
  })

  it('includes timerSeconds calculated from timerEndAt', async () => {
    const { useTraySync } = await import('../renderer/hooks/useTraySync')

    goLiveWithActs({
      acts: [{ name: 'Focus', sketch: 'Deep Work', durationMinutes: 10 }],
    })

    renderHook(() => useTraySync())

    const sentState: TrayShowState = updateTrayState.mock.calls[updateTrayState.mock.calls.length - 1][0]
    expect(sentState.timerSeconds).toBe(600) // 10 * 60
  })

  it('includes nextActs with up to 2 upcoming acts', async () => {
    const { useTraySync } = await import('../renderer/hooks/useTraySync')

    goLiveWithActs({
      acts: [
        { name: 'Act 1', sketch: 'Deep Work', durationMinutes: 25 },
        { name: 'Act 2', sketch: 'Exercise', durationMinutes: 15 },
        { name: 'Act 3', sketch: 'Admin', durationMinutes: 10 },
        { name: 'Act 4', sketch: 'Creative', durationMinutes: 20 },
      ],
    })

    renderHook(() => useTraySync())

    const sentState: TrayShowState = updateTrayState.mock.calls[updateTrayState.mock.calls.length - 1][0]
    expect(sentState.nextActs).toHaveLength(2)
    expect(sentState.nextActs[0].name).toBe('Act 2')
    expect(sentState.nextActs[1].name).toBe('Act 3')
    expect(sentState.actIndex).toBe(0)
    expect(sentState.totalActs).toBe(4)
  })

  it('starts timer interval when mounting during live phase with timerEndAt', async () => {
    const { useTraySync } = await import('../renderer/hooks/useTraySync')

    goLiveWithActs({
      acts: [{ name: 'Focus', sketch: 'Deep Work', durationMinutes: 5 }],
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

    showActor.send({ type: 'ENTER_WRITERS_ROOM' })

    renderHook(() => useTraySync())
    updateTrayTimer.mockClear()

    // Transition to live with a timer
    act(() => {
      showActor.send({ type: 'SET_ENERGY', level: 'high' })
      showActor.send({ type: 'SET_LINEUP', lineup: {
        acts: [{ name: 'Focus', sketch: 'Deep Work', durationMinutes: 10 }],
        beatThreshold: 1,
        openingNote: '',
      }})
      showActor.send({ type: 'START_SHOW' })
    })

    // Advance 1s to trigger interval
    vi.advanceTimersByTime(1000)

    expect(updateTrayTimer).toHaveBeenCalled()
  })

  it('starts timer interval when phase transitions to director', async () => {
    const { useTraySync } = await import('../renderer/hooks/useTraySync')

    goLiveWithActs()

    renderHook(() => useTraySync())
    updateTrayTimer.mockClear()

    act(() => {
      showActor.send({ type: 'ENTER_DIRECTOR' })
    })

    vi.advanceTimersByTime(1000)

    expect(updateTrayTimer).toHaveBeenCalled()
  })

  it('stops timer interval when phase changes away from live/director', async () => {
    const { useTraySync } = await import('../renderer/hooks/useTraySync')

    goLiveWithActs({
      acts: [{ name: 'Focus', sketch: 'Deep Work', durationMinutes: 5 }],
    })

    renderHook(() => useTraySync())

    // Verify interval is running
    updateTrayTimer.mockClear()
    vi.advanceTimersByTime(1000)
    expect(updateTrayTimer).toHaveBeenCalled()

    // Transition to intermission (no timer interval)
    updateTrayTimer.mockClear()
    act(() => {
      showActor.send({ type: 'ENTER_INTERMISSION' })
    })

    // After transition, interval should have stopped
    updateTrayTimer.mockClear()
    vi.advanceTimersByTime(3000)
    expect(updateTrayTimer).not.toHaveBeenCalled()
  })

  it('sends full tray state when timerEndAt changes', async () => {
    const { useTraySync } = await import('../renderer/hooks/useTraySync')

    goLiveWithActs({
      acts: [{ name: 'Focus', sketch: 'Deep Work', durationMinutes: 10 }],
    })

    renderHook(() => useTraySync())
    updateTrayState.mockClear()

    // Extend timer by 5 minutes
    act(() => {
      showActor.send({ type: 'EXTEND_ACT', minutes: 5 })
    })

    expect(updateTrayState).toHaveBeenCalledOnce()
    expect(updateTrayState.mock.calls[0][0].timerSeconds).toBeGreaterThanOrEqual(899)
  })

  it('does not send tray update when unrelated actor fields change', async () => {
    const { useTraySync } = await import('../renderer/hooks/useTraySync')
    renderHook(() => useTraySync())
    updateTrayState.mockClear()

    // Change something the hook doesn't watch (e.g. viewTier)
    act(() => {
      showActor.send({ type: 'SET_VIEW_TIER', tier: 'compact' })
    })

    expect(updateTrayState).not.toHaveBeenCalled()
  })

  it('cleans up interval on unmount', async () => {
    const { useTraySync } = await import('../renderer/hooks/useTraySync')

    goLiveWithActs({
      acts: [{ name: 'Focus', sketch: 'Deep Work', durationMinutes: 5 }],
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

    goLiveWithActs({
      acts: [{ name: 'Morning Focus', sketch: 'Deep Work', durationMinutes: 25 }],
    })

    renderHook(() => useTraySync())

    const sentState: TrayShowState = updateTrayState.mock.calls[updateTrayState.mock.calls.length - 1][0]
    expect(sentState.currentActCategory).toBe('Deep Work')
  })

  it('does not call updateTrayTimer when timerEndAt is null during live phase', async () => {
    const { useTraySync } = await import('../renderer/hooks/useTraySync')

    goLiveWithActs({
      acts: [{ name: 'Focus', sketch: 'Deep Work', durationMinutes: 5 }],
    })
    // Complete the act — this sets timerEndAt to null (enters beat_check substate)
    const actId = showActor.getSnapshot().context.currentActId!
    showActor.send({ type: 'COMPLETE_ACT', actId })

    renderHook(() => useTraySync())
    updateTrayTimer.mockClear()

    vi.advanceTimersByTime(3000)

    // No timer interval should have been started (timerEndAt is null)
    expect(updateTrayTimer).not.toHaveBeenCalled()
  })
})
