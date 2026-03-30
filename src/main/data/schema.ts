import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'

export const shows = sqliteTable('shows', {
  id: text('id').primaryKey(), // ISO date string: "2026-03-21"
  phase: text('phase').notNull(), // no_show, writers_room, live, intermission, director, strike
  energy: text('energy'),
  verdict: text('verdict'),
  beatsLocked: integer('beats_locked').notNull().default(0),
  beatThreshold: integer('beat_threshold').notNull().default(3),
  startedAt: integer('started_at'),
  endedAt: integer('ended_at'),
  planText: text('plan_text'),
})

export const acts = sqliteTable('acts', {
  id: text('id').primaryKey(), // 8-char random alphanumeric
  showId: text('show_id').notNull().references(() => shows.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  sketch: text('sketch').notNull(),
  category: text('category'),
  plannedDurationMs: integer('planned_duration_ms').notNull(),
  actualDurationMs: integer('actual_duration_ms'),
  sortOrder: integer('sort_order').notNull(),
  status: text('status').notNull(), // pending, active, completed, cut
  beatLocked: integer('beat_locked').notNull().default(0),
  plannedStartAt: integer('planned_start_at'),
  actualStartAt: integer('actual_start_at'),
  actualEndAt: integer('actual_end_at'),
})

export const timelineEvents = sqliteTable('timeline_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  showId: text('show_id').notNull().references(() => shows.id, { onDelete: 'cascade' }),
  actId: text('act_id').references(() => acts.id, { onDelete: 'set null' }),
  eventType: text('event_type').notNull(),
  plannedStart: integer('planned_start'),
  plannedEnd: integer('planned_end'),
  actualStart: integer('actual_start'),
  actualEnd: integer('actual_end'),
  driftSeconds: integer('drift_seconds'),
  metadata: text('metadata'), // JSON blob
  createdAt: integer('created_at').notNull(),
})

export const claudeContexts = sqliteTable('claude_contexts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  showId: text('show_id').notNull().references(() => shows.id, { onDelete: 'cascade' }),
  energy: text('energy'),
  planText: text('plan_text'),
  lineupJson: text('lineup_json'),
  sessionId: text('session_id'),
  createdAt: integer('created_at').notNull(),
})

export const metrics = sqliteTable('metrics', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  durationMs: real('duration_ms').notNull(),
  metadata: text('metadata'),
  createdAt: integer('created_at').notNull(),
})

export const calendarCache = sqliteTable('calendar_cache', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  startTime: integer('start_time').notNull(),
  endTime: integer('end_time').notNull(),
  isFixed: integer('is_fixed').notNull().default(1),
  category: text('category'),
  lastSynced: integer('last_synced').notNull(),
})

export const migrations = sqliteTable('_migrations', {
  version: integer('version').primaryKey(),
  name: text('name').notNull(),
  appliedAt: integer('applied_at').notNull(),
})
