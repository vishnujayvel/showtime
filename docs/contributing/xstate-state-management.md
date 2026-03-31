# XState State Management

Showtime uses **XState v5** to manage the show phase lifecycle as a formal state machine. A backward-compatible **Zustand bridge** (`showStore`) lets existing code work unchanged while new code uses XState hooks directly.

## Architecture Overview

```
showMachine.ts          XState v5 machine definition
    |                   (states, events, guards, actions)
    v
showActor.ts            Singleton actor + side effects
    |                   (SQLite persistence, notifications, timeline)
    v
ShowMachineProvider.tsx  React context + hooks
    |                   (useShowSelector, useShowPhase, useShowSend)
    v
Components              Use hooks OR Zustand bridge
    |
    +--[new code]------> useShowSelector(showSelectors.phase)
    +--[existing code]--> useShowStore((s) => s.phase)
    |
    v
showStore.ts            Zustand bridge (backward compat)
    |                   Delegates mutations via sendAndSync()
    v
uiStore.ts              Non-phase UI state
                        (calendar, Claude session)
```

## The Five Files

### 1. `showMachine.ts` — The State Machine

Defines the XState v5 statechart with:

- **6 top-level phases:** `no_show` → `writers_room` → `going_live` → `live` → `intermission`/`director` → `strike`
- **Nested substates:** Writers room (energy/plan/conversation/lineup_ready), Live (act_active/beat_check/celebrating), Intermission (resting/breathing_pause)
- **Parallel region:** `animation` (idle/cold_open/going_live) runs alongside main phase
- **22 context fields:** energy, acts, currentActId, timerEndAt, beatsLocked, verdict, viewTier, etc.
- **30+ events:** `START_SHOW`, `COMPLETE_ACT`, `LOCK_BEAT`, `ENTER_INTERMISSION`, etc.
- **6 guards:** `hasActs`, `hasCurrentAct`, `hasNextAct`, `noNextAct`, `hasTimerRunning`, `hasPausedTimer`

**Key exports:**

```typescript
import {
  showMachine,           // The machine definition
  createShowActor,       // Actor factory (with optional context override)
  getPhaseFromState,     // Extract top-level phase from state value
  getWritersRoomStep,    // Extract writers room substep
  isAnimationActive,     // Check animation parallel region
  computeVerdict,        // DAY WON / GOOD SHOW / SOLID EFFORT / TOMORROW'S SHOW
  VERDICT_MESSAGES,      // Verdict display messages
} from '@/machines/showMachine'
```

### 2. `showActor.ts` — The Singleton Actor

Created at module load time and runs for the app's entire lifecycle. Subscribes to state changes and manages side effects:

- **Phase tracking:** Logs transitions via `window.clui.logEvent()`
- **Timeline events:** Records `show_started`, `show_ended`, `act_started`, `intermission_started/ended`
- **Data persistence:** Flushes state to SQLite during active phases via `window.clui.dataFlush()`
- **Verdict notifications:** Sends native macOS notifications on strike

All `window.clui` calls are wrapped in `tryClui()` for graceful degradation when the preload bridge isn't ready.

```typescript
import { showActor } from '@/machines/showActor'

// Send events directly
showActor.send({ type: 'START_ACT', actId: 'abc-123' })

// Read current state
const snapshot = showActor.getSnapshot()
```

### 3. `ShowMachineProvider.tsx` — React Integration

Wraps the app at the root level (in `main.tsx`). Provides hooks for reading state and sending events.

**Hooks:**

| Hook | Returns | Use for |
|------|---------|---------|
| `useShowSelector(selector)` | `T` | Select any value from actor state |
| `useShowPhase()` | `string` | Current top-level phase |
| `useShowSend()` | `send` function | Dispatch events to the machine |
| `useShowActor()` | `ActorRef` | Raw actor reference |
| `useShowContext()` | `ShowMachineContext` | Full context object |
| `useWritersRoomStep()` | `string \| null` | Current writers room substep |
| `useColdOpenActive()` | `boolean` | Cold open animation state |
| `useGoingLiveActive()` | `boolean` | Going live animation state |

**Selectors namespace:**

```typescript
import { useShowSelector, showSelectors } from '@/machines/ShowMachineProvider'

// 19+ pre-built selectors
const phase = useShowSelector(showSelectors.phase)
const acts = useShowSelector(showSelectors.acts)
const currentAct = useShowSelector(showSelectors.currentAct)
const energy = useShowSelector(showSelectors.energy)
const verdict = useShowSelector(showSelectors.verdict)
const isExpanded = useShowSelector(showSelectors.isExpanded)
```

### 4. `showStore.ts` — The Zustand Bridge

Maintains the exact same API that existing views and tests expect. Every action internally calls `sendAndSync()`:

```typescript
function sendAndSync(event: ShowMachineEvent): void {
  showActor.send(event)                    // 1. Send event to XState
  useShowStore.setState(readActorState())  // 2. Sync snapshot back to Zustand
}
```

The bridge also intercepts `setState()` calls (from tests) and routes them through XState via `_JUMP_PHASE` and `_PATCH_CONTEXT` events to keep the actor in sync.

### 5. `uiStore.ts` — Non-Phase UI State

State that isn't part of the show lifecycle:

- `calendarAvailable` / `calendarEnabled` / `calendarEvents` — Google Calendar integration
- `calendarFetchStatus` / `calendarFetchedAt` — Fetch tracking
- `claudeSessionId` — Current Claude subprocess session

These are persisted to `localStorage` independently of the phase machine.

## Writing New Components

Use the XState hooks directly:

```tsx
import { useShowSelector, useShowSend, showSelectors } from '@/machines/ShowMachineProvider'

function ActTimer() {
  const currentAct = useShowSelector(showSelectors.currentAct)
  const send = useShowSend()

  if (!currentAct) return null

  return (
    <div className="font-mono text-4xl text-txt-primary">
      {currentAct.name}
      <button
        className="no-drag"
        onClick={() => send({ type: 'COMPLETE_ACT' })}
      >
        Done
      </button>
    </div>
  )
}
```

## Sending Events

Events are typed — TypeScript enforces valid event shapes:

```typescript
const send = useShowSend()

// Phase transitions
send({ type: 'ENTER_WRITERS_ROOM' })
send({ type: 'START_SHOW' })
send({ type: 'STRIKE' })

// Act management
send({ type: 'START_ACT', actId: 'abc-123' })
send({ type: 'COMPLETE_ACT' })
send({ type: 'SKIP_ACT' })

// Beat workflow
send({ type: 'LOCK_BEAT' })
send({ type: 'SKIP_BEAT' })

// Lineup editing (works from any phase)
send({ type: 'ADD_ACT', act: { name: 'Deep Work', durationMs: 3600000, category: 'deep' } })
send({ type: 'REMOVE_ACT', actId: 'abc-123' })
send({ type: 'REORDER_ACT', actId: 'abc-123', newIndex: 0 })
```

## Phase Diagram

```
no_show ──[ENTER_WRITERS_ROOM]──> writers_room
                                    ├── energy
                                    ├── plan
                                    ├── conversation
                                    └── lineup_ready
                                         │
                                    [START_SHOW]
                                         │
                                         v
                                   going_live ──> live
                                                   ├── act_active
                                                   ├── beat_check
                                                   └── celebrating
                                                        │
                                              [ENTER_INTERMISSION]
                                                        │
                                                        v
                                                  intermission
                                                   ├── resting
                                                   └── breathing_pause
                                                        │
                                              [EXIT_INTERMISSION]──> live (resume)
                                              [ENTER_DIRECTOR]──> director
                                                        │
                                                   [STRIKE]
                                                        │
                                                        v
                                                     strike
```

## Testing

Tests can use either approach:

**XState-native (preferred for new tests):**

```typescript
import { createShowActor } from '@/machines/showMachine'

const actor = createShowActor({ energy: 3, acts: [...] })
actor.start()
actor.send({ type: 'START_SHOW' })

expect(getPhaseFromState(actor.getSnapshot().value)).toBe('going_live')
```

**Zustand bridge (existing tests):**

```typescript
import { useShowStore } from '@/stores/showStore'

// setState interceptor routes to XState
useShowStore.setState({ phase: 'live', currentActId: 'abc' })
```

Both are valid. The bridge ensures backward compatibility. New test files should prefer the XState-native approach.
