# Lightweight Performance Metrics — Track App Health

GitHub Issue: #38

## Why

Showtime has no visibility into app performance. When a user reports "lineup generation feels slow"
or "app takes forever to start," we have no data. Simple metrics would help:
- Identify performance regressions between releases
- Surface data in HistoryView: "Your average lineup generation takes 12 seconds"
- Detect issues early (e.g., SQLite query taking > 1 second = schema problem)

## What to Build

### 1. Metrics Module: `src/main/metrics/`

A lightweight metrics collector that stores timing data in SQLite alongside existing data.

```typescript
// src/main/metrics/MetricsService.ts
class MetricsService {
  recordTiming(name: string, durationMs: number, metadata?: Record<string, string>): void
  getTimings(name: string, since?: Date, limit?: number): TimingEntry[]
  getSummary(name: string, since?: Date): { avg: number, p95: number, min: number, max: number, count: number }
  prune(olderThanDays?: number): number  // default 30 days
}
```

### 2. What to Measure

Instrument these points (low overhead, high signal):

| Metric Name | Where | What |
|-------------|-------|------|
| `app.startup` | `src/main/index.ts` | Time from app ready to first window show |
| `claude.lineup_generation` | Claude subprocess handlers | Time from sendMessage to parsed lineup |
| `claude.subprocess_spawn` | RunManager | Time to spawn + connect to Claude subprocess |
| `sqlite.hydrate` | SyncEngine.hydrate() | Time to load today's show from SQLite |
| `sqlite.sync` | SyncEngine.writeSnapshot() | Time to write state to SQLite |
| `window.resize` | setBounds calls | Time for window resize operation |
| `build.time` | E2E only | Build duration (CI metric) |

### 3. Storage: New SQLite Table

Add a `metrics` table to the existing SQLite database:

```sql
CREATE TABLE IF NOT EXISTS metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  duration_ms REAL NOT NULL,
  metadata TEXT,  -- JSON string
  created_at INTEGER NOT NULL DEFAULT (unixepoch('now', 'subsec') * 1000)
);
CREATE INDEX idx_metrics_name_created ON metrics(name, created_at);
```

### 4. Auto-Pruning

On app startup, prune metrics older than 30 days. This keeps the table small:
- At ~50 events/day × 30 days = ~1500 rows max
- Estimated storage: < 100 KB

### 5. IPC Bridge

Expose to renderer so HistoryView (or future dashboard) can query:
```typescript
// preload additions
getMetricsSummary(name: string, days?: number): Promise<MetricsSummary>
```

### 6. Migration

Add a new migration file `0004_metrics.sql` to `src/main/data/migrations/`.

## Technology

- SQLite (existing) via better-sqlite3 + drizzle-orm
- No external dependencies
- No external telemetry or shipping

## Testing Strategy

- Unit test: MetricsService.recordTiming + getSummary with in-memory SQLite
- E2E test: Verify `app.startup` metric is recorded after app launch

## Non-Goals

- No remote telemetry or analytics shipping
- No real-time dashboard (future enhancement)
- No alerting or thresholds
- No Prometheus/Grafana integration
- Don't instrument every function — only the 7 key metrics listed above
