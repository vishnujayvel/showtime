/**
 * VCR Cassette — record and playback Claude subprocess event streams for testing.
 *
 * Extracted from run-manager.ts to isolate test infrastructure from production run logic.
 *
 * Record mode (SHOWTIME_RECORD=1): captures all NDJSON events to timestamped cassette files.
 * Playback mode (SHOWTIME_PLAYBACK=1): replays cassette files through the event pipeline,
 * simulating a Claude subprocess without spawning a real process.
 *
 * Cassette files are NDJSON with {ts, event} or {ts, exit} entries stored in e2e/cassettes/.
 */
import { EventEmitter } from 'events'
import { join } from 'path'
import { existsSync, mkdirSync, createWriteStream, readFileSync } from 'fs'
import type { WriteStream } from 'fs'
import type { ChildProcess } from 'child_process'
import { log } from './run-manager.log'
import type { ClaudeEvent, RunOptions, RunHandle } from './run-manager.types'

// ─── VCR Configuration ───

export const VCR_RECORD = !!process.env.SHOWTIME_RECORD
export const VCR_PLAYBACK = !!process.env.SHOWTIME_PLAYBACK
export const VCR_PLAYBACK_SPEED = Number(process.env.SHOWTIME_PLAYBACK_SPEED) || 1
export const CASSETTE_DIR = process.env.SHOWTIME_CASSETTE_DIR || join(process.cwd(), 'e2e', 'cassettes')
// Comma-separated queue of cassette names for playback (without .ndjson extension).
// Each startRun in playback mode dequeues the next name from this list.
export const VCR_CASSETTE_QUEUE: string[] | null = process.env.SHOWTIME_CASSETTE_NAME
  ? process.env.SHOWTIME_CASSETTE_NAME.split(',').map(s => s.trim()).filter(Boolean)
  : null

// ─── Recorder ───

export interface CassetteRecorder {
  record: (event: ClaudeEvent) => void
  recordExit: (code: number | null, signal: string | null) => void
  end: () => void
}

/**
 * Create a recorder that appends timestamped events to a cassette NDJSON file.
 * Call record() for each raw event, recordExit() on process exit, and end() to close.
 */
export function createCassetteRecorder(requestId: string, startTime: number): CassetteRecorder {
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

// ─── Playback ───

/**
 * Replay a recorded cassette file, emitting events through the provided callbacks.
 * Returns a mock RunHandle that can be used like a real run.
 */
export function playbackFromCassette(
  requestId: string,
  options: RunOptions,
  cassetteQueueIdx: number,
  callbacks: {
    processEvent: (requestId: string, handle: RunHandle, event: ClaudeEvent) => void
    onFinished: (requestId: string, handle: RunHandle) => void
    onExit: (requestId: string, code: number | null, signal: string | null, sessionId: string | null) => void
  },
): { handle: RunHandle; newQueueIdx: number } {
  let cassetteName = options.cassetteName || requestId
  let cassettePath = join(CASSETTE_DIR, `${cassetteName}.ndjson`)

  // Auto-select from env var queue when the specific cassette doesn't exist
  let newQueueIdx = cassetteQueueIdx
  if (!existsSync(cassettePath) && VCR_CASSETTE_QUEUE && cassetteQueueIdx < VCR_CASSETTE_QUEUE.length) {
    cassetteName = VCR_CASSETTE_QUEUE[cassetteQueueIdx]
    newQueueIdx = cassetteQueueIdx + 1
    cassettePath = join(CASSETTE_DIR, `${cassetteName}.ndjson`)
    log(`VCR PLAYBACK: auto-selected cassette "${cassetteName}" from queue (idx=${newQueueIdx - 1})`)
  }

  // Synthesize a minimal no-op response when no cassette is available
  if (!existsSync(cassettePath)) {
    log(`VCR PLAYBACK: no cassette found, synthesizing empty response for ${requestId}`)
    return {
      handle: synthesizeEmptyPlayback(requestId, options, callbacks),
      newQueueIdx,
    }
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
        callbacks.onFinished(requestId, handle)
        callbacks.onExit(requestId, exitEntry.code, exitEntry.signal, handle.sessionId)
      }, delay))
    } else if (entry.event) {
      // Schedule the event through the normal pipeline
      const event = entry.event
      timers.push(setTimeout(() => {
        callbacks.processEvent(requestId, handle, event)
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
      callbacks.onFinished(requestId, handle)
      callbacks.onExit(requestId, 0, null, handle.sessionId)
    }, autoExitDelay))
  }

  // Store timers on the mock process so cancel() can clear them
  ;(mockProcess as any)._vcrTimers = timers
  ;(mockProcess as any).kill = (_signal?: string) => {
    log(`VCR PLAYBACK: cancelling playback [${requestId}]`)
    for (const t of timers) clearTimeout(t)
    callbacks.onFinished(requestId, handle)
    callbacks.onExit(requestId, -1, 'SIGINT', handle.sessionId)
    return true
  }

  return { handle, newQueueIdx }
}

/**
 * Synthesize a minimal playback that immediately completes with success.
 * Used when no cassette file is available (e.g., warmup init requests).
 */
function synthesizeEmptyPlayback(
  requestId: string,
  options: RunOptions,
  callbacks: {
    processEvent: (requestId: string, handle: RunHandle, event: ClaudeEvent) => void
    onFinished: (requestId: string, handle: RunHandle) => void
    onExit: (requestId: string, code: number | null, signal: string | null, sessionId: string | null) => void
  },
): RunHandle {
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

  const sessionId = options.sessionId || `synth-${requestId.substring(0, 8)}`

  // Emit init → result → exit in quick succession
  setTimeout(() => {
    callbacks.processEvent(requestId, handle, {
      type: 'system', subtype: 'init', cwd: '/tmp', session_id: sessionId,
      tools: [], mcp_servers: [], model: 'claude-sonnet-4-6', permissionMode: 'default',
      agents: [], skills: [], plugins: [], claude_code_version: '0.0.0',
      fast_mode_state: 'off', uuid: `synth-init-${requestId.substring(0, 8)}`,
    } as any)
  }, 5)

  setTimeout(() => {
    callbacks.processEvent(requestId, handle, {
      type: 'result', subtype: 'success', is_error: false, duration_ms: 10,
      num_turns: 1, result: '', total_cost_usd: 0, session_id: sessionId,
      usage: { input_tokens: 0, output_tokens: 0 }, permission_denials: [],
      uuid: `synth-result-${requestId.substring(0, 8)}`,
    } as any)
  }, 10)

  setTimeout(() => {
    ;(mockProcess as any).exitCode = 0
    callbacks.onFinished(requestId, handle)
    callbacks.onExit(requestId, 0, null, sessionId)
  }, 15)

  return handle
}
