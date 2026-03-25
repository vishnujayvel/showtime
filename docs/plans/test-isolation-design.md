# E2E Test Isolation — Design Document

**Issue:** #42
**Date:** 2026-03-24

## 1. Current State Analysis

### What Already Works

The test infrastructure in `e2e/fixtures.ts` already provides solid isolation:

- **Per-worker userData** — Each Playwright worker gets `$TMPDIR/showtime-test-{workerIndex}` via `SHOWTIME_USER_DATA` env var. The main process reads this in `src/main/index.ts:35-37` and redirects Electron's userData path.
- **SQLite isolation** — Since `DataService.init()` creates the DB inside userData, each worker gets its own database file automatically.
- **Worker cleanup** — `fs.rmSync(userDataDir, ...)` in the fixture teardown deletes the entire temp directory.
- **Onboarding bypass** — Tests set `showtime-onboarding-complete` in localStorage.

### What's Missing

1. **No mid-test state reset** — Once the app is launched (worker-scoped), there's no way to reset SQLite tables between tests within the same worker. `seedFixture()` replaces localStorage but the DB retains rows from prior tests.

2. **No `resetAllData()` IPC** — The proposal correctly identifies this gap. Tests that create shows, timeline events, or metrics pollute the DB for subsequent tests.

3. **State bleed via Zustand** — `seedFixture()` writes to localStorage and reloads, but Zustand's in-memory state may retain stale references during the reload cycle. The `navigateAndWaitPage()` function does a full page reload which should clear this, but the 3-second wait is fragile.

4. **No cold-start vs resume distinction** — All tests clear localStorage and reload, which simulates a cold start. There are no fixtures for testing resume behavior (app reopened with existing show data).

## 2. Test Database Isolation Strategy

### Chosen Approach: Option A — Per-Worker DB Path (Already Implemented) + Option B — Reset IPC (New)

Per-worker isolation is already in place. The missing piece is **intra-worker reset** for tests that need a clean slate without relaunching the entire app.

### Implementation: `resetAllData()` IPC

```typescript
// src/main/ipc/showtime.ts
ipcMain.handle(IPC.RESET_ALL_DATA, () => {
  try {
    const data = DataService.getInstance()
    data.resetAll() // Truncates all tables, resets sequences
    log('Showtime: All data reset via IPC')
    return { success: true }
  } catch (err: unknown) {
    log(`RESET_ALL_DATA error: ${err instanceof Error ? err.message : String(err)}`)
    return { success: false, error: String(err) }
  }
})
```

```typescript
// src/main/data/DataService.ts — add method
resetAll(): void {
  const tables = ['shows', 'timeline_events', 'metrics', 'claude_context']
  for (const table of tables) {
    this.db.exec(`DELETE FROM ${table}`)
  }
}
```

```typescript
// src/preload/index.ts — expose on window.clui
resetAllData: () => ipcRenderer.invoke('showtime:reset-all-data'),
```

### Why Not In-Memory DB (Option C)

In-memory DB (`:memory:`) would provide perfect isolation but:
- Can't inspect DB state after test failure (critical for debugging)
- `DataService.init()` uses file-based path from `app.getPath('userData')` — switching to `:memory:` requires conditional logic that shouldn't exist in production code
- Per-worker file DBs are already fast enough (SQLite on tmpfs)

## 3. Idempotent Test Fixtures

### Design Principles

1. **Fixtures declare desired state, not mutations** — each fixture is a complete snapshot
2. **Atomic seeding** — localStorage + SQLite + Zustand all set in one operation
3. **Zero dependency between tests** — running any test in isolation produces the same result
4. **10x replay invariant** — running a test 10 times produces 10 identical results

### Enhanced `seedFixture()` with SQLite Reset

```typescript
export async function seedFixture(page: Page, fixture: Readonly<Record<string, unknown>>) {
  // Step 1: Reset SQLite data via IPC
  await page.evaluate(() => window.clui.resetAllData())

  // Step 2: Set localStorage state (existing logic)
  await page.evaluate((state) => {
    const fullState = {
      state: { ...defaults, ...state },
      version: 0,
    }
    localStorage.setItem('showtime-show-state', JSON.stringify(fullState))
    localStorage.setItem('showtime-onboarding-complete', 'true')
  }, fixture)

  // Step 3: Reload to pick up new state
  await navigateAndWaitPage(page)
}
```

### Fixture Categories

| Fixture Type | localStorage | SQLite | Use Case |
|-------------|-------------|--------|----------|
| `coldStart` | Empty | Empty | Tests that verify Dark Studio from scratch |
| `midShow` | Live state | Timeline events seeded | Tests that verify live show behavior |
| `resumeShow` | Live state + flag | Shows + timeline in DB | Tests that verify resume-on-reopen |
| `postShow` | Strike state | Full show history | Tests that verify history and stats |

### SQLite Seeding Helpers

```typescript
// e2e/fixtures.ts — new helper
export async function seedShowHistory(page: Page, shows: ShowSeed[]) {
  await page.evaluate(async (data) => {
    for (const show of data) {
      await window.clui.seedTestShow(show) // New IPC for test-only data insertion
    }
  }, shows)
}
```

The `seedTestShow` IPC would only be registered when `NODE_ENV === 'test'` (matching the existing pattern in `src/main/index.ts:121`).

## 4. Test Session Lifecycle

### Lifecycle Hooks

```
globalSetup:     (already handled) — Playwright launches Electron with isolated userData
                 Each worker gets its own app instance + temp DB

beforeEach:      seedFixture(page, FIXTURES.desiredState)
                   → Calls resetAllData() IPC (truncates SQLite)
                   → Sets localStorage to fixture snapshot
                   → Reloads page
                   → Waits for app ready

test:            Run assertions against known fixture state

afterEach:       On failure: screenshot + DOM snapshot for debugging
                 On success: no cleanup needed (next test's seedFixture handles it)

globalTeardown:  (already handled) — app.close() + rmSync(userDataDir)
```

### Wait Strategy Improvement

The current `navigateAndWaitPage` uses a hardcoded 3-second wait. Replace with a smarter ready check:

```typescript
async function navigateAndWaitPage(page: Page) {
  const url = page.url()
  await page.goto(url, { waitUntil: 'commit', timeout: 10000 })
  // Wait for React to render — check for root content
  await page.waitForSelector('[data-testid="app-root"]', { timeout: 10000 }).catch(() => {})
  // Small buffer for Zustand hydration
  await page.waitForTimeout(500)
}
```

This cuts the wait from 3s to ~500ms for most tests.

## 5. Fresh Start vs Resume Testing

### Cold Start Tests

Tests that verify the app starts from zero state:
- Dark Studio renders on first launch
- Onboarding flow appears for new users
- Writer's Room entry from Dark Studio

Fixture: `FIXTURES.darkStudio` + empty SQLite

### Resume Tests (New Category)

Tests that verify the app correctly resumes from saved state:
- App reopens with live show in progress
- App reopens after Strike with show history
- App reopens mid-Writer's Room

Fixture: `FIXTURES.live_expanded` + pre-seeded SQLite timeline events

### Implementation

```typescript
// New fixture for resume testing
export const RESUME_FIXTURES = {
  midShow: {
    localStorage: FIXTURES.live_expanded,
    sqlite: {
      shows: [{ id: 'test-show-1', date: '2026-03-24', startedAt: Date.now() - 3600000 }],
      timeline: [
        { showId: 'test-show-1', type: 'show_started', timestamp: Date.now() - 3600000 },
        { showId: 'test-show-1', type: 'act_started', actId: 'fix-act-1', timestamp: Date.now() - 3000000 },
      ],
    },
  },
}
```

## 6. Dev-Mode Reset

### Keyboard Shortcut: `Cmd+Shift+R` (dev only)

```typescript
// src/main/shortcuts.ts — add to registerShortcuts()
if (process.env.NODE_ENV !== 'production') {
  globalShortcut.register('CommandOrControl+Shift+R', () => {
    const win = getMainWindow()
    if (win) {
      DataService.getInstance().resetAll()
      win.webContents.executeJavaScript(`
        localStorage.removeItem('showtime-show-state');
        location.reload();
      `)
      log('Dev: Full reset triggered via Cmd+Shift+R')
    }
  })
}
```

### Tray Menu: "Reset Show" (Already Exists)

The tray already has a "Reset Show" item. Verify it calls `resetAllData()` and also clears SQLite, not just localStorage/Zustand.

## 7. Files to Modify

| File | Change |
|------|--------|
| `src/shared/types.ts` | Add `RESET_ALL_DATA` to IPC enum |
| `src/main/data/DataService.ts` | Add `resetAll()` method |
| `src/main/ipc/showtime.ts` | Register `RESET_ALL_DATA` handler |
| `src/preload/index.ts` | Expose `resetAllData()` on `window.clui` |
| `e2e/fixtures.ts` | Update `seedFixture()` to call `resetAllData()` first; improve wait strategy |
| `src/main/shortcuts.ts` | Add `Cmd+Shift+R` dev reset shortcut |
| `e2e/*.test.ts` | Migrate tests to use updated `seedFixture()` |

## 8. Migration Plan

1. Add `resetAllData()` IPC (non-breaking — new endpoint)
2. Update `seedFixture()` to call it (backward-compatible — just adds a reset before seed)
3. Add `data-testid="app-root"` to App.tsx root div (for faster ready detection)
4. Reduce `navigateAndWaitPage` timeout from 3s to 500ms
5. Add resume test fixtures
6. Add `Cmd+Shift+R` dev shortcut
7. Verify all existing tests pass with new isolation
