import { eq, asc, sql } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { timelineEvents, acts } from './schema'

/** Inferred select type for a row in the timeline_events table. */
export type TimelineEventRow = typeof timelineEvents.$inferSelect
/** Inferred insert type for a row in the timeline_events table. */
export type TimelineEventInsert = typeof timelineEvents.$inferInsert

/** Represents the time drift between planned and actual duration for a single act. */
export interface ActDrift {
  actId: string | null
  actName: string | null
  driftSeconds: number
  plannedMs: number
  actualMs: number
}

/** Records and queries timeline events and computes schedule drift. */
export class TimelineRepository {
  constructor(private db: BetterSQLite3Database) {}

  recordEvent(event: Omit<TimelineEventInsert, 'id' | 'createdAt'>): void {
    this.db.insert(timelineEvents)
      .values({ ...event, createdAt: Date.now() })
      .run()
  }

  getEventsForShow(showId: string): TimelineEventRow[] {
    return this.db.select().from(timelineEvents)
      .where(eq(timelineEvents.showId, showId))
      .orderBy(asc(timelineEvents.createdAt))
      .all()
  }

  getEventsForAct(actId: string): TimelineEventRow[] {
    return this.db.select().from(timelineEvents)
      .where(eq(timelineEvents.actId, actId))
      .orderBy(asc(timelineEvents.createdAt))
      .all()
  }

  computeDrift(showId: string): number {
    const result = this.db
      .select({ total: sql<number>`COALESCE(SUM(${timelineEvents.driftSeconds}), 0)` })
      .from(timelineEvents)
      .where(eq(timelineEvents.showId, showId))
      .get()
    return result?.total ?? 0
  }

  getDriftPerAct(showId: string): ActDrift[] {
    const rows = this.db
      .select({
        actId: timelineEvents.actId,
        actName: acts.name,
        driftSeconds: sql<number>`COALESCE(${timelineEvents.driftSeconds}, 0)`,
        plannedMs: sql<number>`COALESCE(${acts.plannedDurationMs}, 0)`,
        actualMs: sql<number>`COALESCE(${acts.actualDurationMs}, ${acts.plannedDurationMs}, 0)`,
      })
      .from(timelineEvents)
      .leftJoin(acts, eq(timelineEvents.actId, acts.id))
      .where(eq(timelineEvents.showId, showId))
      .all()
      // Only return act-level events with drift
      .filter((r) => r.actId != null && r.driftSeconds !== 0)

    // Deduplicate by actId (take the last event per act, which has final drift)
    const byAct = new Map<string, ActDrift>()
    for (const row of rows) {
      if (row.actId) {
        byAct.set(row.actId, {
          actId: row.actId,
          actName: row.actName,
          driftSeconds: row.driftSeconds,
          plannedMs: row.plannedMs,
          actualMs: row.actualMs,
        })
      }
    }
    return Array.from(byAct.values())
  }
}
