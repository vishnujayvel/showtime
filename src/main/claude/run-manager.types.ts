/**
 * Run Manager Types — shared interfaces for Claude subprocess management.
 *
 * Used by run-manager.ts, vcr-cassette.ts, and pty-run-manager.ts.
 * Centralizes the RunHandle interface and re-exports shared types from shared/types.
 */
import type { ChildProcess } from 'child_process'
export type { ClaudeEvent, NormalizedEvent, RunOptions, EnrichedError, ResultEvent, InitEvent } from '../../shared/types'

/** Represents an active or recently-finished Claude subprocess with its diagnostic state. */
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
