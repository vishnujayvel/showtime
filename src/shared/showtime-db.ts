/**
 * Lightweight shared DB access for Showtime.
 *
 * Provides read/write access to showtime.db from both the Electron
 * main process and standalone Node.js contexts (skills, CLI tools).
 *
 * Uses better-sqlite3 directly (synchronous) with the same schema
 * as the main app's Drizzle ORM definitions.
 */
import Database from 'better-sqlite3'
import { localToday } from './date-utils'
import { existsSync } from 'fs'
import { resolveDbPath } from './db-path'

// ─── Types ───

/** Row shape for a show record read from the shows table. */
export interface ShowRecord {
  id: string
  phase: string
  energy: string | null
  verdict: string | null
  beatsLocked: number
  beatThreshold: number
  startedAt: number | null
  endedAt: number | null
  planText: string | null
}

/** Row shape for an act record read from the acts table. */
export interface ActRecord {
  id: string
  showId: string
  name: string
  sketch: string
  category: string | null
  plannedDurationMs: number
  actualDurationMs: number | null
  sortOrder: number
  status: string
  beatLocked: number
  plannedStartAt: number | null
  actualStartAt: number | null
  actualEndAt: number | null
}

/** A show and its associated acts for a single day. */
export interface TodayShow {
  show: ShowRecord
  acts: ActRecord[]
}

/** A single act entry in a lineup payload. */
export interface LineupAct {
  name: string
  sketch: string
  durationMinutes: number
  reason?: string
}

/** A complete lineup with acts, beat threshold, and optional opening note. */
export interface Lineup {
  acts: LineupAct[]
  beatThreshold: number
  openingNote?: string
}

// ─── DB Access ───

function openDb(dbPath?: string): Database.Database {
  const path = dbPath ?? resolveDbPath()
  const db = new Database(path)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  return db
}

/** Reads today's show and acts from the database, returning null if none exists. */
export function readToday(dbPath?: string): TodayShow | null {
  const path = dbPath ?? resolveDbPath()
  if (!existsSync(path)) return null

  const db = openDb(path)
  try {
    const today = localToday()
    const show = db.prepare(`
      SELECT id, phase, energy, verdict,
        beats_locked AS beatsLocked,
        beat_threshold AS beatThreshold,
        started_at AS startedAt,
        ended_at AS endedAt,
        plan_text AS planText
      FROM shows WHERE id = ?
    `).get(today) as ShowRecord | undefined
    if (!show) return null

    const acts = db.prepare(`
      SELECT id, show_id AS showId, name, sketch, category,
        planned_duration_ms AS plannedDurationMs,
        actual_duration_ms AS actualDurationMs,
        sort_order AS sortOrder,
        status,
        beat_locked AS beatLocked,
        planned_start_at AS plannedStartAt,
        actual_start_at AS actualStartAt,
        actual_end_at AS actualEndAt
      FROM acts WHERE show_id = ? ORDER BY sort_order ASC
    `).all(today) as ActRecord[]
    return { show, acts }
  } finally {
    db.close()
  }
}

/** Writes a lineup to the database, upserting today's show and replacing all existing acts. */
export function writeLineup(lineup: Lineup, energy?: string, dbPath?: string): void {
  const path = dbPath ?? resolveDbPath()
  const db = openDb(path)

  try {
    const today = localToday()

    db.exec('BEGIN')
    try {
      // Upsert show
      db.prepare(`
        INSERT INTO shows (id, phase, energy, beats_locked, beat_threshold, started_at)
        VALUES (?, 'writers_room', ?, 0, ?, NULL)
        ON CONFLICT(id) DO UPDATE SET
          energy = excluded.energy,
          beat_threshold = excluded.beat_threshold
      `).run(today, energy ?? null, lineup.beatThreshold)

      // Clear existing acts for today
      db.prepare('DELETE FROM acts WHERE show_id = ?').run(today)

      // Insert new acts
      const insertAct = db.prepare(`
        INSERT INTO acts (id, show_id, name, sketch, planned_duration_ms, sort_order, status, beat_locked)
        VALUES (?, ?, ?, ?, ?, ?, 'pending', 0)
      `)
      for (let i = 0; i < lineup.acts.length; i++) {
        const act = lineup.acts[i]
        const id = Math.random().toString(36).slice(2, 10)
        insertAct.run(id, today, act.name, act.sketch, act.durationMinutes * 60 * 1000, i)
      }

      // Save opening note as plan text if provided
      if (lineup.openingNote) {
        db.prepare('UPDATE shows SET plan_text = ? WHERE id = ?').run(lineup.openingNote, today)
      }

      db.exec('COMMIT')
    } catch (e) {
      db.exec('ROLLBACK')
      throw e
    }
  } finally {
    db.close()
  }
}

/** Returns the current phase of today's show, or null if no show exists. */
export function getPhase(dbPath?: string): string | null {
  const path = dbPath ?? resolveDbPath()
  if (!existsSync(path)) return null

  const db = openDb(path)
  try {
    const today = localToday()
    const row = db.prepare('SELECT phase FROM shows WHERE id = ?').get(today) as { phase: string } | undefined
    return row?.phase ?? null
  } finally {
    db.close()
  }
}
