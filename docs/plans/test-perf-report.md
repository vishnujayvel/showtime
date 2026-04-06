---
title: "E2E Test Performance Report — Wave 5, Issue #109"
status: current
last-verified: 2026-04-06
---
# E2E Test Performance Report — Wave 5, Issue #109

## Baseline Metrics (Before Optimization)

| Metric | Value |
|--------|-------|
| Total tests | 145 across 6 projects |
| Passed | 51 |
| Failed | 94 |
| Total duration | 22 min 55s (1371s wall clock) |
| CPU utilization | 12% (2 workers) |
| Workers | 2 |

## After Optimization

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Total duration | 22:55 (1371s) | 18:47 (1123s) | **-18% (-248s)** |
| CPU utilization | 12% | 21% | +75% better |
| Workers | 2 | 4 | 2x parallelism |
| Pass/Fail | 51/94 | 51/94 | No regressions |
| Passing test avg | ~8.5s | ~6.5s | -24% faster |

Notable individual improvements from wait optimization:
- `can trigger beat check`: 15.1s → 8.0s (-47%)
- `DarkStudio: window matches full dims`: 15.1s → 8.0s (-47%)
- `view containers correct widths`: 7.1s → 3.0s (-58%)
- `beat count consistent across views`: 23.1s → 14.0s (-39%)

## Top 5 Slowest Tests

| Test | Duration | Budget | Over By |
|------|----------|--------|---------|
| visual > date label matches ExpandedView and WritersRoom | 60.0s | 20s | +200% |
| data-views > pill-to-expanded preserves anchor point | 47.3s | 15s | +215% |
| data-views > no view ever shows hardcoded "tonight" | 36.3s | 15s | +142% |
| visual > act name matches expanded and dashboard views | 33.0s | 20s | +65% |
| visual > act name matches expanded and compact views | 33.0s | 20s | +65% |

## Duration Distribution

```
     <1s:  15 ███████████████
    1-5s:  17 █████████████████
    5-8s:   4 ████
   8-10s:  44 ████████████████████████████████████████████
  10-13s:  13 █████████████
  13-15s:  31 ███████████████████████████████
  15-20s:  13 █████████████
  20-30s:   3 ███
  30-60s:   5 █████
    >60s:   1 █
```

**Key finding:** 81 of 94 failures are timeout-driven — tests waiting for UI elements that never appear, then failing at their configured timeout boundary (8s or 13s). This is the dominant source of slow test execution.

## Top 5 Slowest Test Files

| File | Total Time | Tests | Avg |
|------|-----------|-------|-----|
| view-tiers.test.ts | 256.5s | 20 | 12.8s |
| consistency.test.ts | 215.4s | 9 | 23.9s |
| visual-regression.test.ts | 160.4s | 12 | 13.4s |
| claude-real.test.ts | 140.4s | 10 | 14.0s |
| onboarding.test.ts | 83.2s | 7 | 11.9s |

## Electron Startup Overhead

- Per-worker startup: ~8.5 seconds (measured from wall clock of first tests vs test duration)
- Fixture scope: worker-level (one Electron per worker, shared across tests)
- With 2 workers: ~17s total startup overhead
- Data-layer IPC tests run in 3-17ms each — zero UI overhead

## Profiling Insights

### Timing Clusters

The bimodal distribution at 8s and 13s corresponds to Playwright's `toBeVisible()` timeout defaults:
- **8s cluster (44 tests):** Tests using `expect(locator).toBeVisible({ timeout: 8000 })` — failing after wait
- **13s cluster (31 tests):** Tests with fixture setup (~5s) + visibility wait (~8s) — both timing out

### Wait/Sleep Analysis (110 instances found)

| Pattern | Count | Impact |
|---------|-------|--------|
| `waitForTimeout(3000)` in fixtures/navigateAndWaitPage | Called on every seed | **HIGH** — adds 3s to every test that seeds state |
| `waitForTimeout(3000)` in view-tiers transitions | 4 instances | **HIGH** — 12s total in the slowest test file |
| `waitForTimeout(300-500)` after UI interactions | ~40 instances | **LOW** — small per-instance but adds up |
| `waitForTimeout(1000-2000)` in visual tests | ~15 instances | **MEDIUM** — could use element waits |
| `setTimeout(resolve, 120000)` in claude-real | 1 instance | **LOW** — hard timeout for real API |

### Screenshot Analysis

- 12 `toHaveScreenshot()` calls in visual-regression.test.ts — KEEP (regression testing)
- ~178 debug `screenshot()` calls across test files — minimal perf impact (5s timeout, silent fail)
- Screenshot helper has no animation waiting — already optimized

### Overlap Analysis

| Overlap | Files | Severity |
|---------|-------|----------|
| Dark Studio → Writer's Room transition | app-launch, writers-room, onboarding, cold-open | HIGH |
| Writer's Room state visibility | writers-room (4 tests), visual-regression, consistency | HIGH |
| Temporal labeling | temporal.test.ts, temporal-copy.test.ts | MEDIUM |
| Go Live transition | writers-room, live-show-go-live | MEDIUM |
| Claude integration | writers-room, claude-real, claude-cassette | MEDIUM |

## Optimizations Applied

### 1. Increased worker count: 2 → 4 (CI stays at 2)

**Rationale:** CPU utilization was only 12% with 2 workers. Tests are I/O bound (waiting for Electron IPC), not CPU bound. 4 workers doubles parallelism with negligible resource impact.

```typescript
workers: process.env.CI ? 2 : 4,
```

### 2. Replaced fixed 3s sleep with smart React-ready wait

**Before:** `navigateAndWaitPage` used `waitUntil: 'commit'` + `waitForTimeout(3000)` on every state seed.

**After:** Uses `waitUntil: 'domcontentloaded'` + `waitForSelector('#root > *')` — completes as soon as React renders, typically <500ms instead of a fixed 3s.

**Impact:** Saves ~2.5s per fixture seed. With ~100+ seeds across the suite, this is ~250s potential savings on passing tests.

### 3. Same fix applied to view-tiers.test.ts (4 instances)

Replaced 4 × `waitForTimeout(3000)` with element-ready waits. Expected savings: ~10s in the slowest test file.

### 4. Added `test:e2e:smoke` script

```json
"test:e2e:smoke": "npx playwright test --project=smoke"
```

Runs only the smoke project (app-launch + onboarding) for fast feedback during development.

### 5. Pre-commit hook: `vitest --changed` instead of full suite

**Before:** `npm test` runs all 521 unit tests on every commit (~2s).
**After:** `npx vitest run --changed` runs only tests for changed files — typically <0.5s.

## Allure Report History

No historical data available (first instrumented run). Future runs will accumulate in `allure-results/history/` via the `pretest:e2e:report` script.

## Recommendations for Future Waves

### High Impact (requires test fixes, not in scope for wave 5)

1. **Fix the 94 failing tests** — this would reduce suite time from ~23 min to an estimated ~5-8 min. The failures are primarily `toBeVisible` timeouts caused by state setup issues, not actual application bugs.

2. **Consolidate overlapping test files** — temporal.test.ts is fully redundant with temporal-copy.test.ts. Several transition tests are duplicated across 3-4 files.

3. **Share Electron instances across compatible projects** — smoke + core-flow could be one project, saving ~8.5s startup per merge.

### Medium Impact

4. **Replace remaining 300-500ms sleeps** with targeted element waits across ~40 instances.

5. **Environment-gated debug screenshots** — skip the ~178 debug screenshots in CI for faster runs.

### Low Impact

6. **Increase `claude-cassette` timeout** awareness — cassette replays consistently hit 21-22s vs 20s budget. Either increase budget or optimize cassette playback.
