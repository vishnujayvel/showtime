import { eq, desc, asc, sql } from 'drizzle-orm'
import { localToday } from '../../shared/date-utils'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { shows, acts, claudeContexts } from './schema'
import type { ShowHistoryEntry, ShowDetailEntry } from './types'

/** Inferred select type for a row in the shows table. */
export type ShowRow = typeof shows.$inferSelect
/** Inferred insert type for a row in the shows table. */
export type ShowInsert = typeof shows.$inferInsert

/** Persists and retrieves daily show records including history and detail views. */
export class ShowRepository {
  constructor(private db: BetterSQLite3Database) {}

  upsertShow(show: ShowInsert): void {
    this.db.insert(shows)
      .values(show)
      .onConflictDoUpdate({
        target: shows.id,
        set: {
          phase: show.phase,
          energy: show.energy,
          verdict: show.verdict,
          beatsLocked: show.beatsLocked,
          beatThreshold: show.beatThreshold,
          startedAt: show.startedAt,
          endedAt: show.endedAt,
          planText: show.planText,
        },
      })
      .run()
  }

  getShow(dateId: string): ShowRow | undefined {
    return this.db.select().from(shows).where(eq(shows.id, dateId)).get()
  }

  getTodayShow(): ShowRow | undefined {
    const today = localToday()
    return this.getShow(today)
  }

  updatePhase(dateId: string, phase: string): void {
    this.db.update(shows).set({ phase }).where(eq(shows.id, dateId)).run()
  }

  updateVerdict(dateId: string, verdict: string): void {
    this.db.update(shows).set({ verdict }).where(eq(shows.id, dateId)).run()
  }

  getRecentShows(limit = 30): ShowHistoryEntry[] {
    // Use raw SQL column reference for correlated subqueries — Drizzle's ${column}
    // interpolation inside sql`` can bind as a parameter instead of a column ref,
    // causing the subquery to always return 0.
    const rows = this.db
      .select({
        showId: shows.id,
        phase: shows.phase,
        energy: shows.energy,
        verdict: shows.verdict,
        beatsLocked: shows.beatsLocked,
        beatThreshold: shows.beatThreshold,
        startedAt: shows.startedAt,
        endedAt: shows.endedAt,
        actCount: sql<number>`(SELECT COUNT(*) FROM acts WHERE acts.show_id = shows.id)`,
        completedActCount: sql<number>`(SELECT COUNT(*) FROM acts WHERE acts.show_id = shows.id AND acts.status = 'completed')`,
      })
      .from(shows)
      .orderBy(desc(shows.id))
      .limit(limit)
      .all()

    return rows as ShowHistoryEntry[]
  }

  getShowDetail(showId: string): ShowDetailEntry | null {
    const show = this.getShow(showId)
    if (!show) return null

    const actRows = this.db.select().from(acts)
      .where(eq(acts.showId, showId))
      .orderBy(asc(acts.sortOrder))
      .all()

    const ctx = this.db.select().from(claudeContexts)
      .where(eq(claudeContexts.showId, showId))
      .orderBy(desc(claudeContexts.createdAt))
      .limit(1)
      .get()

    return {
      showId: show.id,
      phase: show.phase,
      energy: show.energy,
      verdict: show.verdict,
      beatsLocked: show.beatsLocked,
      beatThreshold: show.beatThreshold,
      startedAt: show.startedAt,
      endedAt: show.endedAt,
      planText: show.planText ?? ctx?.planText ?? null,
      lineupJson: ctx?.lineupJson ?? null,
      acts: actRows.map(a => ({
        id: a.id,
        name: a.name,
        sketch: a.sketch,
        category: a.category,
        plannedDurationMs: a.plannedDurationMs,
        actualDurationMs: a.actualDurationMs,
        sortOrder: a.sortOrder,
        status: a.status,
        beatLocked: a.beatLocked,
        plannedStartAt: a.plannedStartAt,
        actualStartAt: a.actualStartAt,
        actualEndAt: a.actualEndAt,
      })),
    }
  }
}
