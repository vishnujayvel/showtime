# Capability: data-persistence

Provides a SQLite-backed persistence layer for Showtime, replacing the volatile
Zustand-only storage with durable, versioned data that survives app restarts.
All database access lives in the Electron main process; the renderer reads and
writes exclusively through the typed IPC bridge (`window.clui`).

**Source proposal:** `openspec/changes/showtime-data-layer-rundown/proposal.md`

---

## ADDED Requirements

### Requirement: Database initialization

The app SHALL initialize a SQLite database on first launch using `better-sqlite3`
(synchronous native driver) managed by `drizzle-orm` for type-safe queries.

- The database file SHALL be stored at `<app.getPath('userData')>/showtime.db`.
- Initialization SHALL occur during the Electron `app.whenReady()` lifecycle,
  before the main window is created.
- If the database file does not exist, it SHALL be created automatically.
- The `DataService` facade SHALL be a singleton instantiated once in
  `src/main/data/DataService.ts` and imported by `src/main/index.ts`.

#### Scenario: First launch creates database

- **WHEN** the app launches for the first time and no `showtime.db` exists
- **THEN** a new SQLite database file SHALL be created at the userData path
- **THEN** all migrations SHALL run to produce the initial schema
- **THEN** the app SHALL proceed to render the Dark Studio view

#### Scenario: Subsequent launch reuses database

- **WHEN** the app launches and `showtime.db` already exists
- **THEN** the existing database SHALL be opened without data loss
- **THEN** only unapplied migrations SHALL run

---

### Requirement: Schema and migrations

The database schema SHALL be defined in `src/main/data/schema.ts` using Drizzle
table definitions. Migrations SHALL be forward-only, versioned SQL files stored
in `src/main/data/migrations/`.

The schema SHALL contain 5 tables:

1. **`shows`** -- one row per calendar day.
   - `id` TEXT PRIMARY KEY (ISO date string, e.g. `"2026-03-21"`)
   - `phase` TEXT NOT NULL (one of: `no_show`, `writers_room`, `live`, `intermission`, `director`, `strike`)
   - `energy` TEXT (one of: `high`, `medium`, `low`, `recovery`, or NULL)
   - `verdict` TEXT (one of: `DAY_WON`, `SOLID_SHOW`, `GOOD_EFFORT`, `SHOW_CALLED_EARLY`, or NULL)
   - `beats_locked` INTEGER NOT NULL DEFAULT 0
   - `beat_threshold` INTEGER NOT NULL DEFAULT 3
   - `started_at` INTEGER (unix ms, nullable)
   - `ended_at` INTEGER (unix ms, nullable)
   - `plan_text` TEXT (original Writer's Room plan dump, nullable)

2. **`acts`** -- N per show.
   - `id` TEXT PRIMARY KEY (8-char random alphanumeric, matching current `generateId()`)
   - `show_id` TEXT NOT NULL REFERENCES shows(id) ON DELETE CASCADE
   - `name` TEXT NOT NULL
   - `sketch` TEXT NOT NULL
   - `category` TEXT
   - `planned_duration_ms` INTEGER NOT NULL
   - `actual_duration_ms` INTEGER
   - `sort_order` INTEGER NOT NULL
   - `status` TEXT NOT NULL (one of: `pending`, `active`, `completed`, `cut`)
   - `beat_locked` INTEGER NOT NULL DEFAULT 0
   - `planned_start_at` INTEGER
   - `actual_start_at` INTEGER
   - `actual_end_at` INTEGER

3. **`timeline_events`** -- event-sourced log of everything that happened.
   - `id` INTEGER PRIMARY KEY AUTOINCREMENT
   - `show_id` TEXT NOT NULL REFERENCES shows(id) ON DELETE CASCADE
   - `act_id` TEXT REFERENCES acts(id) ON DELETE SET NULL
   - `event_type` TEXT NOT NULL (one of: `act_planned`, `act_started`, `act_paused`, `act_resumed`, `act_extended`, `act_completed`, `act_cut`, `act_reordered`, `intermission_started`, `intermission_ended`, `show_started`, `show_ended`)
   - `planned_start` INTEGER
   - `planned_end` INTEGER
   - `actual_start` INTEGER
   - `actual_end` INTEGER
   - `drift_seconds` INTEGER (computed: actual minus planned)
   - `metadata` TEXT (JSON blob for event-specific data)
   - `created_at` INTEGER NOT NULL

4. **`claude_contexts`** -- preserve Claude conversation context between sessions.
   - `id` INTEGER PRIMARY KEY AUTOINCREMENT
   - `show_id` TEXT NOT NULL REFERENCES shows(id) ON DELETE CASCADE
   - `energy` TEXT
   - `plan_text` TEXT
   - `lineup_json` TEXT
   - `session_id` TEXT
   - `created_at` INTEGER NOT NULL

5. **`_migrations`** -- schema version tracking.
   - `version` INTEGER PRIMARY KEY
   - `name` TEXT NOT NULL
   - `applied_at` INTEGER NOT NULL

#### Scenario: Initial migration creates all tables

- **WHEN** `MigrationRunner` runs against an empty database
- **THEN** `001_initial_schema.sql` SHALL execute, creating all 5 tables
- **THEN** a row SHALL be inserted into `_migrations` with `version=1`

#### Scenario: Migrations are idempotent

- **WHEN** `MigrationRunner` runs and `_migrations` already contains version 1
- **THEN** migration 001 SHALL be skipped
- **THEN** only migrations with versions higher than the max applied version SHALL execute

#### Scenario: Forward-only enforcement

- **WHEN** a migration file has a version number lower than or equal to the current max
- **THEN** it SHALL be skipped, never rolled back or re-applied

---

### Requirement: Show CRUD

`ShowRepository` in `src/main/data/ShowRepository.ts` SHALL provide methods for
creating, reading, updating, and querying show records.

- `upsertShow(show)` SHALL insert or update a show row keyed by date.
- `getShow(dateId)` SHALL return the show for a given date, or null.
- `getTodayShow()` SHALL return the show for today's date.
- `updatePhase(dateId, phase)` SHALL update only the phase column.
- `updateVerdict(dateId, verdict)` SHALL update only the verdict column.

#### Scenario: Create today's show

- **WHEN** `upsertShow` is called with today's date and phase `writers_room`
- **THEN** a row SHALL be inserted into `shows` with the provided values
- **THEN** `getTodayShow()` SHALL return that row

#### Scenario: Update show phase

- **WHEN** `updatePhase` is called with `"live"`
- **THEN** only the `phase` column SHALL change; all other columns SHALL remain untouched

#### Scenario: Upsert is idempotent

- **WHEN** `upsertShow` is called twice with the same date but different energy values
- **THEN** the second call SHALL update the existing row, not create a duplicate

---

### Requirement: Act CRUD

`ActRepository` in `src/main/data/ActRepository.ts` SHALL provide methods for
creating, reading, updating, and deleting act records.

- `insertActs(showId, acts[])` SHALL bulk-insert acts for a show.
- `getActsForShow(showId)` SHALL return all acts for a show, ordered by `sort_order`.
- `updateActStatus(actId, status, timestamps?)` SHALL update status and optional timestamp fields.
- `updateActOrder(actId, newOrder)` SHALL update the `sort_order`.
- `deleteAct(actId)` SHALL remove an act and its associated timeline events.

#### Scenario: Bulk insert acts from lineup

- **WHEN** `insertActs` is called with 5 acts after Writer's Room
- **THEN** 5 rows SHALL be inserted into `acts` with sequential `sort_order` values 0-4
- **THEN** `getActsForShow` SHALL return them in `sort_order` order

#### Scenario: Complete an act

- **WHEN** `updateActStatus(actId, 'completed', { actual_end_at: Date.now() })` is called
- **THEN** the act's `status` SHALL become `completed`
- **THEN** `actual_end_at` SHALL be set to the provided timestamp
- **THEN** `actual_duration_ms` SHALL be computed as `actual_end_at - actual_start_at`

#### Scenario: Delete a cut act

- **WHEN** `deleteAct` is called for an act that was cut mid-show
- **THEN** the act row SHALL be removed
- **THEN** timeline events referencing that act SHALL have `act_id` set to NULL (ON DELETE SET NULL)

---

### Requirement: Timeline events

`TimelineRepository` in `src/main/data/TimelineRepository.ts` SHALL provide
methods for recording and querying the event-sourced timeline log.

- `recordEvent(event)` SHALL insert a timeline event with `created_at` set to `Date.now()`.
- `getEventsForShow(showId)` SHALL return all events for a show, ordered by `created_at`.
- `getEventsForAct(actId)` SHALL return all events for a specific act.
- `computeDrift(showId)` SHALL return cumulative drift in seconds for the show
  by summing `drift_seconds` across all act-level events.
- `getDriftPerAct(showId)` SHALL return per-act drift as an array of
  `{ actId, actName, driftSeconds, plannedMs, actualMs }`.

#### Scenario: Record act started event

- **WHEN** an act transitions from `upcoming` to `active`
- **THEN** a timeline event SHALL be recorded with `event_type = 'act_started'`, `actual_start = Date.now()`, and `planned_start` from the act's scheduled position

#### Scenario: Record act completed with drift

- **WHEN** an act completes and ran 3 minutes longer than planned
- **THEN** a timeline event SHALL be recorded with `event_type = 'act_completed'`
- **THEN** `drift_seconds` SHALL be `180` (positive = overrun, negative = underrun)

#### Scenario: Query cumulative drift

- **WHEN** `computeDrift(showId)` is called for a show with 3 completed acts
- **THEN** the returned value SHALL be the algebraic sum of all per-act drift_seconds values

#### Scenario: Record intermission events

- **WHEN** the user enters intermission
- **THEN** a timeline event SHALL be recorded with `event_type = 'intermission_started'`
- **WHEN** the user exits intermission
- **THEN** a timeline event SHALL be recorded with `event_type = 'intermission_ended'`

---

### Requirement: Claude context persistence

`ClaudeContextRepository` in `src/main/data/ClaudeContextRepository.ts` SHALL
persist Claude conversation context so the AI can resume awareness after restart.

- `saveContext(ctx)` SHALL insert a new context row linked to a show.
- `getLatestContext(showId)` SHALL return the most recent context for a show.
- Context rows SHALL capture: `energy`, `plan_text`, `lineup_json` (serialized act array), and `session_id`.

#### Scenario: Save context after Writer's Room

- **WHEN** the user completes Writer's Room and a lineup is finalized
- **THEN** a claude_contexts row SHALL be inserted with the energy level, plan text, and serialized lineup JSON

#### Scenario: Restore context on restart

- **WHEN** the app restarts mid-show and `getLatestContext(todayShowId)` is called
- **THEN** the returned context SHALL contain the energy, plan text, and lineup from before the restart

---

### Requirement: Sync engine

`SyncEngine` in `src/main/data/SyncEngine.ts` SHALL provide bidirectional
synchronization between the Zustand store (renderer) and the SQLite database
(main process).

**Hydration (SQLite -> Zustand):**
- On app launch, the SyncEngine SHALL check for a show matching today's date.
- If a show exists and its phase is not `no_show` or `strike`, the Zustand store
  SHALL be hydrated with the persisted show state (phase, energy, acts, beats,
  verdict).
- If the show's date does not match today, the SyncEngine SHALL NOT hydrate
  (day boundary reset takes precedence).

**Writes (Zustand -> SQLite):**
- State changes SHALL be written to SQLite via a debounced write with a 5-second
  interval.
- Phase transitions (`writers_room -> live`, `live -> intermission`, etc.) SHALL
  trigger an immediate flush, bypassing the debounce timer.
- Act lifecycle events (`startAct`, `completeAct`, `skipAct`, `extendAct`) SHALL
  trigger an immediate flush for the affected act row and a timeline event insert.
- The SyncEngine SHALL use `requestIdleCallback` or equivalent to avoid blocking
  the main process event loop during bulk writes.

**Conflict resolution:**
- Zustand is the source of truth for the current session.
- SQLite is the source of truth for historical data and cross-restart recovery.
- On hydration, the SyncEngine SHALL merge by preferring the SQLite state for
  completed shows and the Zustand state for in-progress shows if both exist
  (edge case: crash during phase transition).

#### Scenario: Hydrate show on launch

- **WHEN** the app launches and SQLite contains a show for today with phase `live` and 3 acts
- **THEN** the Zustand store SHALL be initialized with phase `live`, the 3 acts (with their statuses), beats locked count, and timer state reconstructed from the active act's `actual_start_at` + `planned_duration_ms`

#### Scenario: Debounced write on minor state change

- **WHEN** the user's timer ticks (no phase change, no act lifecycle event)
- **THEN** the SyncEngine SHALL NOT write to SQLite on every tick
- **THEN** the debounced writer SHALL flush at most once per 5 seconds

#### Scenario: Immediate flush on phase transition

- **WHEN** `startShow()` transitions the phase from `writers_room` to `live`
- **THEN** the SyncEngine SHALL immediately write the show row, all act rows, and a `show_started` timeline event to SQLite
- **THEN** the debounce timer SHALL be reset

#### Scenario: Immediate flush on act complete

- **WHEN** `completeAct(actId)` is called
- **THEN** the SyncEngine SHALL immediately update the act row (`status`, `actual_end_at`, `actual_duration_ms`) and insert an `act_completed` timeline event

#### Scenario: Day boundary prevents stale hydration

- **WHEN** the app launches and SQLite contains a show from yesterday
- **THEN** the SyncEngine SHALL NOT hydrate the Zustand store
- **THEN** the app SHALL start in `no_show` phase (Dark Studio)

#### Scenario: App quit triggers final flush

- **WHEN** the user quits the app (or `app.on('before-quit')` fires)
- **THEN** the SyncEngine SHALL perform a synchronous final flush of all pending state to SQLite

---

### Requirement: IPC bridge for data operations

New IPC channels SHALL be added to `src/shared/types.ts` (in the `IPC` constant)
and exposed through `window.clui` in `src/preload/index.ts`.

New IPC channels:
- `showtime:data-hydrate` -- renderer requests hydration payload on launch (invoke)
- `showtime:data-sync` -- renderer pushes state snapshot to main for persistence (send)
- `showtime:data-flush` -- renderer requests immediate flush (invoke)
- `showtime:timeline-events` -- renderer requests timeline events for a show (invoke)
- `showtime:timeline-drift` -- renderer requests drift computation for a show (invoke)
- `showtime:timeline-drift-per-act` -- renderer requests per-act drift breakdown (invoke)
- `showtime:claude-context-save` -- renderer pushes Claude context for persistence (send)
- `showtime:claude-context-get` -- renderer requests latest Claude context (invoke)

New `window.clui` methods:
- `dataHydrate(): Promise<HydrationPayload | null>`
- `dataSync(snapshot: ShowStateSnapshot): void`
- `dataFlush(): Promise<void>`
- `getTimelineEvents(showId: string): Promise<TimelineEvent[]>`
- `getTimelineDrift(showId: string): Promise<number>`
- `getTimelineDriftPerAct(showId: string): Promise<ActDrift[]>`
- `saveClaudeContext(ctx: ClaudeContextPayload): void`
- `getClaudeContext(showId: string): Promise<ClaudeContextPayload | null>`

All IPC handlers SHALL be registered in `src/main/index.ts` during `app.whenReady()`,
after `DataService` initialization.

#### Scenario: Renderer requests hydration

- **WHEN** the renderer calls `window.clui.dataHydrate()` on mount
- **THEN** the main process SHALL query SQLite for today's show and acts
- **THEN** if a resumable show exists, it SHALL return a `HydrationPayload` containing the show state, acts array, beats locked count, and timer reconstruction data
- **THEN** if no resumable show exists, it SHALL return `null`

#### Scenario: Renderer pushes state sync

- **WHEN** the renderer calls `window.clui.dataSync(snapshot)` with the current Zustand state
- **THEN** the main process SHALL queue the snapshot for debounced write to SQLite

#### Scenario: Renderer queries timeline drift

- **WHEN** the renderer calls `window.clui.getTimelineDrift(showId)`
- **THEN** the main process SHALL compute cumulative drift from `timeline_events` and return it as an integer (seconds)

#### Scenario: IPC bridge type safety

- **WHEN** any new IPC method is added
- **THEN** it MUST have a corresponding TypeScript type in `src/shared/types.ts`
- **THEN** the `CluiAPI` interface in `src/preload/index.ts` MUST include the method signature
