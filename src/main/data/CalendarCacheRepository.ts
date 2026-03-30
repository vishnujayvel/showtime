import { and, gte, lte, sql } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { calendarCache } from './schema'
import type { CachedCalendarEvent } from '../../shared/types'

export class CalendarCacheRepository {
  constructor(private db: BetterSQLite3Database) {}

  /** Get cached events for a given day (start/end as epoch ms) */
  getEventsForDay(dayStartMs: number, dayEndMs: number): CachedCalendarEvent[] {
    const rows = this.db
      .select()
      .from(calendarCache)
      .where(and(gte(calendarCache.startTime, dayStartMs), lte(calendarCache.startTime, dayEndMs)))
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

  /** Upsert events (replace all for the given day window) */
  upsertEvents(events: CachedCalendarEvent[]): void {
    const now = Date.now()
    const stmt = this.db
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

    stmt.run()
  }

  /** Clear all cached events */
  clear(): void {
    this.db.delete(calendarCache).run()
  }
}
