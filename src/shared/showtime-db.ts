/**
 * Shared Showtime DB module — lightweight read/write interface.
 *
 * Designed for use by BOTH the Electron app (main process) and
 * Claude Code skills. Uses raw better-sqlite3 in WAL mode so
 * concurrent readers don't block each other.
 *
 * The Electron app's DataService is the primary writer (via drizzle).
 * Skills should prefer reads; writes here are intentionally minimal.
 */
import Database from 'better-sqlite3'
import { getShowtimeDbPath } from './db-path'

export interface ShowRow {
  id: string
  phase: string
  energy: string | null
  verdict: string | null
  beats_locked: number
  beat_threshold: number
  started_at: number | null
  ended_at: number | null
  plan_text: string | null
}

export interface ActRow {
  id: string
  show_id: string
  name: string
  sketch: string
  category: string | null
  planned_duration_ms: number
  actual_duration_ms: number | null
  sort_order: number
  status: string
  beat_locked: number
  planned_start_at: number | null
  actual_start_at: number | null
  actual_end_at: number | null
}

/**
 * Open the shared showtime.db in WAL mode (read-safe for concurrent access).
 * Caller is responsible for calling db.close() when done.
 */
export function openDb(dbPath?: string): Database.Database {
  const db = new Database(dbPath ?? getShowtimeDbPath())
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  return db
}

/** Get today's ISO date string (YYYY-MM-DD). */
function todayId(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Read today's show record. Returns undefined if no show exists yet. */
export function readToday(db: Database.Database): ShowRow | undefined {
  return db.prepare('SELECT * FROM shows WHERE id = ?').get(todayId()) as ShowRow | undefined
}

/** Read acts for today's show, ordered by sort_order. */
export function readTodayActs(db: Database.Database): ActRow[] {
  return db.prepare(
    'SELECT * FROM acts WHERE show_id = ? ORDER BY sort_order ASC'
  ).all(todayId()) as ActRow[]
}

/** Get the current phase for today's show. Returns 'no_show' if no show exists. */
export function getPhase(db: Database.Database): string {
  const row = readToday(db)
  return row?.phase ?? 'no_show'
}

/**
 * Write/update the lineup for today's show.
 * Creates the show row if it doesn't exist, then upserts acts.
 */
export function writeLineup(
  db: Database.Database,
  acts: Array<{
    id: string
    name: string
    sketch: string
    durationMinutes: number
    order: number
    pinnedStartAt?: number | null
    calendarEventId?: string | null
  }>,
  options?: { energy?: string; beatThreshold?: number }
): void {
  const showId = todayId()

  const upsertShow = db.prepare(`
    INSERT INTO shows (id, phase, energy, beats_locked, beat_threshold)
    VALUES (?, 'writers_room', ?, 0, ?)
    ON CONFLICT(id) DO UPDATE SET
      energy = COALESCE(excluded.energy, shows.energy),
      beat_threshold = COALESCE(excluded.beat_threshold, shows.beat_threshold)
  `)

  const deleteOldActs = db.prepare('DELETE FROM acts WHERE show_id = ?')

  const insertAct = db.prepare(`
    INSERT INTO acts (id, show_id, name, sketch, planned_duration_ms, sort_order, status, beat_locked, planned_start_at)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, ?)
  `)

  const tx = db.transaction(() => {
    upsertShow.run(showId, options?.energy ?? null, options?.beatThreshold ?? 3)
    deleteOldActs.run(showId)
    for (const act of acts) {
      insertAct.run(
        act.id,
        showId,
        act.name,
        act.sketch,
        act.durationMinutes * 60 * 1000,
        act.order,
        act.pinnedStartAt ?? null
      )
    }
  })

  tx()
}
