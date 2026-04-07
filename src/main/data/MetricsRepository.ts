import { eq, and, gte, sql } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { metrics } from './schema'

/** Aggregated statistics for a named performance metric. */
export interface MetricsSummary {
  avg: number
  p95: number
  min: number
  max: number
  count: number
}

/** Records, summarizes, and prunes performance timing metrics. */
export class MetricsRepository {
  constructor(private db: BetterSQLite3Database) {}

  recordTiming(name: string, durationMs: number, metadata?: Record<string, string>): void {
    this.db.insert(metrics).values({
      name,
      durationMs,
      metadata: metadata ? JSON.stringify(metadata) : null,
      createdAt: Date.now(),
    }).run()
  }

  getSummary(name: string, sinceDays?: number): MetricsSummary {
    const conditions = [eq(metrics.name, name)]
    if (sinceDays) {
      const cutoff = Date.now() - sinceDays * 24 * 60 * 60 * 1000
      conditions.push(gte(metrics.createdAt, cutoff))
    }

    const rows = this.db
      .select({ durationMs: metrics.durationMs })
      .from(metrics)
      .where(and(...conditions))
      .orderBy(metrics.durationMs)
      .all()

    if (rows.length === 0) {
      return { avg: 0, p95: 0, min: 0, max: 0, count: 0 }
    }

    const durations = rows.map(r => r.durationMs)
    const sum = durations.reduce((a, b) => a + b, 0)
    const p95Index = Math.min(Math.ceil(durations.length * 0.95) - 1, durations.length - 1)

    return {
      avg: Math.round(sum / durations.length * 100) / 100,
      p95: durations[p95Index],
      min: durations[0],
      max: durations[durations.length - 1],
      count: durations.length,
    }
  }

  prune(olderThanDays = 30): number {
    const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000
    const result = this.db.delete(metrics).where(
      sql`${metrics.createdAt} < ${cutoff}`
    ).run()
    return result.changes
  }
}
