# Test Framework Research: Systematic State Discovery & Test Generation

**Date:** 2026-03-21
**Goal:** Find the right framework to systematically discover ALL user states/flows in Showtime, auto-generate test cases, and run them.

---

## 1. The Problem: State Explosion in Showtime

Showtime has a combinatorial state space that manual test-writing cannot cover:

| Dimension | Values | Count |
|-----------|--------|-------|
| ShowPhase | no_show, writers_room, live, intermission, director, strike | 6 |
| ViewTier | micro, compact, dashboard, expanded | 4 |
| WritersRoomStep | energy, plan, lineup | 3 |
| EnergyLevel | high, medium, low, recovery, null | 5 |
| Act count | 0, 1, 2, 3+ | 4 |
| Current act status | none, active, completed, skipped | 4 |
| Beat state | pending, locked, skipped | 3 |
| Timer state | null, running, paused | 3 |
| Temporal | before noon (today), after 6PM (tomorrow) | 2 |
| History | first show, has past shows | 2 |
| Onboarding | complete, not complete | 2 |
| Transitions | coldOpenActive, goingLiveActive | 2 each |

**Naive exhaustive**: 6 x 4 x 3 x 5 x 4 x 4 x 3 x 3 x 2 x 2 x 2 x 2 x 2 = **414,720 combinations**

Most are invalid (you cannot be in `strike` phase with `energy: null` and `writersRoomStep: plan`). But the valid subset is still large. We need a framework that:

1. Defines which combinations are valid (the state machine model)
2. Automatically generates paths through them
3. Produces runnable Playwright/Vitest tests
4. Shrinks failures to minimal reproductions

---

## 2. Frameworks Evaluated

### 2A. XState `@xstate/graph` + `@xstate/test` (Model-Based Testing)

**What it does:** Define a state machine (XState v5), then use `getShortestPaths()` / `getSimplePaths()` to auto-generate every reachable state and the transitions to get there. Each generated path becomes a test case.

**How it works:**
```typescript
import { createMachine } from 'xstate'
import { createTestModel } from '@xstate/test'

const showMachine = createMachine({
  id: 'show',
  initial: 'no_show',
  states: {
    no_show: { on: { ENTER_WRITERS_ROOM: 'writers_room' } },
    writers_room: { on: { START_SHOW: 'live' } },
    live: {
      on: {
        INTERMISSION: 'intermission',
        DIRECTOR: 'director',
        STRIKE: 'strike',
      }
    },
    intermission: { on: { RESUME: 'live' } },
    director: {
      on: {
        RESUME: 'live',
        CALL_EARLY: 'strike',
      }
    },
    strike: { on: { RESET: 'no_show' } },
  }
})

const model = createTestModel(showMachine)
const plans = model.getSimplePathPlans()
// Auto-generates paths like:
// no_show -> writers_room -> live -> strike
// no_show -> writers_room -> live -> intermission -> live -> strike
// no_show -> writers_room -> live -> director -> live -> strike
// no_show -> writers_room -> live -> director -> strike (call early)
```

**Strengths:**
- Graph algorithms guarantee coverage of every reachable state
- Adding a new state to the machine auto-generates new test paths
- Works with both Vitest (unit) and Playwright (E2E)
- David Khourshid (XState creator) designed this specifically for UI state machines
- State machine model serves as living documentation

**Weaknesses:**
- Requires maintaining a separate XState machine that mirrors the Zustand store logic
- `@xstate/test` is transitioning to be part of `@xstate/graph` in v5; API is in flux
- Cannot easily model continuous values (timer countdowns, timestamps)
- Path explosion with parallel/nested states

**Fit for Showtime:** HIGH. Showtime already has a well-defined phase machine (`ShowPhase`) and the store actions map cleanly to XState events. The machine would not replace Zustand -- it would be a test-only model.

**References:**
- [Stately.ai: @xstate/test](https://stately.ai/docs/xstate-test)
- [Stately.ai: @xstate/graph](https://stately.ai/docs/xstate-graph)
- [CSS-Tricks: Model-Based Testing in React with State Machines](https://css-tricks.com/model-based-testing-in-react-with-state-machines/)
- [XState test demo repo](https://github.com/davidkpiano/xstate-test-demo)
- [Tim Deschryver: Generated tests with XState and Cypress](https://timdeschryver.dev/blog/generated-tests-with-xstate-and-cypress)

---

### 2B. fast-check (Property-Based / Model-Based Testing)

**What it does:** Generate random sequences of commands (actions) against a model and the real system, checking that invariants hold after every step. If a failure is found, fast-check shrinks the sequence to the minimal reproduction.

**How it works:**
```typescript
import fc from 'fast-check'

// Model = simplified representation of ShowStore
type Model = { phase: string; acts: number; beatsLocked: number }

// Commands that mirror store actions
class SetLineupCommand implements fc.Command<Model, ShowStore> {
  check(m: Readonly<Model>) { return m.phase === 'no_show' || m.phase === 'writers_room' }
  run(m: Model, real: ShowStore) {
    real.setLineup(sampleLineup)
    m.phase = 'writers_room'
    m.acts = 3
    expect(real.phase).toBe(m.phase)
  }
}

class StartShowCommand implements fc.Command<Model, ShowStore> {
  check(m: Readonly<Model>) { return m.acts > 0 && m.phase === 'writers_room' }
  run(m: Model, real: ShowStore) {
    real.startShow()
    m.phase = 'live'
    expect(real.phase).toBe('live')
  }
}

// fc.commands() generates random valid sequences
fc.assert(
  fc.property(
    fc.commands([
      fc.constant(new SetLineupCommand()),
      fc.constant(new StartShowCommand()),
      fc.constant(new EnterIntermissionCommand()),
      fc.constant(new LockBeatCommand()),
      // ... all store actions
    ]),
    (cmds) => {
      const model: Model = { phase: 'no_show', acts: 0, beatsLocked: 0 }
      const real = createFreshStore()
      fc.modelRun(() => ({ model, real }), cmds)
    }
  )
)
```

**Strengths:**
- Finds edge cases humans would never write tests for (the "unknown unknowns")
- Automatic shrinking produces minimal failing sequences
- `check()` method naturally encodes preconditions (cannot start show with 0 acts)
- Race condition detection with `fc.scheduler()` (relevant for celebration timeout, beat check)
- No separate state machine to maintain -- commands are defined against the real store

**Weaknesses:**
- Random exploration is less systematic than graph traversal (may miss rare paths)
- Requires defining invariants ("what should always be true") rather than specific expectations
- Harder to get specific visual regression coverage
- Slower than deterministic tests

**Fit for Showtime:** HIGH for store-level testing. fast-check excels at finding the weird state combinations that cause bugs (e.g., "what happens if you lockBeat, then immediately enterIntermission, then resetShow?"). Less useful for visual/E2E.

**References:**
- [fast-check: Model-based testing docs](https://fast-check.dev/docs/advanced/model-based-testing/)
- [fast-check: asyncModelRun API](https://fast-check.dev/api-reference/functions/asyncModelRun.html)
- [fast-check: commands API](https://fast-check.dev/api-reference/functions/commands.html)
- [fast-check GitHub](https://github.com/dubzzz/fast-check)

---

### 2C. Cucumber/Gherkin + Playwright BDD

**What it does:** Write human-readable scenarios in Gherkin (`Given/When/Then`), map step definitions to Playwright actions.

```gherkin
Feature: Show Planning

  Scenario: Plan today's show with high energy
    Given the app is at Dark Studio (no_show)
    When I enter the Writer's Room
    And I select "High Energy"
    And I dump my plan "Focus sprint 45min, Exercise 30min"
    And I confirm the lineup
    Then the show should be live
    And the first act timer should be counting down
```

**Strengths:**
- Readable by non-developers
- Good for documenting business logic
- playwright-bdd package integrates directly

**Weaknesses:**
- Manual scenario writing -- does not auto-generate paths
- Significant boilerplate for step definitions
- No shrinking or random exploration
- Overkill for a solo/small team project

**Fit for Showtime:** LOW. Showtime is a solo developer project. The overhead of maintaining Gherkin files + step definitions is not justified. The test-as-documentation benefit is already served by the XState model approach.

**References:**
- [Playwright BDD setup guide](https://testdino.com/blog/playwright-bdd/)
- [Playwright + Cucumber integration](https://talent500.com/blog/how-to-integrate-cucumber-with-playwright/)

---

### 2D. Microsoft PICT (Pairwise Combinatorial Testing)

**What it does:** Given a set of parameters and their possible values, generates a minimal set of combinations where every pair of values appears at least once. Research shows 70-95% of bugs are triggered by 2-variable interactions.

**How it works:**
```
# showtime.pict model file
Phase: no_show, writers_room, live, intermission, director, strike
ViewTier: micro, compact, dashboard, expanded
Energy: high, medium, low, recovery, null
ActCount: 0, 1, 3
TimerState: null, running, paused
Onboarding: complete, not_complete

# Constraints
IF [Phase] = "no_show" THEN [Energy] = "null";
IF [Phase] = "no_show" THEN [ActCount] = "0";
IF [Phase] = "no_show" THEN [TimerState] = "null";
IF [ActCount] = "0" THEN [TimerState] = "null";
IF [Phase] = "strike" THEN [TimerState] = "null";
```

Running `pict showtime.pict` produces ~20-30 test cases covering all parameter pairs.

**Strengths:**
- Reduces 414,720 combinations to ~25 test cases
- Mathematically proven pair coverage
- Constraints eliminate invalid combinations
- PICT is free, open-source, well-maintained by Microsoft

**Weaknesses:**
- Generates parameter combinations, not action sequences
- No awareness of state transitions or ordering
- Output needs manual translation to test code
- Best for configuration testing, not flow testing

**Fit for Showtime:** MEDIUM. Useful as a supplementary tool for generating the "seed states" that E2E tests should start from. Not a primary testing framework.

**References:**
- [Microsoft PICT GitHub](https://github.com/microsoft/pict)
- [PICT documentation](https://github.com/microsoft/pict/blob/main/doc/pict.md)
- [Pairwise Testing 2025 article](https://medium.com/@aleksei.aleinikov.gr/pairwise-testing-2025-cut-your-test-suite-by-90-without-cutting-quality-649991df7c71)

---

### 2E. Playwright Built-in Capabilities

**Visual Regression:**
- `await expect(page).toHaveScreenshot('dark-studio.png')` with pixel-diff comparison
- `await expect(page.locator('.act-card')).toHaveScreenshot()` for component-level
- `animations: 'disabled'` option to stabilize screenshots
- `maxDiffPixels` / `threshold` for tolerance tuning

**Test Tagging:**
```typescript
test.describe('smoke tests', { tag: '@smoke' }, () => { ... })
test.describe('visual regression', { tag: '@visual' }, () => { ... })
test('edge case: beat during intermission', { tag: ['@regression', '@edge'] }, async () => { ... })

// Run: npx playwright test --grep @smoke
```

**Fixtures for State Seeding:**
```typescript
// Custom fixture that seeds localStorage before each test
const test = base.extend<{ seededPage: Page }>({
  seededPage: async ({ page }, use) => {
    await page.evaluate((state) => {
      localStorage.setItem('showtime-show-state', JSON.stringify(state))
      localStorage.setItem('showtime-onboarding-complete', 'true')
    }, liveShowState)
    await page.reload()
    await use(page)
  }
})
```

**Fit for Showtime:** Already in use. Enhanced with fixtures and tagging, Playwright remains the E2E backbone.

**References:**
- [Playwright visual comparisons](https://playwright.dev/docs/test-snapshots)
- [Playwright test fixtures](https://playwright.dev/docs/test-fixtures)
- [Playwright test tagging](https://playwright.dev/docs/test-annotations)
- [Electron testing with Playwright](https://playwright.dev/docs/api/class-electron)

---

## 3. Recommended Architecture: Three-Layer Testing

After evaluating all frameworks, the recommendation is a **three-layer approach** that combines the strengths of each:

```
Layer 3: Playwright E2E (tagged, fixture-seeded, visual regression)
         -- Tests the real app in all view states
         -- Seeded via localStorage fixtures from PICT combinations
         -- Visual regression snapshots for each view tier x phase

Layer 2: fast-check Model-Based (property-based store testing)
         -- Random command sequences against Zustand store
         -- Finds edge cases in state transitions
         -- Automatic shrinking for minimal reproductions
         -- Invariant checking (e.g., "phase is always valid after any action sequence")

Layer 1: XState Test Model (deterministic path generation)
         -- Test-only XState machine modeling ShowPhase transitions
         -- getSimplePaths() generates all valid phase flows
         -- Each path becomes a Vitest test that drives the Zustand store
         -- Guarantees every reachable state is tested
```

### Why This Combination?

| Concern | Layer | Framework |
|---------|-------|-----------|
| "Did I cover every phase transition?" | L1 | XState graph traversal |
| "What weird action sequences break things?" | L2 | fast-check random commands |
| "Does the UI render correctly in each state?" | L3 | Playwright visual regression |
| "Does the full flow work end-to-end?" | L3 | Playwright E2E with fixtures |

### What We Skip and Why

- **Cucumber/Gherkin**: Overhead not justified for solo dev. XState model provides the same documentation benefit.
- **PICT as primary tool**: Good for generating seed states (used as input to Layer 3 fixtures), but not a testing framework.

---

## 4. Concrete Example: "Planning Today vs Tomorrow" Flow

### The Problem

Showtime should show today's show before ~6PM, and switch to "plan tomorrow's show" after 6PM (or when today's show is complete). The `showDate` field and day boundary detection are involved.

### Layer 1: XState Model

```typescript
// test/models/dayBoundaryMachine.ts
import { createMachine } from 'xstate'

const dayBoundaryMachine = createMachine({
  id: 'dayBoundary',
  initial: 'today_no_show',
  states: {
    today_no_show: {
      on: {
        ENTER_WRITERS_ROOM: 'today_planning',
        DAY_BOUNDARY_CROSSES: 'tomorrow_no_show',
      }
    },
    today_planning: {
      on: {
        START_SHOW: 'today_live',
        DAY_BOUNDARY_CROSSES: 'stale_show_reset',
      }
    },
    today_live: {
      on: {
        COMPLETE_ALL_ACTS: 'today_strike',
        DAY_BOUNDARY_CROSSES: 'stale_show_reset',
      }
    },
    today_strike: {
      on: {
        RESET: 'tomorrow_no_show',
        // After 6PM, resetting should target tomorrow
      }
    },
    tomorrow_no_show: {
      on: {
        ENTER_WRITERS_ROOM: 'tomorrow_planning',
        MIDNIGHT_CROSSES: 'today_no_show', // tomorrow becomes today
      }
    },
    tomorrow_planning: {
      on: {
        MIDNIGHT_CROSSES: 'today_planning',
      }
    },
    stale_show_reset: {
      // Day boundary crossed mid-show, auto-reset
      on: { '': 'tomorrow_no_show' }
    },
  }
})

// getSimplePaths() auto-generates:
// 1. today_no_show -> today_planning -> today_live -> today_strike -> tomorrow_no_show
// 2. today_no_show -> today_planning -> stale_show_reset -> tomorrow_no_show
// 3. today_no_show -> tomorrow_no_show -> tomorrow_planning -> today_planning (midnight)
// ... etc
```

### Layer 2: fast-check Commands

```typescript
// test/properties/dayBoundary.property.ts
import fc from 'fast-check'

class MockClockAdvanceCommand implements fc.Command<DayModel, ShowStore> {
  constructor(readonly hours: number) {}
  check() { return true }
  run(model: DayModel, store: ShowStore) {
    vi.advanceTimersByTime(this.hours * 60 * 60 * 1000)
    // Invariant: showDate should always be valid
    const date = store.showDate
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    // Invariant: if past midnight, showDate should be today
    if (model.currentHour >= 24) {
      model.currentHour -= 24
      model.day += 1
    }
  }
}

// Generate random sequences of: set energy, set lineup, start show,
// advance clock by 1-12 hours, enter intermission, reset show
fc.assert(fc.property(
  fc.commands([
    fc.constant(new SetLineupCommand()),
    fc.constant(new StartShowCommand()),
    fc.nat({ max: 12 }).map(h => new MockClockAdvanceCommand(h)),
    fc.constant(new ResetShowCommand()),
  ]),
  (cmds) => {
    vi.useFakeTimers()
    const model = { phase: 'no_show', currentHour: 10, day: 0 }
    const store = createFreshStore()
    fc.modelRun(() => ({ model, real: store }), cmds)
    vi.useRealTimers()
  }
))
```

### Layer 3: Playwright E2E with Time Mocking

```typescript
// e2e/day-boundary.test.ts
import { test, expect } from './fixtures'

test.describe('Day Boundary', { tag: '@regression' }, () => {
  test('before noon shows today planning', async ({ seededPage }) => {
    // Fixture seeds: time=10:00AM, no show state
    await expect(seededPage.getByText("Enter the Writer's Room")).toBeVisible()
    await expect(seededPage).toHaveScreenshot('dark-studio-morning.png')
  })

  test('after 6PM shows tomorrow planning', async ({ seededPage }) => {
    // Fixture seeds: time=7:00PM, today's show completed
    await expect(seededPage.getByText("Plan Tomorrow")).toBeVisible()
    await expect(seededPage).toHaveScreenshot('dark-studio-evening.png')
  })

  test('day boundary mid-show resets gracefully', async ({ seededPage }) => {
    // Fixture seeds: live show, time=11:55PM
    // Advance clock past midnight
    await seededPage.evaluate(() => {
      // Trigger day boundary event
      window.dispatchEvent(new CustomEvent('showtime:day-boundary'))
    })
    await expect(seededPage.getByText("Enter the Writer's Room")).toBeVisible()
  })
})
```

---

## 5. Concrete Example: Auto-Generating View Tier Transition Tests

### The Challenge

4 view tiers x 3 live phases (live, intermission, director) = 12 view states.
Plus transitions between them (cycle, expand, collapse) = 12 x 3 = 36 transition tests.
Plus phase transitions that force view tier changes (beatCheck forces expand, strike forces expanded).

### Layer 1: XState View Tier Model

```typescript
const viewTierMachine = createMachine({
  id: 'viewTier',
  type: 'parallel',
  states: {
    tier: {
      initial: 'expanded',
      states: {
        micro: {
          on: {
            EXPAND: 'compact',
            CYCLE: 'compact',
            BEAT_CHECK: 'dashboard', // forced expand
          }
        },
        compact: {
          on: {
            EXPAND: 'dashboard',
            COLLAPSE: 'micro',
            CYCLE: 'dashboard',
            BEAT_CHECK: 'dashboard', // forced expand
          }
        },
        dashboard: {
          on: {
            EXPAND: 'expanded',
            COLLAPSE: 'compact',
            CYCLE: 'expanded',
          }
        },
        expanded: {
          on: {
            COLLAPSE: 'dashboard',
            CYCLE: 'micro',
            // EXPAND clamps at expanded (no transition)
          }
        },
      }
    },
    phase: {
      initial: 'live',
      states: {
        live: {
          on: {
            INTERMISSION: 'intermission',
            DIRECTOR: 'director',
            STRIKE: { target: 'strike', actions: 'forceExpanded' },
          }
        },
        intermission: { on: { RESUME: 'live' } },
        director: { on: { RESUME: 'live', CALL_EARLY: 'strike' } },
        strike: {},
      }
    }
  }
})

// getSimplePaths() generates all valid combinations:
// (micro, live) -> EXPAND -> (compact, live) -> INTERMISSION -> (compact, intermission) -> ...
// (expanded, live) -> BEAT_CHECK -> (expanded, live) [no change, already >= dashboard]
// etc.
```

### Generated Test Paths (Sample)

The XState graph traversal would produce paths like:

```
Path 1: (expanded, live) -> COLLAPSE -> (dashboard, live) -> COLLAPSE -> (compact, live) -> COLLAPSE -> (micro, live)
Path 2: (micro, live) -> BEAT_CHECK -> (dashboard, live) -> STRIKE -> (expanded, strike)
Path 3: (micro, live) -> CYCLE -> (compact, live) -> INTERMISSION -> (compact, intermission) -> EXPAND -> (dashboard, intermission)
Path 4: (expanded, live) -> DIRECTOR -> (expanded, director) -> CALL_EARLY -> (expanded, strike)
```

### Translating to Playwright Tests

```typescript
// Auto-generated from XState paths
test.describe('View Tier Transitions', { tag: '@visual' }, () => {
  for (const plan of viewTierModel.getSimplePathPlans()) {
    test.describe(plan.description, () => {
      for (const path of plan.paths) {
        test(path.description, async ({ electronApp, page }) => {
          // Seed the starting state
          await page.evaluate((state) => {
            localStorage.setItem('showtime-show-state', JSON.stringify({
              state: { ...state }
            }))
          }, path.segments[0].state)
          await page.reload()

          // Execute each transition
          for (const segment of path.segments) {
            await executeEvent(page, segment.event)
            // Verify the resulting state
            await verifyState(page, segment.state)
            // Visual regression for each state
            await expect(page).toHaveScreenshot(
              `${segment.state.tier}-${segment.state.phase}.png`
            )
          }
        })
      }
    })
  }
})
```

---

## 6. Test Organization: The 100+ Test Problem

### Directory Structure

```
src/
  __tests__/
    stores/
      showStore.test.ts              # Existing unit tests
      showStore.property.ts          # NEW: fast-check property tests
    models/
      showPhaseMachine.ts            # NEW: XState test model for phases
      viewTierMachine.ts             # NEW: XState test model for view tiers
      dayBoundaryMachine.ts          # NEW: XState test model for day logic
    generated/
      phase-paths.test.ts            # NEW: Auto-generated from XState models
      viewTier-paths.test.ts         # NEW: Auto-generated from XState models
e2e/
  fixtures/
    electronApp.ts                   # NEW: Shared Electron launch fixture
    stateSeeder.ts                   # NEW: localStorage seeding helpers
    states/                          # NEW: Predefined state snapshots
      no-show-morning.json
      live-act1-micro.json
      intermission-paused.json
      strike-day-won.json
      writers-room-lineup.json
  smoke/
    app-launch.test.ts               # @smoke: App opens
    happy-path.test.ts               # @smoke: Full flow through
  flows/
    writers-room.test.ts             # @regression: All WR steps
    live-show.test.ts                # @regression: Act lifecycle
    intermission.test.ts             # @regression: Pause/resume
    director-mode.test.ts            # @regression: All 4 director options
    strike.test.ts                   # @regression: Verdicts
    day-boundary.test.ts             # @regression: Today/tomorrow
  navigation/
    view-tier-transitions.test.ts    # @regression: All tier changes
    back-button.test.ts              # @regression: Back navigation
    beat-check-expand.test.ts        # @edge: Force-expand on beat check
  visual/
    dark-studio.visual.ts            # @visual: Screenshot comparison
    pill-view.visual.ts              # @visual
    compact-view.visual.ts           # @visual
    dashboard-view.visual.ts         # @visual
    expanded-view.visual.ts          # @visual
    writers-room.visual.ts           # @visual
    strike-view.visual.ts            # @visual
  edge-cases/
    double-click-beat.test.ts        # @edge: Race condition
    reset-during-celebration.test.ts # @edge: Timeout cleanup
    stale-show-rehydration.test.ts   # @edge: Yesterday's state
  onboarding/
    first-launch.test.ts             # @regression: Full onboarding
    skip-onboarding.test.ts          # @regression
    help-retrigger.test.ts           # @regression
```

### Tagging Strategy

| Tag | When to Run | Description |
|-----|------------|-------------|
| `@smoke` | Every commit | App launches, happy path works |
| `@regression` | Every PR | All flows and state transitions |
| `@visual` | PR + nightly | Screenshot comparison |
| `@edge` | Nightly | Race conditions, boundary cases |
| `@generated` | Weekly | Full XState path exploration |

### Playwright Config with Projects

```typescript
// playwright.config.ts
export default defineConfig({
  testDir: './e2e',
  projects: [
    {
      name: 'smoke',
      testMatch: /smoke\/.*.test.ts/,
      retries: 1,
    },
    {
      name: 'regression',
      testMatch: /flows|navigation|onboarding\/.*.test.ts/,
      retries: 0,
    },
    {
      name: 'visual',
      testMatch: /visual\/.*.visual.ts/,
      expect: {
        toHaveScreenshot: {
          maxDiffPixels: 50,
          animations: 'disabled',
        }
      },
    },
    {
      name: 'edge',
      testMatch: /edge-cases\/.*.test.ts/,
      retries: 2,
    },
  ],
})
```

---

## 7. State Seeding Strategy for Electron

The current E2E tests seed state by manipulating `localStorage` via `page.evaluate()`. This works but is fragile. Here is the improved approach:

### State Fixture Factory

```typescript
// e2e/fixtures/stateSeeder.ts
import { test as base, type Page } from '@playwright/test'

// Canonical state snapshots
const STATES = {
  noShow: {
    phase: 'no_show',
    energy: null,
    acts: [],
    currentActId: null,
    beatsLocked: 0,
    beatThreshold: 3,
    timerEndAt: null,
    timerPausedRemaining: null,
    verdict: null,
    viewTier: 'expanded',
    showDate: new Date().toISOString().slice(0, 10),
  },
  liveWithActs: (actCount: number) => ({
    phase: 'live',
    energy: 'high',
    acts: Array.from({ length: actCount }, (_, i) => ({
      id: `act-${i}`,
      name: `Act ${i + 1}`,
      sketch: 'Test',
      durationMinutes: 30,
      status: i === 0 ? 'active' : 'upcoming',
      beatLocked: false,
      order: i,
      ...(i === 0 ? { startedAt: Date.now() } : {}),
    })),
    currentActId: 'act-0',
    beatsLocked: 0,
    beatThreshold: actCount,
    timerEndAt: Date.now() + 30 * 60 * 1000,
    viewTier: 'micro',
    showDate: new Date().toISOString().slice(0, 10),
  }),
  // ... more states
} as const

// Custom fixture
export const test = base.extend<{
  seedState: (state: Record<string, unknown>) => Promise<void>
}>({
  seedState: async ({ page }, use) => {
    const seed = async (state: Record<string, unknown>) => {
      await page.evaluate((s) => {
        const existing = JSON.parse(
          localStorage.getItem('showtime-show-state') || '{}'
        )
        localStorage.setItem('showtime-show-state', JSON.stringify({
          ...existing,
          state: { ...existing.state, ...s }
        }))
        localStorage.setItem('showtime-onboarding-complete', 'true')
      }, state)
      // Reload to pick up the seeded state
      const url = page.url()
      await page.goto(url, { waitUntil: 'commit', timeout: 10000 })
      await page.waitForTimeout(2000)
    }
    await use(seed)
  }
})
```

### PICT for Generating Seed Combinations

Use PICT to generate the set of states to test visually:

```
# showtime-visual.pict
Phase: no_show, writers_room, live, intermission, strike
ViewTier: micro, compact, dashboard, expanded
Energy: high, low, recovery
ActProgress: none_done, one_done, all_done
BeatState: zero_locked, half_locked, all_locked

IF [Phase] = "no_show" THEN [ViewTier] = "expanded";
IF [Phase] = "writers_room" THEN [ViewTier] = "expanded";
IF [Phase] = "strike" THEN [ViewTier] = "expanded";
IF [Phase] = "no_show" THEN [ActProgress] = "none_done";
IF [Phase] = "no_show" THEN [BeatState] = "zero_locked";
```

Output (~20 combinations) becomes the fixture set for visual regression tests.

---

## 8. Industry Patterns: How Complex Apps Handle This

### Navigation / Back Button in SPAs

Calendar apps (Fantastical, Google Calendar) and project tools (Linear, Notion) handle navigation by:

1. **URL-based state**: Each view has a URL, back button uses browser history. Not applicable to Showtime (single-window Electron, no URL routing).

2. **Stack-based navigation**: Push/pop view stack. Relevant for Showtime's `showHistory` overlay and onboarding. The pattern is:
   - `HistoryView` pushes onto the view stack
   - Back button pops it
   - Phase changes (no_show -> writers_room) are forward-only transitions, not stackable

3. **State restoration**: Calendar apps persist the selected date and view mode. Showtime already does this with Zustand `persist` middleware + day boundary detection in `onRehydrateStorage`.

### Testing Strategy for Navigation

```typescript
// Navigation invariants for fast-check:
class NavigateBackCommand implements fc.Command<NavModel, App> {
  check(m: Readonly<NavModel>) { return m.viewStack.length > 1 }
  run(m: NavModel, app: App) {
    app.goBack()
    m.viewStack.pop()
    // Invariant: current view matches top of stack
    expect(app.currentView).toBe(m.viewStack[m.viewStack.length - 1])
  }
}
```

---

## 9. Implementation Plan (OpenSpec Change)

### Phase 1: Foundation (1-2 days)

**Install dependencies:**
```bash
npm install --save-dev xstate @xstate/graph fast-check
```

**Create XState test model for ShowPhase:**
- File: `src/__tests__/models/showPhaseMachine.ts`
- Map each `ShowPhase` to an XState state
- Map each store action to an XState event
- Add guards for preconditions (cannot startShow with 0 acts)

**Create fast-check command set:**
- File: `src/__tests__/properties/showStore.property.ts`
- One command class per store action
- Model tracks: phase, act count, beats locked, timer state
- Define invariants:
  - Phase is always a valid ShowPhase
  - beatsLocked never exceeds total acts
  - currentActId is null when phase is no_show or strike
  - viewTier is 'expanded' when phase is strike

### Phase 2: Path Generation (1 day)

**Generate Vitest tests from XState paths:**
- File: `src/__tests__/generated/phase-paths.test.ts`
- Use `getSimplePaths()` to enumerate all paths
- Each path drives the Zustand store through the sequence
- Assert final state matches expected

**Generate view tier tests:**
- File: `src/__tests__/generated/viewTier-paths.test.ts`
- Parallel state model (tier x phase)
- Assert window resize IPC calls for each state

### Phase 3: E2E Fixtures & Seeding (1-2 days)

**Create Playwright fixtures:**
- `e2e/fixtures/electronApp.ts` — shared Electron launch
- `e2e/fixtures/stateSeeder.ts` — localStorage seeding
- `e2e/fixtures/states/*.json` — canonical state snapshots

**Restructure E2E tests:**
- Split monolithic `showtime.test.ts` into per-flow files
- Add `@smoke` / `@regression` / `@visual` tags
- Update `playwright.config.ts` with projects

### Phase 4: Visual Regression (1 day)

**Add screenshot tests:**
- One visual test per (viewTier, phase) combination
- Use PICT output to determine which combinations
- Baseline screenshots generated in CI

### Phase 5: Edge Case Discovery (ongoing)

**Run fast-check with high iteration count:**
```typescript
fc.assert(property, { numRuns: 10000 })
```

**File bugs for any failures found**, with the shrunk command sequence as the reproduction.

### OpenSpec Spec File

```yaml
id: showtime-test-framework
title: Systematic Test Generation Framework
type: enhancement
priority: high
dependencies: []
acceptance_criteria:
  - XState test model covers all 6 ShowPhase states and all transitions
  - fast-check property tests run 1000+ random sequences without failure
  - Playwright E2E tests are tagged and split into smoke/regression/visual/edge
  - Visual regression baselines exist for all (viewTier x phase) combinations
  - CI runs smoke on every push, regression on PR, visual nightly
  - No manual test enumeration — all paths derived from models
```

---

## 10. Summary: Decision Matrix

| Framework | Layer | Use For | Install | Priority |
|-----------|-------|---------|---------|----------|
| **XState `@xstate/graph`** | L1 | Deterministic path generation, coverage guarantee | `xstate @xstate/graph` | P0 |
| **fast-check** | L2 | Random edge case discovery, shrinking | `fast-check` | P0 |
| **Playwright (existing)** | L3 | E2E flows, visual regression | Already installed | P0 |
| **PICT** | Supplementary | Generate seed state combinations | CLI tool (brew/cargo) | P1 |
| **Cucumber/Gherkin** | Skip | Not justified for team size | -- | Skip |

The key insight: **XState is not replacing Zustand**. The XState machine exists only in test files as a formal model of the state transitions. It is the "blueprint" that generates tests. The production code stays Zustand. fast-check then fuzzes the edges that the deterministic model might miss. Playwright renders the result and catches visual regressions.
