CREATE TABLE IF NOT EXISTS metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  duration_ms REAL NOT NULL,
  metadata TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch('now', 'subsec') * 1000)
);
CREATE INDEX idx_metrics_name_created ON metrics(name, created_at);
