import { appendFileSync, existsSync, mkdirSync, readdirSync, unlinkSync, readFileSync } from 'fs'
import { localToday } from '../shared/date-utils'
import { appendFile } from 'fs/promises'
import { homedir } from 'os'
import { join, basename } from 'path'
import { app } from 'electron'

// ─── Types ───

export type LogLevel = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG'

export interface AppLogEntry {
  ts: string
  level: LogLevel
  event: string
  data?: Record<string, unknown>
}

// ─── Constants ───

// Lazy-evaluated to support test mocking of homedir()
function getLogDir_(): string {
  return join(homedir(), 'Library', 'Logs', 'Showtime')
}
const RETENTION_DAYS = 7
const FLUSH_INTERVAL_MS = 1000
const MAX_BUFFER_SIZE = 32

// ─── State ───

let buffer: string[] = []
let timer: ReturnType<typeof setInterval> | null = null
let resolvedLogDir: string | null = null
let currentLogPath: string | null = null
let minLevel: LogLevel = 'INFO'

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
}

// ─── Core ───

function logDir(): string {
  if (!resolvedLogDir) resolvedLogDir = getLogDir_()
  return resolvedLogDir
}

function getLogPath(): string {
  const date = localToday()
  return join(logDir(), `showtime-${date}.log`)
}

function ensureLogDir(): void {
  const dir = logDir()
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

function formatEntry(entry: AppLogEntry): string {
  return JSON.stringify(entry) + '\n'
}

function flush(): void {
  if (buffer.length === 0) return
  const path = currentLogPath ?? getLogPath()
  const chunk = buffer.join('')
  buffer = []
  appendFile(path, chunk).catch(() => {
    // Best-effort — don't crash the app over logging
  })
}

function ensureTimer(): void {
  if (timer) return
  timer = setInterval(flush, FLUSH_INTERVAL_MS)
  if (timer && typeof timer === 'object' && 'unref' in timer) {
    timer.unref()
  }
}

// ─── Public API ───

/**
 * Initialize the app logger. Call once during app startup.
 * Creates the log directory, rotates old logs, and writes startup info.
 */
export function initAppLogger(options?: { level?: LogLevel; logDir?: string }): void {
  if (options?.level) minLevel = options.level
  resolvedLogDir = options?.logDir ?? null // Custom dir for testing, or re-evaluate from homedir
  ensureLogDir()
  currentLogPath = getLogPath()
  rotateOldLogs()
  logStartup()
}

/**
 * Write a structured log entry.
 * No PII — never log plan text, act names, or user content.
 */
export function appLog(level: LogLevel, event: string, data?: Record<string, unknown>): void {
  if (LEVEL_PRIORITY[level] > LEVEL_PRIORITY[minLevel]) return

  const entry: AppLogEntry = {
    ts: new Date().toISOString(),
    level,
    event,
    ...(data && Object.keys(data).length > 0 ? { data } : {}),
  }

  buffer.push(formatEntry(entry))
  if (buffer.length >= MAX_BUFFER_SIZE) flush()
  ensureTimer()
}

/**
 * Synchronously drain all pending log entries. Call on shutdown.
 */
export function flushAppLogs(): void {
  if (timer) { clearInterval(timer); timer = null }
  if (buffer.length === 0) return
  const path = currentLogPath ?? getLogPath()
  const chunk = buffer.join('')
  buffer = []
  try { appendFileSync(path, chunk) } catch { /* best-effort */ }
}

/**
 * Delete log files older than RETENTION_DAYS.
 */
function rotateOldLogs(): void {
  try {
    const dir = logDir()
    const files = readdirSync(dir).filter(f => f.startsWith('showtime-') && f.endsWith('.log'))
    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000

    for (const file of files) {
      // Extract date from filename: showtime-YYYY-MM-DD.log
      const match = file.match(/^showtime-(\d{4}-\d{2}-\d{2})\.log$/)
      if (!match) continue
      const fileDate = new Date(match[1] + 'T00:00:00Z').getTime()
      if (fileDate < cutoff) {
        try { unlinkSync(join(dir, file)) } catch { /* skip files that can't be deleted */ }
      }
    }
  } catch {
    // Log dir may not exist yet on first run
  }
}

/**
 * Write startup metadata (no PII).
 */
function logStartup(): void {
  appLog('INFO', 'app_startup', {
    appVersion: app.getVersion(),
    electronVersion: process.versions.electron ?? 'N/A',
    nodeVersion: process.versions.node,
    macosVersion: process.platform === 'darwin' ? require('os').release() : 'N/A',
    platform: process.platform,
    arch: process.arch,
  })
}

/**
 * Collect the last 24h of logs for issue reporting.
 * Returns formatted text suitable for pasting into GitHub issues.
 */
export function collectRecentLogs(): string {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000
  const lines: string[] = []

  try {
    const dir = logDir()
    const files = readdirSync(dir)
      .filter(f => f.startsWith('showtime-') && f.endsWith('.log'))
      .sort() // chronological by date

    for (const file of files) {
      const match = file.match(/^showtime-(\d{4}-\d{2}-\d{2})\.log$/)
      if (!match) continue
      const fileDate = new Date(match[1] + 'T00:00:00Z').getTime()
      // Only read files from the last 2 days (covers 24h window)
      if (fileDate < cutoff - 24 * 60 * 60 * 1000) continue

      const content = readFileSync(join(dir, file), 'utf-8')
      for (const line of content.split('\n')) {
        if (!line.trim()) continue
        try {
          const entry = JSON.parse(line) as AppLogEntry
          const entryTime = new Date(entry.ts).getTime()
          if (entryTime >= cutoff) {
            lines.push(line)
          }
        } catch {
          // Skip malformed lines
        }
      }
    }
  } catch {
    return '(No logs available)'
  }

  // Flush current buffer too
  flushAppLogs()

  const header = [
    '## Showtime Diagnostic Report',
    '',
    `- **App Version:** ${app.getVersion()}`,
    `- **Electron:** ${process.versions.electron}`,
    `- **Node:** ${process.versions.node}`,
    `- **macOS:** ${process.platform === 'darwin' ? require('os').release() : 'N/A'}`,
    `- **Generated:** ${new Date().toISOString()}`,
    '',
    '## Recent Logs (last 24h)',
    '',
    '```jsonl',
  ]

  return [...header, ...lines, '```'].join('\n')
}

/**
 * Get the log directory path (for tests and external tools).
 */
export function getLogDir(): string {
  return logDir()
}

/**
 * Get the current log file path (for tests).
 */
export function getCurrentLogPath(): string {
  return currentLogPath ?? getLogPath()
}
