import { test, expect } from './fixtures'
import fs from 'fs'
import path from 'path'
import os from 'os'

test.describe('Application Log Trail (#40)', () => {
  test('log file exists after app launch', async () => {
    const logDir = path.join(os.homedir(), 'Library', 'Logs', 'Showtime')
    const today = new Date().toISOString().slice(0, 10)
    const logFile = path.join(logDir, `showtime-${today}.log`)

    // The app has already launched via fixtures — log file should exist
    expect(fs.existsSync(logFile)).toBe(true)

    const content = fs.readFileSync(logFile, 'utf-8')
    const lines = content.trim().split('\n').filter(Boolean)
    expect(lines.length).toBeGreaterThan(0)

    // First entry should be app_startup
    const firstEntry = JSON.parse(lines[0])
    expect(firstEntry.event).toBe('app_startup')
    expect(firstEntry.level).toBe('INFO')
    expect(firstEntry.data).toHaveProperty('appVersion')
    expect(firstEntry.data).toHaveProperty('electronVersion')
  })

  test('log entries are valid JSONL', async () => {
    const logDir = path.join(os.homedir(), 'Library', 'Logs', 'Showtime')
    const today = new Date().toISOString().slice(0, 10)
    const logFile = path.join(logDir, `showtime-${today}.log`)

    if (!fs.existsSync(logFile)) return

    const content = fs.readFileSync(logFile, 'utf-8')
    const lines = content.trim().split('\n').filter(Boolean)

    for (const line of lines) {
      const entry = JSON.parse(line) // Should not throw
      expect(entry).toHaveProperty('ts')
      expect(entry).toHaveProperty('level')
      expect(entry).toHaveProperty('event')
    }
  })
})
