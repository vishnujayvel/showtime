import { and, gte, lte, notInArray, sql } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { calendarCache } from './schema'
import type { CachedCalendarEvent } from '../../shared/types'

export class CalendarCacheRepository {
  constructor(private db: BetterSQLite3Database) {}

  /** Get cached events for a given day (start/end as epoch ms, uses interval overlap) */
  getEventsForDay(dayStartMs: number, dayEndMs: number): CachedCalendarEvent[] {
    const rows = this.db
      .select()
      .from(calendarCache)
      .where(and(lte(calendarCache.startTime, dayEndMs), gte(calendarCache.endTime, dayStartMs)))
      .all()

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      startTime: r.startTime,
      endTime: r.endTime,
      isFixed: r.isFixed === 1,
      category: r.category,
      lastSynced: r.lastSynced,
    }))
  }

  /** Upsert events and remove stale rows for the given day window */
  upsertEvents(events: CachedCalendarEvent[], dayStartMs?: number, dayEndMs?: number): void {
    if (events.length === 0) return

    const now = Date.now()
    const incomingIds = events.map((e) => e.id)

    // Compute window from events if not provided
    const windowStart = dayStartMs ?? Math.min(...events.map((e) => e.startTime))
    const windowEnd = dayEndMs ?? Math.max(...events.map((e) => e.endTime))

    this.db.transaction(() => {
      // Upsert incoming events
      this.db
        .insert(calendarCache)
        .values(
          events.map((e) => ({
            id: e.id,
            title: e.title,
            startTime: e.startTime,
            endTime: e.endTime,
            isFixed: e.isFixed ? 1 : 0,
            category: e.category,
            lastSynced: now,
          }))
        )
        .onConflictDoUpdate({
          target: calendarCache.id,
          set: {
            title: sql`excluded.title`,
            startTime: sql`excluded.start_time`,
            endTime: sql`excluded.end_time`,
            isFixed: sql`excluded.is_fixed`,
            category: sql`excluded.category`,
            lastSynced: sql`excluded.last_synced`,
          },
        })
        .run()

      // Remove stale rows in the same window that weren't in this sync
      this.db
        .delete(calendarCache)
        .where(
          and(
            gte(calendarCache.startTime, windowStart),
            lte(calendarCache.startTime, windowEnd),
            notInArray(calendarCache.id, incomingIds),
          ),
        )
        .run()
    })
  }

  /** Clear all cached events */
  clear(): void {
    this.db.delete(calendarCache).run()
  }
}
