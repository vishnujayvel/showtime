# ADR: XState v5 for Show Phase Management

**Status:** Accepted
**Date:** 2026-03-31
**Context:** Showtime's show lifecycle (6 phases, nested substates, guarded transitions) was managed by imperative Zustand logic in a 768-line `showStore.ts`. This ADR documents why we're migrating phase management to XState v5 while keeping Zustand for UI-only state.

---

## Decision

Showtime adopts a **hybrid architecture**: XState v5 owns the show phase state machine, Zustand owns UI-only state (view tier preferences, transient UI flags). The XState machine is the single source of truth for phase transitions, act lifecycle, beat tracking, and verdict computation.

### New File Structure

| File | Responsibility |
|------|----------------|
| `src/renderer/machines/showMachine.ts` | Declarative statechart: 6 phases, nested substates, guards, actions |
| `src/renderer/machines/ShowMachineProvider.tsx` | React context + hooks (`useShowActor`, `useShowSelector`, `useShowSend`) |
| `src/renderer/machines/showActor.ts` | Singleton actor instance + SQLite sync side effects |
| `src/renderer/stores/uiStore.ts` | UI-only state (view tier, overlay flags) |
| `src/renderer/stores/showStore.ts` | Bridge layer — delegates to XState actor, exposes Zustand-compatible API |

---

## Context

### Problem

The Zustand `showStore.ts` grew to 768 lines of imperative phase management:

- Phase transitions were `if/else` chains scattered across action functions
- Guards (e.g., "can only go live if acts exist") were implicit, not declared
- No formal state machine — invalid transitions were prevented by convention, not enforcement
- Testing required recreating exact store state to test a single transition
- Deep research (224 sources, Gemini) confirmed: unstructured Zustand stores create unmapped journey gaps that surface as product bugs, not code errors

### Options Considered

**Option A: Refactor Zustand with a State Transition Matrix (STM)**
Add a middleware layer that intercepts `set()` calls and validates against a transition matrix. Keeps Zustand as sole state manager. Rejected because: still imperative, no visual tooling, guards and actions remain scattered, STM must be manually kept in sync with the actual transitions.

**Option B: XState v5 as sole state manager (replace Zustand entirely)**
Move all state — phases, UI, view tiers — into the XState machine. Rejected because: XState context updates cause full tree re-renders without careful selector memoization, view tier toggling and transient UI flags don't benefit from statechart formalism, and it would require rewriting every `useShowStore` call at once.

**Option C: Hybrid — XState for phases, Zustand for UI (chosen)**
XState machine owns phase lifecycle. Zustand `showStore` becomes a thin bridge that delegates to the XState actor for phase operations and manages UI-only state directly. Components can migrate incrementally from `useShowStore` to `useShowSelector`.

---

## Why XState v5?

1. **Declarative statechart** — All valid transitions, guards, and actions are defined in one place. Invalid transitions are impossible by construction.

2. **Nested substates** — Writer's Room has 4 substates (`energy` → `plan` → `conversation` → `lineup_ready`). Live has 3 (`act_active` → `beat_check` → `celebrating`). Intermission has 2 (`resting`, `breathing_pause`). These are first-class in XState, awkward to model in flat Zustand.

3. **Parallel regions** — The `animation` region runs alongside the `phase` region. Cold open and going-live animations track independently of phase transitions without flag-juggling.

4. **Formal guards** — `hasActs`, `hasNextAct`, `hasPausedTimer`, `hasCurrentAct` are declared as named guards, not inline `if` checks. Tests can verify guard logic in isolation.

5. **Visualizer** — XState machines can be pasted into [stately.ai/viz](https://stately.ai/viz) for visual debugging. No equivalent exists for Zustand.

6. **Property-based testing** — `@xstate/test` + `fast-check` can mathematically verify reachability of all states. The deep research identified this as the gold standard for journey gap prevention.

---

## Machine Architecture

```
show (parallel)
├── phase
│   ├── no_show
│   ├── cold_open
│   ├── writers_room
│   │   ├── energy
│   │   ├── plan
│   │   ├── conversation
│   │   └── lineup_ready
│   ├── going_live
│   ├── live
│   │   ├── act_active
│   │   ├── beat_check
│   │   └── celebrating
│   ├── intermission
│   │   ├── resting
│   │   └── breathing_pause
│   ├── director
│   └── strike
└── animation
    ├── idle
    ├── cold_open
    └── going_live
```

### Key Guards

| Guard | Prevents |
|-------|----------|
| `hasActs` | Going live with empty lineup |
| `hasNextAct` | Auto-advancing when lineup is exhausted |
| `noNextAct` | Staying in live when all acts are done |
| `hasCurrentAct` | Exiting director mode with no act to resume |
| `hasPausedTimer` | Resuming a timer that doesn't exist |

---

## Migration Strategy

### Phase 1: Machine + Tests (complete)
- `showMachine.ts` with all 6 phases, nested substates, guards, actions
- `ShowMachineProvider.tsx` with React hooks
- 51 unit tests covering all transitions and guards

### Phase 2: Store Bridge (in progress — 31 tests failing)
- `showStore.ts` refactored from 768 → ~200 lines (delegates to XState actor)
- `showActor.ts` singleton with SQLite sync subscription
- `uiStore.ts` for UI-only state
- Bridge incomplete: verdict, beat locking, view tier not fully wired

### Phase 3: Component Migration (planned)
- Components incrementally adopt `useShowSelector` / `useShowSend`
- `showStore` bridge preserved for backward compatibility during migration
- Remove bridge layer once all components use XState hooks directly

---

## Consequences

### Positive
- Invalid phase transitions are impossible by construction
- State machine is visualizable and formally testable
- Nested substates eliminate "which sub-step are we in?" bugs
- SQLite sync is a single subscription, not scattered through actions

### Negative
- React Context reintroduced for `ShowMachineProvider` (acceptable — it wraps a single actor, not general state)
- Two state management paradigms during migration (XState + Zustand)
- Learning curve for contributors unfamiliar with statecharts
- 31 tests currently failing due to incomplete bridge layer

### Risks
- Bridge layer may accumulate tech debt if Phase 3 migration stalls
- XState v5 is still newer than v4 — community patterns are less established

---

## References

- Deep research: `.claude/specs/journey-discovery/deep-research-gemini.md` (224 sources)
- XState v5 docs: https://stately.ai/docs/xstate-v5
- Writer's Room state machine spec: `docs/plans/writers-room-state-machine.md`
