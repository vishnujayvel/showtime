# Showtime Three-Layer Test Suite + Bug Discovery

## Why

The app has 30+ features built across 10 Loki runs but the test coverage is shallow — tests verify that components render, not that state transitions are correct across all combinations. Known bug #29 ("tonight's lineup" when planning for tomorrow) proves that temporal + phase combinations are untested. We need systematic state discovery.

Research at `docs/plans/2026-03-21-test-framework-research.md` recommends a three-layer approach.

## What Changes

### Layer 1: XState State Machine Model (`@xstate/graph`)

**Install:** `npm install -D xstate @xstate/graph @xstate/test`

**Create:** `src/__tests__/model/show-machine.ts` — A test-only XState machine modeling ShowPhase transitions:
```
States: no_show, writers_room, live, intermission, director, strike
Events: ENTER_WRITERS_ROOM, SET_LINEUP, START_SHOW, COMPLETE_ACT, ENTER_INTERMISSION, ENTER_DIRECTOR, RESUME, CALL_EARLY, STRIKE, RESET
```

**Create:** `src/__tests__/model/show-machine.test.ts` — Uses `getSimplePaths()` to auto-generate ALL valid state paths. Each path drives the real Zustand showStore and asserts:
- Phase matches after each transition
- UI copy is correct for the phase (no "tonight" when planning tomorrow)
- View tier is appropriate for the phase
- Store invariants hold (beatsLocked <= beatThreshold, acts.length >= 0)

### Layer 2: fast-check Property-Based Store Testing

**Install:** `npm install -D fast-check`

**Create:** `src/__tests__/property/show-store.property.test.ts` — Command-based model testing:

Commands that mirror store actions:
- `EnterWritersRoomCommand` — precondition: phase === 'no_show'
- `SetLineupCommand` — precondition: phase === 'writers_room'
- `StartShowCommand` — precondition: has acts, phase === 'writers_room'
- `CompleteActCommand` — precondition: phase === 'live', has active act
- `LockBeatCommand` — precondition: beatCheckPending === true
- `SkipBeatCommand` — precondition: beatCheckPending === true
- `EnterIntermissionCommand` — precondition: phase === 'live'
- `ResumeFromIntermissionCommand` — precondition: phase === 'intermission'
- `EnterDirectorCommand` — precondition: phase === 'live'
- `CallShowEarlyCommand` — precondition: phase === 'director'
- `ResetShowCommand` — any phase
- `CycleTierUpCommand` — any phase
- `CycleTierDownCommand` — any phase

Invariants checked after EVERY command:
- `phase` is always a valid ShowPhase
- `viewTier` is always a valid ViewTier
- `beatsLocked >= 0 && beatsLocked <= beatThreshold`
- `acts` array is never null/undefined
- If `phase === 'live'`, exactly one act has status 'active'
- If `beatCheckPending === true`, phase was just 'live' and an act just completed
- `showStartedAt` is set when phase !== 'no_show'

**Create:** `src/__tests__/property/temporal.property.test.ts` — Property tests for temporal logic:
- GIVEN any time of day, WHEN DarkStudioView renders, THEN the greeting matches the temporal rules
- GIVEN time after 6PM, WHEN Writer's Room shows, THEN copy says "tomorrow" not "tonight"
- GIVEN a planned date, WHEN the cold open plays, THEN the day name matches the planned date

### Layer 3: Enhanced Playwright E2E (split + tagged + fixtures)

**Split the monolithic `e2e/showtime.test.ts` (1,328 lines) into feature files:**

| File | Tests | Tag |
|------|-------|-----|
| `e2e/launch.test.ts` | App launch, window config, tray menu | @smoke |
| `e2e/onboarding.test.ts` | First launch, 5 steps, skip, back | @smoke |
| `e2e/writers-room.test.ts` | Energy → plan → Claude lineup → "WE'RE LIVE!" | @regression |
| `e2e/live-show.test.ts` | Timer, beat check, intermission, director | @regression |
| `e2e/strike.test.ts` | Verdict, celebration, encore, reset | @regression |
| `e2e/views.test.ts` | View tier transitions, window sizing, drag | @regression |
| `e2e/temporal.test.ts` | Today vs tomorrow copy, date labels, cold open | @regression |
| `e2e/data-layer.test.ts` | SQLite persistence, show restore after restart | @regression |
| `e2e/rundown.test.ts` | RundownBar, drift, plan modification | @regression |
| `e2e/history.test.ts` | History view, past shows, lineup archive | @regression |

**Add Playwright fixtures** for state seeding:
```typescript
// e2e/fixtures.ts
export const liveShowFixture = {
  phase: 'live',
  acts: [{ name: 'Deep Work', status: 'active', ... }],
  viewTier: 'expanded',
  showStartedAt: Date.now() - 3600000, // 1 hour ago
}
```

**Add visual regression** with `toHaveScreenshot()` for key states.

### Bug Discovery Phase (CRITICAL — DO THIS AFTER BUILDING TESTS)

After all three test layers are implemented:

1. Run the full test suite:
```bash
npm run test          # Vitest: XState paths + fast-check + unit tests
npm run test:e2e      # Playwright: all tagged E2E tests
```

2. For EVERY test failure:
   - Analyze the failure
   - File a GitHub issue with `--label "bug" --label "auto-detected"`
   - Include: test name, expected vs actual, which layer caught it

3. Commit the test suite even if some tests fail (the failures ARE the bugs we're looking for)

4. Print a summary of all bugs found

## Files to Create

| File | Purpose |
|------|---------|
| `src/__tests__/model/show-machine.ts` | XState machine definition |
| `src/__tests__/model/show-machine.test.ts` | Auto-generated path tests |
| `src/__tests__/property/show-store.property.test.ts` | fast-check command model |
| `src/__tests__/property/temporal.property.test.ts` | Temporal logic properties |
| `e2e/fixtures.ts` | Shared state seeding fixtures |
| `e2e/launch.test.ts` | App launch smoke tests |
| `e2e/onboarding.test.ts` | Onboarding flow |
| `e2e/writers-room.test.ts` | Writer's Room flow |
| `e2e/live-show.test.ts` | Live show flow |
| `e2e/strike.test.ts` | Strike/verdict flow |
| `e2e/views.test.ts` | View tier transitions |
| `e2e/temporal.test.ts` | Temporal copy verification |
| `e2e/data-layer.test.ts` | SQLite persistence |
| `e2e/rundown.test.ts` | RundownBar |
| `e2e/history.test.ts` | History view |

## Files to Modify

| File | Change |
|------|--------|
| `package.json` | Add xstate, @xstate/graph, @xstate/test, fast-check as devDependencies |
| `e2e/showtime.test.ts` | Delete after splitting into feature files (or keep as legacy) |
| `playwright.config.ts` | Add projects for tagged test groups |

## Testing Strategy

```bash
npm run build
npm run test           # All Vitest tests (unit + model + property)
npm run test:e2e       # All Playwright E2E tests
npx tsc --noEmit
```

After tests run, file GitHub issues for every failure.

## Loop Configuration
autonomous: true
max_iterations: 3
issue_labels: ["bug", "auto-detected"]
cooldown_minutes: 2
