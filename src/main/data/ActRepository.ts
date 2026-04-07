import { eq, asc } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { acts } from './schema'

/** Inferred select type for a row in the acts table. */
export type ActRow = typeof acts.$inferSelect
/** Inferred insert type for a row in the acts table. */
export type ActInsert = typeof acts.$inferInsert

/** Persists and retrieves act records from SQLite. */
export class ActRepository {
  constructor(private db: BetterSQLite3Database) {}

  insertActs(showId: string, actList: Omit<ActInsert, 'showId'>[]): void {
    if (actList.length === 0) return
    this.db.insert(acts)
      .values(actList.map((a) => ({ ...a, showId })))
      .run()
  }

  getActsForShow(showId: string): ActRow[] {
    return this.db.select().from(acts)
      .where(eq(acts.showId, showId))
      .orderBy(asc(acts.sortOrder))
      .all()
  }

  updateActStatus(
    actId: string,
    status: string,
    timestamps?: { actualStartAt?: number; actualEndAt?: number; actualDurationMs?: number }
  ): void {
    this.db.update(acts).set({
      status,
      ...(timestamps?.actualStartAt != null && { actualStartAt: timestamps.actualStartAt }),
      ...(timestamps?.actualEndAt != null && { actualEndAt: timestamps.actualEndAt }),
      ...(timestamps?.actualDurationMs != null && { actualDurationMs: timestamps.actualDurationMs }),
    }).where(eq(acts.id, actId)).run()
  }

  updateActOrder(actId: string, newOrder: number): void {
    this.db.update(acts).set({ sortOrder: newOrder }).where(eq(acts.id, actId)).run()
  }

  deleteAct(actId: string): void {
    this.db.delete(acts).where(eq(acts.id, actId)).run()
  }

  upsertAct(act: ActInsert): void {
    this.db.insert(acts)
      .values(act)
      .onConflictDoUpdate({
        target: acts.id,
        set: {
          name: act.name,
          sketch: act.sketch,
          category: act.category,
          plannedDurationMs: act.plannedDurationMs,
          actualDurationMs: act.actualDurationMs,
          sortOrder: act.sortOrder,
          status: act.status,
          beatLocked: act.beatLocked,
          plannedStartAt: act.plannedStartAt,
          actualStartAt: act.actualStartAt,
          actualEndAt: act.actualEndAt,
        },
      })
      .run()
  }
}
