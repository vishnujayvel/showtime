import Database from 'better-sqlite3'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

export class MigrationRunner {
  constructor(private db: Database.Database) {}

  run(migrationsDir: string): void {
    // Ensure _migrations table exists
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS _migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at INTEGER NOT NULL
      )
    `)

    // Get already-applied versions
    const applied = new Set(
      (this.db.prepare('SELECT version FROM _migrations').all() as Array<{ version: number }>)
        .map((row) => row.version)
    )

    // Read migration files, sorted by version number
    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort()

    for (const file of files) {
      const version = parseInt(file.split('_')[0], 10)
      if (isNaN(version) || applied.has(version)) continue

      const sql = readFileSync(join(migrationsDir, file), 'utf-8')
      const name = file.replace('.sql', '')

      this.db.transaction(() => {
        this.db.exec(sql)
        this.db.prepare(
          'INSERT INTO _migrations (version, name, applied_at) VALUES (?, ?, ?)'
        ).run(version, name, Date.now())
      })()
    }
  }
}
