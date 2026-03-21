-- Showtime initial schema
-- Forward-only migration. Never modify this file after deployment.

PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS _migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS shows (
  id TEXT PRIMARY KEY,
  phase TEXT NOT NULL,
  energy TEXT,
  verdict TEXT,
  beats_locked INTEGER NOT NULL DEFAULT 0,
  beat_threshold INTEGER NOT NULL DEFAULT 3,
  started_at INTEGER,
  ended_at INTEGER,
  plan_text TEXT
);

CREATE TABLE IF NOT EXISTS acts (
  id TEXT PRIMARY KEY,
  show_id TEXT NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sketch TEXT NOT NULL,
  category TEXT,
  planned_duration_ms INTEGER NOT NULL,
  actual_duration_ms INTEGER,
  sort_order INTEGER NOT NULL,
  status TEXT NOT NULL,
  beat_locked INTEGER NOT NULL DEFAULT 0,
  planned_start_at INTEGER,
  actual_start_at INTEGER,
  actual_end_at INTEGER
);

CREATE TABLE IF NOT EXISTS timeline_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  show_id TEXT NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  act_id TEXT REFERENCES acts(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  planned_start INTEGER,
  planned_end INTEGER,
  actual_start INTEGER,
  actual_end INTEGER,
  drift_seconds INTEGER,
  metadata TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS claude_contexts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  show_id TEXT NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  energy TEXT,
  plan_text TEXT,
  lineup_json TEXT,
  session_id TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_acts_show_id ON acts(show_id);
CREATE INDEX IF NOT EXISTS idx_timeline_events_show_id ON timeline_events(show_id);
CREATE INDEX IF NOT EXISTS idx_timeline_events_act_id ON timeline_events(act_id);
