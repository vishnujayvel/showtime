# XState Migration Guide

This guide documents the migration from imperative Zustand phase management to a declarative XState v5 statechart. For the decision rationale, see [ADR: XState Migration](./adr-xstate-migration.md).

## Before and After

### Before: Imperative Zustand (768 lines)

```typescript
// showStore.ts — phase transitions scattered across action functions
setPhase: (phase) => {
  const current = get().phase
  if (current === 'writers_room' && phase === 'live') {
    if (get().acts.length === 0) return  // guard hidden in action
    set({ phase, showStartedAt: Date.now(), ... })
  } else if (current === 'live' && phase === 'intermission') {
    // ... more branching
  }
}
```

### After: Declarative XState v5 (753 lines — but structured)

```typescript
// showMachine.ts — all transitions, guards, and actions in one place
writers_room: {
  on: {
    START_SHOW: {
      target: 'live',
      guard: 'hasActs',         // named, testable
      actions: 'startShowContext' // pure, isolated
    }
  }
}
```

## New Files

| File | Lines | Purpose |
|------|-------|---------|
| `src/renderer/machines/showMachine.ts` | 753 | Statechart definition: types, guards, actions, states |
| `src/renderer/machines/ShowMachineProvider.tsx` | ~170 | React context + hooks for components |
| `src/renderer/machines/showActor.ts` | ~170 | Singleton actor + SQLite sync side effects |
| `src/renderer/stores/uiStore.ts` | ~60 | UI-only state extracted from showStore |

## State Machine Topology

```
show (parallel machine)
│
├── phase (sequential)
│   ├── no_show ──── ENTER_WRITERS_ROOM ───► writers_room
│   │                TRIGGER_COLD_OPEN ────► cold_open
│   │
│   ├── cold_open ── COMPLETE_COLD_OPEN ───► writers_room
│   │
│   ├── writers_room (nested: energy → plan → conversation → lineup_ready)
│   │                START_SHOW ───────────► live [guard: hasActs]
│   │                TRIGGER_GOING_LIVE ───► going_live
│   │                RESET ────────────────► no_show
│   │
│   ├── going_live ─ COMPLETE_GOING_LIVE ──► live [guard: hasActs]
│   │
│   ├── live (nested: act_active → beat_check → celebrating)
│   │                ENTER_INTERMISSION ───► intermission
│   │                ENTER_DIRECTOR ───────► director
│   │                STRIKE ───────────────► strike
│   │
│   ├── intermission (nested: resting / breathing_pause)
│   │                EXIT_INTERMISSION ────► live [guard: hasPausedTimer]
│   │                                       live [guard: hasNextAct]
│   │                                       strike [fallback]
│   │
│   ├── director ─── EXIT_DIRECTOR ────────► live [guard: hasCurrentAct]
│   │                SKIP_TO_NEXT ─────────► live / strike
│   │                CALL_SHOW_EARLY ──────► strike
│   │
│   └── strike ───── RESET ───────────────► no_show
│
└── animation (parallel, independent of phase)
    ├── idle
    ├── cold_open ── COMPLETE_COLD_OPEN ──► idle
    └── going_live ─ COMPLETE_GOING_LIVE ─► idle
```

## Event Catalog

### Phase Lifecycle
| Event | From | To | Guard |
|-------|------|----|-------|
| `ENTER_WRITERS_ROOM` | no_show | writers_room | — |
| `TRIGGER_COLD_OPEN` | no_show | cold_open | — |
| `COMPLETE_COLD_OPEN` | cold_open | writers_room | — |
| `START_SHOW` | writers_room | live | `hasActs` |
| `TRIGGER_GOING_LIVE` | writers_room | going_live | — |
| `COMPLETE_GOING_LIVE` | going_live | live | `hasActs` |
| `STRIKE` | live, intermission | strike | — |
| `RESET` | any | no_show | — |

### Act Lifecycle
| Event | Effect |
|-------|--------|
| `START_ACT` | Sets act to active, starts timer |
| `COMPLETE_ACT` | Marks act completed, triggers beat check |
| `SKIP_ACT` | Marks act skipped, auto-advances or strikes |
| `EXTEND_ACT` | Adds minutes to running timer |

### Beat System
| Event | Effect |
|-------|--------|
| `LOCK_BEAT` | Increments `beatsLocked`, triggers celebration |
| `SKIP_BEAT` | Clears beat check, advances to next act |
| `CELEBRATION_DONE` | Ends celebration, advances or strikes |

### Director Mode
| Event | Effect |
|-------|--------|
| `ENTER_DIRECTOR` | Enters compassionate options overlay |
| `EXIT_DIRECTOR` | Returns to live (if act exists) |
| `SKIP_TO_NEXT` | Skips current act, starts next or strikes |
| `CALL_SHOW_EARLY` | Marks all remaining acts skipped, strikes |
| `START_BREATHING_PAUSE` | Enters intermission with breathing timer |

### Lineup Editing (available in writers_room, live, intermission)
| Event | Effect |
|-------|--------|
| `REORDER_ACT` | Moves act up or down in lineup order |
| `REMOVE_ACT` | Removes act from lineup |
| `ADD_ACT` | Appends new act to lineup |

## React Integration

### Provider Setup

```tsx
// App.tsx
import { ShowMachineProvider } from './machines/ShowMachineProvider'

function App() {
  return (
    <ShowMachineProvider>
      <Router />
    </ShowMachineProvider>
  )
}
```

### Consuming State (New Pattern)

```tsx
import { useShowSelector, useShowSend, showSelectors } from '../machines/ShowMachineProvider'

function MyComponent() {
  const phase = useShowSelector(showSelectors.phase)
  const acts = useShowSelector(showSelectors.acts)
  const send = useShowSend()

  return (
    <button onClick={() => send({ type: 'ENTER_WRITERS_ROOM' })}>
      Enter Writer's Room
    </button>
  )
}
```

### Consuming State (Legacy Bridge — still works)

```tsx
import { useShowStore } from '../stores/showStore'

function MyComponent() {
  const phase = useShowStore((s) => s.phase)
  const enterWritersRoom = useShowStore((s) => s.enterWritersRoom)

  return (
    <button onClick={enterWritersRoom}>
      Enter Writer's Room
    </button>
  )
}
```

## Testing

### Unit Tests

The machine is tested independently of React:

```typescript
import { createActor } from 'xstate'
import { showMachine, createInitialContext } from './showMachine'

test('cannot go live without acts', () => {
  const actor = createActor(showMachine).start()
  actor.send({ type: 'ENTER_WRITERS_ROOM' })
  actor.send({ type: 'START_SHOW' }) // should be blocked by hasActs guard

  const phase = getPhaseFromState(actor.getSnapshot().value)
  expect(phase).toBe('writers_room') // still in writers_room
})
```

### Resetting Between Tests

```typescript
import { showActor } from './showActor'

beforeEach(() => {
  showActor.send({ type: 'RESET' })
})
```

## Migration Checklist

### Phase 1: Machine + Tests (complete)
- [x] `showMachine.ts` — all 6 phases, nested substates, guards, actions
- [x] `ShowMachineProvider.tsx` — React context + hooks
- [x] 51 unit tests — all transitions and guards verified

### Phase 2: Store Bridge (in progress)
- [x] `showStore.ts` refactored to delegate to XState actor
- [x] `showActor.ts` singleton with SQLite sync
- [x] `uiStore.ts` for UI-only state
- [ ] Bridge wiring: verdict computation
- [ ] Bridge wiring: beat locking flow
- [ ] Bridge wiring: view tier sync
- [ ] All 336 tests passing (currently 305/336)

### Phase 3: Component Migration (planned)
- [ ] `App.tsx` — wrap with `ShowMachineProvider`
- [ ] Phase-dependent views — use `useShowSelector(showSelectors.phase)`
- [ ] Act components — use `useShowSend` for events
- [ ] Timer components — read from XState context
- [ ] Remove `showStore` bridge layer
- [ ] Remove legacy phase mutation methods

## Known Issues

- **31 failing tests** — Bridge layer incomplete for verdict, beat locking, view tier
- **Loki session died mid-Phase 2** — `a1f6df5` is a WIP checkpoint
- **SQLite sync** in `showActor.ts` uses `window.clui` which may not be available in test environment
