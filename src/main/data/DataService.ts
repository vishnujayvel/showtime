import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { join } from 'path'
import { app } from 'electron'
import { MigrationRunner } from './MigrationRunner'
import { ShowRepository } from './ShowRepository'
import { ActRepository } from './ActRepository'
import { TimelineRepository } from './TimelineRepository'
import { ClaudeContextRepository } from './ClaudeContextRepository'
import { MetricsRepository } from './MetricsRepository'
import { CalendarCacheRepository } from './CalendarCacheRepository'

let instance: DataService | null = null

export class DataService {
  readonly raw: Database.Database
  readonly db: BetterSQLite3Database
  readonly shows: ShowRepository
  readonly acts: ActRepository
  readonly timeline: TimelineRepository
  readonly claudeCtx: ClaudeContextRepository
  readonly metrics: MetricsRepository
  readonly calendarCache: CalendarCacheRepository

  private constructor(dbPath: string) {
    this.raw = new Database(dbPath)
    this.raw.pragma('journal_mode = WAL')
    this.raw.pragma('foreign_keys = ON')
    this.db = drizzle(this.raw)
    this.shows = new ShowRepository(this.db)
    this.acts = new ActRepository(this.db)
    this.timeline = new TimelineRepository(this.db)
    this.claudeCtx = new ClaudeContextRepository(this.db)
    this.metrics = new MetricsRepository(this.db)
    this.calendarCache = new CalendarCacheRepository(this.db)
  }

  static init(): DataService {
    if (instance) return instance
    const dbPath = join(app.getPath('userData'), 'showtime.db')
    instance = new DataService(dbPath)
    const migrationRunner = new MigrationRunner(instance.raw)
    migrationRunner.run(join(__dirname, 'data', 'migrations'))
    return instance
  }

  static initWithPath(dbPath: string, migrationsDir: string): DataService {
    const svc = new DataService(dbPath)
    const migrationRunner = new MigrationRunner(svc.raw)
    migrationRunner.run(migrationsDir)
    return svc
  }

  static getInstance(): DataService {
    if (!instance) throw new Error('DataService not initialized. Call DataService.init() first.')
    return instance
  }

  /** Truncate all data tables (preserves schema). Used by test reset and dev Cmd+Shift+R. */
  resetAllData(): void {
    this.raw.exec('DELETE FROM metrics')
    this.raw.exec('DELETE FROM claude_contexts')
    this.raw.exec('DELETE FROM timeline_events')
    this.raw.exec('DELETE FROM acts')
    this.raw.exec('DELETE FROM shows')
    this.raw.exec('DELETE FROM calendar_cache')
  }

  close(): void {
    this.raw.close()
    if (instance === this) instance = null
  }
}
