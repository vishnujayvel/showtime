import { existsSync, mkdirSync, readdirSync, unlinkSync, appendFileSync } from 'fs'
import { localToday } from '../shared/date-utils'
import { appendFile } from 'fs/promises'
import { join } from 'path'
import { app } from 'electron'

// ─── Types ───

export interface MetricEntry {
  ts: string
  metric: string
  value: number
  tags?: Record<string, string>
}

// ─── Constants ───

const FLUSH_INTERVAL_MS = 1000
const MAX_BUFFER_SIZE = 32

// ─── MetricsWriter ───

export class MetricsWriter {
  private buffer: string[] = []
  private flushTimer: ReturnType<typeof setInterval> | null = null
  private metricsDir: string
  private currentFilePath: string | null = null

  constructor(baseDir: string) {
    this.metricsDir = join(baseDir, 'metrics')
    this.ensureDir()
  }

  // ─── Public API ───

  /**
   * Emit a metric with a name, numeric value, and optional tags.
   * Each entry is buffered and flushed periodically as NDJSON.
   */
  emit(metric: string, value: number, tags?: Record<string, string>): void {
    const entry: MetricEntry = {
      ts: new Date().toISOString(),
      metric,
      value,
      ...(tags && Object.keys(tags).length > 0 ? { tags } : {}),
    }

    this.buffer.push(JSON.stringify(entry) + '\n')
    if (this.buffer.length >= MAX_BUFFER_SIZE) this.flush()
    this.ensureTimer()
  }

  /**
   * Start a timer. Call `.stop()` on the returned object to emit the elapsed ms.
   */
  timer(metric: string): { stop: () => number } {
    const start = Date.now()
    return {
      stop: (): number => {
        const elapsed = Date.now() - start
        this.emit(metric, elapsed)
        return elapsed
      },
    }
  }

  /**
   * Increment a counter metric by 1.
   */
  increment(metric: string, tags?: Record<string, string>): void {
    this.emit(metric, 1, tags)
  }

  /**
   * Delete NDJSON files older than retentionDays.
   */
  prune(retentionDays = 30): void {
    try {
      const files = readdirSync(this.metricsDir).filter(f => f.endsWith('.ndjson'))
      const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000

      for (const file of files) {
        // Extract date from filename: YYYY-MM-DD.ndjson
        const match = file.match(/^(\d{4}-\d{2}-\d{2})\.ndjson$/)
        if (!match) continue
        const fileDate = new Date(match[1] + 'T00:00:00Z').getTime()
        if (fileDate < cutoff) {
          try { unlinkSync(join(this.metricsDir, file)) } catch { /* skip */ }
        }
      }
    } catch {
      // Metrics dir may not exist yet
    }
  }

  /**
   * Synchronously drain all buffered entries. Call on shutdown.
   */
  flushSync(): void {
    if (this.flushTimer) { clearInterval(this.flushTimer); this.flushTimer = null }
    if (this.buffer.length === 0) return
    const path = this.getFilePath()
    const chunk = this.buffer.join('')
    this.buffer = []
    try { appendFileSync(path, chunk) } catch { /* best-effort */ }
  }

  // ─── Internals ───

  private ensureDir(): void {
    if (!existsSync(this.metricsDir)) {
      mkdirSync(this.metricsDir, { recursive: true })
    }
  }

  private getFilePath(): string {
    const date = localToday()
    return join(this.metricsDir, `${date}.ndjson`)
  }

  private flush(): void {
    if (this.buffer.length === 0) return
    const path = this.currentFilePath ?? this.getFilePath()
    const chunk = this.buffer.join('')
    this.buffer = []
    appendFile(path, chunk).catch(() => {
      // Best-effort — don't crash the app over metrics
    })
  }

  private ensureTimer(): void {
    if (this.flushTimer) return
    this.flushTimer = setInterval(() => this.flush(), FLUSH_INTERVAL_MS)
    if (this.flushTimer && typeof this.flushTimer === 'object' && 'unref' in this.flushTimer) {
      (this.flushTimer as NodeJS.Timeout).unref()
    }
  }
}

// ─── Singleton ───

let instance: MetricsWriter | null = null

/**
 * Lazily initialize and return the singleton MetricsWriter.
 * Uses `app.getPath('userData')` as the base path.
 */
export function getMetricsWriter(): MetricsWriter {
  if (!instance) {
    instance = new MetricsWriter(app.getPath('userData'))
  }
  return instance
}
