# E2E Test Isolation — Fresh Sessions, Test Accounts, Idempotent Fixtures

GitHub Issue: #42

## Why

SQLite persistence + session resume works correctly in production, but creates a testing problem:
- The app resumes from cached state — tests can't reliably start from a clean slate
- There's no concept of "test accounts" or isolated test databases
- Test fixtures seed data into a shared DB that persists across runs
- `clearShowHistory()` IPC doesn't exist — there's no way to clean up
- Manual testing requires Settings → Reset Show before each test

This isn't a bug — it's missing test infrastructure. The concepts of **idempotency**, **test fixtures**, and **session isolation** need to be designed properly.

## Phase 1: Design Document

**Create a design doc first** at `docs/plans/test-isolation-design.md` covering:

### 1. Test Database Isolation Strategy

Evaluate and choose one approach:

**Option A: Per-Test DB Path** (recommended)
- When `SHOWTIME_TEST=1` env var is set, use `showtime-test-{workerIndex}.db` instead of `showtime.db`
- Each Playwright worker gets its own DB — zero contention
- Playwright `globalSetup` deletes test DBs before suite starts
- Playwright `globalTeardown` cleans up test DBs

**Option B: Reset IPC**
- Add `resetAllData()` IPC handler that truncates all tables
- Call in `beforeEach` — slower but simpler
- Risk: race conditions if tests run in parallel

**Option C: In-Memory DB for Tests**
- Use `:memory:` SQLite database when `SHOWTIME_TEST=1`
- Fastest, zero disk I/O, perfect isolation
- Drawback: can't inspect DB state after test failure

### 2. Idempotent Test Fixtures

Design a fixture system where:
- Each test declares exactly what state it needs (not what it modifies)
- Fixtures are applied atomically — seed state, navigate, assert
- No test depends on output from a previous test
- Running a test 10 times produces the same result

### 3. Test Session Lifecycle

Define test lifecycle hooks:
```
globalSetup:    Create test DB, run migrations
beforeEach:     Seed fixture state (localStorage + SQLite), navigate to starting view
test:           Run assertions
afterEach:      Screenshot on failure, cleanup transient state
globalTeardown: Delete test DBs
```

### 4. Fresh Start vs Resume Testing

Two test categories:
- **Cold start tests**: App has no prior data → Dark Studio
- **Resume tests**: App has prior show data → resumes mid-show
- Both need explicit fixtures, not implicit state

### 5. Dev-Mode Reset

- `Cmd+Shift+R` shortcut (dev only) → reset to fresh state
- Settings → "Reset Show" already exists but is buried
- Consider tray menu item: "New Show" for quick reset

## Phase 2: Implementation

Based on the design doc, implement:

1. **Test DB isolation** (chosen approach from design)
2. **`resetAllData()` IPC handler** — truncate all tables, clear localStorage, reset Zustand
3. **Updated `e2e/fixtures.ts`** — `freshStart()` helper that guarantees clean slate
4. **Playwright config updates** — `globalSetup`/`globalTeardown` for DB lifecycle
5. **Dev reset shortcut** — `Cmd+Shift+R` in main process
6. **Update existing E2E tests** to use new isolation

## IMPORTANT RULES (from CLAUDE.md)
- Playwright E2E is mandatory — every feature needs E2E coverage
- Test before commit: `npm run test && npm run test:e2e`
- Never commit with failing tests
