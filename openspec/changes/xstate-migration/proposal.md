## Why

The show phase state machine (no_show → writers_room → live → intermission → director → strike) is implemented as imperative Zustand actions scattered across 768 lines of showStore.ts. Zustand is unopinionated — it allows any state mutation from anywhere via `set()`, with no enforcement of valid transitions. This has caused recurring bugs from missing journeys: transitions that were never specified, guard conditions that were never checked, and edge cases where the app falls into undefined states (e.g., entering intermission from no_show, timer expiring during director mode with no defined resolution). A codebase audit identified 4 explicit guard gaps and multiple invalid state combinations that are technically reachable. We need formal state machine enforcement where invalid transitions are impossible by definition, not just checked at runtime.

## What Changes

- **BREAKING**: Replace Zustand phase management with XState v5 machine actor for all show phase transitions
- **BREAKING**: All components reading `phase` from showStore must migrate to XState selectors (`useSelector(showActor, ...)`)
- **BREAKING**: All components calling phase transition actions (enterWritersRoom, startShow, etc.) must migrate to `showActor.send({ type: 'EVENT' })`
- Add nested states for Writer's Room substeps (energy → plan → conversation → lineup_ready)
- Add nested states for Act lifecycle (upcoming → active → completed/skipped) with beat check flow
- Add parallel state regions for timer management and animation flags (coldOpen, goingLive)
- Add `@xstate/react` dependency for React integration hooks
- Keep Zustand for non-machine state: viewTier, calendar cache, Claude session ID
- Migrate entire test suite: unit tests (showStore.test.ts, stateMachine.test.ts), property tests (show-store.property.test.ts), and E2E tests to work with XState
- Wire XState machine actions to SQLite SyncEngine for persistence
- Update CLAUDE.md state management rules (Zustand-only → XState for state machines + Zustand for UI state)

## Capabilities

### New Capabilities
- `xstate-show-machine`: XState v5 machine definition for the complete show lifecycle — 6 top-level phases, nested substates, guarded transitions, entry/exit actions, parallel regions for timer and animation state
- `xstate-react-bridge`: React integration layer — useActorRef, useSelector hooks, context provider for the show machine actor, backward-compatible API surface during migration

### Modified Capabilities
- `show-lifecycle`: Phase transition rules move from imperative Zustand actions to declarative XState machine transitions. All existing transitions preserved; 4 guard gaps fixed. **BREAKING**: API surface changes from `useShowStore(s => s.startShow)()` to `showActor.send({ type: 'START_SHOW' })`
- `showtime-core`: Store split — phase state managed by XState actor, non-phase UI state remains in Zustand. ShowStoreState type narrows to exclude phase-managed fields
- `ui-views`: All 12 views and 3 panels update imports from showStore phase selectors to XState selectors. No visual or behavioral changes
- `claude-integration`: Claude subprocess lifecycle (pre-warm, stream parsing) wired as XState invoked services rather than imperative function calls

## Impact

- **Core store**: showStore.ts split into showMachine.ts (XState) + uiStore.ts (Zustand remainder)
- **Components**: All 12 views, 3 panels, and ~10 components that read phase state need selector migration
- **Tests**: 535 unit tests, 5 property test suites, 21 E2E test files need updates
- **Dependencies**: Add `@xstate/react`. `xstate` and `@xstate/graph` already in package.json
- **CLAUDE.md**: Rule 8 (Zustand Only) updated to "XState for state machines + Zustand for UI state"
- **SyncEngine**: Actions wired to machine entry/exit rather than imperative flushToSQLite calls
- **Preload/IPC**: No changes — IPC bridge remains the same, machine actions call through existing window.clui API
- **Skill (SKILL.md)**: No changes needed — skill generates lineup JSON, app parses it regardless of state management layer
