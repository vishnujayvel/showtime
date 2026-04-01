import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useSessionStore } from '../renderer/stores/sessionStore'
import type { HealthReport, TabState } from '../shared/types'

function makeTab(overrides: Partial<TabState> = {}): TabState {
  return {
    id: 'tab-1',
    claudeSessionId: null,
    status: 'idle',
    activeRequestId: null,
    hasUnread: false,
    currentActivity: '',
    permissionQueue: [],
    permissionDenied: null,
    attachments: [],
    messages: [],
    title: 'Test',
    lastResult: null,
    sessionModel: null,
    sessionTools: [],
    sessionMcpServers: [],
    sessionSkills: [],
    sessionVersion: null,
    queuedPrompts: [],
    workingDirectory: '~',
    hasChosenDirectory: false,
    additionalDirs: [],
    ...overrides,
  }
}

describe('useHealthReconciliation', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('sets up an interval that polls every 1500ms', async () => {
    const { useHealthReconciliation } = await import('../renderer/hooks/useHealthReconciliation')
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval')

    renderHook(() => useHealthReconciliation())

    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 1500)
    setIntervalSpy.mockRestore()
  })

  it('clears interval on unmount', async () => {
    const { useHealthReconciliation } = await import('../renderer/hooks/useHealthReconciliation')
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval')

    const { unmount } = renderHook(() => useHealthReconciliation())
    unmount()

    expect(clearIntervalSpy).toHaveBeenCalled()
    clearIntervalSpy.mockRestore()
  })

  it('does nothing when no tabs are running or connecting', async () => {
    const { useHealthReconciliation } = await import('../renderer/hooks/useHealthReconciliation')
    const idleTab = makeTab({ status: 'idle' })
    useSessionStore.setState({ tabs: [idleTab] })

    const tabHealthSpy = vi.fn()
    Object.assign(window.showtime, { tabHealth: tabHealthSpy })

    renderHook(() => useHealthReconciliation())

    await vi.advanceTimersByTimeAsync(1500)

    // tabHealth should NOT be called when no running tabs exist
    expect(tabHealthSpy).not.toHaveBeenCalled()
  })

  it('calls tabHealth when a tab is running', async () => {
    const { useHealthReconciliation } = await import('../renderer/hooks/useHealthReconciliation')
    const runningTab = makeTab({ status: 'running', activeRequestId: 'req-1' })
    useSessionStore.setState({ tabs: [runningTab] })

    const healthResponse: HealthReport = {
      tabs: [{ tabId: 'tab-1', status: 'running', activeRequestId: 'req-1', claudeSessionId: null, alive: true }],
      queueDepth: 0,
    }
    const tabHealthSpy = vi.fn().mockResolvedValue(healthResponse)
    Object.assign(window.showtime, { tabHealth: tabHealthSpy })

    renderHook(() => useHealthReconciliation())

    await vi.advanceTimersByTimeAsync(1500)

    expect(tabHealthSpy).toHaveBeenCalledOnce()
  })

  it('unsticks a tab marked "dead" in health but "running" in UI', async () => {
    const { useHealthReconciliation } = await import('../renderer/hooks/useHealthReconciliation')
    const runningTab = makeTab({ status: 'running', activeRequestId: 'req-1' })
    useSessionStore.setState({ tabs: [runningTab] })

    const healthResponse: HealthReport = {
      tabs: [{ tabId: 'tab-1', status: 'dead', activeRequestId: null, claudeSessionId: null, alive: false }],
      queueDepth: 0,
    }
    Object.assign(window.showtime, { tabHealth: vi.fn().mockResolvedValue(healthResponse) })

    renderHook(() => useHealthReconciliation())

    await vi.advanceTimersByTimeAsync(1500)

    const tab = useSessionStore.getState().tabs[0]
    expect(tab.status).toBe('dead')
    expect(tab.currentActivity).toBe('Session ended')
    expect(tab.activeRequestId).toBeNull()
  })

  it('unsticks a tab marked "idle" + not alive in health but "running" in UI', async () => {
    const { useHealthReconciliation } = await import('../renderer/hooks/useHealthReconciliation')
    const runningTab = makeTab({ status: 'running', activeRequestId: 'req-1' })
    useSessionStore.setState({ tabs: [runningTab] })

    const healthResponse: HealthReport = {
      tabs: [{ tabId: 'tab-1', status: 'idle', activeRequestId: null, claudeSessionId: null, alive: false }],
      queueDepth: 0,
    }
    Object.assign(window.showtime, { tabHealth: vi.fn().mockResolvedValue(healthResponse) })

    renderHook(() => useHealthReconciliation())

    await vi.advanceTimersByTimeAsync(1500)

    const tab = useSessionStore.getState().tabs[0]
    expect(tab.status).toBe('completed')
    expect(tab.currentActivity).toBe('')
    expect(tab.activeRequestId).toBeNull()
  })

  it('unsticks a tab marked "failed" in health but "connecting" in UI', async () => {
    const { useHealthReconciliation } = await import('../renderer/hooks/useHealthReconciliation')
    const connectingTab = makeTab({ status: 'connecting', activeRequestId: 'req-1' })
    useSessionStore.setState({ tabs: [connectingTab] })

    const healthResponse: HealthReport = {
      tabs: [{ tabId: 'tab-1', status: 'failed', activeRequestId: null, claudeSessionId: null, alive: false }],
      queueDepth: 0,
    }
    Object.assign(window.showtime, { tabHealth: vi.fn().mockResolvedValue(healthResponse) })

    renderHook(() => useHealthReconciliation())

    await vi.advanceTimersByTimeAsync(1500)

    const tab = useSessionStore.getState().tabs[0]
    expect(tab.status).toBe('failed')
    expect(tab.activeRequestId).toBeNull()
  })

  it('does not update store when health status matches UI status', async () => {
    const { useHealthReconciliation } = await import('../renderer/hooks/useHealthReconciliation')
    const runningTab = makeTab({ status: 'running', activeRequestId: 'req-1' })
    useSessionStore.setState({ tabs: [runningTab] })

    const healthResponse: HealthReport = {
      tabs: [{ tabId: 'tab-1', status: 'running', activeRequestId: 'req-1', claudeSessionId: null, alive: true }],
      queueDepth: 0,
    }
    Object.assign(window.showtime, { tabHealth: vi.fn().mockResolvedValue(healthResponse) })

    // Spy on setState to verify it's not called unnecessarily
    const setStateSpy = vi.spyOn(useSessionStore, 'setState')

    renderHook(() => useHealthReconciliation())

    await vi.advanceTimersByTimeAsync(1500)

    // setState should not be called since nothing changed
    expect(setStateSpy).not.toHaveBeenCalled()
    setStateSpy.mockRestore()
  })

  it('ignores transient health check errors', async () => {
    const { useHealthReconciliation } = await import('../renderer/hooks/useHealthReconciliation')
    const runningTab = makeTab({ status: 'running', activeRequestId: 'req-1' })
    useSessionStore.setState({ tabs: [runningTab] })

    Object.assign(window.showtime, {
      tabHealth: vi.fn().mockRejectedValue(new Error('network error')),
    })

    renderHook(() => useHealthReconciliation())

    // Should not throw
    await vi.advanceTimersByTimeAsync(1500)

    // Tab should remain unchanged
    const tab = useSessionStore.getState().tabs[0]
    expect(tab.status).toBe('running')
  })

  it('handles health response with null/invalid tabs gracefully', async () => {
    const { useHealthReconciliation } = await import('../renderer/hooks/useHealthReconciliation')
    const runningTab = makeTab({ status: 'running', activeRequestId: 'req-1' })
    useSessionStore.setState({ tabs: [runningTab] })

    // health returns response without tabs array
    Object.assign(window.showtime, {
      tabHealth: vi.fn().mockResolvedValue({ tabs: null, queueDepth: 0 }),
    })

    renderHook(() => useHealthReconciliation())

    // Should not throw
    await vi.advanceTimersByTimeAsync(1500)

    const tab = useSessionStore.getState().tabs[0]
    expect(tab.status).toBe('running')
  })

  it('does not poll for tabs without activeRequestId', async () => {
    const { useHealthReconciliation } = await import('../renderer/hooks/useHealthReconciliation')
    // Tab is "running" but has no activeRequestId (should be skipped)
    const runningTab = makeTab({ status: 'running', activeRequestId: null })
    useSessionStore.setState({ tabs: [runningTab] })

    const tabHealthSpy = vi.fn()
    Object.assign(window.showtime, { tabHealth: tabHealthSpy })

    renderHook(() => useHealthReconciliation())

    await vi.advanceTimersByTimeAsync(1500)

    expect(tabHealthSpy).not.toHaveBeenCalled()
  })

  it('leaves non-running tabs untouched when reconciling', async () => {
    const { useHealthReconciliation } = await import('../renderer/hooks/useHealthReconciliation')
    const tabs = [
      makeTab({ id: 'tab-1', status: 'running', activeRequestId: 'req-1' }),
      makeTab({ id: 'tab-2', status: 'completed' }),
    ]
    useSessionStore.setState({ tabs })

    const healthResponse: HealthReport = {
      tabs: [
        { tabId: 'tab-1', status: 'dead', activeRequestId: null, claudeSessionId: null, alive: false },
        { tabId: 'tab-2', status: 'idle', activeRequestId: null, claudeSessionId: null, alive: false },
      ],
      queueDepth: 0,
    }
    Object.assign(window.showtime, { tabHealth: vi.fn().mockResolvedValue(healthResponse) })

    renderHook(() => useHealthReconciliation())

    await vi.advanceTimersByTimeAsync(1500)

    const state = useSessionStore.getState()
    expect(state.tabs[0].status).toBe('dead')
    // tab-2 was 'completed', not 'running'/'connecting', so it shouldn't be changed
    expect(state.tabs[1].status).toBe('completed')
  })
})
