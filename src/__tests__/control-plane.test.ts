// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { NormalizedEvent, RunOptions } from '../shared/types'

// ─── Hoisted mocks (available before vi.mock factories run) ───

type Handler = (...args: any[]) => void

const {
  mockRunManager,
  mockPtyRunManager,
  mockPermissionServer,
  handlerState,
} = vi.hoisted(() => {
  const _vi = { fn: (...args: any[]) => (globalThis as any).__vitest_mocker__?.fn?.(...args) ?? (() => {}) }

  const state = {
    runManagerHandlers: {} as Record<string, Handler>,
    ptyRunManagerHandlers: {} as Record<string, Handler>,
    permissionServerHandlers: {} as Record<string, Handler>,
  }

  return {
    mockRunManager: {
      on(event: string, handler: Handler) { state.runManagerHandlers[event] = handler },
      emit() {},
      startRun: null as any,
      cancel: null as any,
      isRunning: null as any,
      writeToStdin: null as any,
      getEnrichedError: null as any,
    },
    mockPtyRunManager: {
      on(event: string, handler: Handler) { state.ptyRunManagerHandlers[event] = handler },
      emit() {},
      startRun: null as any,
      cancel: null as any,
      isRunning: null as any,
      getEnrichedError: null as any,
      respondToPermission: null as any,
    },
    mockPermissionServer: {
      on(event: string, handler: Handler) { state.permissionServerHandlers[event] = handler },
      emit() {},
      start: null as any,
      stop: null as any,
      getPort: null as any,
      registerRun: null as any,
      unregisterRun: null as any,
      generateSettingsFile: null as any,
      respondToPermission: null as any,
    },
    handlerState: state,
  }
})

// ─── Mock RunManager ───

vi.mock('../main/claude/run-manager', () => ({
  RunManager: function RunManager() { return mockRunManager },
}))

// ─── Mock PtyRunManager ───

vi.mock('../main/claude/pty-run-manager', () => ({
  PtyRunManager: function PtyRunManager() { return mockPtyRunManager },
}))

// ─── Mock PermissionServer ───

vi.mock('../main/hooks/permission-server', () => ({
  PermissionServer: function PermissionServer() { return mockPermissionServer },
  maskSensitiveFields: (input: unknown) => input,
}))

// ─── Mock logger ───

vi.mock('../main/logger', () => ({ log: () => {} }))

// ─── Import after mocks ───

import { ControlPlane } from '../main/claude/control-plane'

// ─── Helpers ───

function makeRunOptions(overrides: Partial<RunOptions> = {}): RunOptions {
  return { prompt: 'test prompt', projectPath: '/tmp/project', ...overrides }
}

/** Flush microtask queue so _dispatch's awaited hookServerReady resolves. */
function flush(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0))
}

// ─── Tests ───

// Shorthand accessors for handler maps
const runManagerHandlers = () => handlerState.runManagerHandlers
const ptyRunManagerHandlers = () => handlerState.ptyRunManagerHandlers
const permissionServerHandlers = () => handlerState.permissionServerHandlers

describe('ControlPlane', () => {
  let cp: ControlPlane

  afterEach(async () => {
    // Suppress error/rejection events during shutdown cleanup
    cp.on('error', () => {})
    // Swallow rejections from inflight promises during tab closure
    const suppress = () => {}
    process.on('unhandledRejection', suppress)
    cp.shutdown()
    await flush()
    process.removeListener('unhandledRejection', suppress)
  })

  beforeEach(() => {
    // Reset handler maps
    handlerState.runManagerHandlers = {}
    handlerState.ptyRunManagerHandlers = {}
    handlerState.permissionServerHandlers = {}

    // Reset mock functions on RunManager
    mockRunManager.startRun = vi.fn().mockReturnValue({ pid: 12345 })
    mockRunManager.cancel = vi.fn().mockReturnValue(true)
    mockRunManager.isRunning = vi.fn().mockReturnValue(false)
    mockRunManager.writeToStdin = vi.fn().mockReturnValue(true)
    mockRunManager.getEnrichedError = vi.fn().mockReturnValue({
      message: 'error', stderrTail: [], stdoutTail: [], exitCode: 1,
      elapsedMs: 0, toolCallCount: 0, sawPermissionRequest: false, permissionDenials: [],
    })

    // Reset mock functions on PtyRunManager
    mockPtyRunManager.startRun = vi.fn().mockReturnValue({ pid: 54321 })
    mockPtyRunManager.cancel = vi.fn().mockReturnValue(true)
    mockPtyRunManager.isRunning = vi.fn().mockReturnValue(false)
    mockPtyRunManager.getEnrichedError = vi.fn().mockReturnValue({
      message: 'error', stderrTail: [], exitCode: 1, elapsedMs: 0, toolCallCount: 0,
    })
    mockPtyRunManager.respondToPermission = vi.fn().mockReturnValue(true)

    // Reset mock functions on PermissionServer
    mockPermissionServer.start = vi.fn().mockResolvedValue(8899)
    mockPermissionServer.stop = vi.fn()
    mockPermissionServer.getPort = vi.fn().mockReturnValue(8899)
    mockPermissionServer.registerRun = vi.fn().mockReturnValue('token-123')
    mockPermissionServer.unregisterRun = vi.fn()
    mockPermissionServer.generateSettingsFile = vi.fn().mockReturnValue('/tmp/hook-settings.json')
    mockPermissionServer.respondToPermission = vi.fn().mockReturnValue(true)

    cp = new ControlPlane()
  })

  // ── 1. createTab returns unique tabId ──

  describe('createTab', () => {
    it('returns a UUID-format tabId', () => {
      const tabId = cp.createTab()
      expect(tabId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      )
    })

    it('returns unique IDs for multiple tabs', () => {
      const a = cp.createTab()
      const b = cp.createTab()
      expect(a).not.toBe(b)
    })
  })

  // ── 2. createTab sets initial status to idle ──

  it('createTab sets initial status to idle', () => {
    const tabId = cp.createTab()
    const entry = cp.getTabStatus(tabId)
    expect(entry).toBeDefined()
    expect(entry!.status).toBe('idle')
    expect(entry!.claudeSessionId).toBeNull()
    expect(entry!.activeRequestId).toBeNull()
    expect(entry!.promptCount).toBe(0)
  })

  // ── 3. closeTab removes tab ──

  it('closeTab removes tab from registry', () => {
    const tabId = cp.createTab()
    cp.closeTab(tabId)
    expect(cp.getTabStatus(tabId)).toBeUndefined()
  })

  // ── 4. closeTab cancels active run ──

  it('closeTab cancels active run', async () => {
    const tabId = cp.createTab()
    const promise = cp.submitPrompt(tabId, 'req-active', makeRunOptions())
    await flush()

    cp.closeTab(tabId)
    expect(mockRunManager.cancel).toHaveBeenCalledWith('req-active')

    // The promise should reject with 'Tab closed'
    await expect(promise).rejects.toThrow('Tab closed')
  })

  // ── 5. closeTab rejects queued requests ──

  it('closeTab rejects queued requests', async () => {
    const tabId = cp.createTab()

    // First prompt occupies the tab
    cp.submitPrompt(tabId, 'req-1', makeRunOptions())
    await flush()

    // Second prompt gets queued
    const queued = cp.submitPrompt(tabId, 'req-queued', makeRunOptions())

    cp.closeTab(tabId)
    await expect(queued).rejects.toThrow('Tab closed')
  })

  // ── 6. submitPrompt dispatches immediately when idle ──

  it('submitPrompt dispatches immediately when idle', async () => {
    const tabId = cp.createTab()
    cp.submitPrompt(tabId, 'req-1', makeRunOptions())
    await flush()

    expect(mockRunManager.startRun).toHaveBeenCalledWith('req-1', expect.objectContaining({
      prompt: 'test prompt',
    }))

    const entry = cp.getTabStatus(tabId)
    expect(entry!.activeRequestId).toBe('req-1')
    // First run with no sessionId → status should be 'connecting'
    expect(entry!.status).toBe('connecting')
  })

  // ── 7. submitPrompt queues when tab busy ──

  it('submitPrompt queues when tab busy', async () => {
    const tabId = cp.createTab()
    cp.submitPrompt(tabId, 'req-1', makeRunOptions())
    await flush()

    // Second prompt should be queued, not dispatched
    cp.submitPrompt(tabId, 'req-2', makeRunOptions())
    // startRun should only have been called once (for req-1)
    expect(mockRunManager.startRun).toHaveBeenCalledTimes(1)

    const health = cp.getHealth()
    expect(health.queueDepth).toBe(1)
  })

  // ── 8. submitPrompt rejects when queue full ──

  it('submitPrompt rejects when queue full (32)', async () => {
    const tabId = cp.createTab()
    cp.submitPrompt(tabId, 'req-active', makeRunOptions())
    await flush()

    // Fill queue to 32
    for (let i = 0; i < 32; i++) {
      cp.submitPrompt(tabId, `req-q-${i}`, makeRunOptions())
    }

    // 33rd should be rejected
    await expect(
      cp.submitPrompt(tabId, 'req-overflow', makeRunOptions()),
    ).rejects.toThrow('back-pressure')
  })

  // ── 9. submitPrompt idempotency ──

  it('submitPrompt returns same promise for duplicate requestId (inflight)', async () => {
    const tabId = cp.createTab()
    cp.submitPrompt(tabId, 'req-dup', makeRunOptions())
    await flush()

    // Duplicate requestId should NOT trigger another startRun
    cp.submitPrompt(tabId, 'req-dup', makeRunOptions())
    expect(mockRunManager.startRun).toHaveBeenCalledTimes(1)

    // Clean up: complete the run so inflight promise resolves
    runManagerHandlers()['exit']('req-dup', 0, null, null)
  })

  it('submitPrompt adds waiter for duplicate requestId (queued)', async () => {
    const tabId = cp.createTab()
    cp.submitPrompt(tabId, 'req-active', makeRunOptions())
    await flush()

    // Queue a request
    const q1 = cp.submitPrompt(tabId, 'req-q', makeRunOptions())
    // Duplicate of queued request — different promise but linked
    const q2 = cp.submitPrompt(tabId, 'req-q', makeRunOptions())
    expect(q2).not.toBe(q1)

    // Both should reject together when tab is closed
    cp.closeTab(tabId)
    await expect(q1).rejects.toThrow('Tab closed')
    await expect(q2).rejects.toThrow('Tab closed')
  })

  // ── 10. submitPrompt with non-existent tab throws ──

  it('submitPrompt throws for non-existent tab', async () => {
    await expect(
      cp.submitPrompt('no-such-tab', 'req-1', makeRunOptions()),
    ).rejects.toThrow('does not exist')
  })

  // ── 11. submitPrompt uses stored sessionId for resume ──

  it('submitPrompt uses stored sessionId for resume', async () => {
    const tabId = cp.createTab()

    // Simulate a first run that sets the sessionId via normalized session_init
    cp.submitPrompt(tabId, 'req-1', makeRunOptions())
    await flush()

    // Fire session_init to set claudeSessionId on the tab
    const initEvent: NormalizedEvent = {
      type: 'session_init',
      sessionId: 'sess-abc',
      tools: [],
      model: 'claude-4',
      mcpServers: [],
      skills: [],
      version: '2.0',
    }
    runManagerHandlers()['normalized']('req-1', initEvent)

    // Complete the first run
    runManagerHandlers()['exit']('req-1', 0, null, 'sess-abc')
    await flush()

    // Second submitPrompt should inject the stored sessionId
    cp.submitPrompt(tabId, 'req-2', makeRunOptions())
    await flush()

    expect(mockRunManager.startRun).toHaveBeenCalledWith('req-2', expect.objectContaining({
      sessionId: 'sess-abc',
    }))
  })

  // ── 12. Queue processing on exit ──

  it('processes queued request after active run exits', async () => {
    const tabId = cp.createTab()
    cp.submitPrompt(tabId, 'req-1', makeRunOptions())
    await flush()

    // Queue a second request
    cp.submitPrompt(tabId, 'req-2', makeRunOptions())
    expect(mockRunManager.startRun).toHaveBeenCalledTimes(1)

    // Simulate first run exit
    runManagerHandlers()['exit']('req-1', 0, null, null)
    await flush()

    // Now req-2 should have been dispatched
    expect(mockRunManager.startRun).toHaveBeenCalledTimes(2)
    expect(mockRunManager.startRun).toHaveBeenCalledWith('req-2', expect.any(Object))
  })

  // ── 13. Status transition: connecting → running on session_init ──

  it('transitions from connecting to running on session_init', async () => {
    const tabId = cp.createTab()
    const statusChanges: [string, string][] = []
    cp.on('tab-status-change', (tid: string, newS: string, oldS: string) => {
      if (tid === tabId) statusChanges.push([oldS, newS])
    })

    cp.submitPrompt(tabId, 'req-1', makeRunOptions())
    await flush()

    // Status should be connecting
    expect(cp.getTabStatus(tabId)!.status).toBe('connecting')

    // Fire session_init
    runManagerHandlers()['normalized']('req-1', {
      type: 'session_init',
      sessionId: 'sess-1',
      tools: [],
      model: 'claude-4',
      mcpServers: [],
      skills: [],
      version: '2.0',
    } as NormalizedEvent)

    expect(cp.getTabStatus(tabId)!.status).toBe('running')
    expect(statusChanges).toContainEqual(['connecting', 'running'])
  })

  // ── 14. Status transition: running → completed on exit code 0 ──

  it('transitions to completed on exit code 0', async () => {
    const tabId = cp.createTab()
    cp.submitPrompt(tabId, 'req-1', makeRunOptions())
    await flush()

    runManagerHandlers()['exit']('req-1', 0, null, null)

    expect(cp.getTabStatus(tabId)!.status).toBe('completed')
  })

  // ── 15. Status transition: running → failed on SIGINT ──

  it('transitions to failed on SIGINT signal', async () => {
    const tabId = cp.createTab()
    cp.submitPrompt(tabId, 'req-1', makeRunOptions())
    await flush()

    runManagerHandlers()['exit']('req-1', null, 'SIGINT', null)

    expect(cp.getTabStatus(tabId)!.status).toBe('failed')
  })

  // ── 16. Status transition: running → dead on unexpected exit ──

  it('transitions to dead on unexpected null exit code', async () => {
    const tabId = cp.createTab()
    cp.on('error', () => {}) // Prevent EventEmitter unhandled error throw
    cp.submitPrompt(tabId, 'req-1', makeRunOptions())
    await flush()

    runManagerHandlers()['exit']('req-1', null, null, null)

    expect(cp.getTabStatus(tabId)!.status).toBe('dead')
  })

  it('transitions to failed on non-zero non-signal exit', async () => {
    const tabId = cp.createTab()
    cp.on('error', () => {}) // Prevent EventEmitter unhandled error throw
    cp.submitPrompt(tabId, 'req-1', makeRunOptions())
    await flush()

    runManagerHandlers()['exit']('req-1', 1, null, null)

    expect(cp.getTabStatus(tabId)!.status).toBe('failed')
  })

  // ── 17. Error event emits enriched error ──

  it('emits enriched error on RunManager error event', async () => {
    const tabId = cp.createTab()
    cp.submitPrompt(tabId, 'req-1', makeRunOptions())
    await flush()

    const errors: any[] = []
    cp.on('error', (tid: string, enriched: any) => {
      if (tid === tabId) errors.push(enriched)
    })

    runManagerHandlers()['error']('req-1', new Error('boom'))

    expect(errors).toHaveLength(1)
    expect(errors[0].message).toBe('boom')
    expect(cp.getTabStatus(tabId)!.status).toBe('dead')
  })

  // ── 18. initSession sends warmup prompt ──

  it('initSession sends warmup prompt with "hi"', async () => {
    const tabId = cp.createTab()
    cp.initSession(tabId)
    await flush()

    expect(mockRunManager.startRun).toHaveBeenCalledWith(
      `init-${tabId}`,
      expect.objectContaining({
        prompt: 'hi',
        maxTurns: 1,
      }),
    )
  })

  // ── 19. initSession skips if already warm ──

  it('initSession skips if claudeSessionId already set', async () => {
    const tabId = cp.createTab()

    // Manually inject sessionId to simulate warm state
    const entry = cp.getTabStatus(tabId)!
    ;(entry as any).claudeSessionId = 'sess-warm'
    // Need to set it through the actual tab map — getTabStatus returns the reference
    // so mutating it directly works since Map stores by reference.

    cp.initSession(tabId)
    await flush()

    // startRun should not have been called
    expect(mockRunManager.startRun).not.toHaveBeenCalled()
  })

  it('initSession skips duplicate init if already in progress', async () => {
    const tabId = cp.createTab()
    cp.initSession(tabId)
    await flush()

    cp.initSession(tabId)
    await flush()

    // startRun called only once
    expect(mockRunManager.startRun).toHaveBeenCalledTimes(1)
  })

  // ── 20. cancel removes from queue ──

  it('cancel removes request from queue and rejects it', async () => {
    const tabId = cp.createTab()
    cp.submitPrompt(tabId, 'req-active', makeRunOptions())
    await flush()

    const queued = cp.submitPrompt(tabId, 'req-queued', makeRunOptions())
    const result = cp.cancel('req-queued')

    expect(result).toBe(true)
    await expect(queued).rejects.toThrow('cancelled')
  })

  // ── 21. cancel delegates to RunManager for active run ──

  it('cancel delegates to RunManager for active run', async () => {
    const tabId = cp.createTab()
    cp.submitPrompt(tabId, 'req-active', makeRunOptions())
    await flush()

    cp.cancel('req-active')
    expect(mockRunManager.cancel).toHaveBeenCalledWith('req-active')
  })

  // ── 22. getHealth returns tab entries and queue depth ──

  it('getHealth returns correct structure', async () => {
    const tabId = cp.createTab()
    cp.submitPrompt(tabId, 'req-1', makeRunOptions())
    await flush()

    cp.submitPrompt(tabId, 'req-q1', makeRunOptions())

    const health = cp.getHealth()
    expect(health.tabs).toHaveLength(1)
    expect(health.tabs[0]).toMatchObject({
      tabId,
      status: 'connecting',
      activeRequestId: 'req-1',
      claudeSessionId: null,
      alive: false, // isRunning mock returns false
    })
    expect(health.queueDepth).toBe(1)
  })

  // ── 23. setPermissionMode changes mode ──

  it('setPermissionMode auto-approves permission requests', async () => {
    const tabId = cp.createTab()
    cp.setPermissionMode('auto')

    // Trigger permission-request from the captured permission server handler
    const permHandler = permissionServerHandlers()['permission-request']
    expect(permHandler).toBeDefined()

    permHandler('q-1', { tool_name: 'bash', tool_input: {} }, tabId, [
      { id: 'allow', label: 'Allow' },
    ])

    expect(mockPermissionServer.respondToPermission).toHaveBeenCalledWith(
      'q-1', 'allow', 'Auto mode',
    )
  })

  // ── 24. resetTabSession clears sessionId ──

  it('resetTabSession clears claudeSessionId', async () => {
    const tabId = cp.createTab()
    // Set up a session
    cp.submitPrompt(tabId, 'req-1', makeRunOptions())
    await flush()

    runManagerHandlers()['normalized']('req-1', {
      type: 'session_init',
      sessionId: 'sess-to-clear',
      tools: [],
      model: 'claude-4',
      mcpServers: [],
      skills: [],
      version: '2.0',
    } as NormalizedEvent)

    expect(cp.getTabStatus(tabId)!.claudeSessionId).toBe('sess-to-clear')

    cp.resetTabSession(tabId)
    expect(cp.getTabStatus(tabId)!.claudeSessionId).toBeNull()
  })

  // ── 25. respondToPermission routes hook- prefix to PermissionServer ──

  it('respondToPermission routes hook- prefix to PermissionServer', () => {
    const tabId = cp.createTab()
    const result = cp.respondToPermission(tabId, 'hook-q-123', 'allow')

    expect(mockPermissionServer.respondToPermission).toHaveBeenCalledWith(
      'hook-q-123', 'allow',
    )
    expect(result).toBe(true)
  })

  // ── 26. respondToPermission routes to RunManager.writeToStdin ──

  it('respondToPermission routes non-hook to RunManager.writeToStdin', async () => {
    const tabId = cp.createTab()
    cp.submitPrompt(tabId, 'req-1', makeRunOptions())
    await flush()

    const result = cp.respondToPermission(tabId, 'perm-q-456', 'allow')

    expect(mockRunManager.writeToStdin).toHaveBeenCalledWith('req-1', {
      type: 'permission_response',
      question_id: 'perm-q-456',
      option_id: 'allow',
    })
    expect(result).toBe(true)
  })

  // ── 27. shutdown stops everything ──

  it('shutdown stops permission server and closes all tabs', async () => {
    const tabA = cp.createTab()
    const tabB = cp.createTab()

    cp.shutdown()

    expect(mockPermissionServer.stop).toHaveBeenCalled()
    expect(cp.getTabStatus(tabA)).toBeUndefined()
    expect(cp.getTabStatus(tabB)).toBeUndefined()
  })

  // ── Additional edge cases ──

  it('permission-request for closed tab auto-denies', () => {
    const permHandler = permissionServerHandlers()['permission-request']
    expect(permHandler).toBeDefined()

    // Use a tabId that was never created
    permHandler('q-orphan', { tool_name: 'bash' }, 'nonexistent-tab', [])

    expect(mockPermissionServer.respondToPermission).toHaveBeenCalledWith(
      'q-orphan', 'deny', 'Tab closed',
    )
  })

  it('exit event stores sessionId on tab', async () => {
    const tabId = cp.createTab()
    cp.submitPrompt(tabId, 'req-1', makeRunOptions())
    await flush()

    runManagerHandlers()['exit']('req-1', 0, null, 'sess-from-exit')

    expect(cp.getTabStatus(tabId)!.claudeSessionId).toBe('sess-from-exit')
  })

  it('respondToPermission returns false when tab has no active request', () => {
    const tabId = cp.createTab()
    const result = cp.respondToPermission(tabId, 'perm-q', 'allow')
    expect(result).toBe(false)
  })

  it('closeTab is safe to call on non-existent tab', () => {
    expect(() => cp.closeTab('no-such-tab')).not.toThrow()
  })

  it('exit event unregisters run token from permission server', async () => {
    const tabId = cp.createTab()
    cp.submitPrompt(tabId, 'req-1', makeRunOptions())
    await flush()

    runManagerHandlers()['exit']('req-1', 0, null, null)

    expect(mockPermissionServer.unregisterRun).toHaveBeenCalledWith('token-123')
  })

  it('error event unregisters run token from permission server', async () => {
    const tabId = cp.createTab()
    cp.on('error', () => {}) // Prevent EventEmitter unhandled error throw
    cp.submitPrompt(tabId, 'req-1', makeRunOptions())
    await flush()

    runManagerHandlers()['error']('req-1', new Error('crash'))

    expect(mockPermissionServer.unregisterRun).toHaveBeenCalledWith('token-123')
  })

  it('normalized events from init requests are suppressed (except session_init)', async () => {
    const tabId = cp.createTab()
    cp.initSession(tabId)
    await flush()

    const events: any[] = []
    cp.on('event', (_tid: string, ev: any) => events.push(ev))

    const initReqId = `init-${tabId}`

    // session_init should emit with isWarmup flag
    runManagerHandlers()['normalized'](initReqId, {
      type: 'session_init',
      sessionId: 'sess-warmup',
      tools: [],
      model: 'claude-4',
      mcpServers: [],
      skills: [],
      version: '2.0',
    } as NormalizedEvent)

    expect(events).toHaveLength(1)
    expect(events[0].isWarmup).toBe(true)

    // Other events from init request should be suppressed
    runManagerHandlers()['normalized'](initReqId, {
      type: 'text_chunk',
      text: 'should be hidden',
    } as NormalizedEvent)

    expect(events).toHaveLength(1) // still 1
  })

  it('status transitions to running immediately when tab already has sessionId', async () => {
    const tabId = cp.createTab()

    // First run: establish session
    cp.submitPrompt(tabId, 'req-1', makeRunOptions())
    await flush()

    runManagerHandlers()['normalized']('req-1', {
      type: 'session_init',
      sessionId: 'sess-established',
      tools: [],
      model: 'claude-4',
      mcpServers: [],
      skills: [],
      version: '2.0',
    } as NormalizedEvent)
    runManagerHandlers()['exit']('req-1', 0, null, 'sess-established')
    await flush()

    // Second run: should start as 'running' not 'connecting'
    cp.submitPrompt(tabId, 'req-2', makeRunOptions())
    await flush()

    expect(cp.getTabStatus(tabId)!.status).toBe('running')
  })
})
