# HistoryView E2E Tests + Data Flow Verification

GitHub Issue: #37 — HistoryView has zero E2E tests

## Why

`HistoryView` is fully implemented (UI, IPC, SQLite queries) but has ZERO test coverage.
The full-stack data flow (showStore → SyncEngine → SQLite → ShowRepository → IPC → HistoryView)
has never been verified end-to-end. Without tests, we can't confirm:
- Shows are persisted to SQLite after completing a show cycle
- HistoryView displays past shows correctly
- Expanding a show loads act detail from SQLite
- Navigation to/from HistoryView works from both DarkStudioView and StrikeView

## What Exists (DO NOT REWRITE)

The full implementation stack is already built:
1. **UI**: `src/renderer/views/HistoryView.tsx` (245 lines) — show list, expand/collapse, act detail
2. **IPC Bridge**: `src/preload/index.ts` — `getShowHistory(limit)` and `getShowDetail(showId)`
3. **IPC Handlers**: `src/main/ipc/showtime.ts` — `SHOW_HISTORY` and `SHOW_DETAIL` handlers
4. **Data Layer**: `src/main/data/ShowRepository.ts` — `getRecentShows()` and `getShowDetail()` with SQL
5. **Sync Engine**: `src/main/data/SyncEngine.ts` — debounced write from Zustand to SQLite
6. **Store integration**: `src/renderer/stores/showStore.ts` — `syncToSQLite()` on state changes

Navigation entry points:
- DarkStudioView: "Past Shows" button
- StrikeView: "View Past Shows" button (data-testid="view-history-btn")

## What to Build

### 1. E2E Test File: `e2e/history.test.ts`

Write Playwright E2E tests covering:

**Test 1: Navigate to HistoryView from DarkStudioView**
- Launch app → DarkStudioView (no_show phase)
- Click "Past Shows" button
- Verify HistoryView renders with "PAST SHOWS" header
- Verify empty state: "No past shows yet" when no data

**Test 2: Navigate to HistoryView from StrikeView**
- Run a complete show cycle (energy → lineup → live → strike)
- On StrikeView, click "View Past Shows" (data-testid="view-history-btn")
- Verify HistoryView renders

**Test 3: Verify past show appears after completing a show**
- Run a complete show cycle through to Strike phase
- Navigate to HistoryView
- Verify at least one show entry is listed (not empty state)
- Verify show date, verdict badge, act count, and beat stars are visible

**Test 4: Expand a show to see detail**
- With at least one past show in history
- Click on a show entry to expand it
- Verify act list appears with act names and durations
- Verify plan text is shown if available

**Test 5: Back button returns to previous view**
- From HistoryView, click "Back to Stage" button
- Verify return to DarkStudioView (or previous view)

### 2. Data Seeding for Tests

The tests need past show data in SQLite. Two approaches:
- **Option A (preferred)**: Run a fast show cycle in the test (start show → add acts → complete → strike)
- **Option B**: Seed SQLite directly via IPC or test fixture before navigating to HistoryView

Use Option A for Test 3 and 4 (verifies full data flow). Use empty DB for Test 1 (verifies empty state).

### 3. Fix Any Data Flow Bugs Found

If E2E tests reveal that shows aren't being persisted (e.g., SyncEngine debounce not firing before
test assertions), fix the root cause:
- The `flushToSQLite()` path exists for immediate writes (used on phase transitions)
- Verify `flushToSQLite()` is called on Strike phase entry
- If not, add a flush call when entering Strike phase

## Testing Strategy

- All tests use Playwright with the existing `e2e/fixtures.ts` ElectronApplication helper
- Follow existing test patterns from `e2e/showtime.test.ts` and `e2e/strike-reset.test.ts`
- Screenshots for visual verification: `e2e/screenshots/history-*.png`
- Tests must be independent — each test launches fresh app instance

## Technology

- Playwright + @playwright/test
- Electron test fixtures (existing)
- SQLite via better-sqlite3 + drizzle-orm (existing)

## Non-Goals

- Do NOT rewrite HistoryView UI
- Do NOT add new features to HistoryView
- Do NOT change the data schema
- Do NOT add unit tests (focus is E2E)
