CREATE TABLE IF NOT EXISTS calendar_cache (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  start_time INTEGER NOT NULL,
  end_time INTEGER NOT NULL,
  is_fixed INTEGER NOT NULL DEFAULT 1,
  category TEXT,
  last_synced INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_calendar_cache_start ON calendar_cache(start_time);
