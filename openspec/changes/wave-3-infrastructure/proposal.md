# Wave 3: Infrastructure

## Why

Waves 1 and 2 fixed the core flow and added UX polish. Now we need the infrastructure layer: lightweight metrics for product improvement, faster startup, a QA monitor skill, and documentation for recent features.

## What Changes

### 1. Lightweight Session Metrics with 30-Day TTL (#170)

**Files:** New `src/main/metrics.ts`, `src/main/index.ts`, `src/main/ipc/core.ts`, `src/preload/index.ts`

A lightweight, local-only metrics system:

**Storage:** `~/Library/Application Support/Showtime/metrics/` — one NDJSON file per day (`2026-04-02.ndjson`), auto-pruned beyond 30 days on app startup.

**API (main process):**
```typescript
class MetricsWriter {
  emit(metric: string, value: number, tags?: Record<string, string>): void
  timer(metric: string): { stop(): number }
  increment(metric: string, tags?: Record<string, string>): void
}
```

**What to track:**
- `session.duration_ms` — app open time
- `lineup.generation_time_ms` — Claude response time
- `acts.completed` / `acts.skipped` — completion rates
- `beats.locked` — presence moments
- `xstate.events_dropped` — silent drops (from wildcard handler)
- `app.startup_time_ms` — time to interactive
- `claude.cost_usd` — API cost per session

**IPC bridge:** Add `window.showtime.emitMetric(metric, value, tags?)` for renderer to log metrics.

**TTL:** On startup, scan metrics dir, delete files older than 30 days.

### 2. Bootstrap Latency (#164)

**Files:** `src/main/index.ts`, `src/renderer/App.tsx`, `src/main/claude/control-plane.ts`

Reduce time-to-interactive:

1. **Defer Claude subprocess warmup** — Don't pre-warm until Writer's Room is entered, not on app launch
2. **Show skeleton UI instantly** — Render the Dark Studio view before any async init completes
3. **Parallelize init** — Database init, tray setup, and window creation can run concurrently
4. **Measure** — Use the new MetricsWriter to track `app.startup_time_ms` from `app.whenReady()` to first render

### 3. Log-Tailing QA Monitor Skill (#162)

**Files:** New `src/skills/showtime-qa/SKILL.md`

A Claude Code skill that:
1. Tails `~/Library/Logs/Showtime/showtime-*.log` for today
2. Parses structured JSON events — surfaces errors, warnings, slow ops
3. Maps known patterns to remediation (e.g., NODE_MODULE_VERSION → electron-rebuild)
4. Can file GitHub issues after user confirmation

This is a SKILL.md file only — no app code changes. The skill reads the existing log files.

### 4. Documentation for Recent Features (#148)

**Files:** `docs/guide/` directory — VitePress pages

Write docs for:
- **Getting Started** — Install, first run, building a lineup
- **Writer's Room** — Energy selection, chatting with Claude, lineup editing, finalization
- **Live Show** — Timer, beat checks, intermission, director mode
- **Framework** — Acts, Beats, Sketches, SNL metaphor explained
- **Settings** — Timer display mode (pill vs menu bar), help

Update `docs/.vitepress/config.ts` sidebar to include new guide pages.
Verify: `npm run docs:build --prefix docs` must pass.

## Testing Strategy

- Unit tests: MetricsWriter (emit, timer, TTL pruning), startup timing
- Integration: Metrics files created in correct directory with correct format
- Manual: Verify startup is perceptibly faster, QA skill works in Claude Code

## Acceptance Criteria

1. Metrics NDJSON files written to `~/Library/Application Support/Showtime/metrics/`
2. Files older than 30 days auto-deleted on startup
3. `window.showtime.emitMetric()` IPC bridge works from renderer
4. App startup time measurably reduced (defer Claude warmup)
5. QA monitor skill can tail today's log and surface errors
6. Guide pages exist and docs build passes
