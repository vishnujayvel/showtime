// @vitest-environment node
/**
 * Tests for the shared showtime-db module (readToday, writeLineup, getPhase).
 *
 * Uses a real SQLite database in a temp directory with proper migrations.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { join } from 'path'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import Database from 'better-sqlite3'

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/showtime-test', getVersion: () => '0.0.0-test' },
}))

import { readToday, writeLineup, getPhase, type Lineup } from '../shared/showtime-db'

let tmpDir: string
let dbPath: string

function setupDb(path: string): void {
  const db = new Database(path)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  // Run migrations manually (same schema as DataService)
  const migrationsDir = join(__dirname, '..', 'main', 'data', 'migrations')
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require('fs')
  const files = fs.readdirSync(migrationsDir).filter((f: string) => f.endsWith('.sql')).sort()
  for (const file of files) {
    const sql = fs.readFileSync(join(migrationsDir, file), 'utf-8')
    db.exec(sql)
  }
  db.close()
}

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'showtime-db-test-'))
  dbPath = join(tmpDir, 'showtime.db')
  setupDb(dbPath)
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

const sampleLineup: Lineup = {
  acts: [
    { name: 'Deep Work: Project', sketch: 'Deep Work', durationMinutes: 60 },
    { name: 'Gym Session', sketch: 'Exercise', durationMinutes: 45 },
    { name: 'Email Triage', sketch: 'Admin', durationMinutes: 30 },
  ],
  beatThreshold: 3,
  openingNote: 'Three-act show today. Let\'s go.',
}

describe('writeLineup + readToday', () => {
  it('writes a lineup and reads it back', () => {
    writeLineup(sampleLineup, 'high', dbPath)

    const result = readToday(dbPath)
    expect(result).not.toBeNull()
    expect(result!.show.phase).toBe('writers_room')
    expect(result!.show.energy).toBe('high')
    expect(result!.show.beatThreshold).toBe(3)
    expect(result!.show.planText).toBe(sampleLineup.openingNote)
    expect(result!.acts).toHaveLength(3)
    expect(result!.acts[0].name).toBe('Deep Work: Project')
    expect(result!.acts[0].sketch).toBe('Deep Work')
    expect(result!.acts[0].plannedDurationMs).toBe(60 * 60 * 1000)
    expect(result!.acts[1].name).toBe('Gym Session')
    expect(result!.acts[2].name).toBe('Email Triage')
  })

  it('acts are ordered by sort_order', () => {
    writeLineup(sampleLineup, 'medium', dbPath)

    const result = readToday(dbPath)
    for (let i = 0; i < result!.acts.length; i++) {
      expect(result!.acts[i].sortOrder).toBe(i)
    }
  })

  it('replaces existing lineup on re-write', () => {
    writeLineup(sampleLineup, 'high', dbPath)

    const newLineup: Lineup = {
      acts: [{ name: 'Solo Act', sketch: 'Creative', durationMinutes: 90 }],
      beatThreshold: 1,
    }
    writeLineup(newLineup, 'low', dbPath)

    const result = readToday(dbPath)
    expect(result!.acts).toHaveLength(1)
    expect(result!.acts[0].name).toBe('Solo Act')
    expect(result!.show.energy).toBe('low')
    expect(result!.show.beatThreshold).toBe(1)
  })

  it('writes default energy as null when not provided', () => {
    writeLineup(sampleLineup, undefined, dbPath)

    const result = readToday(dbPath)
    expect(result!.show.energy).toBeNull()
  })
})

describe('readToday', () => {
  it('returns null when no show exists', () => {
    const result = readToday(dbPath)
    expect(result).toBeNull()
  })

  it('returns null when DB file does not exist', () => {
    const result = readToday('/nonexistent/path/showtime.db')
    expect(result).toBeNull()
  })
})

describe('getPhase', () => {
  it('returns phase of today\'s show', () => {
    writeLineup(sampleLineup, 'high', dbPath)

    const phase = getPhase(dbPath)
    expect(phase).toBe('writers_room')
  })

  it('returns null when no show exists', () => {
    const phase = getPhase(dbPath)
    expect(phase).toBeNull()
  })

  it('returns null when DB file does not exist', () => {
    const phase = getPhase('/nonexistent/path/showtime.db')
    expect(phase).toBeNull()
  })

  it('reflects phase updates', () => {
    writeLineup(sampleLineup, 'high', dbPath)

    // Manually update phase
    const db = new Database(dbPath)
    const today = new Date().toISOString().slice(0, 10)
    db.prepare('UPDATE shows SET phase = ? WHERE id = ?').run('live', today)
    db.close()

    const phase = getPhase(dbPath)
    expect(phase).toBe('live')
  })
})

// DarkStudioView resume detection tests are in resumeDetection.test.ts
// (requires jsdom environment for localStorage)
