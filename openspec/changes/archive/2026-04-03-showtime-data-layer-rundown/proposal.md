# Showtime Data Layer + Live Rundown Bar

## Why

Showtime currently stores ALL state in-memory via Zustand. When the app quits, everything is lost — acts, beats, timers, the entire show. Users can't see how their day unfolded, can't track schedule drift, and can't resume a show after a restart. The app needs a persistence layer and a visual timeline that shows the plan vs reality.

## What Changes

### Phase 1: SQLite Data Layer (Foundation)

- **NEW**: Add `better-sqlite3` as a native dependency for synchronous SQLite access in the Electron main process.
- **NEW**: Add `drizzle-orm` + `drizzle-kit` for type-safe schema definitions and migrations.
- **NEW**: Create `src/main/data/` module with:
  - `schema.ts` — Drizzle table definitions for 5 tables (see below)
  - `migrations/001_initial_schema.sql` — Initial migration
  - `DataService.ts` — Facade class exposing repository methods
  - `ShowRepository.ts` — CRUD for shows table
  - `ActRepository.ts` — CRUD for acts table
  - `TimelineRepository.ts` — Event-sourced timeline tracking (the KEY table)
  - `ClaudeContextRepository.ts` — Preserve Claude conversation context between sessions
  - `SyncEngine.ts` — Bidirectional sync between Zustand and SQLite
  - `MigrationRunner.ts` — Versioned schema migrations
- **MODIFIED**: `src/main/index.ts` — Initialize DataService on app ready, add IPC handlers for data operations
- **MODIFIED**: `src/preload/index.ts` — Add data IPC bridge methods to `window.clui` API
- **MODIFIED**: `src/renderer/stores/showStore.ts` — Hydrate from SQLite on launch, sync changes back via debounced writes (5s interval + immediate flush on phase transitions)
- **MODIFIED**: `src/renderer/stores/sessionStore.ts` — Persist Claude session context to SQLite

### Suggested Database Schema (5 tables)

**`shows`** — One row per day
- `id` TEXT PRIMARY KEY (date: "2026-03-21")
- `phase` TEXT (no_show, writers_room, live, intermission, director, strike)
- `energy` TEXT (high, medium, low, recovery)
- `verdict` TEXT (DAY_WON, SOLID_SHOW, GOOD_EFFORT, SHOW_CALLED_EARLY)
- `beats_locked` INTEGER, `beat_threshold` INTEGER
- `started_at` INTEGER (unix ms), `ended_at` INTEGER
- `plan_text` TEXT (original plan dump from Writer's Room)

**`acts`** — N per show
- `id` TEXT PRIMARY KEY (uuid)
- `show_id` TEXT REFERENCES shows(id)
- `name` TEXT, `sketch` TEXT, `category` TEXT
- `planned_duration_ms` INTEGER, `actual_duration_ms` INTEGER
- `sort_order` INTEGER, `status` TEXT (pending, active, completed, cut)
- `beat_locked` BOOLEAN
- `planned_start_at` INTEGER, `actual_start_at` INTEGER, `actual_end_at` INTEGER

**`timeline_events`** — Event-sourced log (THE KEY TABLE)
- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `show_id` TEXT REFERENCES shows(id)
- `act_id` TEXT REFERENCES acts(id) (nullable for show-level events)
- `event_type` TEXT (act_planned, act_started, act_paused, act_resumed, act_extended, act_completed, act_cut, act_reordered, intermission_started, intermission_ended, show_started, show_ended)
- `planned_start` INTEGER, `planned_end` INTEGER
- `actual_start` INTEGER, `actual_end` INTEGER
- `drift_seconds` INTEGER (computed: actual - planned)
- `metadata` TEXT (JSON blob for event-specific data)
- `created_at` INTEGER

**`claude_contexts`** — Preserve Claude conversation context
- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `show_id` TEXT REFERENCES shows(id)
- `energy` TEXT, `plan_text` TEXT, `lineup_json` TEXT
- `session_id` TEXT
- `created_at` INTEGER

**`_migrations`** — Schema versioning
- `version` INTEGER PRIMARY KEY
- `name` TEXT, `applied_at` INTEGER

### Phase 2: Live Rundown Bar (UI)

- **NEW**: `src/renderer/components/RundownBar.tsx` — Horizontal timeline bar component
  - Acts rendered as proportional colored blocks (width = duration / total show duration)
  - NOW marker (vertical red line) positioned by current time
  - Completed acts show actual vs planned (overrun hatching for blocks that ran over)
  - Current act highlighted with ON AIR glow and progress fill
  - Future acts show planned duration, dimmed
  - Intermissions as thin patterned gaps
  - Status badge: "Act 3 of 5 • 12m behind schedule"
  - Reads from timeline_events via IPC to compute drift
- **NEW**: `src/renderer/components/MiniRundownStrip.tsx` — 4px version for pill view
- **MODIFIED**: `src/renderer/views/ExpandedView.tsx` — Integrate RundownBar between ON AIR indicator and timer
- **MODIFIED**: `src/renderer/views/PillView.tsx` — Add MiniRundownStrip below content row
- **MODIFIED**: `src/renderer/stores/showStore.ts` — Record timeline events on act lifecycle changes (start, pause, extend, complete, cut, reorder)

### Phase 2b: Plan Modification

- **MODIFIED**: `src/renderer/panels/LineupPanel.tsx` — Show planned vs projected times per act. Allow reordering acts mid-show (drag-and-drop or up/down buttons). Show "9:50 → 10:15" when an act has been pushed back.
- **NEW**: Ability to add/remove acts during a live show ("encore" acts)
- Timeline events capture every modification: act_reordered, act_cut, act_added

## Capabilities

### New Capabilities
- `data-persistence` — SQLite database, migrations, repositories, sync engine
- `rundown-bar` — Live horizontal timeline with drift visualization

### Modified Capabilities
- `window-management` — No changes needed (already content-tight from previous redesign)

## Risks

1. **better-sqlite3 native module** — Requires Electron rebuild for native bindings. Use `electron-rebuild` or `@electron/rebuild`. Well-documented process but adds build complexity.
2. **Sync race conditions** — Zustand writes are synchronous but IPC to SQLite is async. The SyncEngine must handle rapid state changes (e.g., act complete → beat check → next act in <2s). Debounce writes but flush immediately on phase transitions.
3. **Migration safety** — SQLite migrations must be forward-only and idempotent. Use versioned SQL files, not auto-generated diffs.
4. **Timeline event volume** — For a typical 5-8 act day, expect 30-50 timeline events. Negligible for SQLite. No pagination needed.
5. **Rundown bar performance** — Recomputing block widths on every timer tick would be expensive. Compute layout on act lifecycle events only, not on every second.

## Testing Strategy

**CRITICAL: All testing must use Playwright with Electron.** Loki must run E2E tests that launch the actual app and verify behavior visually.

### Unit Tests (Vitest)
- DataService: CRUD operations on all 5 tables
- SyncEngine: hydration, debounced writes, flush-on-transition
- MigrationRunner: version tracking, forward-only
- Timeline drift computation: planned vs actual, cumulative drift
- RundownBar layout math: block widths, NOW marker position, overrun detection

### E2E Tests (Playwright + Electron)
- App launches → SQLite database created in app data directory
- Create a show → acts persisted to SQLite → restart app → show restored
- Complete an act → timeline_event recorded with actual_start/actual_end
- Rundown bar shows correct number of blocks matching act count
- NOW marker visible and positioned within the active act block
- Drift badge shows correct "Xm behind" text
- Act runs over planned duration → overrun hatching appears on rundown bar
- Plan modification (reorder acts) → timeline_event of type act_reordered recorded
- Kill and restart app mid-show → show resumes from persisted state
- Strike view → all timeline events queryable for the day's drift story

### Verification Commands
```bash
npm run build          # TypeScript + Vite build
npm run test           # Vitest unit tests
npm run test:e2e       # Playwright E2E (launches Electron)
npx tsc --noEmit       # Type checking
```

Loki MUST run these verification commands after implementation and confirm all pass before declaring completion.
