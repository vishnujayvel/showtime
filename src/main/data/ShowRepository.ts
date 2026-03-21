import { eq } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { shows } from './schema'

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
}
