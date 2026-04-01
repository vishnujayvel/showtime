// @vitest-environment node
/**
 * Part D: Shared SQLite access — showtime-db module (#125)
 *
 * Tests the lightweight read/write interface for shared DB access.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { join } from 'path'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { DataService } from '../main/data/DataService'
import { openDb, readToday, readTodayActs, getPhase, writeLineup } from '../shared/showtime-db'
import type Database from 'better-sqlite3'

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/showtime-test', getVersion: () => '0.0.0-test' },
}))

let tmpDir: string
let data: DataService
let dbPath: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'showtime-db-test-'))
  dbPath = join(tmpDir, 'test.db')
  const migrationsDir = join(__dirname, '..', 'main', 'data', 'migrations')
  data = DataService.initWithPath(dbPath, migrationsDir)
})

afterEach(() => {
  data.close()
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('showtime-db shared module', () => {
  it('openDb opens a database in WAL mode', () => {
    const db = openDb(dbPath)
    const mode = db.pragma('journal_mode', { simple: true })
    expect(mode).toBe('wal')
    db.close()
  })

  it('getPhase returns no_show when no show exists', () => {
    const db = openDb(dbPath)
    expect(getPhase(db)).toBe('no_show')
    db.close()
  })

  it('readToday returns today\'s show after insert', () => {
    const today = new Date().toISOString().slice(0, 10)
    data.shows.upsertShow({ id: today, phase: 'live', energy: 'high', beatsLocked: 1, beatThreshold: 3 })

    const db = openDb(dbPath)
    const show = readToday(db)
    expect(show).toBeDefined()
    expect(show!.phase).toBe('live')
    expect(show!.energy).toBe('high')
    db.close()
  })

  it('getPhase reads phase from today\'s show', () => {
    const today = new Date().toISOString().slice(0, 10)
    data.shows.upsertShow({ id: today, phase: 'intermission' })

    const db = openDb(dbPath)
    expect(getPhase(db)).toBe('intermission')
    db.close()
  })

  it('writeLineup creates show and acts', () => {
    const db = openDb(dbPath)
    writeLineup(db, [
      { id: 'act-1', name: 'Deep Work', sketch: 'Deep Work', durationMinutes: 60, order: 0 },
      { id: 'act-2', name: 'Exercise', sketch: 'Exercise', durationMinutes: 45, order: 1 },
    ], { energy: 'high', beatThreshold: 3 })

    const show = readToday(db)
    expect(show).toBeDefined()
    expect(show!.phase).toBe('writers_room')

    const acts = readTodayActs(db)
    expect(acts).toHaveLength(2)
    expect(acts[0].name).toBe('Deep Work')
    expect(acts[0].planned_duration_ms).toBe(60 * 60 * 1000)
    expect(acts[1].name).toBe('Exercise')
    expect(acts[1].sort_order).toBe(1)

    db.close()
  })

  it('writeLineup handles pinned acts', () => {
    const db = openDb(dbPath)
    writeLineup(db, [
      { id: 'act-1', name: 'Standup', sketch: 'Admin', durationMinutes: 30, order: 0, pinnedStartAt: 1711800000000, calendarEventId: 'cal-abc' },
      { id: 'act-2', name: 'Code', sketch: 'Deep Work', durationMinutes: 60, order: 1 },
    ])

    const acts = readTodayActs(db)
    expect(acts[0].planned_start_at).toBe(1711800000000)
    expect(acts[1].planned_start_at).toBeNull()

    db.close()
  })

  it('writeLineup replaces existing acts on re-write', () => {
    const db = openDb(dbPath)

    writeLineup(db, [
      { id: 'act-1', name: 'Task A', sketch: 'Admin', durationMinutes: 30, order: 0 },
    ])
    expect(readTodayActs(db)).toHaveLength(1)

    writeLineup(db, [
      { id: 'act-2', name: 'Task B', sketch: 'Deep Work', durationMinutes: 45, order: 0 },
      { id: 'act-3', name: 'Task C', sketch: 'Exercise', durationMinutes: 30, order: 1 },
    ])
    const acts = readTodayActs(db)
    expect(acts).toHaveLength(2)
    expect(acts[0].name).toBe('Task B')

    db.close()
  })

  it('concurrent read from shared module while DataService writes', () => {
    const today = new Date().toISOString().slice(0, 10)

    // DataService writes
    data.shows.upsertShow({ id: today, phase: 'live', energy: 'medium', beatsLocked: 0, beatThreshold: 3 })
    data.acts.insertActs(today, [
      { id: 'a1', name: 'Act One', sketch: 'Deep Work', plannedDurationMs: 3600000, sortOrder: 0, status: 'active', beatLocked: 0 },
    ])

    // Shared module reads concurrently
    const db = openDb(dbPath)
    const phase = getPhase(db)
    expect(phase).toBe('live')

    const acts = readTodayActs(db)
    expect(acts).toHaveLength(1)
    expect(acts[0].name).toBe('Act One')

    db.close()
  })
})
