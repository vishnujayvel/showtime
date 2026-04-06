import { spawn, execSync, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import { homedir } from 'os'
import { join } from 'path'
import { existsSync, mkdirSync, createWriteStream, readFileSync } from 'fs'
import type { WriteStream } from 'fs'
import { StreamParser } from '../stream-parser'
import { normalize } from './event-normalizer'
import { log as _log } from '../logger'
import { getCliEnv } from '../cli-env'
import { appLog } from '../app-logger'
import type { ClaudeEvent, NormalizedEvent, RunOptions, EnrichedError, ResultEvent, InitEvent } from '../../shared/types'

const MAX_RING_LINES = 100
const DEBUG = process.env.CLUI_DEBUG === '1'

// ─── VCR Cassette Mode ───
const VCR_RECORD = !!process.env.SHOWTIME_RECORD
const VCR_PLAYBACK = !!process.env.SHOWTIME_PLAYBACK
const VCR_PLAYBACK_SPEED = Number(process.env.SHOWTIME_PLAYBACK_SPEED) || 1
const CASSETTE_DIR = process.env.SHOWTIME_CASSETTE_DIR || join(process.cwd(), 'e2e', 'cassettes')
// Comma-separated queue of cassette names for playback (without .ndjson extension).
// Each startRun in playback mode dequeues the next name from this list.
const VCR_CASSETTE_QUEUE: string[] | null = process.env.SHOWTIME_CASSETTE_NAME
  ? process.env.SHOWTIME_CASSETTE_NAME.split(',').map(s => s.trim()).filter(Boolean)
  : null

// ─── Showtime System Prompt ───
// Replaces the old CLUI_SYSTEM_HINT with a unified identity prompt.
// Reads SKILL.md from disk, strips YAML frontmatter and DB section,
// prepends Showtime-specific UI rendering hints.

export function buildShowtimeSystemPrompt(): string {
  const uiHints = [
    'You are the Showtime Director — an ADHD-friendly day-planning companion',
    'running inside Showtime, a macOS desktop app with a rich chat UI.',
    '',
    'UI rendering:',
    '- The app renders full markdown: tables, bold, headers, bullet lists, code blocks.',
    '- Use rich formatting when presenting lineups, verdicts, and beat checks.',
    '- Clickable markdown links render as real buttons.',
    '',
    'Behavioral contract:',
    '- When the user asks to build a lineup or plan their day, ALWAYS respond with',
    '  a ```showtime-lineup JSON code block. This is your primary output format.',
    '- Follow the SNL Day Framework: Shows, Acts, Beats, Sketches.',
    '- Never use guilt language. The show adapts to the performer.',
    '- You are NOT a software engineering assistant in this context.',
    '  You are a day-planning companion.',
  ].join('\n')

  // Resolution order: installed skill → __dirname-relative → dev cwd fallback
  // NOTE: The skill directory name is 'showtime' (matching src/skills/showtime/),
  // NOT 'showtime-director' (the YAML frontmatter name field).
  const candidates = [
    join(homedir(), '.claude/skills/showtime/SKILL.md'),
    join(__dirname, '../../skills/showtime/SKILL.md'),
    join(process.cwd(), 'src/skills/showtime/SKILL.md'),
  ]

  let skillContent = ''
  for (const candidate of candidates) {
    try {
      if (existsSync(candidate)) {
        const raw = readFileSync(candidate, 'utf-8')
        // Strip YAML frontmatter
        skillContent = raw.replace(/^---[\s\S]*?---\n/, '')
        // Strip Database Integration section (not runnable in subprocess)
        skillContent = skillContent.replace(
          /## Database Integration[\s\S]*?(?=\n## |$)/,
          ''
        )
        log(`Loaded skill from: ${candidate}`)
        break
      }
    } catch {
      // Try next candidate
    }
  }

  if (!skillContent) {
    log('WARNING: showtime SKILL.md not found at any candidate path, using minimal prompt')
  }

  return skillContent
    ? `${uiHints}\n\n${skillContent}`
    : uiHints
}

// In development: re-read on every call for hot-reload
// In production: cache at module load
const _cachedPrompt = buildShowtimeSystemPrompt()
const getShowtimeSystemPrompt = process.env.NODE_ENV === 'development'
  ? () => buildShowtimeSystemPrompt()
  : () => _cachedPrompt

// Tools auto-approved via --allowedTools (never trigger the permission card).
// Includes routine internal agent mechanics (Agent, Task, TaskOutput, TodoWrite,
// Notebook) — prompting for these would make UX terrible without adding meaningful
// safety. This is a deliberate CLUI policy choice, not native Claude parity.
// If runtime evidence shows any of these create real user-facing approval moments,
// they should be moved to the hook matcher in permission-server.ts instead.
const SAFE_TOOLS = [
  'Read', 'Glob', 'Grep', 'LS',
  'TodoRead', 'TodoWrite',
  'Agent', 'Task', 'TaskOutput',
  'Notebook',
  'WebSearch', 'WebFetch',
]

// All tools to pre-approve when NO hook server is available (fallback path).
// Includes safe + dangerous tools so nothing is silently denied.
const DEFAULT_ALLOWED_TOOLS = [
  'Bash', 'Edit', 'Write', 'MultiEdit',
  ...SAFE_TOOLS,
]

function log(msg: string): void {
  _log('RunManager', msg)
}

export interface RunHandle {
  runId: string
  sessionId: string | null
  process: ChildProcess
  pid: number | null
  startedAt: number
  /** Ring buffer of last N stderr lines */
  stderrTail: string[]
  /** Ring buffer of last N stdout lines */
  stdoutTail: string[]
  /** Count of tool calls seen during this run */
  toolCallCount: number
  /** Whether any permission_request event was seen during this run */
  sawPermissionRequest: boolean
  /** Permission denials from result event */
  permissionDenials: Array<{ tool_name: string; tool_use_id: string }>
}

/**
 * RunManager: spawns one `claude -p` process per run, parses NDJSON,
 * emits normalized events, handles cancel, and keeps diagnostic ring buffers.
 *
 * Events emitted:
 *  - 'normalized' (runId, NormalizedEvent)
 *  - 'raw' (runId, ClaudeEvent)  — for logging/debugging
 *  - 'exit' (runId, code, signal, sessionId)
 *  - 'error' (runId, Error)
 */
export class RunManager extends EventEmitter {
  private activeRuns = new Map<string, RunHandle>()
  /** Holds recently-finished runs so diagnostics survive past process exit */
  private _finishedRuns = new Map<string, RunHandle>()
  private claudeBinary: string
  /** Index into VCR_CASSETTE_QUEUE for round-robin cassette selection */
  private _cassetteQueueIdx = 0
  /** Pre-warmed subprocess waiting to be claimed */
  private _warmProcess: ChildProcess | null = null
  /** Timer that kills the warm process after 30s of idleness */
  private _warmTimeout: ReturnType<typeof setTimeout> | null = null

  constructor() {
    super()
    this.claudeBinary = this._findClaudeBinary()
    log(`Claude binary: ${this.claudeBinary}`)
  }

  /**
   * Pre-warm a Claude subprocess so it's ready when Writer's Room needs it.
   * The process is spawned with stream-json I/O and standard flags but no prompt.
   * It will be killed after 30s if not claimed via getWarmProcess().
   */
  preWarm(options?: { projectPath?: string; hookSettingsPath?: string; allowedTools?: string[] }): void {
    // Don't pre-warm during VCR playback
    if (VCR_PLAYBACK) return

    // Already have a warm process
    if (this._warmProcess && this._warmProcess.exitCode === null) {
      log('Pre-warm: already have a warm process, skipping')
      return
    }

    const cwd = options?.projectPath === '~' ? homedir() : (options?.projectPath || process.cwd())

    const args: string[] = [
      '-p',
      '--bare',
      '--input-format', 'stream-json',
      '--output-format', 'stream-json',
      '--verbose',
      '--include-partial-messages',
      '--permission-mode', 'default',
    ]

    if (options?.hookSettingsPath) {
      args.push('--settings', options.hookSettingsPath)
      const safeAllowed = [...SAFE_TOOLS, ...(options.allowedTools || [])]
      args.push('--allowedTools', safeAllowed.join(','))
    } else {
      const allAllowed = [...DEFAULT_ALLOWED_TOOLS, ...(options?.allowedTools || [])]
      args.push('--allowedTools', allAllowed.join(','))
    }

    args.push('--append-system-prompt', getShowtimeSystemPrompt())

    log(`Pre-warm: spawning warm subprocess in ${cwd}`)

    try {
      const child = spawn(this.claudeBinary, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd,
        env: this._getEnv(),
      })

      this._warmProcess = child
      log(`Pre-warm: spawned PID ${child.pid}`)

      // Kill after 30s if unclaimed
      this._warmTimeout = setTimeout(() => {
        this._killWarmProcess('timeout')
      }, 30_000)

      // Clean up if the process exits on its own
      child.on('close', () => {
        if (this._warmProcess === child) {
          log('Pre-warm: process exited on its own')
          this._warmProcess = null
          if (this._warmTimeout) {
            clearTimeout(this._warmTimeout)
            this._warmTimeout = null
          }
        }
      })

      child.on('error', (err) => {
        log(`Pre-warm: process error: ${err.message}`)
        if (this._warmProcess === child) {
          this._warmProcess = null
          if (this._warmTimeout) {
            clearTimeout(this._warmTimeout)
            this._warmTimeout = null
          }
        }
      })
    } catch (err) {
      log(`Pre-warm: failed to spawn: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  /**
   * Claim the pre-warmed process. Returns the ChildProcess if one is ready,
   * or null if no warm process is available.
   */
  getWarmProcess(): ChildProcess | null {
    const proc = this._warmProcess
    if (!proc || proc.exitCode !== null) {
      this._warmProcess = null
      return null
    }

    // Claim it
    this._warmProcess = null
    if (this._warmTimeout) {
      clearTimeout(this._warmTimeout)
      this._warmTimeout = null
    }

    log(`Pre-warm: claimed warm process PID ${proc.pid}`)
    return proc
  }

  private _killWarmProcess(reason: string): void {
    if (this._warmProcess && this._warmProcess.exitCode === null) {
      log(`Pre-warm: killing warm process (${reason})`)
      this._warmProcess.kill('SIGTERM')
    }
    this._warmProcess = null
    if (this._warmTimeout) {
      clearTimeout(this._warmTimeout)
      this._warmTimeout = null
    }
  }

  private _findClaudeBinary(): string {
    const candidates = [
      '/usr/local/bin/claude',
      '/opt/homebrew/bin/claude',
      join(homedir(), '.npm-global/bin/claude'),
    ]

    for (const c of candidates) {
      try {
        execSync(`test -x "${c}"`, { stdio: 'ignore' })
        return c
      } catch {}
    }

    try {
      return execSync('/bin/zsh -ilc "whence -p claude"', { encoding: 'utf-8', env: getCliEnv() }).trim()
    } catch {}

    try {
      return execSync('/bin/bash -lc "which claude"', { encoding: 'utf-8', env: getCliEnv() }).trim()
    } catch {}

    return 'claude'
  }

  private _getEnv(): NodeJS.ProcessEnv {
    const env = getCliEnv()
    const binDir = this.claudeBinary.substring(0, this.claudeBinary.lastIndexOf('/'))
    if (env.PATH && !env.PATH.includes(binDir)) {
      env.PATH = `${binDir}:${env.PATH}`
    }

    return env
  }

  startRun(requestId: string, options: RunOptions): RunHandle {
    // ─── VCR Playback: replay from cassette instead of spawning ───
    if (VCR_PLAYBACK) {
      log(`VCR PLAYBACK mode active — replaying cassette for ${requestId}`)
      return this._playbackFromCassette(requestId, options)
    }

    const cwd = options.projectPath === '~' ? homedir() : options.projectPath

    const args: string[] = [
      '-p',
      '--bare',
      '--input-format', 'stream-json',
      '--output-format', 'stream-json',
      '--verbose',
      '--include-partial-messages',
      '--permission-mode', 'default',
    ]

    if (options.sessionId) {
      args.push('--resume', options.sessionId)
    }
    if (options.model) {
      args.push('--model', options.model)
    }
    if (options.addDirs && options.addDirs.length > 0) {
      for (const dir of options.addDirs) {
        args.push('--add-dir', dir)
      }
    }

    if (options.hookSettingsPath) {
      // CLUI-scoped hook settings: the PreToolUse HTTP hook handles permissions
      // for dangerous tools (Bash, Edit, Write, MultiEdit).
      // Auto-approve safe tools so they don't trigger the permission card.
      args.push('--settings', options.hookSettingsPath)
      const safeAllowed = [
        ...SAFE_TOOLS,
        ...(options.allowedTools || []),
      ]
      args.push('--allowedTools', safeAllowed.join(','))
    } else {
      // Fallback: no hook server available.
      // Pre-approve common tools so they run without being silently denied.
      const allAllowed = [
        ...DEFAULT_ALLOWED_TOOLS,
        ...(options.allowedTools || []),
      ]
      args.push('--allowedTools', allAllowed.join(','))
    }
    if (options.maxTurns) {
      args.push('--max-turns', String(options.maxTurns))
    }
    if (options.maxBudgetUsd) {
      args.push('--max-budget-usd', String(options.maxBudgetUsd))
    }
    if (options.systemPrompt) {
      args.push('--system-prompt', options.systemPrompt)
    }
    // Always tell Claude it's inside CLUI (additive, doesn't replace base prompt)
    args.push('--append-system-prompt', getShowtimeSystemPrompt())

    if (DEBUG) {
      log(`Starting run ${requestId}: ${this.claudeBinary} ${args.join(' ')}`)
      log(`Prompt: ${options.prompt.substring(0, 200)}`)
    } else {
      log(`Starting run ${requestId}`)
    }

    // Try to claim a pre-warmed process (only for fresh runs, not resumes)
    let child: ChildProcess
    const warmChild = !options.sessionId ? this.getWarmProcess() : null
    if (warmChild) {
      child = warmChild
      log(`Reusing pre-warmed process PID: ${child.pid}`)
    } else {
      child = spawn(this.claudeBinary, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd,
        env: this._getEnv(),
      })
      log(`Spawned PID: ${child.pid}`)
    }

    const handle: RunHandle = {
      runId: requestId,
      sessionId: options.sessionId || null,
      process: child,
      pid: child.pid || null,
      startedAt: Date.now(),
      stderrTail: [],
      stdoutTail: [],
      toolCallCount: 0,
      sawPermissionRequest: false,
      permissionDenials: [],
    }

    // ─── VCR Record: set up cassette writer (no-op if not recording) ───
    const recorder = VCR_RECORD
      ? this._recordToCassette(requestId, handle.startedAt)
      : null

    // ─── stdout → NDJSON parser → normalizer → events ───
    const parser = StreamParser.fromStream(child.stdout!)

    parser.on('event', (raw: ClaudeEvent) => {
      // VCR Record: tee raw event to cassette (side-effect only)
      if (recorder) recorder.record(raw)

      this._processEvent(requestId, handle, raw)

      // Close stdin after result event — with stream-json input the process
      // stays alive waiting for more input; closing stdin triggers clean exit.
      if (raw.type === 'result') {
        log(`Run complete [${requestId}]: sawPermissionRequest=${handle.sawPermissionRequest}, denials=${handle.permissionDenials.length}`)
        try { child.stdin?.end() } catch {}
      }
    })

    parser.on('parse-error', (line: string) => {
      log(`Parse error [${requestId}]: ${line.substring(0, 200)}`)
      this._ringPush(handle.stderrTail, `[parse-error] ${line.substring(0, 200)}`)
    })

    // ─── stderr ring buffer ───
    child.stderr?.setEncoding('utf-8')
    child.stderr?.on('data', (data: string) => {
      const lines = data.split('\n').filter((l: string) => l.trim())
      for (const line of lines) {
        this._ringPush(handle.stderrTail, line)
      }
      log(`Stderr [${requestId}]: ${data.trim().substring(0, 500)}`)
    })

    // ─── Process lifecycle ───
    // Snapshot diagnostics BEFORE deleting the handle so callers can still read them.
    child.on('close', (code, signal) => {
      log(`Process closed [${requestId}]: code=${code} signal=${signal}`)
      // VCR Record: write exit event and close cassette file
      if (recorder) {
        recorder.recordExit(code, signal)
        recorder.end()
        log(`VCR RECORD: cassette finalized for ${requestId}`)
      }
      // Move handle to finished map so getEnrichedError still works after exit
      this._finishedRuns.set(requestId, handle)
      this.activeRuns.delete(requestId)
      this.emit('exit', requestId, code, signal, handle.sessionId)
      // Clean up finished run after a short delay (gives callers time to read diagnostics)
      setTimeout(() => this._finishedRuns.delete(requestId), 5000)
    })

    child.on('error', (err) => {
      log(`Process error [${requestId}]: ${err.message}`)
      // VCR Record: close cassette on process error
      if (recorder) {
        recorder.recordExit(null, 'ERROR')
        recorder.end()
      }
      this._finishedRuns.set(requestId, handle)
      this.activeRuns.delete(requestId)
      this.emit('error', requestId, err)
      setTimeout(() => this._finishedRuns.delete(requestId), 5000)
    })

    // ─── Write prompt to stdin (stream-json format, keep open) ───
    // Using --input-format stream-json for bidirectional communication.
    // Stdin stays open so follow-up messages can be sent.
    const userMessage = JSON.stringify({
      type: 'user',
      message: {
        role: 'user',
        content: [{ type: 'text', text: options.prompt }],
      },
    })
    child.stdin!.write(userMessage + '\n')

    this.activeRuns.set(requestId, handle)

    appLog('INFO', 'claude.session_start', {
      requestId,
      promptLength: options.prompt?.length,
      model: options.model,
    })

    return handle
  }

  /**
   * Write a message to a running process's stdin (for follow-up prompts, etc.)
   */
  writeToStdin(requestId: string, message: object): boolean {
    const handle = this.activeRuns.get(requestId)
    if (!handle) return false
    if (!handle.process.stdin || handle.process.stdin.destroyed) return false

    const json = JSON.stringify(message)
    log(`Writing to stdin [${requestId}]: ${json.substring(0, 200)}`)
    handle.process.stdin.write(json + '\n')
    return true
  }

  /**
   * Cancel a running process: SIGINT, then SIGKILL after 5s.
   */
  cancel(requestId: string): boolean {
    const handle = this.activeRuns.get(requestId)
    if (!handle) return false

    log(`Cancelling run ${requestId}`)
    handle.process.kill('SIGINT')

    // Fallback: SIGKILL if process hasn't exited after 5s.
    // Only check exitCode — process.killed is set true by the SIGINT call above,
    // so checking !killed would prevent the fallback from ever firing.
    setTimeout(() => {
      if (handle.process.exitCode === null) {
        log(`Force killing run ${requestId} (SIGINT did not terminate)`)
        handle.process.kill('SIGKILL')
      }
    }, 5000)

    return true
  }

  /**
   * Get an enriched error object for a failed run.
   */
  getEnrichedError(requestId: string, exitCode: number | null): EnrichedError {
    const handle = this.activeRuns.get(requestId) || this._finishedRuns.get(requestId)
    return {
      message: `Run failed with exit code ${exitCode}`,
      stderrTail: handle?.stderrTail.slice(-20) || [],
      stdoutTail: handle?.stdoutTail.slice(-20) || [],
      exitCode,
      elapsedMs: handle ? Date.now() - handle.startedAt : 0,
      toolCallCount: handle?.toolCallCount || 0,
      sawPermissionRequest: handle?.sawPermissionRequest || false,
      permissionDenials: handle?.permissionDenials || [],
    }
  }

  isRunning(requestId: string): boolean {
    return this.activeRuns.has(requestId)
  }

  getHandle(requestId: string): RunHandle | undefined {
    return this.activeRuns.get(requestId)
  }

  getActiveRunIds(): string[] {
    return Array.from(this.activeRuns.keys())
  }

  // ─── VCR Cassette: Record ───

  /**
   * Returns a recorder function that appends timestamped events to a cassette file.
   * Call the returned function for each raw NDJSON event. Call .end() when done.
   */
  private _recordToCassette(requestId: string, startTime: number): {
    record: (event: ClaudeEvent) => void
    recordExit: (code: number | null, signal: string | null) => void
    end: () => void
  } {
    if (!existsSync(CASSETTE_DIR)) {
      mkdirSync(CASSETTE_DIR, { recursive: true })
      log(`Created cassette directory: ${CASSETTE_DIR}`)
    }

    const cassettePath = join(CASSETTE_DIR, `${requestId}.ndjson`)
    const ws: WriteStream = createWriteStream(cassettePath, { flags: 'w' })
    log(`VCR RECORD: writing cassette to ${cassettePath}`)

    return {
      record: (event: ClaudeEvent) => {
        const line = JSON.stringify({ ts: Date.now() - startTime, event })
        ws.write(line + '\n')
      },
      recordExit: (code: number | null, signal: string | null) => {
        const line = JSON.stringify({ ts: Date.now() - startTime, exit: { code, signal } })
        ws.write(line + '\n')
      },
      end: () => {
        ws.end()
      },
    }
  }

  // ─── VCR Cassette: Playback ───

  /**
   * Creates a mock RunHandle that replays events from a recorded cassette file
   * through the same EventEmitter pipeline as a real run.
   */
  private _playbackFromCassette(requestId: string, options: RunOptions): RunHandle {
    let cassetteName = options.cassetteName || requestId
    let cassettePath = join(CASSETTE_DIR, `${cassetteName}.ndjson`)

    // Auto-select from env var queue when the specific cassette doesn't exist
    if (!existsSync(cassettePath) && VCR_CASSETTE_QUEUE && this._cassetteQueueIdx < VCR_CASSETTE_QUEUE.length) {
      cassetteName = VCR_CASSETTE_QUEUE[this._cassetteQueueIdx]
      this._cassetteQueueIdx++
      cassettePath = join(CASSETTE_DIR, `${cassetteName}.ndjson`)
      log(`VCR PLAYBACK: auto-selected cassette "${cassetteName}" from queue (idx=${this._cassetteQueueIdx - 1})`)
    }

    // Synthesize a minimal no-op response when no cassette is available
    if (!existsSync(cassettePath)) {
      log(`VCR PLAYBACK: no cassette found, synthesizing empty response for ${requestId}`)
      return this._synthesizeEmptyPlayback(requestId, options)
    }

    log(`VCR PLAYBACK: reading cassette from ${cassettePath} (speed=${VCR_PLAYBACK_SPEED}x)`)

    // Read and parse all cassette lines
    const raw = readFileSync(cassettePath, 'utf-8')
    const lines = raw.split('\n').filter((l) => l.trim())
    const entries: Array<{ ts: number; event?: ClaudeEvent; exit?: { code: number | null; signal: string | null } }> = []
    for (const line of lines) {
      try {
        entries.push(JSON.parse(line))
      } catch {
        log(`VCR PLAYBACK: skipping unparseable line: ${line.substring(0, 100)}`)
      }
    }

    // Create a mock ChildProcess-like EventEmitter for the handle
    const mockProcess = new EventEmitter() as any as ChildProcess
    // Stub out methods that might be called on the process
    ;(mockProcess as any).kill = (_signal?: string) => {
      log(`VCR PLAYBACK: mock process kill called [${requestId}]`)
      return true
    }
    ;(mockProcess as any).pid = -1
    ;(mockProcess as any).exitCode = null
    ;(mockProcess as any).stdin = { write: () => true, end: () => {}, destroyed: false }

    const handle: RunHandle = {
      runId: requestId,
      sessionId: options.sessionId || null,
      process: mockProcess,
      pid: -1,
      startedAt: Date.now(),
      stderrTail: [],
      stdoutTail: [],
      toolCallCount: 0,
      sawPermissionRequest: false,
      permissionDenials: [],
    }

    this.activeRuns.set(requestId, handle)

    // Schedule events at their recorded timestamps (adjusted by playback speed)
    const timers: ReturnType<typeof setTimeout>[] = []

    for (const entry of entries) {
      const delay = VCR_PLAYBACK_SPEED > 0 ? entry.ts / VCR_PLAYBACK_SPEED : 0

      if (entry.exit) {
        // Schedule the exit event
        const exitEntry = entry.exit
        timers.push(setTimeout(() => {
          log(`VCR PLAYBACK: exit [${requestId}] code=${exitEntry.code} signal=${exitEntry.signal}`)
          ;(mockProcess as any).exitCode = exitEntry.code
          this._finishedRuns.set(requestId, handle)
          this.activeRuns.delete(requestId)
          this.emit('exit', requestId, exitEntry.code, exitEntry.signal, handle.sessionId)
          setTimeout(() => this._finishedRuns.delete(requestId), 5000)
        }, delay))
      } else if (entry.event) {
        // Schedule the event through the normal pipeline
        const event = entry.event
        timers.push(setTimeout(() => {
          this._processEvent(requestId, handle, event)
        }, delay))
      }
    }

    // If no exit entry was in the cassette, auto-exit after the last event
    const lastTs = entries.length > 0 ? entries[entries.length - 1].ts : 0
    const hasExitEntry = entries.some((e) => !!e.exit)
    if (!hasExitEntry) {
      const autoExitDelay = VCR_PLAYBACK_SPEED > 0 ? (lastTs + 100) / VCR_PLAYBACK_SPEED : 100
      timers.push(setTimeout(() => {
        log(`VCR PLAYBACK: auto-exit [${requestId}] (no exit entry in cassette)`)
        ;(mockProcess as any).exitCode = 0
        this._finishedRuns.set(requestId, handle)
        this.activeRuns.delete(requestId)
        this.emit('exit', requestId, 0, null, handle.sessionId)
        setTimeout(() => this._finishedRuns.delete(requestId), 5000)
      }, autoExitDelay))
    }

    // Store timers on the mock process so cancel() can clear them
    ;(mockProcess as any)._vcrTimers = timers
    ;(mockProcess as any).kill = (_signal?: string) => {
      log(`VCR PLAYBACK: cancelling playback [${requestId}]`)
      for (const t of timers) clearTimeout(t)
      this._finishedRuns.set(requestId, handle)
      this.activeRuns.delete(requestId)
      this.emit('exit', requestId, -1, 'SIGINT', handle.sessionId)
      return true
    }

    return handle
  }

  /**
   * Synthesize a minimal playback that immediately completes with success.
   * Used when no cassette file is available (e.g., warmup init requests).
   */
  private _synthesizeEmptyPlayback(requestId: string, options: RunOptions): RunHandle {
    const mockProcess = new EventEmitter() as any as ChildProcess
    ;(mockProcess as any).kill = () => true
    ;(mockProcess as any).pid = -1
    ;(mockProcess as any).exitCode = null
    ;(mockProcess as any).stdin = { write: () => true, end: () => {}, destroyed: false }

    const handle: RunHandle = {
      runId: requestId,
      sessionId: options.sessionId || null,
      process: mockProcess,
      pid: -1,
      startedAt: Date.now(),
      stderrTail: [],
      stdoutTail: [],
      toolCallCount: 0,
      sawPermissionRequest: false,
      permissionDenials: [],
    }

    this.activeRuns.set(requestId, handle)

    const sessionId = options.sessionId || `synth-${requestId.substring(0, 8)}`

    // Emit init → result → exit in quick succession
    setTimeout(() => {
      this._processEvent(requestId, handle, {
        type: 'system', subtype: 'init', cwd: '/tmp', session_id: sessionId,
        tools: [], mcp_servers: [], model: 'claude-sonnet-4-6', permissionMode: 'default',
        agents: [], skills: [], plugins: [], claude_code_version: '0.0.0',
        fast_mode_state: 'off', uuid: `synth-init-${requestId.substring(0, 8)}`,
      } as any)
    }, 5)

    setTimeout(() => {
      this._processEvent(requestId, handle, {
        type: 'result', subtype: 'success', is_error: false, duration_ms: 10,
        num_turns: 1, result: '', total_cost_usd: 0, session_id: sessionId,
        usage: { input_tokens: 0, output_tokens: 0 }, permission_denials: [],
        uuid: `synth-result-${requestId.substring(0, 8)}`,
      } as any)
    }, 10)

    setTimeout(() => {
      ;(mockProcess as any).exitCode = 0
      this._finishedRuns.set(requestId, handle)
      this.activeRuns.delete(requestId)
      this.emit('exit', requestId, 0, null, sessionId)
      setTimeout(() => this._finishedRuns.delete(requestId), 5000)
    }, 15)

    return handle
  }

  /**
   * Shared event processing pipeline used by both real runs and VCR playback.
   * Tracks session state, emits raw + normalized events.
   */
  private _processEvent(requestId: string, handle: RunHandle, event: ClaudeEvent): void {
    // Track session ID from init event
    if (event.type === 'system' && 'subtype' in event && (event as InitEvent).subtype === 'init') {
      handle.sessionId = (event as InitEvent).session_id
    }

    // Track permission_request events
    if (event.type === 'permission_request') {
      handle.sawPermissionRequest = true
      log(`Permission request seen [${requestId}]`)
    }

    // Extract permission_denials from result event
    if (event.type === 'result') {
      const { permission_denials } = event as ResultEvent
      if (permission_denials.length > 0) {
        handle.permissionDenials = permission_denials.map((d) => ({
          tool_name: d.tool_name || '',
          tool_use_id: d.tool_use_id || '',
        }))
        log(`Permission denials [${requestId}]: ${JSON.stringify(handle.permissionDenials)}`)
      }
    }

    // Ring buffer stdout lines (raw JSON for diagnostics)
    this._ringPush(handle.stdoutTail, JSON.stringify(event).substring(0, 300))

    // Emit raw event for debugging
    this.emit('raw', requestId, event)

    // Normalize and emit canonical events
    const normalized = normalize(event)
    for (const evt of normalized) {
      if (evt.type === 'tool_call') handle.toolCallCount++
      this.emit('normalized', requestId, evt)
    }
  }

  private _ringPush(buffer: string[], line: string): void {
    buffer.push(line)
    if (buffer.length > MAX_RING_LINES) {
      buffer.shift()
    }
  }
}
