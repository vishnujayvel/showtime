import { eq, desc, sql, count } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { shows, acts } from './schema'
import type { ShowHistoryEntry } from './types'

export type ShowRow = typeof shows.$inferSelect
export type ShowInsert = typeof shows.$inferInsert

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
    const today = new Date().toISOString().slice(0, 10)
    return this.getShow(today)
  }

  updatePhase(dateId: string, phase: string): void {
    this.db.update(shows).set({ phase }).where(eq(shows.id, dateId)).run()
  }

  updateVerdict(dateId: string, verdict: string): void {
    this.db.update(shows).set({ verdict }).where(eq(shows.id, dateId)).run()
  }

  getRecentShows(limit = 30): ShowHistoryEntry[] {
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
        actCount: sql<number>`(SELECT COUNT(*) FROM acts WHERE acts.show_id = ${shows.id})`,
        completedActCount: sql<number>`(SELECT COUNT(*) FROM acts WHERE acts.show_id = ${shows.id} AND acts.status = 'completed')`,
      })
      .from(shows)
      .orderBy(desc(shows.id))
      .limit(limit)
      .all()

    return rows as ShowHistoryEntry[]
  }
}
