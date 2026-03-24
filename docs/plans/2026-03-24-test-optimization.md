# E2E Test Suite Optimization Report

**Date:** 2026-03-24
**Scope:** All 14 files in `e2e/`, 159 total test cases across monolith + feature files

---

## 1. Duplicate Tests: Monolith vs Feature Files

The monolith (`showtime.test.ts`, 53 tests) has been fully split into feature files. The Playwright config already ignores it (`testIgnore: ['showtime.test.ts']`). Below is the exhaustive duplicate mapping.

### 1A. Exact Duplicates (same logic, same assertions)

| # | Monolith (showtime.test.ts) | Feature File | Notes |
|---|----------------------------|--------------|-------|
| 1 | `7.1 > window opens and is visible` (L62) | `app-launch.test.ts:4` | Identical check |
| 2 | `7.1 > renders Dark Studio view` (L70) | `app-launch.test.ts:9` | Identical |
| 3 | `7.2 > clicking CTA transitions to Writer's Room` (L81) | `writers-room.test.ts:4` | Feature version seeds state first (more robust) |
| 4 | `7.3 > can select energy level` (L96) | `writers-room.test.ts:24` | Feature version uses `seedFixture` |
| 5 | `7.3 > shows plan dump textarea` (L103) | `writers-room.test.ts:34` | Feature version seeds state |
| 6 | `7.3 > can submit plan and see lineup preview` (L112) | `writers-room.test.ts:46` | Near-identical |
| 7 | `7.3 > can go live` (L133) | `writers-room.test.ts:71` | Identical |
| 8 | `7.4 > expanded view shows content when live` (L146) | `live-show.test.ts:4` | Feature version seeds via `setShowState` |
| 9 | `7.4 > can trigger beat check` (L152) | `live-show.test.ts:18` | Feature uses `setShowState` (1 line vs 8) |
| 10 | `7.4 > can trigger intermission` (L166) | `live-show.test.ts:22` | Feature uses `setShowState` |
| 11 | `7.5 > can render strike view with verdict` (L191) | `strike-reset.test.ts:6-39` | Monolith tests 1 verdict; feature tests all 4 |
| 12 | `Pill > can toggle` (L362) | `live-show.test.ts:39` | Identical logic |
| 13 | `Electron > #4 window is always-on-top` (L399) | `app-launch.test.ts:17` | Identical |
| 14 | `Electron > #4 window background is transparent` (L405) | `app-launch.test.ts:23` | Identical |
| 15 | `Electron > #10 window uses content-tight sizing` (L412) | `app-launch.test.ts:29` | Identical |
| 16 | `Electron > #3 tray menu labels` (L432) | `app-launch.test.ts:46` | Identical |
| 17 | `Visual > no inline styles` (L223) | `visual-validation.test.ts:4` | Identical logic |
| 18 | `Visual > GoingLive ON AIR animation` (L255) | `visual-validation.test.ts:26` | Identical |
| 19 | `Visual > Beat Check animate-beat-ignite` (L278) | `visual-validation.test.ts:40` | Identical |
| 20 | `Visual > view containers have correct widths` (L305) | `visual-validation.test.ts:67` | Identical |
| 21 | `Visual > spotlight-warm CSS class` (L332) | `visual-validation.test.ts:86` | Feature seeds via `FIXTURES` |
| 22 | `Visual > BeatCheckModal spotlight-golden` (L338) | `visual-validation.test.ts:93` | Identical |
| 23 | `Issue > #1 Claude integration` (L445) | `visual-validation.test.ts:109` | Identical |
| 24 | `Issue > #2 Beat celebration` (L487) | `visual-validation.test.ts:149` | Identical |
| 25 | `Issue > #7 GoingLive ON AIR` (L511) | `visual-validation.test.ts:173` | Identical |
| 26 | `Issue > #8 Spotlight CSS` (L531) | `visual-validation.test.ts:187` | Identical |
| 27 | `Issue > #10 View dimensions` (L568) | `visual-validation.test.ts:218` | Identical |
| 28 | `Issue > #14 Loading indicator` (L593) | `visual-validation.test.ts:237` | Identical |
| 29 | `Race Condition > #11 double lockBeat` (L631) | `live-show.test.ts:65` | Identical |
| 30 | `Claude E2E > generates real lineup` (L681) | `writers-room.test.ts:82` | Identical |
| 31 | `Onboarding > shows on first launch` (L780) | `onboarding.test.ts:4` | Identical |
| 32 | `Onboarding > can navigate through 5 steps` (L794) | `onboarding.test.ts:16` | Feature version is self-contained |
| 33 | `Onboarding > completing enters Writer's Room` (L839) | `onboarding.test.ts:63` | Feature version is self-contained |
| 34 | `Onboarding > does not show when flag set` (L854) | `onboarding.test.ts:90` | Identical |
| 35 | `Onboarding > can skip` (L873) | `onboarding.test.ts:106` | Identical |
| 36 | `Onboarding > back button` (L900) | `onboarding.test.ts:129` | Identical |
| 37 | `Onboarding > Help button re-triggers` (L934) | `onboarding.test.ts:158` | Identical |
| 38 | `Dynamic Window Bounds > resizes to match` (L963) | `app-launch.test.ts:57` | Identical |
| 39 | `Reset Show > Director Mode shows reset` (L994) | `strike-reset.test.ts:63` | Feature uses `seedFixture` |
| 40 | `Reset Show > confirming reset returns to Dark Studio` (L1041) | `strike-reset.test.ts:85` | Feature is self-contained |
| 41 | `Data Layer > creates SQLite` (L1073) | `data-layer.test.ts:4` | Identical |
| 42 | `Data Layer > hydrate IPC` (L1085) | `data-layer.test.ts:12` | Identical |
| 43 | `Data Layer > timeline round-trip` (L1097) | `data-layer.test.ts:24` | Identical |
| 44 | `Data Layer > timeline drift` (L1118) | `data-layer.test.ts:42` | Identical |
| 45 | `Data Layer > claude context round-trip` (L1126) | `data-layer.test.ts:50` | Identical |
| 46 | `RundownBar > renders during live` (L1148) | `live-show.test.ts:106` | Identical |
| 47 | `RundownBar > MiniRundownStrip in pill` (L1193) | `live-show.test.ts:144` | Identical (feature uses `setShowState`) |
| 48 | `RundownBar > not during no_show` (L1217) | `live-show.test.ts:160` | Identical |
| 49 | `RundownBar > overrun hatching CSS` (L1236) | `live-show.test.ts:173` | Identical |
| 50 | `Plan Modification > Encore button` (L1260) | `live-show.test.ts:194` | Identical |
| 51 | `Plan Modification > Encore form` (L1291) | `live-show.test.ts:224` | Identical |
| 52 | `Plan Modification > projected times` (L1315) | `live-show.test.ts:246` | Identical |

### 1B. Tests Only in the Monolith (Not Replicated)

| # | Monolith Test | Status |
|---|--------------|--------|
| 1 | `Data Layer > show detail IPC responds` (L~1126+) | Only in `data-layer.test.ts:70` -- actually **IS** replicated |

**Result: All 53 monolith tests are replicated in the feature files.** Zero tests are unique to the monolith.

### 1C. Tests Only in Feature Files (New Coverage)

These tests exist only in feature files and have no monolith equivalent:

| File | Test | Purpose |
|------|------|---------|
| `strike-reset.test.ts` | 4 individual verdict tests (DAY_WON, SOLID_SHOW, GOOD_EFFORT, SHOW_CALLED_EARLY) | Monolith only tested SOLID_SHOW |
| `view-tiers.test.ts` | All 17 tests | Entirely new: verifies window dimensions per view tier |
| `consistency.test.ts` | All 9 tests | Entirely new: cross-view data consistency |
| `temporal.test.ts` | 2 temporal copy tests | Non-clock-mocked temporal assertions |
| `temporal-copy.test.ts` | 9 clock-mocked temporal tests | Full time-of-day coverage for temporal copy |
| `visual-regression.test.ts` | 12 screenshot-comparison tests | Entirely new: pixel-diff regressions |
| `data-layer.test.ts` | `show detail IPC responds` | Extra coverage beyond monolith |

---

## 2. Recommendation: Delete the Monolith

**Delete `showtime.test.ts` entirely.** It is already ignored in `playwright.config.ts` via `testIgnore: ['showtime.test.ts']`, so it does not run. But it still:

- Adds 49KB of dead code to the repo
- Confuses new contributors who may think it's the primary test suite
- Risks being accidentally re-enabled

The monolith is also **architecturally inferior** to the feature files:
- It launches its own Electron app via `beforeAll`/`afterAll` (not using the shared fixture)
- Tests are **sequentially dependent** -- test N relies on state left by test N-1 (fragile)
- It uses raw `localStorage` manipulation instead of `seedFixture`/`setShowState` helpers
- It shares a single `page` variable across all tests (no isolation)

**Action:** `git rm e2e/showtime.test.ts`

---

## 3. Top 10 Slowest Test Patterns

### Pattern 1: `navigateAndWait` uses 3000ms hardcoded sleep
**Impact:** Called once per `seedFixture`, once per `setShowState`, once per explicit `navigateAndWait`. Every state transition costs 3 seconds.
**Location:** `fixtures.ts:203-205`
**Fix:** Replace `await page.waitForTimeout(3000)` with:
```ts
await page.waitForSelector('[data-clui-ui]', { timeout: 10000 })
```
**Estimated savings:** ~2-2.5s per navigation. With ~80 navigations across all tests, this saves **~160-200 seconds total**.

### Pattern 2: Monolith launches its own Electron app
**Impact:** showtime.test.ts has its own `electron.launch()` in `beforeAll`, separate from the shared fixture.
**Location:** `showtime.test.ts:23-42`
**Fix:** Already mitigated by `testIgnore`. Deleting the file removes the risk entirely.
**Estimated savings:** 0 (already ignored), but prevents accidental re-inclusion.

### Pattern 3: Excessive screenshots in feature files
**Impact:** 80 screenshots across feature files. Each `page.screenshot()` takes ~200-500ms.
**Locations:** `live-show.test.ts` (13), `consistency.test.ts` (10), `onboarding.test.ts` (10), `view-tiers.test.ts` (16)
**Fix:** Remove screenshots that are not for visual regression. Only keep: (a) visual-regression.test.ts screenshots (used for `toHaveScreenshot` diffs), (b) screenshots on failure (already handled by Playwright `video: 'retain-on-failure'`).
**Estimated savings:** ~16-40 seconds (80 screenshots x 200-500ms).

### Pattern 4: Onboarding tests navigate through all 5 steps repeatedly
**Impact:** Tests 2, 3, 5, 6 in `onboarding.test.ts` each navigate through 4 onboarding steps from scratch.
**Location:** `onboarding.test.ts:16-88, 63-88, 106-127, 129-156`
**Fix:** Create a `FIXTURES.onboarding_step5` seed that sets onboarding state directly in localStorage, skipping the 4 click-and-wait steps. Only one test should actually verify navigation works.
**Estimated savings:** ~8-12 seconds (3 tests x 4 steps x 500ms waits + navigation).

### Pattern 5: `writers-room.test.ts` "submit plan" test waits 5s for Claude
**Impact:** `page.waitForTimeout(5000)` twice in the plan submission test.
**Location:** `writers-room.test.ts:60-66`
**Fix:** Use `Promise.race` with loading indicator and lineup card selectors (as the Claude E2E test already does). Fall back to a shorter timeout.
**Estimated savings:** ~5-8 seconds per test run.

### Pattern 6: `temporal-copy.test.ts` calls `seedWithMockHour` 11 times
**Impact:** Each call does a full `navigateAndWaitPage` (3s sleep). 11 navigations = 33 seconds of sleeping.
**Location:** `temporal-copy.test.ts` (all 9 tests + 1 multi-fixture test)
**Fix:** Fix `navigateAndWaitPage` (Pattern 1) -- this is the root cause. Also consider grouping temporal tests that share the same fixture.
**Estimated savings:** ~22 seconds (saved from Pattern 1 fix).

### Pattern 7: `live-show.test.ts` uses raw localStorage instead of `seedFixture`
**Impact:** Tests at lines 65-101 (race condition), 106-142 (RundownBar), 194-222 (Encore) use verbose `page.evaluate` blocks to manipulate localStorage, then call `navigateAndWait`. The `seedFixture` helper is cleaner and more reliable.
**Location:** `live-show.test.ts:65-101, 106-142, 194-222`
**Fix:** Convert to `seedFixture(page, { ...FIXTURES.live_expanded, beatCheckPending: true, ... })`.
**Estimated savings:** Maintainability improvement; negligible time savings.

### Pattern 8: `view-tiers.test.ts` polls window bounds with 500ms sleep loop
**Impact:** `waitForBounds` polls every 500ms up to 8000ms timeout. 10 tests use this.
**Location:** `view-tiers.test.ts:5-27`
**Fix:** Reduce poll interval to 200ms. Or better, listen for Electron's `resize` event via IPC.
**Estimated savings:** ~5-10 seconds (less wasted polling).

### Pattern 9: Duplicate state-setting across `consistency.test.ts`
**Impact:** 4 tests seed `FIXTURES.live_expanded`, then switch view tier via `setShowState`. Each `setShowState` triggers a full navigation + 3s wait.
**Location:** `consistency.test.ts:5-88`
**Fix:** Verify via localStorage reads instead of navigating to each view tier separately. The state is stored in localStorage -- reading it doesn't require a page reload.
**Estimated savings:** ~12 seconds (4 extra navigations removed).

### Pattern 10: `visual-regression.test.ts` runs 12 `toHaveScreenshot` comparisons
**Impact:** Each `toHaveScreenshot` does: seed state + navigate (3s) + screenshot comparison (~500ms). On first run, it generates baseline images.
**Location:** `visual-regression.test.ts` (all 12 tests)
**Fix:** This is inherently slow but necessary. Optimize by batching: seed multiple states and capture screenshots in fewer navigations (e.g., capture all strike variants in one test with in-test state changes).
**Estimated savings:** ~6 seconds (reduce from 12 navigations to ~8 via grouping).

---

## 4. Optimized `playwright.config.ts` Project Groupings

### Current Config

```ts
projects: [
  { name: 'smoke', testMatch: /app-launch|onboarding/ },           // 14 tests
  { name: 'core-flow', testMatch: /writers-room|live-show|strike-reset/ },  // 25 tests
  { name: 'data-views', testMatch: /data-layer|temporal|temporal-copy|view-tiers/ }, // 34 tests
  { name: 'visual', testMatch: /visual-regression|visual-validation|consistency/ },  // 33 tests
]
```

### Problems
1. **Unbalanced workers.** `smoke` has 14 fast tests; `data-views` has 34 tests including 17 view-tier tests that poll window bounds.
2. **`temporal-copy.test.ts` is mismatched.** It uses `test.beforeAll` + `installMockHourScript` which requires worker scope, but it is grouped with unrelated files.
3. **`consistency.test.ts` is slow** (10 navigations) and grouped with visual regression (12 navigations). This worker takes the longest.

### Recommended Config

```ts
projects: [
  {
    name: 'smoke',
    testMatch: /app-launch|onboarding/,
    // 14 tests, fast (no Claude, no polling)
  },
  {
    name: 'core-flow',
    testMatch: /writers-room|live-show|strike-reset/,
    // 25 tests, medium (includes Claude conditional test)
  },
  {
    name: 'data-temporal',
    testMatch: /data-layer|temporal\.test|temporal-copy/,
    // 17 tests, all data/temporal focused
  },
  {
    name: 'view-tiers',
    testMatch: /view-tiers/,
    // 17 tests, all poll window bounds (isolated to avoid blocking)
  },
  {
    name: 'visual-reg',
    testMatch: /visual-regression/,
    // 12 tests, screenshot comparison (heavy I/O)
  },
  {
    name: 'visual-validate',
    testMatch: /visual-validation|consistency/,
    // 21 tests, DOM assertions
  },
],
workers: 6,  // Increase to match 6 projects
```

**Rationale:** Split `data-views` (34 tests) into `data-temporal` (17) and `view-tiers` (17). Split `visual` (33 tests) into `visual-reg` (12, I/O heavy) and `visual-validate` (21, CPU-bound DOM checks). This gives 6 roughly equal groups that can each run on their own worker.

---

## 5. Estimated Time Savings

### Current Estimated Runtime

| Source | Time |
|--------|------|
| Electron launch (4 workers x ~5s) | ~20s |
| navigateAndWait sleeps (~80 calls x 3s) | ~240s |
| Screenshots (~80 x 300ms avg) | ~24s |
| waitForTimeout calls (~35 in feature files x avg 600ms) | ~21s |
| Actual test logic | ~30s |
| **Total (wall clock, 4 parallel workers)** | **~80-100s** |

### After Optimization

| Change | Savings |
|--------|---------|
| Fix `navigateAndWaitPage` (3s -> 0.5s per call) | **-200s aggregate, -50s wall clock** |
| Remove unnecessary screenshots (keep ~20 essential) | **-18s aggregate, -5s wall clock** |
| Remove unnecessary `waitForTimeout` calls | **-15s aggregate, -4s wall clock** |
| Seed onboarding state instead of clicking through | **-10s aggregate, -3s wall clock** |
| Reduce `waitForBounds` poll interval | **-5s aggregate, -2s wall clock** |
| 6 workers instead of 4 | **-15s wall clock** (better parallelism) |
| Delete monolith (prevent accidental inclusion) | **0s** (already ignored) |
| **Total estimated wall-clock savings** | **~60-80 seconds (60-80% reduction)** |

### Priority Order

1. **Fix `navigateAndWaitPage`** -- single change, biggest impact (~50s wall clock savings)
2. **Delete monolith** -- zero-risk cleanup
3. **Increase workers to 6 + rebalance projects** -- config-only change
4. **Strip non-essential screenshots** -- moderate effort, good payoff
5. **Seed onboarding state** -- add fixture, update 3 tests
6. **Everything else** -- diminishing returns

---

## Appendix: Test Count Summary

| File | Tests | Screenshots | waitForTimeout | Worker-scoped fixture |
|------|-------|-------------|----------------|----------------------|
| `showtime.test.ts` (IGNORED) | 53 | 43 | 35 | No (own launch) |
| `app-launch.test.ts` | 7 | 1 | 3 | Yes |
| `onboarding.test.ts` | 7 | 10 | 10 | Yes |
| `writers-room.test.ts` | 6 | 6 | 8 | Yes |
| `live-show.test.ts` | 13 | 13 | 5 | Yes |
| `strike-reset.test.ts` | 6 | 6 | 4 | Yes |
| `temporal.test.ts` | 2 | 2 | 0 | Yes |
| `temporal-copy.test.ts` | 9 | 8 | 0 | Yes |
| `view-tiers.test.ts` | 17 | 16 | 0 | Yes |
| `data-layer.test.ts` | 6 | 0 | 0 | Yes |
| `visual-regression.test.ts` | 12 | 0 | 0 | Yes |
| `visual-validation.test.ts` | 12 | 8 | 5 | Yes |
| `consistency.test.ts` | 9 | 10 | 0 | Yes |
| **Total (active)** | **106** | **80** | **35** | -- |
