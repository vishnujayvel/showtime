# Showtime Data Layer + Live Rundown Bar -- Design

## Context

Showtime currently stores all runtime state in a Zustand store (`showStore.ts`) with the `persist` middleware writing to `localStorage` via the `showtime-show-state` key. This gives basic survival across page reloads within a session, but has three critical limitations:

1. **No durable persistence.** `localStorage` lives in the renderer's WebStorage. If the Electron app crashes, the user clears site data, or the app is reinstalled, all show history is lost. There is no main-process-owned data store.

2. **No timeline or drift tracking.** The store tracks current state (phase, acts, timer) but never records *when* things happened relative to when they were *planned* to happen. There is no event log, so features like "12 minutes behind schedule" or post-show drift analysis are impossible.

3. **No visual timeline.** The user has no at-a-glance representation of their day's structure -- how acts relate to each other in time, which ran over, where the current moment sits relative to the plan.

### Current Store Shape

The `ShowStoreState` interface in `src/renderer/stores/showStore.ts` carries:
- `phase: ShowPhase` (no_show | writers_room | live | intermission | director | strike)
- `energy: EnergyLevel | null`
- `acts: Act[]` (each with id, name, sketch, durationMinutes, status, beatLocked, order, startedAt?, completedAt?)
- `currentActId`, `beatsLocked`, `beatThreshold`, `timerEndAt`, `timerPausedRemaining`
- `showDate`, `verdict`, `isExpanded`, `writersRoomStep`, `claudeSessionId`
- Transient UI flags: `beatCheckPending`, `celebrationActive`, `goingLiveActive`, `breathingPauseEndAt`

The store is created with `persist()` middleware and a `partialize` function that strips transient UI flags. On rehydration, a day-boundary check resets state if `showDate !== today()`.

### IPC Architecture

All renderer-to-main communication flows through the typed `window.clui` API defined in `src/preload/index.ts`. The preload bridge uses `contextBridge.exposeInMainWorld('clui', api)` and maps each method to either `ipcRenderer.invoke()` (request-response) or `ipcRenderer.send()` (fire-and-forget). The main process registers handlers via `ipcMain.handle()` and `ipcMain.on()` in `src/main/index.ts`. This boundary is strict -- the renderer never imports Node.js modules.

### Constraints

- Zustand must remain the runtime state engine. The reactive UI depends on Zustand subscriptions; replacing Zustand with direct SQLite reads would require rewriting every component.
- The preload IPC bridge is the only communication path. No new transport mechanisms.
- macOS only. No IndexedDB cross-platform concerns.
- The data layer runs exclusively in the main process. The renderer never touches SQLite directly.

---

## Goals

1. **Persist show state to SQLite.** Survive app crashes, restarts, and day boundaries. Resume a show from where it left off.
2. **Record timeline events.** Create an event-sourced log of act lifecycle transitions (planned, started, paused, completed, skipped, extended, reordered) with planned vs actual timestamps and computed drift.
3. **Enable drift computation.** Provide a query API that returns cumulative schedule drift at any point in the show, powering both the Rundown Bar UI and the Strike view's day summary.
4. **Add a Live Rundown Bar.** A horizontal timeline component showing acts as proportional colored blocks, a NOW marker, overrun hatching, and a schedule drift badge. Integrated into ExpandedView (28px bar) and PillView (4px mini strip).
5. **Preserve Claude session context.** Persist energy level, plan dump, and generated lineup JSON so the Claude session can be resumed after a restart without re-prompting.
6. **Forward-only migrations.** Versioned SQL schema migrations that run idempotently on app launch.

## Non-Goals

- **Multi-day analytics dashboard.** The schema supports querying historical shows, but no UI for cross-day trends, streaks, or weekly summaries is built in this change. That is a future capability.
- **Cloud sync.** The database is local-only. No remote backup, no cross-device sync.
- **Real-time SQLite reads from the renderer.** The renderer reads state from Zustand, not from SQLite. SQLite is the persistence layer, not the query engine for the UI hot path.
- **Replacing Zustand persist middleware.** The existing `localStorage` persist stays as a fast-path cache. SQLite is the authoritative store; `localStorage` is a fallback for sub-second hydration on normal launches.
- **Drag-and-drop act reordering in the Rundown Bar.** Reordering happens in LineupPanel. The Rundown Bar is read-only.
- **Custom ORM or query builder.** Drizzle ORM is used for type-safe schema definitions, not as a full query builder. Complex queries use raw SQL via Drizzle's `sql` template tag.

---

## Decisions

### 1. better-sqlite3 as the database driver

**Choice:** `better-sqlite3` for synchronous SQLite access in the Electron main process.

**Why not IndexedDB or localStorage?**
- IndexedDB is async-only. Every read requires `await`, adding latency to the hydration hot path. `better-sqlite3` reads are synchronous -- `db.prepare(sql).get()` returns immediately with zero async overhead.
- `localStorage` has a 5-10MB limit, no schema enforcement, no queryability. It works for Zustand's persist middleware (small JSON blob) but cannot support timeline event queries or multi-day history.
- `localStorage` lives in the renderer process. The data layer must be in the main process to survive renderer crashes and maintain strict process isolation.

**Why not other SQLite bindings?**
- `sql.js` (WASM-compiled SQLite): Runs in renderer or main, but slower than native for write-heavy workloads. No WAL mode support.
- `node:sqlite` (Node.js 22.5+ built-in): Too new, not yet stable. Electron may not ship with a compatible Node.js version.

**Why better-sqlite3 specifically?**
- Synchronous API eliminates callback/promise chains for CRUD operations. A `saveShow()` call is 3 synchronous statements, not 3 awaited promises.
- Battle-tested in Electron apps (Obsidian, Signal Desktop, Linear). Known-good compatibility.
- WAL (Write-Ahead Logging) mode for safe concurrent reads during write batches.
- Single native dependency. Compiles against the Electron Node.js ABI via `electron-rebuild`.

**Build impact:** Requires `electron-rebuild` (or `@electron/rebuild`) as a postinstall step. This adds ~5s to `npm install` on first build. Already standard practice for Electron apps with native dependencies.

### 2. Drizzle ORM for type-safe schema definitions

**Choice:** `drizzle-orm` + `drizzle-kit` for schema definition and typed query helpers.

**Why not Prisma?**
- Prisma requires a daemon process (`prisma engine`) and generates a heavy client (~2MB). Overkill for a local SQLite database with 5 tables.
- Prisma's migration system auto-generates SQL diffs, which can produce destructive migrations (column drops, table renames) without explicit developer approval. Not safe for forward-only migrations.

**Why not raw SQL everywhere?**
- Raw SQL strings lose type safety at the TypeScript boundary. A column rename in the schema silently breaks queries at runtime, not at compile time.
- Drizzle's schema definitions (`sqliteTable`, `text`, `integer`) generate TypeScript types that flow through repository methods. If the `shows` table adds a column, every `select()` and `insert()` call in `ShowRepository` gets type-checked automatically.

**What Drizzle provides:**
- `drizzle-orm/sqlite-core`: Schema definition DSL (`sqliteTable`, column types).
- `drizzle-orm/better-sqlite3`: Driver adapter for `better-sqlite3`.
- Type-safe `select()`, `insert()`, `update()`, `delete()` methods.
- `sql` template tag for raw SQL when Drizzle's query builder is insufficient (drift computation queries, aggregations).

**What Drizzle does NOT provide (and we don't use):**
- `drizzle-kit push` or `drizzle-kit migrate` for auto-generated migrations. We write migrations by hand as versioned SQL files.
- `drizzle-studio` or any GUI tooling.

### 3. Event-sourced timeline_events as the drift computation foundation

**Choice:** An append-only `timeline_events` table that records every act lifecycle transition with both planned and actual timestamps.

**Why event sourcing?**
- The `acts` table stores current state (status, startedAt, completedAt). But current state cannot answer "how far behind schedule was Act 3 when it started?" because that requires knowing the *planned* start time, which shifts as earlier acts run over or under.
- Event sourcing captures the full temporal story: when each event was planned to happen (based on lineup order + cumulative durations at plan time) and when it actually happened.
- Drift is computed per-event: `drift_seconds = (actual_start - planned_start) / 1000`. Cumulative drift is a simple `SUM(drift_seconds)` query.

**Event types:**
- `act_planned` -- Recorded when the show starts (Going Live). One event per act, capturing the planned_start and planned_end based on lineup order and durations.
- `act_started` -- Recorded when `startAct()` fires. Captures actual_start.
- `act_completed` -- Recorded when `completeAct()` fires. Captures actual_end.
- `act_skipped` -- Recorded when `skipAct()` fires.
- `act_extended` -- Recorded when `extendAct()` fires. Metadata includes extension minutes.
- `act_reordered` -- Recorded when `reorderAct()` fires mid-show. Metadata includes old and new sort positions.
- `beat_locked` / `beat_skipped` -- Recorded on beat check resolution.
- `intermission_start` / `intermission_end` -- Intermission boundaries.
- `show_started` / `show_struck` -- Show-level bookends.
- `director_entered` -- Director Mode invocations (useful for understanding show disruptions).

**Volume estimate:** A typical 5-8 act day generates 30-60 timeline events. This is trivial for SQLite. No pagination, indexing, or archival needed for v1.

### 4. Sync engine: Zustand to SQLite on debounce + phase transitions

**Choice:** A `SyncEngine` class in the main process that receives state snapshots from the renderer via IPC and writes them to SQLite using two strategies.

**Strategy A -- Debounced periodic writes (5-second interval):**
- The renderer subscribes to Zustand state changes via `useShowStore.subscribe()`.
- On each change, the renderer calls `window.clui.saveShow(stateSnapshot)` (fire-and-forget IPC).
- The main process SyncEngine debounces these calls with a 5-second timer. Only the latest snapshot is written.
- This handles gradual state changes (timer ticks are NOT synced -- only state shape changes like act field updates).

**Strategy B -- Immediate flush on phase transitions:**
- When the phase changes (startAct, completeAct, skipAct, enterIntermission, exitIntermission, strikeTheStage), the renderer calls `window.clui.flushShow(stateSnapshot)` (invoke IPC, awaited).
- The SyncEngine cancels any pending debounce timer and writes immediately.
- Additionally, the SyncEngine records the appropriate `timeline_event` for the transition.

**Hydration (SQLite to Zustand on launch):**
1. Main process `app.on('ready')` initializes DataService (opens DB, runs migrations).
2. Main process loads today's show via `ShowRepository.loadByDate(today())`.
3. If a show exists, main process sends the saved state to the renderer via IPC (`clui:hydrate-show` event).
4. Renderer's showStore receives the hydration payload and calls `set(savedState)`, overriding the localStorage-based persist rehydration.
5. If no show exists for today, the renderer proceeds with the default `no_show` initial state.

**Why the renderer initiates writes (not the main process polling):**
- The renderer owns the Zustand store. It knows when state changes.
- The main process has no visibility into Zustand state unless the renderer sends it.
- Polling from main would require a new IPC channel (main-to-renderer request), which inverts the existing communication pattern.

**Why debounce instead of write-on-every-change:**
- During a live act, Zustand fires `set()` on every timer-related state update. Writing to SQLite on every tick would be ~1 write/second with no data change worth persisting.
- The 5-second debounce coalesces rapid changes while ensuring no more than 5 seconds of data loss on crash.

### 5. IPC pattern: main process owns DataService, renderer requests via typed handlers

**Choice:** Extend the existing `window.clui` API with new data-specific methods. All database access flows through `ipcMain.handle()` handlers that delegate to `DataService`.

**New IPC methods on `window.clui`:**
```typescript
// Persistence (renderer → main)
saveShow(state: ShowSnapshot): void              // fire-and-forget, debounced in main
flushShow(state: ShowSnapshot): Promise<void>    // invoke, immediate write + timeline event
recordTimelineEvent(event: TimelineEventInput): Promise<void>

// Hydration (main → renderer, on launch)
onHydrateShow(callback: (state: ShowSnapshot) => void): () => void

// Queries (renderer → main, for Rundown Bar)
getDriftReport(showId: string): Promise<DriftReport>
getTimelineEvents(showId: string): Promise<TimelineEvent[]>

// Claude context
saveClaudeContext(ctx: ClaudeContextInput): Promise<void>
loadClaudeContext(showId: string): Promise<ClaudeContext | null>
```

**New IPC constants in `shared/types.ts`:**
```typescript
SAVE_SHOW: 'showtime:save-show'
FLUSH_SHOW: 'showtime:flush-show'
HYDRATE_SHOW: 'showtime:hydrate-show'
RECORD_TIMELINE_EVENT: 'showtime:record-timeline-event'
GET_DRIFT_REPORT: 'showtime:get-drift-report'
GET_TIMELINE_EVENTS: 'showtime:get-timeline-events'
SAVE_CLAUDE_CONTEXT: 'showtime:save-claude-context'
LOAD_CLAUDE_CONTEXT: 'showtime:load-claude-context'
```

**Why not a generic `query` IPC?** A generic `window.clui.query(sql)` would expose the full SQLite surface to the renderer, violating the principle of least privilege. Each operation gets its own typed handler with validated inputs.

### 6. electron-rebuild for native module compatibility

**Choice:** Use `@electron/rebuild` as a postinstall hook to compile `better-sqlite3` against Electron's Node.js ABI.

**Implementation:**
```json
{
  "scripts": {
    "postinstall": "electron-rebuild -f -w better-sqlite3"
  },
  "devDependencies": {
    "@electron/rebuild": "^3.x"
  }
}
```

**Why this is necessary:** Electron ships its own V8 and Node.js ABI, which differs from the system Node.js. Native modules compiled by `npm install` target the system ABI. Without `electron-rebuild`, `better-sqlite3` crashes with `NODE_MODULE_VERSION mismatch` at runtime.

**CI/CD impact:** The rebuild step adds ~10-15 seconds to CI builds. It must run on the same platform as the target (macOS for macOS builds). This is already the case since Showtime is macOS-only.

### 7. RundownBar layout: computed on act lifecycle events, NOT on timer ticks

**Choice:** The RundownBar component computes block widths, overrun percentages, and the NOW marker position only when the act list or act statuses change -- not on every timer tick.

**Why not recompute on every tick?**
- Block widths are derived from planned durations (static) and actual durations (change only on act complete/extend). Recomputing on every tick wastes CPU on identical results.
- The NOW marker position is the only time-dependent element. It is computed via CSS (`left: calc(...)`) relative to the current act's elapsed percentage, which the browser updates via a single `requestAnimationFrame` or CSS transition.

**Layout computation:**
1. Total show duration = sum of all act planned durations (for proportional block widths).
2. Each block's width = `(act.durationMinutes / totalDuration) * 100%`.
3. Completed blocks use actual duration for width if it differs from planned (overrun or underrun).
4. Overrun hatching width = `((actualDuration - plannedDuration) / plannedDuration) * 100%` of the block, capped at the block boundary.
5. NOW marker position = percentage through the total timeline based on elapsed time since show start.

**Recomputation triggers:**
- `startAct` -- active block changes, NOW marker resets to start of new block.
- `completeAct` -- block transitions from active to completed, overrun computed.
- `skipAct` -- block marked as skipped (dimmed, no overrun).
- `extendAct` -- block planned duration updated, widths recalculated.
- `reorderAct` -- block positions change.
- `enterIntermission` / `exitIntermission` -- NOW marker pauses/resumes.

**NOT triggers:** Timer ticks, beat checks, celebration animations, Director Mode entry.

### 8. Migration strategy: versioned SQL files, forward-only, idempotent

**Choice:** Hand-written SQL migration files in `src/main/data/migrations/`, named `001_initial_schema.sql`, `002_add_column_x.sql`, etc. A `MigrationRunner` class executes them sequentially on app launch.

**Migration runner behavior:**
1. On DataService init, open (or create) the SQLite database.
2. Create the `_migrations` table if it does not exist.
3. Read all `*.sql` files from the migrations directory, sorted by numeric prefix.
4. For each migration not yet recorded in `_migrations`, execute it within a transaction.
5. Record the migration version and timestamp in `_migrations`.

**Idempotency:** Each migration uses `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` (SQLite 3.35+), or guards with `SELECT` checks before `INSERT`. The runner skips migrations already recorded in `_migrations`, so re-running is safe.

**Forward-only:** No rollback mechanism. If a migration fails, the transaction rolls back and the app logs the error. The user sees the previous schema. Destructive migrations (DROP TABLE, DROP COLUMN) are prohibited in v1.

**Initial migration (`001_initial_schema.sql`):**
- Creates `shows`, `acts`, `timeline_events`, `claude_contexts`, and `_migrations` tables.
- Enables WAL mode: `PRAGMA journal_mode=WAL;`
- Enables foreign keys: `PRAGMA foreign_keys=ON;`
- Creates indexes: `idx_acts_show_id`, `idx_timeline_events_show_id`, `idx_timeline_events_act_id`, `idx_shows_date`.

### 9. Testing: Playwright + Electron for E2E, Vitest for unit

**Choice:** All features require both unit and E2E test coverage, per CLAUDE.md rule #6.

**Unit tests (Vitest, `src/__tests__/`):**
- `DataService`: Open/close database, run migrations, CRUD on all 5 tables.
- `SyncEngine`: Debounce behavior (state change within 5s window coalesces to one write), immediate flush on phase transition (cancels debounce timer), hydration payload shape.
- `MigrationRunner`: Applies new migrations, skips already-applied, handles failure (transaction rollback).
- `TimelineRepository`: Record events, compute drift report, handle edge cases (no events, single act, all acts skipped).
- `RundownBar layout math`: Block width calculation, NOW marker position, overrun percentage, schedule badge text.

**E2E tests (Playwright, `e2e/`):**
- App launches and creates `showtime.db` in the app data directory.
- Full show flow (energy -> plan -> lineup -> live -> complete acts -> strike) persists to SQLite. Kill and restart: show resumes from persisted state.
- Timeline events are recorded on act start/complete/skip. Verified by querying the database file directly in the test.
- RundownBar renders correct number of blocks matching act count.
- NOW marker is visible and positioned within the active act block.
- Drift badge shows correct "Xm behind" text after an act runs over.
- Act runs over planned duration: overrun hatching appears on the completed block.
- MiniRundownStrip appears in PillView with proportional colored segments.
- Plan modification (reorder acts mid-show): timeline_event of type `act_reordered` recorded.
- Strike view shows final drift summary.

**Verification commands (must all pass before declaring completion):**
```bash
npm run build          # TypeScript + Vite build
npm run test           # Vitest unit tests
npm run test:e2e       # Playwright E2E (launches Electron)
npx tsc --noEmit       # Type checking
```

### 10. Database location: `app.getPath('userData') + '/showtime.db'`

**Choice:** Store the SQLite database file in Electron's standard user data directory.

**Path:** `~/Library/Application Support/Showtime/showtime.db` (macOS).

**Why `app.getPath('userData')`?**
- Standard Electron convention. Survives app updates (the binary changes, user data persists).
- Backed up by Time Machine and iCloud Drive (if the user has ~/Library backup enabled).
- No permission issues -- the app has full read/write access to its own userData directory.
- The directory is created automatically by Electron on first launch.

**Why not the project directory or cwd?**
- Showtime is a user-facing app, not a development tool. The database should live with user data, not in a code repository.
- `process.cwd()` varies depending on how the app is launched (from terminal vs Finder vs dock).

**WAL mode files:** SQLite in WAL mode creates `showtime.db-wal` and `showtime.db-shm` alongside the main file. These are transient and managed by SQLite automatically. They do not need to be backed up separately.

---

## Risks / Trade-offs

### 1. Native dependency build complexity

**Risk:** `better-sqlite3` is a C++ native module. It must be compiled against Electron's specific Node.js ABI version. If the Electron version is updated, `electron-rebuild` must re-run. On rare occasions, `better-sqlite3` releases lag behind new Node.js ABI versions, causing build failures.

**Mitigation:** Pin both `electron` and `better-sqlite3` versions in `package.json`. Run `electron-rebuild` in the `postinstall` script so it triggers automatically. Document the rebuild step in CLAUDE.md under a new "Build" section.

**Likelihood:** Low for v1 (versions are pinned). Moderate on Electron upgrades.

### 2. Two sources of truth during runtime

**Risk:** Zustand (renderer) and SQLite (main process) both hold show state. If the IPC write fails silently (e.g., the main process crashes, the IPC channel is saturated), Zustand and SQLite diverge. On next launch, SQLite hydrates stale data, losing the user's progress.

**Mitigation:**
- Phase-transition flushes use `ipcRenderer.invoke()` (awaited), not `send()` (fire-and-forget). If the write fails, the promise rejects and the renderer can retry or warn the user.
- Debounced writes use `send()` but include a sequence number. The main process logs dropped writes. On app quit, a final synchronous flush ensures the latest state is persisted.
- The `localStorage` persist middleware remains as a secondary cache. If SQLite hydration returns stale data, the renderer can compare timestamps with localStorage and use the newer source.

**Likelihood:** Low in normal operation. The IPC channel is reliable within a single Electron process. The risk is primarily during crash scenarios.

### 3. Schema migration forward-only constraint

**Risk:** If a migration introduces a bug (e.g., a `NOT NULL` column without a default), it cannot be rolled back. The user's database is stuck on the broken schema until a new forward migration fixes it.

**Mitigation:**
- All new columns must have defaults or be nullable.
- Migrations are tested in CI before release. The MigrationRunner runs against a fresh database and an existing database with test data.
- Emergency fix path: ship a new `002_fix_xxx.sql` migration that corrects the issue. Users get the fix on next app launch.

**Likelihood:** Low if migrations are reviewed carefully. The 5-table schema is simple enough that destructive mistakes are unlikely.

### 4. RundownBar performance with many acts

**Risk:** If a user creates a large number of acts (>20), the RundownBar's proportional layout compresses each block to a few pixels, making labels unreadable and tooltips awkward.

**Mitigation:** The RundownBar only renders act labels when the block width exceeds a minimum threshold (e.g., 30px). Narrow blocks show only the act number. Tooltips remain functional on hover regardless of block width. In practice, the SNL Day Framework recommends 3-7 acts per day, so >20 acts is an extreme edge case.

**Likelihood:** Very low. The framework discourages excessive act counts.

### 5. Hydration race with Zustand persist middleware

**Risk:** On app launch, two hydration sources compete: (a) Zustand's `persist` middleware rehydrates from localStorage synchronously during store creation, and (b) the main process sends SQLite data via IPC asynchronously. If localStorage has newer data than SQLite (e.g., SQLite write was debounced and the app crashed before flush), the SQLite hydration would overwrite the newer localStorage state.

**Mitigation:** Compare `updated_at` timestamps. The hydration handler in the renderer only applies SQLite state if its `updated_at` is >= the localStorage state's last-known write time. If localStorage is newer (crash recovery scenario), it wins and the renderer sends the localStorage state back to SQLite to sync up.

**Likelihood:** Low in normal operation. Only manifests if the app crashes between a state change and the next 5-second debounce window -- a <=5 second exposure window.

### 6. Rundown Bar adds visual complexity to the Expanded View

**Risk:** The Expanded View (560x620) already contains the ON AIR indicator, clapperboard badge, timer hero, progress bar, action buttons, and lineup sidebar. Adding a 28px RundownBar between the ON AIR indicator and the timer could feel cluttered, especially on smaller displays.

**Mitigation:** The RundownBar is designed to be glanceable, not interactive. Its 28px height is shorter than a single line of body text. The mockup (`direction-a-rundown-bar.html`) validates that it integrates cleanly between the ON AIR row and the timer section. If user testing reveals clutter, the RundownBar can be collapsed to a 4px strip (matching the PillView treatment) via a user preference -- but this is not built in v1.
