import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

// Mock Electron's `app` module (not available in Vitest)
vi.mock('electron', () => ({
  app: {
    getVersion: () => '1.0.0-test',
  },
}))

import {
  initAppLogger,
  appLog,
  flushAppLogs,
  collectRecentLogs,
  getCurrentLogPath,
} from '../main/app-logger'

const testLogDir = join(tmpdir(), `showtime-logger-test-${Date.now()}`)

describe('app-logger', () => {
  beforeEach(() => {
    mkdirSync(testLogDir, { recursive: true })
  })

  afterEach(() => {
    flushAppLogs()
    try { rmSync(testLogDir, { recursive: true, force: true }) } catch { /* ignore */ }
  })

  it('writes JSONL entries with correct structure', () => {
    initAppLogger({ level: 'DEBUG', logDir: testLogDir })
    appLog('INFO', 'test_event', { foo: 'bar' })
    appLog('WARN', 'test_warning')
    flushAppLogs()

    const logPath = getCurrentLogPath()
    expect(existsSync(logPath)).toBe(true)

    const content = readFileSync(logPath, 'utf-8')
    const lines = content.trim().split('\n').filter(Boolean)

    // Should have startup log + 2 test entries
    expect(lines.length).toBeGreaterThanOrEqual(3)

    // Verify JSONL format
    for (const line of lines) {
      const entry = JSON.parse(line)
      expect(entry).toHaveProperty('ts')
      expect(entry).toHaveProperty('level')
      expect(entry).toHaveProperty('event')
      expect(['ERROR', 'WARN', 'INFO', 'DEBUG']).toContain(entry.level)
      expect(new Date(entry.ts).getTime()).toBeGreaterThan(0)
    }

    // Verify specific entries
    const testEvent = lines.map(l => JSON.parse(l)).find(e => e.event === 'test_event')
    expect(testEvent).toBeDefined()
    expect(testEvent!.level).toBe('INFO')
    expect(testEvent!.data).toEqual({ foo: 'bar' })

    const testWarning = lines.map(l => JSON.parse(l)).find(e => e.event === 'test_warning')
    expect(testWarning).toBeDefined()
    expect(testWarning!.level).toBe('WARN')
    expect(testWarning!.data).toBeUndefined()
  })

  it('startup log contains expected fields', () => {
    initAppLogger({ logDir: testLogDir })
    flushAppLogs()

    const logPath = getCurrentLogPath()
    const content = readFileSync(logPath, 'utf-8')
    const lines = content.trim().split('\n').filter(Boolean)

    const startupEntry = JSON.parse(lines[0])
    expect(startupEntry.event).toBe('app_startup')
    expect(startupEntry.level).toBe('INFO')
    expect(startupEntry.data).toHaveProperty('appVersion')
    expect(startupEntry.data).toHaveProperty('electronVersion')
    expect(startupEntry.data).toHaveProperty('nodeVersion')
    expect(startupEntry.data).toHaveProperty('platform')
    expect(startupEntry.data).toHaveProperty('arch')
  })

  it('respects severity level filtering', () => {
    initAppLogger({ level: 'WARN', logDir: testLogDir })
    appLog('DEBUG', 'should_be_filtered')
    appLog('INFO', 'also_filtered')
    appLog('WARN', 'should_appear')
    appLog('ERROR', 'also_appears')
    flushAppLogs()

    const logPath = getCurrentLogPath()
    const content = readFileSync(logPath, 'utf-8')
    const events = content.trim().split('\n').filter(Boolean).map(l => JSON.parse(l))

    const eventNames = events.map(e => e.event)
    expect(eventNames).not.toContain('should_be_filtered')
    expect(eventNames).not.toContain('also_filtered')
    expect(eventNames).toContain('should_appear')
    expect(eventNames).toContain('also_appears')
  })

  it('rotates log files older than 7 days', () => {
    // Create fake old log files BEFORE init (which triggers rotation)
    const oldDate = '2020-01-01'
    const recentDate = new Date().toISOString().slice(0, 10)
    writeFileSync(join(testLogDir, `showtime-${oldDate}.log`), '{"ts":"2020-01-01T00:00:00Z","level":"INFO","event":"old"}\n')
    writeFileSync(join(testLogDir, `showtime-${recentDate}.log`), '{"ts":"now","level":"INFO","event":"recent"}\n')

    initAppLogger({ logDir: testLogDir })
    flushAppLogs()

    const files = readdirSync(testLogDir)
    expect(files).not.toContain(`showtime-${oldDate}.log`)
    expect(files).toContain(`showtime-${recentDate}.log`)
  })

  it('log file uses YYYY-MM-DD naming convention', () => {
    initAppLogger({ logDir: testLogDir })
    flushAppLogs()

    const logPath = getCurrentLogPath()
    const filename = logPath.split('/').pop()!
    expect(filename).toMatch(/^showtime-\d{4}-\d{2}-\d{2}\.log$/)
  })

  it('collectRecentLogs returns formatted report', () => {
    initAppLogger({ level: 'DEBUG', logDir: testLogDir })
    appLog('INFO', 'test_collect')
    flushAppLogs()

    const report = collectRecentLogs()
    expect(report).toContain('## Showtime Diagnostic Report')
    expect(report).toContain('**App Version:**')
    expect(report).toContain('**Electron:**')
    expect(report).toContain('## Recent Logs (last 24h)')
    expect(report).toContain('```jsonl')
    expect(report).toContain('test_collect')
  })
})
