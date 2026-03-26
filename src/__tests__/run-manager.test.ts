// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { EventEmitter } from 'events'

// ─── Mocks ───

vi.mock('child_process', () => ({
  spawn: vi.fn(),
  execSync: vi.fn(() => '/usr/local/bin/claude'),
}))

vi.mock('../main/logger', () => ({
  log: vi.fn(),
}))

vi.mock('../main/cli-env', () => ({
  getCliEnv: () => ({ ...process.env }),
}))

import { spawn } from 'child_process'
import { RunManager } from '../main/claude/run-manager'
import type { RunOptions, NormalizedEvent, ClaudeEvent } from '../shared/types'

// ─── Mock ChildProcess helper ───

interface MockStdin {
  write: ReturnType<typeof vi.fn>
  end: ReturnType<typeof vi.fn>
  destroyed: boolean
}

interface MockChildProcess extends EventEmitter {
  stdout: EventEmitter & { setEncoding: ReturnType<typeof vi.fn> }
  stderr: EventEmitter & { setEncoding: ReturnType<typeof vi.fn> }
  stdin: MockStdin
  kill: ReturnType<typeof vi.fn>
  pid: number
  exitCode: number | null
}

function createMockProcess(): MockChildProcess {
  const child = new EventEmitter() as MockChildProcess
  child.stdout = Object.assign(new EventEmitter(), {
    setEncoding: vi.fn(),
  })
  child.stderr = Object.assign(new EventEmitter(), {
    setEncoding: vi.fn(),
  })
  child.stdin = {
    write: vi.fn(),
    end: vi.fn(),
    destroyed: false,
  }
  child.kill = vi.fn()
  child.pid = 12345
  child.exitCode = null
  return child
}

// ─── Default RunOptions ───

function defaultOptions(overrides: Partial<RunOptions> = {}): RunOptions {
  return {
    prompt: 'Hello, world!',
    projectPath: '/tmp/test-project',
    ...overrides,
  }
}

// ─── Tests ───

describe('RunManager', () => {
  let manager: RunManager
  let mockChild: MockChildProcess

  beforeEach(() => {
    vi.clearAllMocks()
    mockChild = createMockProcess()
    vi.mocked(spawn).mockReturnValue(mockChild as any)
    manager = new RunManager()
  })

  afterEach(() => {
    manager.removeAllListeners()
  })

  // 1. startRun builds correct args
  it('startRun builds correct args', () => {
    manager.startRun('req-1', defaultOptions())

    expect(spawn).toHaveBeenCalledOnce()
    const [binary, args] = vi.mocked(spawn).mock.calls[0]
    expect(binary).toBe('/usr/local/bin/claude')
    expect(args).toContain('-p')
    expect(args).toContain('--input-format')
    expect(args).toContain('stream-json')
    expect(args).toContain('--output-format')
    expect(args).toContain('--verbose')
    expect(args).toContain('--include-partial-messages')
    expect(args).toContain('--permission-mode')
    expect(args).toContain('default')
  })

  // 2. startRun with sessionId adds --resume
  it('startRun with sessionId adds --resume', () => {
    manager.startRun('req-2', defaultOptions({ sessionId: 'sess-abc' }))

    const args = vi.mocked(spawn).mock.calls[0][1] as string[]
    const resumeIdx = args.indexOf('--resume')
    expect(resumeIdx).toBeGreaterThan(-1)
    expect(args[resumeIdx + 1]).toBe('sess-abc')
  })

  // 3. startRun with model adds --model
  it('startRun with model adds --model', () => {
    manager.startRun('req-3', defaultOptions({ model: 'claude-sonnet-4-20250514' }))

    const args = vi.mocked(spawn).mock.calls[0][1] as string[]
    const modelIdx = args.indexOf('--model')
    expect(modelIdx).toBeGreaterThan(-1)
    expect(args[modelIdx + 1]).toBe('claude-sonnet-4-20250514')
  })

  // 4. startRun with addDirs adds --add-dir flags
  it('startRun with addDirs adds --add-dir flags', () => {
    manager.startRun('req-4', defaultOptions({ addDirs: ['/foo', '/bar'] }))

    const args = vi.mocked(spawn).mock.calls[0][1] as string[]
    const addDirIndices = args.reduce<number[]>((acc, arg, i) => {
      if (arg === '--add-dir') acc.push(i)
      return acc
    }, [])
    expect(addDirIndices).toHaveLength(2)
    expect(args[addDirIndices[0] + 1]).toBe('/foo')
    expect(args[addDirIndices[1] + 1]).toBe('/bar')
  })

  // 5. startRun with hookSettingsPath adds --settings and only safe tools
  it('startRun with hookSettingsPath adds --settings and only safe tools in --allowedTools', () => {
    manager.startRun('req-5', defaultOptions({ hookSettingsPath: '/tmp/settings.json' }))

    const args = vi.mocked(spawn).mock.calls[0][1] as string[]
    const settingsIdx = args.indexOf('--settings')
    expect(settingsIdx).toBeGreaterThan(-1)
    expect(args[settingsIdx + 1]).toBe('/tmp/settings.json')

    const allowedIdx = args.indexOf('--allowedTools')
    expect(allowedIdx).toBeGreaterThan(-1)
    const allowedStr = args[allowedIdx + 1]
    // When hookSettingsPath is set, dangerous tools (Bash, Edit, Write, MultiEdit) should NOT be in allowedTools
    const allowedTools = allowedStr.split(',')
    expect(allowedTools).not.toContain('Bash')
    expect(allowedTools).not.toContain('Edit')
    expect(allowedTools).not.toContain('Write')
    expect(allowedTools).not.toContain('MultiEdit')
    // Safe tools should be present
    expect(allowedTools).toContain('Read')
    expect(allowedTools).toContain('Glob')
    expect(allowedTools).toContain('Grep')
    expect(allowedTools).toContain('WebSearch')
    expect(allowedTools).toContain('Agent')
  })

  // 6. startRun without hookSettingsPath uses DEFAULT_ALLOWED_TOOLS
  it('startRun without hookSettingsPath uses DEFAULT_ALLOWED_TOOLS', () => {
    manager.startRun('req-6', defaultOptions())

    const args = vi.mocked(spawn).mock.calls[0][1] as string[]
    const allowedIdx = args.indexOf('--allowedTools')
    expect(allowedIdx).toBeGreaterThan(-1)
    const allowedStr = args[allowedIdx + 1]
    // All tools should be present including dangerous ones
    expect(allowedStr).toContain('Bash')
    expect(allowedStr).toContain('Edit')
    expect(allowedStr).toContain('Write')
    expect(allowedStr).toContain('MultiEdit')
    expect(allowedStr).toContain('Read')
    expect(allowedStr).toContain('Glob')
    expect(allowedStr).toContain('Grep')
  })

  // 7. startRun writes prompt to stdin
  it('startRun writes prompt to stdin as JSON user message', () => {
    manager.startRun('req-7', defaultOptions({ prompt: 'Test prompt' }))

    expect(mockChild.stdin.write).toHaveBeenCalledOnce()
    const written = mockChild.stdin.write.mock.calls[0][0] as string
    expect(written).toContain('\n')
    const parsed = JSON.parse(written.trim())
    expect(parsed.type).toBe('user')
    expect(parsed.message.role).toBe('user')
    expect(parsed.message.content[0].type).toBe('text')
    expect(parsed.message.content[0].text).toBe('Test prompt')
  })

  // 8. startRun returns RunHandle with correct fields
  it('startRun returns RunHandle with correct fields', () => {
    const handle = manager.startRun('req-8', defaultOptions())

    expect(handle.runId).toBe('req-8')
    expect(handle.pid).toBe(12345)
    expect(handle.startedAt).toBeGreaterThan(0)
    expect(handle.stderrTail).toEqual([])
    expect(handle.stdoutTail).toEqual([])
    expect(handle.toolCallCount).toBe(0)
    expect(handle.sawPermissionRequest).toBe(false)
    expect(handle.permissionDenials).toEqual([])
    expect(handle.sessionId).toBeNull()
  })

  // 9. NDJSON events flow through normalize and emit
  it('NDJSON events flow through normalize and emit', async () => {
    manager.startRun('req-9', defaultOptions())

    const normalizedEvents: NormalizedEvent[] = []
    manager.on('normalized', (_runId: string, evt: NormalizedEvent) => {
      normalizedEvents.push(evt)
    })

    const rawEvents: ClaudeEvent[] = []
    manager.on('raw', (_runId: string, evt: ClaudeEvent) => {
      rawEvents.push(evt)
    })

    // Push a system init event as NDJSON through mock stdout
    const initEvent = JSON.stringify({
      type: 'system',
      subtype: 'init',
      session_id: 'sess-123',
      cwd: '/tmp',
      tools: ['Read', 'Edit'],
      mcp_servers: [],
      model: 'claude-sonnet-4-20250514',
      permissionMode: 'default',
      agents: [],
      skills: [],
      plugins: [],
      claude_code_version: '2.1.63',
      fast_mode_state: 'off',
      uuid: 'uuid-1',
    })
    mockChild.stdout.emit('data', initEvent + '\n')

    // Wait for synchronous processing
    await vi.waitFor(() => {
      expect(rawEvents).toHaveLength(1)
    })

    expect(rawEvents[0].type).toBe('system')
    expect(normalizedEvents).toHaveLength(1)
    expect(normalizedEvents[0].type).toBe('session_init')
  })

  // 10. stderr data fills ring buffer
  it('stderr data fills ring buffer', () => {
    const handle = manager.startRun('req-10', defaultOptions())

    mockChild.stderr.emit('data', 'warning: something happened\n')
    mockChild.stderr.emit('data', 'error: critical failure\n')

    expect(handle.stderrTail).toHaveLength(2)
    expect(handle.stderrTail[0]).toBe('warning: something happened')
    expect(handle.stderrTail[1]).toBe('error: critical failure')
  })

  // 11. Ring buffer overflow — only last 100 lines kept
  it('ring buffer overflow keeps only last 100 lines', () => {
    const handle = manager.startRun('req-11', defaultOptions())

    for (let i = 0; i < 120; i++) {
      mockChild.stderr.emit('data', `line-${i}\n`)
    }

    expect(handle.stderrTail).toHaveLength(100)
    // First line should be line-20 (lines 0-19 were shifted out)
    expect(handle.stderrTail[0]).toBe('line-20')
    expect(handle.stderrTail[99]).toBe('line-119')
  })

  // 12. Process close emits exit event
  it('process close emits exit event', () => {
    const handle = manager.startRun('req-12', defaultOptions())

    const exitEvents: Array<{ runId: string; code: number | null; signal: string | null; sessionId: string | null }> = []
    manager.on('exit', (runId, code, signal, sessionId) => {
      exitEvents.push({ runId, code, signal, sessionId })
    })

    // Simulate sessionId being set by an init event
    handle.sessionId = 'sess-xyz'

    mockChild.emit('close', 0, null)

    expect(exitEvents).toHaveLength(1)
    expect(exitEvents[0].runId).toBe('req-12')
    expect(exitEvents[0].code).toBe(0)
    expect(exitEvents[0].signal).toBeNull()
    expect(exitEvents[0].sessionId).toBe('sess-xyz')
  })

  // 13. Process close moves handle to finishedRuns
  it('process close moves handle to finishedRuns — isRunning false but getEnrichedError works', () => {
    manager.startRun('req-13', defaultOptions())

    expect(manager.isRunning('req-13')).toBe(true)

    mockChild.emit('close', 1, null)

    expect(manager.isRunning('req-13')).toBe(false)
    expect(manager.getHandle('req-13')).toBeUndefined()

    // getEnrichedError should still return diagnostics from the finished run
    const enriched = manager.getEnrichedError('req-13', 1)
    expect(enriched.message).toContain('exit code 1')
    expect(enriched.exitCode).toBe(1)
  })

  // 14. Process error emits error event
  it('process error emits error event', () => {
    manager.startRun('req-14', defaultOptions())

    const errorEvents: Array<{ runId: string; error: Error }> = []
    manager.on('error', (runId, err) => {
      errorEvents.push({ runId, error: err })
    })

    const err = new Error('ENOENT: spawn failed')
    mockChild.emit('error', err)

    expect(errorEvents).toHaveLength(1)
    expect(errorEvents[0].runId).toBe('req-14')
    expect(errorEvents[0].error.message).toBe('ENOENT: spawn failed')

    // Handle moved to finishedRuns
    expect(manager.isRunning('req-14')).toBe(false)
  })

  // 15. cancel sends SIGINT
  it('cancel sends SIGINT', () => {
    manager.startRun('req-15', defaultOptions())

    const result = manager.cancel('req-15')

    expect(result).toBe(true)
    expect(mockChild.kill).toHaveBeenCalledWith('SIGINT')
  })

  // 16. cancel SIGKILL fallback after 5s
  it('cancel sends SIGKILL after 5s if process has not exited', () => {
    vi.useFakeTimers()

    try {
      manager.startRun('req-16', defaultOptions())

      manager.cancel('req-16')
      expect(mockChild.kill).toHaveBeenCalledWith('SIGINT')

      // Process hasn't exited: exitCode is still null
      mockChild.exitCode = null

      vi.advanceTimersByTime(5000)

      expect(mockChild.kill).toHaveBeenCalledWith('SIGKILL')
    } finally {
      vi.useRealTimers()
    }
  })

  // 16b. cancel SIGKILL is NOT sent if process already exited
  it('cancel does not send SIGKILL if process already exited', () => {
    vi.useFakeTimers()

    try {
      manager.startRun('req-16b', defaultOptions())

      manager.cancel('req-16b')
      expect(mockChild.kill).toHaveBeenCalledWith('SIGINT')

      // Process exited before the 5s timeout
      mockChild.exitCode = 0

      vi.advanceTimersByTime(5000)

      // kill should only have been called once (SIGINT), no SIGKILL
      expect(mockChild.kill).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  // 17. writeToStdin writes JSON
  it('writeToStdin writes JSON message to stdin', () => {
    manager.startRun('req-17', defaultOptions())

    // Clear the initial prompt write
    mockChild.stdin.write.mockClear()

    const message = { type: 'user', message: { role: 'user', content: [{ type: 'text', text: 'follow-up' }] } }
    const result = manager.writeToStdin('req-17', message)

    expect(result).toBe(true)
    expect(mockChild.stdin.write).toHaveBeenCalledOnce()
    const written = mockChild.stdin.write.mock.calls[0][0] as string
    expect(written).toContain('\n')
    const parsed = JSON.parse(written.trim())
    expect(parsed.type).toBe('user')
    expect(parsed.message.content[0].text).toBe('follow-up')
  })

  // 18. writeToStdin returns false for unknown requestId
  it('writeToStdin returns false for unknown requestId', () => {
    const result = manager.writeToStdin('nonexistent', { type: 'user', message: 'test' })
    expect(result).toBe(false)
  })

  // 19. getEnrichedError returns diagnostics
  it('getEnrichedError returns diagnostics with correct fields', () => {
    const handle = manager.startRun('req-19', defaultOptions())

    // Push some stderr data
    mockChild.stderr.emit('data', 'some error output\n')
    handle.toolCallCount = 3
    handle.sawPermissionRequest = true
    handle.permissionDenials = [{ tool_name: 'Bash', tool_use_id: 'tu-1' }]

    const enriched = manager.getEnrichedError('req-19', 2)

    expect(enriched.message).toContain('exit code 2')
    expect(enriched.exitCode).toBe(2)
    expect(enriched.stderrTail).toContain('some error output')
    expect(enriched.elapsedMs).toBeGreaterThanOrEqual(0)
    expect(enriched.toolCallCount).toBe(3)
    expect(enriched.sawPermissionRequest).toBe(true)
    expect(enriched.permissionDenials).toEqual([{ tool_name: 'Bash', tool_use_id: 'tu-1' }])
  })

  // 20. getActiveRunIds returns active run IDs
  it('getActiveRunIds returns active run IDs', () => {
    // Need a fresh mock for each startRun call
    const child1 = createMockProcess()
    const child2 = createMockProcess()
    child2.pid = 54321

    vi.mocked(spawn)
      .mockReturnValueOnce(child1 as any)
      .mockReturnValueOnce(child2 as any)

    // Re-create manager to pick up fresh mocks
    const mgr = new RunManager()
    mgr.startRun('run-a', defaultOptions())
    mgr.startRun('run-b', defaultOptions())

    const ids = mgr.getActiveRunIds()
    expect(ids).toContain('run-a')
    expect(ids).toContain('run-b')
    expect(ids).toHaveLength(2)

    mgr.removeAllListeners()
  })

  // 21. parse-error events are logged to stderrTail
  it('parse-error events are logged to stderrTail', () => {
    const handle = manager.startRun('req-21', defaultOptions())

    // Push non-JSON to stdout — StreamParser will emit 'parse-error'
    mockChild.stdout.emit('data', 'this is not valid json\n')

    // The parse-error handler pushes to stderrTail with [parse-error] prefix
    expect(handle.stderrTail.some((line) => line.includes('[parse-error]'))).toBe(true)
    expect(handle.stderrTail.some((line) => line.includes('this is not valid json'))).toBe(true)
  })

  // Additional edge case: cancel returns false for unknown requestId
  it('cancel returns false for unknown requestId', () => {
    const result = manager.cancel('nonexistent')
    expect(result).toBe(false)
  })

  // Additional edge case: getHandle returns the active handle
  it('getHandle returns active handle', () => {
    const handle = manager.startRun('req-get', defaultOptions())
    expect(manager.getHandle('req-get')).toBe(handle)
  })

  // Additional edge case: session_id extracted from init event
  it('session_id is extracted from system init event', () => {
    const handle = manager.startRun('req-sid', defaultOptions())
    expect(handle.sessionId).toBeNull()

    const initEvent = JSON.stringify({
      type: 'system',
      subtype: 'init',
      session_id: 'extracted-session-id',
      cwd: '/tmp',
      tools: [],
      mcp_servers: [],
      model: 'claude-sonnet-4-20250514',
      permissionMode: 'default',
      agents: [],
      skills: [],
      plugins: [],
      claude_code_version: '2.1.63',
      fast_mode_state: 'off',
      uuid: 'uuid-2',
    })
    mockChild.stdout.emit('data', initEvent + '\n')

    expect(handle.sessionId).toBe('extracted-session-id')
  })

  // Additional edge case: result event closes stdin
  it('result event closes stdin', () => {
    manager.startRun('req-result', defaultOptions())

    const resultEvent = JSON.stringify({
      type: 'result',
      subtype: 'success',
      is_error: false,
      duration_ms: 1000,
      num_turns: 1,
      result: 'Done.',
      total_cost_usd: 0.01,
      session_id: 'sess-r',
      usage: {},
      permission_denials: [],
      uuid: 'uuid-r',
    })
    mockChild.stdout.emit('data', resultEvent + '\n')

    expect(mockChild.stdin.end).toHaveBeenCalled()
  })

  // Additional edge case: writeToStdin returns false when stdin is destroyed
  it('writeToStdin returns false when stdin is destroyed', () => {
    manager.startRun('req-destroyed', defaultOptions())
    mockChild.stdin.destroyed = true

    const result = manager.writeToStdin('req-destroyed', { type: 'user', message: 'test' })
    expect(result).toBe(false)
  })
})
