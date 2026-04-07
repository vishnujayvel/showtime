import { eq, desc } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { claudeContexts } from './schema'

/** Inferred select type for a row in the claude_contexts table. */
export type ClaudeContextRow = typeof claudeContexts.$inferSelect
/** Inferred insert type for a row in the claude_contexts table. */
export type ClaudeContextInsert = typeof claudeContexts.$inferInsert

/** Stores and retrieves Claude conversation context snapshots per show. */
export class ClaudeContextRepository {
  constructor(private db: BetterSQLite3Database) {}

  saveContext(ctx: Omit<ClaudeContextInsert, 'id' | 'createdAt'>): void {
    this.db.insert(claudeContexts)
      .values({ ...ctx, createdAt: Date.now() })
      .run()
  }

  getLatestContext(showId: string): ClaudeContextRow | undefined {
    return this.db.select().from(claudeContexts)
      .where(eq(claudeContexts.showId, showId))
      .orderBy(desc(claudeContexts.id))
      .limit(1)
      .get()
  }
}
