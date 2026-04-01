/**
 * sessionStore event handling tests.
 *
 * Covers all 11 NormalizedEvent types dispatched through handleNormalizedEvent,
 * plus handleStatusChange, handleError, and multi-turn conversation flow.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// ─── Mocks (must be hoisted before imports) ───

vi.mock('../renderer/stores/uiStore', () => {
  const setCalendarAvailable = vi.fn()
  return {
    useUIStore: Object.assign(
      vi.fn((selector: any) => selector({ setCalendarAvailable })),
      {
        getState: vi.fn(() => ({
          setCalendarAvailable,
        })),
      }
    ),
  }
})

vi.mock('../renderer/theme', () => ({
  useThemeStore: Object.assign(vi.fn(), {
    getState: vi.fn(() => ({ soundEnabled: false })),
  }),
}))

// Mock the notification mp3 import so it doesn't fail in jsdom
vi.mock('../../resources/notification.mp3', () => ({ default: '' }))

import { useSessionStore } from '../renderer/stores/sessionStore'
import { useUIStore } from '../renderer/stores/uiStore'
import type { NormalizedEvent, EnrichedError } from '../shared/types'

// ─── Helpers ───

function getTab() {
  const state = useSessionStore.getState()
  return state.tabs.find((t) => t.id === state.activeTabId)!
}

function tabId() {
  return useSessionStore.getState().activeTabId
}

function dispatch(event: NormalizedEvent) {
  useSessionStore.getState().handleNormalizedEvent(tabId(), event)
}

// ─── Setup ───

beforeEach(() => {
  // Reset the store by replacing tabs with a fresh tab.
  // Zustand stores persist across tests so we need to explicitly reset.
  const state = useSessionStore.getState()
  const freshId = state.activeTabId // keep same ID for simplicity
  useSessionStore.setState({
    tabs: [
      {
        id: freshId,
        claudeSessionId: null,
        status: 'idle',
        activeRequestId: null,
        hasUnread: false,
        currentActivity: '',
        permissionQueue: [],
        permissionDenied: null,
        attachments: [],
        messages: [],
        title: 'Showtime',
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
      },
    ],
    isExpanded: false,
  })
  vi.clearAllMocks()
})

// ═══════════════════════════════════════════════════════
// 1. session_init
// ═══════════════════════════════════════════════════════

describe('session_init', () => {
  const baseInit: NormalizedEvent = {
    type: 'session_init',
    sessionId: 'sess-001',
    tools: ['Read', 'Edit', 'Bash'],
    model: 'claude-sonnet-4-6',
    mcpServers: [{ name: 'fs', status: 'connected' }],
    skills: ['commit'],
    version: '2.1.63',
  }

  it('sets session metadata fields on the tab', () => {
    dispatch(baseInit)
    const tab = getTab()
    expect(tab.claudeSessionId).toBe('sess-001')
    expect(tab.sessionModel).toBe('claude-sonnet-4-6')
    expect(tab.sessionTools).toEqual(['Read', 'Edit', 'Bash'])
    expect(tab.sessionMcpServers).toEqual([{ name: 'fs', status: 'connected' }])
    expect(tab.sessionSkills).toEqual(['commit'])
    expect(tab.sessionVersion).toBe('2.1.63')
  })

  it('triggers setCalendarAvailable(true) when a calendar tool is present', () => {
    const initWithCalendar: NormalizedEvent = {
      ...baseInit,
      tools: ['Read', 'gcal_list_events', 'Bash'],
    }
    dispatch(initWithCalendar)

    const { setCalendarAvailable } = (useUIStore as any).getState()
    expect(setCalendarAvailable).toHaveBeenCalledWith(true)
  })

  it('does NOT change status to running when isWarmup is true', () => {
    const warmupInit: NormalizedEvent = { ...baseInit, isWarmup: true }
    dispatch(warmupInit)
    expect(getTab().status).toBe('idle') // unchanged from initial
  })

  it('changes status to running when isWarmup is falsy', () => {
    dispatch(baseInit)
    expect(getTab().status).toBe('running')
    expect(getTab().currentActivity).toBe('Thinking...')
  })
})

// ═══════════════════════════════════════════════════════
// 2. text_chunk
// ═══════════════════════════════════════════════════════

describe('text_chunk', () => {
  it('creates a new assistant message if no assistant message exists', () => {
    dispatch({ type: 'text_chunk', text: 'Hello' })
    const tab = getTab()
    expect(tab.messages).toHaveLength(1)
    expect(tab.messages[0].role).toBe('assistant')
    expect(tab.messages[0].content).toBe('Hello')
  })

  it('appends to last assistant message', () => {
    dispatch({ type: 'text_chunk', text: 'Hello' })
    dispatch({ type: 'text_chunk', text: ' world' })
    const tab = getTab()
    expect(tab.messages).toHaveLength(1)
    expect(tab.messages[0].content).toBe('Hello world')
  })

  it('accumulates multiple chunks into a single message', () => {
    const chunks = ['The ', 'quick ', 'brown ', 'fox']
    for (const text of chunks) {
      dispatch({ type: 'text_chunk', text })
    }
    const tab = getTab()
    expect(tab.messages).toHaveLength(1)
    expect(tab.messages[0].content).toBe('The quick brown fox')
    expect(tab.currentActivity).toBe('Writing...')
  })
})

// ═══════════════════════════════════════════════════════
// 3. tool_call
// ═══════════════════════════════════════════════════════

describe('tool_call', () => {
  it('adds a tool message with toolName and status running', () => {
    dispatch({ type: 'tool_call', toolName: 'Read', toolId: 'tool-001', index: 0 })
    const tab = getTab()
    expect(tab.messages).toHaveLength(1)
    const msg = tab.messages[0]
    expect(msg.role).toBe('tool')
    expect(msg.toolName).toBe('Read')
    expect(msg.toolStatus).toBe('running')
    expect(tab.currentActivity).toBe('Running Read...')
  })
})

// ═══════════════════════════════════════════════════════
// 4. tool_call_update
// ═══════════════════════════════════════════════════════

describe('tool_call_update', () => {
  it('appends partialInput to the last running tool message', () => {
    dispatch({ type: 'tool_call', toolName: 'Read', toolId: 'tool-001', index: 0 })
    dispatch({ type: 'tool_call_update', toolId: 'tool-001', partialInput: '{"file":' })
    dispatch({ type: 'tool_call_update', toolId: 'tool-001', partialInput: ' "main.ts"}' })

    const tab = getTab()
    const toolMsg = tab.messages.find((m) => m.role === 'tool')!
    expect(toolMsg.toolInput).toBe('{"file": "main.ts"}')
  })
})

// ═══════════════════════════════════════════════════════
// 5. tool_call_complete
// ═══════════════════════════════════════════════════════

describe('tool_call_complete', () => {
  it('sets last running tool toolStatus to completed', () => {
    dispatch({ type: 'tool_call', toolName: 'Read', toolId: 'tool-001', index: 0 })
    dispatch({ type: 'tool_call_complete', index: 0 })

    const tab = getTab()
    const toolMsg = tab.messages.find((m) => m.role === 'tool')!
    expect(toolMsg.toolStatus).toBe('completed')
  })
})

// ═══════════════════════════════════════════════════════
// 6. task_update
// ═══════════════════════════════════════════════════════

describe('task_update', () => {
  it('adds assistant message with extracted text content', () => {
    dispatch({
      type: 'task_update',
      message: {
        model: 'claude-sonnet-4-6',
        id: 'msg-001',
        role: 'assistant',
        content: [{ type: 'text', text: 'Here is my analysis' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 50 },
      },
    })

    const tab = getTab()
    const assistantMsg = tab.messages.find((m) => m.role === 'assistant')
    expect(assistantMsg).toBeDefined()
    expect(assistantMsg!.content).toBe('Here is my analysis')
  })

  it('adds tool messages for tool_use blocks', () => {
    dispatch({
      type: 'task_update',
      message: {
        model: 'claude-sonnet-4-6',
        id: 'msg-002',
        role: 'assistant',
        content: [
          { type: 'tool_use', name: 'Edit', id: 'tool-edit-1', input: { file_path: '/src/app.ts' } },
        ],
        stop_reason: 'tool_use',
        usage: { input_tokens: 100, output_tokens: 50 },
      },
    })

    const tab = getTab()
    const toolMsg = tab.messages.find((m) => m.role === 'tool' && m.toolName === 'Edit')
    expect(toolMsg).toBeDefined()
    expect(toolMsg!.toolStatus).toBe('completed')
  })

  it('skips adding text if streamed text already exists for this turn', () => {
    // Simulate: user message, then streamed text, then task_update with same text
    useSessionStore.setState((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === tabId()
          ? {
              ...t,
              messages: [
                { id: 'u1', role: 'user' as const, content: 'Do something', timestamp: Date.now() },
                { id: 'a1', role: 'assistant' as const, content: 'Streamed response', timestamp: Date.now() },
              ],
            }
          : t
      ),
    }))

    dispatch({
      type: 'task_update',
      message: {
        model: 'claude-sonnet-4-6',
        id: 'msg-003',
        role: 'assistant',
        content: [{ type: 'text', text: 'Streamed response' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 50 },
      },
    })

    const tab = getTab()
    // Should still have only 2 messages (user + original assistant), not a duplicate
    const assistantMsgs = tab.messages.filter((m) => m.role === 'assistant')
    expect(assistantMsgs).toHaveLength(1)
  })
})

// ═══════════════════════════════════════════════════════
// 7. task_complete
// ═══════════════════════════════════════════════════════

describe('task_complete', () => {
  const baseComplete: NormalizedEvent = {
    type: 'task_complete',
    result: 'Done!',
    costUsd: 0.012,
    durationMs: 1500,
    numTurns: 2,
    usage: { input_tokens: 200, output_tokens: 100 },
    sessionId: 'sess-001',
  }

  it('sets status to completed and clears activeRequestId', () => {
    dispatch(baseComplete)
    const tab = getTab()
    expect(tab.status).toBe('completed')
    expect(tab.activeRequestId).toBeNull()
    expect(tab.currentActivity).toBe('')
  })

  it('sets lastResult with cost, duration, turns, usage', () => {
    dispatch(baseComplete)
    const tab = getTab()
    expect(tab.lastResult).toEqual({
      totalCostUsd: 0.012,
      durationMs: 1500,
      numTurns: 2,
      usage: { input_tokens: 200, output_tokens: 100 },
      sessionId: 'sess-001',
    })
  })

  it('adds assistant message from result text when no streamed text exists', () => {
    dispatch(baseComplete)
    const tab = getTab()
    const assistantMsg = tab.messages.find((m) => m.role === 'assistant')
    expect(assistantMsg).toBeDefined()
    expect(assistantMsg!.content).toBe('Done!')
  })

  it('does not add duplicate assistant message if streamed text already exists', () => {
    // Pre-populate with a user message and streamed assistant text
    useSessionStore.setState((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === tabId()
          ? {
              ...t,
              messages: [
                { id: 'u1', role: 'user' as const, content: 'Hello', timestamp: Date.now() },
                { id: 'a1', role: 'assistant' as const, content: 'Streamed', timestamp: Date.now() },
              ],
            }
          : t
      ),
    }))

    dispatch(baseComplete)
    const tab = getTab()
    const assistantMsgs = tab.messages.filter((m) => m.role === 'assistant')
    expect(assistantMsgs).toHaveLength(1) // no duplicate
  })

  it('sets permissionDenied when permissionDenials are present', () => {
    const eventWithDenials: NormalizedEvent = {
      ...baseComplete,
      permissionDenials: [
        { toolName: 'Bash', toolUseId: 'tu-001' },
        { toolName: 'Edit', toolUseId: 'tu-002' },
      ],
    }
    dispatch(eventWithDenials)
    const tab = getTab()
    expect(tab.permissionDenied).toEqual({
      tools: [
        { toolName: 'Bash', toolUseId: 'tu-001' },
        { toolName: 'Edit', toolUseId: 'tu-002' },
      ],
    })
  })

  it('clears permissionDenied when no permissionDenials', () => {
    // Set a pre-existing permissionDenied
    useSessionStore.setState((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === tabId()
          ? { ...t, permissionDenied: { tools: [{ toolName: 'Bash', toolUseId: 'tu-old' }] } }
          : t
      ),
    }))

    dispatch(baseComplete)
    expect(getTab().permissionDenied).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════
// 8. error
// ═══════════════════════════════════════════════════════

describe('error event', () => {
  it('sets status to failed and adds system error message', () => {
    dispatch({ type: 'error', message: 'Something broke', isError: true })
    const tab = getTab()
    expect(tab.status).toBe('failed')
    expect(tab.activeRequestId).toBeNull()
    expect(tab.currentActivity).toBe('')
    const errMsg = tab.messages.find((m) => m.role === 'system')
    expect(errMsg).toBeDefined()
    expect(errMsg!.content).toBe('Error: Something broke')
  })
})

// ═══════════════════════════════════════════════════════
// 9. session_dead
// ═══════════════════════════════════════════════════════

describe('session_dead', () => {
  it('sets status to dead and adds system message with exit code', () => {
    dispatch({ type: 'session_dead', exitCode: 1, signal: null, stderrTail: [] })
    const tab = getTab()
    expect(tab.status).toBe('dead')
    expect(tab.activeRequestId).toBeNull()
    const sysMsg = tab.messages.find((m) => m.role === 'system')
    expect(sysMsg).toBeDefined()
    expect(sysMsg!.content).toContain('exit 1')
  })
})

// ═══════════════════════════════════════════════════════
// 10. permission_request
// ═══════════════════════════════════════════════════════

describe('permission_request', () => {
  it('adds to permissionQueue with mapped fields', () => {
    dispatch({
      type: 'permission_request',
      questionId: 'q-001',
      toolName: 'Bash',
      toolDescription: 'Run a Bash command',
      toolInput: { command: 'rm -rf /' },
      options: [
        { id: 'allow', label: 'Allow', kind: 'allow' },
        { id: 'deny', label: 'Deny', kind: 'deny' },
      ],
    })

    const tab = getTab()
    expect(tab.permissionQueue).toHaveLength(1)
    const req = tab.permissionQueue[0]
    expect(req.questionId).toBe('q-001')
    expect(req.toolTitle).toBe('Bash')
    expect(req.toolDescription).toBe('Run a Bash command')
    expect(req.toolInput).toEqual({ command: 'rm -rf /' })
    expect(req.options).toEqual([
      { optionId: 'allow', kind: 'allow', label: 'Allow' },
      { optionId: 'deny', kind: 'deny', label: 'Deny' },
    ])
    expect(tab.currentActivity).toBe('Waiting for permission: Bash')
  })
})

// ═══════════════════════════════════════════════════════
// 11. rate_limit
// ═══════════════════════════════════════════════════════

describe('rate_limit', () => {
  it('adds system message for non-allowed rate limits', () => {
    const resetsAt = Date.now() + 60_000
    dispatch({
      type: 'rate_limit',
      status: 'rate_limited',
      resetsAt,
      rateLimitType: 'token',
    })

    const tab = getTab()
    const sysMsg = tab.messages.find((m) => m.role === 'system')
    expect(sysMsg).toBeDefined()
    expect(sysMsg!.content).toContain('Rate limited')
    expect(sysMsg!.content).toContain('token')
  })

  it('does not add message when status is allowed', () => {
    dispatch({
      type: 'rate_limit',
      status: 'allowed',
      resetsAt: Date.now() + 60_000,
      rateLimitType: 'token',
    })

    const tab = getTab()
    expect(tab.messages).toHaveLength(0)
  })
})

// ═══════════════════════════════════════════════════════
// 12. handleStatusChange
// ═══════════════════════════════════════════════════════

describe('handleStatusChange', () => {
  it('updates tab status', () => {
    useSessionStore.getState().handleStatusChange(tabId(), 'running', 'idle')
    expect(getTab().status).toBe('running')
  })

  it('clears currentActivity and permissionQueue when transitioning to idle', () => {
    // Set some existing state
    useSessionStore.setState((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === tabId()
          ? {
              ...t,
              currentActivity: 'Working...',
              permissionQueue: [
                {
                  questionId: 'q-x',
                  toolTitle: 'Bash',
                  options: [{ optionId: 'allow', label: 'Allow', kind: 'allow' }],
                },
              ],
            }
          : t
      ),
    }))

    useSessionStore.getState().handleStatusChange(tabId(), 'idle', 'running')
    const tab = getTab()
    expect(tab.status).toBe('idle')
    expect(tab.currentActivity).toBe('')
    expect(tab.permissionQueue).toHaveLength(0)
  })
})

// ═══════════════════════════════════════════════════════
// 13. handleError
// ═══════════════════════════════════════════════════════

describe('handleError', () => {
  const baseError: EnrichedError = {
    message: 'Process crashed',
    stderrTail: ['line 1', 'line 2', 'line 3'],
    exitCode: 1,
    elapsedMs: 500,
    toolCallCount: 3,
  }

  it('sets status to failed and adds error message with stderr tail', () => {
    useSessionStore.getState().handleError(tabId(), baseError)
    const tab = getTab()
    expect(tab.status).toBe('failed')
    expect(tab.activeRequestId).toBeNull()
    expect(tab.currentActivity).toBe('')
    expect(tab.permissionQueue).toHaveLength(0)

    const errMsg = tab.messages.find((m) => m.role === 'system')
    expect(errMsg).toBeDefined()
    expect(errMsg!.content).toContain('Process crashed')
    expect(errMsg!.content).toContain('line 3')
  })

  it('does not add duplicate error if last message is already an error', () => {
    // First error
    useSessionStore.getState().handleError(tabId(), baseError)
    expect(getTab().messages).toHaveLength(1)

    // Second error — should be deduplicated
    useSessionStore.getState().handleError(tabId(), {
      ...baseError,
      message: 'Another crash',
    })
    const tab = getTab()
    expect(tab.messages).toHaveLength(1) // still 1 — deduped
    // Keeps the original error message
    expect(tab.messages[0].content).toContain('Process crashed')
  })
})

// ═══════════════════════════════════════════════════════
// 14. Multi-turn integration
// ═══════════════════════════════════════════════════════

describe('multi-turn conversation', () => {
  it('accumulates messages correctly across two turns', () => {
    const id = tabId()
    const handle = useSessionStore.getState().handleNormalizedEvent

    // ─── Turn 1: user sends message, gets streamed response ───

    // Simulate user message by pre-populating
    useSessionStore.setState((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === id
          ? {
              ...t,
              status: 'connecting' as const,
              messages: [
                { id: 'u1', role: 'user' as const, content: 'Plan my day', timestamp: Date.now() },
              ],
            }
          : t
      ),
    }))

    // session_init
    handle(id, {
      type: 'session_init',
      sessionId: 'sess-multi',
      tools: ['Read', 'Bash'],
      model: 'claude-sonnet-4-6',
      mcpServers: [],
      skills: [],
      version: '2.1.63',
    })
    expect(getTab().status).toBe('running')

    // text_chunks
    handle(id, { type: 'text_chunk', text: 'Here is ' })
    handle(id, { type: 'text_chunk', text: 'your plan.' })

    // task_complete
    handle(id, {
      type: 'task_complete',
      result: 'Here is your plan.',
      costUsd: 0.005,
      durationMs: 800,
      numTurns: 1,
      usage: { input_tokens: 100, output_tokens: 50 },
      sessionId: 'sess-multi',
    })

    let tab = getTab()
    expect(tab.status).toBe('completed')
    // Should have: user msg + assistant text (streamed, no duplicate from result)
    expect(tab.messages).toHaveLength(2)
    expect(tab.messages[0].role).toBe('user')
    expect(tab.messages[1].role).toBe('assistant')
    expect(tab.messages[1].content).toBe('Here is your plan.')

    // ─── Turn 2: user sends another message ───

    useSessionStore.setState((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === id
          ? {
              ...t,
              status: 'connecting' as const,
              messages: [
                ...t.messages,
                { id: 'u2', role: 'user' as const, content: 'Add a workout', timestamp: Date.now() },
              ],
            }
          : t
      ),
    }))

    // session_init (reusing existing session)
    handle(id, {
      type: 'session_init',
      sessionId: 'sess-multi',
      tools: ['Read', 'Bash'],
      model: 'claude-sonnet-4-6',
      mcpServers: [],
      skills: [],
      version: '2.1.63',
    })

    // text_chunks for turn 2
    handle(id, { type: 'text_chunk', text: 'Added workout ' })
    handle(id, { type: 'text_chunk', text: 'to your plan.' })

    // task_complete for turn 2
    handle(id, {
      type: 'task_complete',
      result: 'Added workout to your plan.',
      costUsd: 0.003,
      durationMs: 600,
      numTurns: 1,
      usage: { input_tokens: 80, output_tokens: 40 },
      sessionId: 'sess-multi',
    })

    tab = getTab()
    expect(tab.status).toBe('completed')
    // Should have: user1 + assistant1 + user2 + assistant2
    expect(tab.messages).toHaveLength(4)
    expect(tab.messages[0]).toMatchObject({ role: 'user', content: 'Plan my day' })
    expect(tab.messages[1]).toMatchObject({ role: 'assistant', content: 'Here is your plan.' })
    expect(tab.messages[2]).toMatchObject({ role: 'user', content: 'Add a workout' })
    expect(tab.messages[3]).toMatchObject({ role: 'assistant', content: 'Added workout to your plan.' })

    // Verify no duplicates from task_complete result text
    const assistantMsgs = tab.messages.filter((m) => m.role === 'assistant')
    expect(assistantMsgs).toHaveLength(2)
  })
})
