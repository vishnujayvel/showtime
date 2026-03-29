import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSessionStore } from '../renderer/stores/sessionStore'
import type { NormalizedEvent, EnrichedError } from '../shared/types'

// ─── Helpers to capture IPC listener callbacks ───

type EventCallback = (tabId: string, event: NormalizedEvent) => void
type StatusCallback = (tabId: string, newStatus: string, oldStatus: string) => void
type ErrorCallback = (tabId: string, error: EnrichedError) => void
type SkillCallback = (status: { name: string; state: string; error?: string }) => void

let capturedOnEvent: EventCallback | null = null
let capturedOnStatus: StatusCallback | null = null
let capturedOnError: ErrorCallback | null = null
let capturedOnSkill: SkillCallback | null = null

const unsubEvent = vi.fn()
const unsubStatus = vi.fn()
const unsubError = vi.fn()
const unsubSkill = vi.fn()

function installMocks() {
  Object.assign(window.clui, {
    onEvent: vi.fn((cb: EventCallback) => {
      capturedOnEvent = cb
      return unsubEvent
    }),
    onTabStatusChange: vi.fn((cb: StatusCallback) => {
      capturedOnStatus = cb
      return unsubStatus
    }),
    onError: vi.fn((cb: ErrorCallback) => {
      capturedOnError = cb
      return unsubError
    }),
    onSkillStatus: vi.fn((cb: SkillCallback) => {
      capturedOnSkill = cb
      return unsubSkill
    }),
  })
}

// Mock requestAnimationFrame / cancelAnimationFrame
let rafCallbacks: Array<{ id: number; cb: FrameRequestCallback }> = []
let nextRafId = 1

function flushRAF() {
  const pending = [...rafCallbacks]
  rafCallbacks = []
  pending.forEach(({ cb }) => cb(performance.now()))
}

// ─── Mock store actions injected before the hook subscribes ───

const mockHandleNormalizedEvent = vi.fn()
const mockHandleStatusChange = vi.fn()
const mockHandleError = vi.fn()

describe('useClaudeEvents', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    capturedOnEvent = null
    capturedOnStatus = null
    capturedOnError = null
    capturedOnSkill = null
    unsubEvent.mockClear()
    unsubStatus.mockClear()
    unsubError.mockClear()
    unsubSkill.mockClear()
    mockHandleNormalizedEvent.mockClear()
    mockHandleStatusChange.mockClear()
    mockHandleError.mockClear()
    rafCallbacks = []
    nextRafId = 1

    // Install RAF mocks
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      const id = nextRafId++
      rafCallbacks.push({ id, cb })
      return id
    })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      rafCallbacks = rafCallbacks.filter((r) => r.id !== id)
    })

    // Inject mock actions into the store BEFORE the hook subscribes
    // so useSessionStore((s) => s.handleNormalizedEvent) picks up our mocks
    useSessionStore.setState({
      handleNormalizedEvent: mockHandleNormalizedEvent as any,
      handleStatusChange: mockHandleStatusChange as any,
      handleError: mockHandleError as any,
    })

    installMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('subscribes to all four event channels on mount', async () => {
    const { useClaudeEvents } = await import('../renderer/hooks/useClaudeEvents')
    renderHook(() => useClaudeEvents())

    expect(window.clui.onEvent).toHaveBeenCalledOnce()
    expect(window.clui.onTabStatusChange).toHaveBeenCalledOnce()
    expect(window.clui.onError).toHaveBeenCalledOnce()
    expect(window.clui.onSkillStatus).toHaveBeenCalledOnce()
  })

  it('unsubscribes from all channels on unmount', async () => {
    const { useClaudeEvents } = await import('../renderer/hooks/useClaudeEvents')
    const { unmount } = renderHook(() => useClaudeEvents())

    unmount()

    expect(unsubEvent).toHaveBeenCalledOnce()
    expect(unsubStatus).toHaveBeenCalledOnce()
    expect(unsubError).toHaveBeenCalledOnce()
    expect(unsubSkill).toHaveBeenCalledOnce()
  })

  it('routes non-text-chunk events to handleNormalizedEvent immediately', async () => {
    const { useClaudeEvents } = await import('../renderer/hooks/useClaudeEvents')
    renderHook(() => useClaudeEvents())

    const toolCallEvent: NormalizedEvent = {
      type: 'tool_call',
      toolName: 'Bash',
      toolId: 'tool-1',
      index: 0,
    }

    act(() => {
      capturedOnEvent!('tab-1', toolCallEvent)
    })

    expect(mockHandleNormalizedEvent).toHaveBeenCalledWith('tab-1', toolCallEvent)
  })

  it('batches text_chunk events and flushes on RAF', async () => {
    const { useClaudeEvents } = await import('../renderer/hooks/useClaudeEvents')
    renderHook(() => useClaudeEvents())

    // Send multiple text chunks for the same tab
    capturedOnEvent!('tab-1', { type: 'text_chunk', text: 'Hello ' } as NormalizedEvent)
    capturedOnEvent!('tab-1', { type: 'text_chunk', text: 'world' } as NormalizedEvent)

    // Should NOT have been called yet (batched)
    expect(mockHandleNormalizedEvent).not.toHaveBeenCalled()

    // Flush RAF
    act(() => {
      flushRAF()
    })

    // Should flush concatenated text
    expect(mockHandleNormalizedEvent).toHaveBeenCalledOnce()
    expect(mockHandleNormalizedEvent).toHaveBeenCalledWith('tab-1', { type: 'text_chunk', text: 'Hello world' })
  })

  it('flushes text chunks synchronously before task_complete', async () => {
    const { useClaudeEvents } = await import('../renderer/hooks/useClaudeEvents')
    renderHook(() => useClaudeEvents())

    // Buffer a text chunk
    capturedOnEvent!('tab-1', { type: 'text_chunk', text: 'buffered text' } as NormalizedEvent)
    expect(mockHandleNormalizedEvent).not.toHaveBeenCalled()

    // Now send task_complete -- should synchronously flush the buffer first
    const taskCompleteEvent: NormalizedEvent = {
      type: 'task_complete',
      result: 'done',
      costUsd: 0.01,
      durationMs: 1000,
      numTurns: 1,
      usage: {},
      sessionId: 'sess-1',
    }

    act(() => {
      capturedOnEvent!('tab-1', taskCompleteEvent)
    })

    // First call: flushed text chunk, second call: task_complete
    expect(mockHandleNormalizedEvent).toHaveBeenCalledTimes(2)
    expect(mockHandleNormalizedEvent.mock.calls[0]).toEqual(['tab-1', { type: 'text_chunk', text: 'buffered text' }])
    expect(mockHandleNormalizedEvent.mock.calls[1]).toEqual(['tab-1', taskCompleteEvent])
  })

  it('flushes text chunks synchronously before task_update', async () => {
    const { useClaudeEvents } = await import('../renderer/hooks/useClaudeEvents')
    renderHook(() => useClaudeEvents())

    capturedOnEvent!('tab-1', { type: 'text_chunk', text: 'pending' } as NormalizedEvent)

    const taskUpdateEvent: NormalizedEvent = {
      type: 'task_update',
      message: {
        model: 'claude-sonnet-4-6',
        id: 'msg-1',
        role: 'assistant',
        content: [{ type: 'text', text: 'response' }],
        stop_reason: null,
        usage: {},
      },
    }

    act(() => {
      capturedOnEvent!('tab-1', taskUpdateEvent)
    })

    expect(mockHandleNormalizedEvent).toHaveBeenCalledTimes(2)
    expect(mockHandleNormalizedEvent.mock.calls[0]).toEqual(['tab-1', { type: 'text_chunk', text: 'pending' }])
    expect(mockHandleNormalizedEvent.mock.calls[1]).toEqual(['tab-1', taskUpdateEvent])
  })

  it('routes status change events to handleStatusChange', async () => {
    const { useClaudeEvents } = await import('../renderer/hooks/useClaudeEvents')
    renderHook(() => useClaudeEvents())

    act(() => {
      capturedOnStatus!('tab-1', 'running', 'idle')
    })

    expect(mockHandleStatusChange).toHaveBeenCalledWith('tab-1', 'running', 'idle')
  })

  it('routes error events to handleError', async () => {
    const { useClaudeEvents } = await import('../renderer/hooks/useClaudeEvents')
    renderHook(() => useClaudeEvents())

    const error: EnrichedError = {
      message: 'Connection failed',
      stderrTail: ['error line'],
      exitCode: 1,
      elapsedMs: 500,
      toolCallCount: 0,
    }

    act(() => {
      capturedOnError!('tab-1', error)
    })

    expect(mockHandleError).toHaveBeenCalledWith('tab-1', error)
  })

  it('logs a warning when skill install fails', async () => {
    const { useClaudeEvents } = await import('../renderer/hooks/useClaudeEvents')
    renderHook(() => useClaudeEvents())

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    capturedOnSkill!({ name: 'test-skill', state: 'failed', error: 'not found' })

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Skill install failed: test-skill')
    )
    warnSpy.mockRestore()
  })

  it('does not log when skill install succeeds', async () => {
    const { useClaudeEvents } = await import('../renderer/hooks/useClaudeEvents')
    renderHook(() => useClaudeEvents())

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    capturedOnSkill!({ name: 'test-skill', state: 'installed' })

    expect(warnSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('cancels pending RAF on unmount', async () => {
    const { useClaudeEvents } = await import('../renderer/hooks/useClaudeEvents')
    const { unmount } = renderHook(() => useClaudeEvents())

    // Buffer a text chunk to schedule an RAF
    capturedOnEvent!('tab-1', { type: 'text_chunk', text: 'orphaned' } as NormalizedEvent)
    expect(rafCallbacks.length).toBe(1)

    unmount()

    // RAF callback should have been cancelled
    expect(rafCallbacks.length).toBe(0)
  })

  it('handles text chunks for multiple tabs independently', async () => {
    const { useClaudeEvents } = await import('../renderer/hooks/useClaudeEvents')
    renderHook(() => useClaudeEvents())

    capturedOnEvent!('tab-1', { type: 'text_chunk', text: 'AAA' } as NormalizedEvent)
    capturedOnEvent!('tab-2', { type: 'text_chunk', text: 'BBB' } as NormalizedEvent)

    act(() => {
      flushRAF()
    })

    expect(mockHandleNormalizedEvent).toHaveBeenCalledTimes(2)
    // Order: Map iteration order = insertion order
    expect(mockHandleNormalizedEvent.mock.calls[0]).toEqual(['tab-1', { type: 'text_chunk', text: 'AAA' }])
    expect(mockHandleNormalizedEvent.mock.calls[1]).toEqual(['tab-2', { type: 'text_chunk', text: 'BBB' }])
  })
})
