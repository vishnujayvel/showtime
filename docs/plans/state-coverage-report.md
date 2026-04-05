# State Machine Coverage Report

> Generated: 2026-04-05 01:55:37 UTC
> Source: `src/renderer/machines/showMachine.ts`
> Run: `bun run scripts/state-coverage-report.ts`

## 1. State Tree

Every state and substate in the machine, with transition and test counts.

```
➖ show (compound) — 0 events, 0 tested
  ✅ show.phase (compound) — 1 events, 1 tested
    ✅ show.phase.no_show — 4 events, 4 tested
    ✅ show.phase.cold_open — 2 events, 2 tested
    ✅ show.phase.writers_room (compound) — 10 events, 10 tested
      ✅ show.phase.writers_room.energy — 2 events, 2 tested
      ✅ show.phase.writers_room.plan — 1 events, 1 tested
      ✅ show.phase.writers_room.conversation — 1 events, 1 tested
      ✅ show.phase.writers_room.lineup_ready — 2 events, 2 tested
    ✅ show.phase.going_live — 2 events, 2 tested
    ✅ show.phase.live (compound) — 12 events, 12 tested
      ✅ show.phase.live.act_active — 3 events, 3 tested
      ✅ show.phase.live.beat_check — 2 events, 2 tested
      ✅ show.phase.live.celebrating — 2 events, 2 tested
    ✅ show.phase.intermission (compound) — 6 events, 6 tested
      ✅ show.phase.intermission.resting — 1 events, 1 tested
      ✅ show.phase.intermission.breathing_pause — 1 events, 1 tested
    ✅ show.phase.director — 6 events, 6 tested
    ✅ show.phase.strike — 1 events, 1 tested
  ➖ show.animation (compound) — 0 events, 0 tested
    ✅ show.animation.idle — 2 events, 2 tested
    ✅ show.animation.cold_open — 1 events, 1 tested
    ✅ show.animation.going_live — 1 events, 1 tested
```

## 2. Transition Matrix

Event x Leaf-State. Each cell shows whether a transition exists and whether it has test coverage.

Legend:
- `Y` = transition exists and has test coverage
- `!` = transition exists but no test coverage found
- `.` = no transition (event not handled in this state)
- `W` = caught by wildcard handler only

### no_show

| Event | phase.no_show |
| --- | --- |
| ENTER_WRITERS_ROOM | `Y` |
| RESET | `Y` |
| RESTORE_SHOW | `Y` |
| SET_VIEW_TIER | `Y` |
| TRIGGER_COLD_OPEN | `Y` |

### cold_open

| Event | phase.cold_open |
| --- | --- |
| COMPLETE_COLD_OPEN | `Y` |
| RESET | `Y` |
| SET_VIEW_TIER | `Y` |

### writers_room

| Event | writers_room.energy | writers_room.plan | writers_room.conversation | writers_room.lineup_ready |
| --- | --- | --- | --- | --- |
| ADD_ACT | `Y` | `Y` | `Y` | `Y` |
| CONFIRM_LINEUP_EDIT | `Y` | `Y` | `Y` | `Y` |
| FINALIZE_LINEUP | `Y` | `Y` | `Y` | `Y` |
| REMOVE_ACT | `Y` | `Y` | `Y` | `Y` |
| REORDER_ACT | `Y` | `Y` | `Y` | `Y` |
| RESET | `Y` | `Y` | `Y` | `Y` |
| SET_ENERGY | `Y` | `W` | `W` | `Y` |
| SET_LINEUP | `Y` | `Y` | `Y` | `Y` |
| SET_VIEW_TIER | `Y` | `Y` | `Y` | `Y` |
| SET_WRITERS_ROOM_STEP | `Y` | `Y` | `Y` | `Y` |
| START_SHOW | `Y` | `Y` | `Y` | `Y` |
| TRIGGER_GOING_LIVE | `Y` | `Y` | `Y` | `Y` |
| UPDATE_ACT | `Y` | `Y` | `Y` | `Y` |

### going_live

| Event | phase.going_live |
| --- | --- |
| COMPLETE_GOING_LIVE | `Y` |
| RESET | `Y` |
| SET_VIEW_TIER | `Y` |

### live

| Event | live.act_active | live.beat_check | live.celebrating |
| --- | --- | --- | --- |
| ADD_ACT | `Y` | `Y` | `Y` |
| CALL_SHOW_EARLY | `Y` | `Y` | `Y` |
| CELEBRATION_DONE | `W` | `W` | `Y` |
| COMPLETE_ACT | `Y` | `W` | `W` |
| EDIT_LINEUP | `Y` | `Y` | `Y` |
| ENTER_DIRECTOR | `Y` | `Y` | `Y` |
| ENTER_INTERMISSION | `Y` | `Y` | `Y` |
| EXTEND_ACT | `Y` | `Y` | `Y` |
| LOCK_BEAT | `W` | `Y` | `Y` |
| REMOVE_ACT | `Y` | `Y` | `Y` |
| REORDER_ACT | `Y` | `Y` | `Y` |
| RESET | `Y` | `Y` | `Y` |
| SET_VIEW_TIER | `Y` | `Y` | `Y` |
| SKIP_ACT | `Y` | `W` | `W` |
| SKIP_BEAT | `W` | `Y` | `W` |
| START_BREATHING_PAUSE | `Y` | `Y` | `Y` |
| STRIKE | `Y` | `Y` | `Y` |
| UPDATE_ACT | `Y` | `Y` | `Y` |

### intermission

| Event | intermission.resting | intermission.breathing_pause |
| --- | --- | --- |
| ADD_ACT | `Y` | `Y` |
| END_BREATHING_PAUSE | `W` | `Y` |
| EXIT_INTERMISSION | `Y` | `Y` |
| REMOVE_ACT | `Y` | `Y` |
| REORDER_ACT | `Y` | `Y` |
| RESET | `Y` | `Y` |
| SET_VIEW_TIER | `Y` | `Y` |
| START_BREATHING_PAUSE | `Y` | `W` |
| STRIKE | `Y` | `Y` |

### director

| Event | phase.director |
| --- | --- |
| CALL_SHOW_EARLY | `Y` |
| EDIT_LINEUP | `Y` |
| EXIT_DIRECTOR | `Y` |
| RESET | `Y` |
| SET_VIEW_TIER | `Y` |
| SKIP_TO_NEXT | `Y` |
| START_BREATHING_PAUSE | `Y` |

### strike

| Event | phase.strike |
| --- | --- |
| RESET | `Y` |
| SET_VIEW_TIER | `Y` |

### animation

| Event | animation.idle | animation.cold_open | animation.going_live |
| --- | --- | --- | --- |
| COMPLETE_COLD_OPEN | `W` | `Y` | `W` |
| COMPLETE_GOING_LIVE | `W` | `W` | `Y` |
| TRIGGER_COLD_OPEN | `Y` | `W` | `W` |
| TRIGGER_GOING_LIVE | `Y` | `W` | `W` |

## 3. Guard Coverage

Named guards defined in the machine and their test coverage.

- ✅ `hasActs` — tested in: xstate-bug-batch.test.ts
- ⚠️ `hasCurrentAct` — no test found
- ✅ `hasNextAct` — tested in: showMachine.test.ts
- ➖ `noNextAct` (defined but unused in transitions)
- ✅ `hasConfirmedLineup` — tested in: xstate-bug-batch.test.ts, hydrateFromDB.test.ts
- ➖ `hasTimerRunning` (defined but unused in transitions)
- ✅ `hasPausedTimer` — tested in: showMachine.test.ts, xstate-bug-batch.test.ts

Additionally, there are **21** inline guards (anonymous arrow functions in transitions).
Inline guards are tested indirectly through their transition tests.

## 4. Dead End Analysis

States with limited or no outgoing transitions (potential UX traps).

- ⚠️ `show.animation.cold_open` — exits: COMPLETE_COLD_OPEN
- ⚠️ `show.animation.going_live` — exits: COMPLETE_GOING_LIVE

## 5. Connectivity Report

| Metric | Count |
| --- | --- |
| Total states (all) | 23 |
| Leaf (atomic) states | 17 |
| Total transitions | 82 |
| Unique events | 34 |
| Reachable leaf states from initial | 17 / 17 |
| Unreachable leaf states | 0 |
| States with only one exit | 3 |

### States With Only One Exit (potential UX traps)

- `show.phase.strike` — only exit: RESET
- `show.animation.cold_open` — only exit: COMPLETE_COLD_OPEN
- `show.animation.going_live` — only exit: COMPLETE_GOING_LIVE

## 6. Test Coverage Cross-Reference

For each event type, which test files reference it.

| Event | Covered | Test Files |
| --- | --- | --- |
| `ADD_ACT` | ✅ | showMachine.test.ts, showStore.test.ts, stateMachine.test.ts |
| `CALL_SHOW_EARLY` | ✅ | showMachine.test.ts, showStore.test.ts, stateMachine.test.ts, beatCheckForceExpand.test.ts, verdictLogic.test.ts |
| `CELEBRATION_DONE` | ✅ | showMachine.test.ts, restoreShow.test.ts |
| `COMPLETE_ACT` | ✅ | showMachine.test.ts, xstate-bug-batch.test.ts, showStore.test.ts, inspect-drop-detection.test.ts, stateMachine.test.ts, beatCheckForceExpand.test.ts, restoreShow.test.ts, components.test.tsx, audioAndPolish.test.tsx, statePersistence.test.ts, verdictLogic.test.ts, useTraySync.test.ts |
| `COMPLETE_COLD_OPEN` | ✅ | showMachine.test.ts, showStore.test.ts |
| `COMPLETE_GOING_LIVE` | ✅ | showMachine.test.ts, showStore.test.ts |
| `CONFIRM_LINEUP_EDIT` | ✅ | showMachine.test.ts |
| `EDIT_LINEUP` | ✅ | showMachine.test.ts |
| `END_BREATHING_PAUSE` | ✅ | showMachine.test.ts, showStore.test.ts |
| `ENTER_DIRECTOR` | ✅ | showMachine.test.ts, showStore.test.ts, stateMachine.test.ts, components.test.tsx, verdictLogic.test.ts, useTraySync.test.ts |
| `ENTER_INTERMISSION` | ✅ | showMachine.test.ts, xstate-bug-batch.test.ts, showStore.test.ts, inspect-drop-detection.test.ts, stateMachine.test.ts, restoreShow.test.ts, statePersistence.test.ts, waveBEnhancements.test.tsx, useTraySync.test.ts |
| `ENTER_WRITERS_ROOM` | ✅ | showMachine.test.ts, xstate-bug-batch.test.ts, showStore.test.ts, stateMachine.test.ts, beatCheckForceExpand.test.ts, restoreShow.test.ts, hydrateFromDB.test.ts, useTimer.test.ts, components.test.tsx, updateAct.test.ts, audioAndPolish.test.tsx, statePersistence.test.ts, viewMenu.test.tsx, verdictLogic.test.ts, waveBEnhancements.test.tsx, useTraySync.test.ts |
| `EXIT_DIRECTOR` | ✅ | showMachine.test.ts, showStore.test.ts, stateMachine.test.ts |
| `EXIT_INTERMISSION` | ✅ | showMachine.test.ts, xstate-bug-batch.test.ts, showStore.test.ts, stateMachine.test.ts, restoreShow.test.ts |
| `EXTEND_ACT` | ✅ | showMachine.test.ts, showStore.test.ts, stateMachine.test.ts, useTraySync.test.ts |
| `FINALIZE_LINEUP` | ✅ | showMachine.test.ts, xstate-bug-batch.test.ts, showStore.test.ts, stateMachine.test.ts, beatCheckForceExpand.test.ts, restoreShow.test.ts, useTimer.test.ts, components.test.tsx, updateAct.test.ts, audioAndPolish.test.tsx, statePersistence.test.ts, viewMenu.test.tsx, verdictLogic.test.ts, waveBEnhancements.test.tsx, useTraySync.test.ts |
| `LOCK_BEAT` | ✅ | showMachine.test.ts, xstate-bug-batch.test.ts, showStore.test.ts, inspect-drop-detection.test.ts, stateMachine.test.ts, beatCheckForceExpand.test.ts, restoreShow.test.ts, components.test.tsx, audioAndPolish.test.tsx, verdictLogic.test.ts, useTraySync.test.ts |
| `REMOVE_ACT` | ✅ | showMachine.test.ts, xstate-bug-batch.test.ts, showStore.test.ts, stateMachine.test.ts |
| `REORDER_ACT` | ✅ | showMachine.test.ts, xstate-bug-batch.test.ts, showStore.test.ts, stateMachine.test.ts |
| `RESET` | ✅ | showMachine.test.ts, xstate-bug-batch.test.ts, showStore.test.ts, inspect-drop-detection.test.ts, stateMachine.test.ts, beatCheckForceExpand.test.ts, restoreShow.test.ts |
| `RESTORE_SHOW` | ✅ | showMachine.test.ts, inspect-drop-detection.test.ts, restoreShow.test.ts |
| `SET_ENERGY` | ✅ | showMachine.test.ts, xstate-bug-batch.test.ts, showStore.test.ts, stateMachine.test.ts, beatCheckForceExpand.test.ts, useTimer.test.ts, components.test.tsx, updateAct.test.ts, audioAndPolish.test.tsx, statePersistence.test.ts, viewMenu.test.tsx, verdictLogic.test.ts, waveBEnhancements.test.tsx, useTraySync.test.ts |
| `SET_LINEUP` | ✅ | showMachine.test.ts, xstate-bug-batch.test.ts, showStore.test.ts, stateMachine.test.ts, beatCheckForceExpand.test.ts, restoreShow.test.ts, useTimer.test.ts, components.test.tsx, updateAct.test.ts, audioAndPolish.test.tsx, statePersistence.test.ts, viewMenu.test.tsx, verdictLogic.test.ts, waveBEnhancements.test.tsx, useTraySync.test.ts |
| `SET_VIEW_TIER` | ✅ | showMachine.test.ts, showStore.test.ts, beatCheckForceExpand.test.ts, audioAndPolish.test.tsx, waveBEnhancements.test.tsx, useTraySync.test.ts |
| `SET_WRITERS_ROOM_STEP` | ✅ | showMachine.test.ts, xstate-bug-batch.test.ts, showStore.test.ts |
| `SKIP_ACT` | ✅ | showMachine.test.ts, showStore.test.ts, stateMachine.test.ts, useTraySync.test.ts |
| `SKIP_BEAT` | ✅ | showMachine.test.ts, xstate-bug-batch.test.ts, showStore.test.ts, stateMachine.test.ts, beatCheckForceExpand.test.ts, verdictLogic.test.ts |
| `SKIP_TO_NEXT` | ✅ | showMachine.test.ts |
| `START_BREATHING_PAUSE` | ✅ | showMachine.test.ts, showStore.test.ts |
| `START_SHOW` | ✅ | showMachine.test.ts, xstate-bug-batch.test.ts, showStore.test.ts, inspect-drop-detection.test.ts, stateMachine.test.ts, beatCheckForceExpand.test.ts, restoreShow.test.ts, useTimer.test.ts, components.test.tsx, updateAct.test.ts, audioAndPolish.test.tsx, statePersistence.test.ts, viewMenu.test.tsx, verdictLogic.test.ts, waveBEnhancements.test.tsx, useTraySync.test.ts |
| `STRIKE` | ✅ | showMachine.test.ts, showStore.test.ts, inspect-drop-detection.test.ts, beatCheckForceExpand.test.ts, restoreShow.test.ts, audioAndPolish.test.tsx, waveBEnhancements.test.tsx |
| `TRIGGER_COLD_OPEN` | ✅ | showMachine.test.ts, xstate-bug-batch.test.ts, showStore.test.ts, inspect-drop-detection.test.ts |
| `TRIGGER_GOING_LIVE` | ✅ | showMachine.test.ts, xstate-bug-batch.test.ts, showStore.test.ts |
| `UPDATE_ACT` | ✅ | updateAct.test.ts |

**Event coverage: 34/34 (100.0%)**

## Summary

| Metric | Value |
| --- | --- |
| Machine | `showMachine` (XState v5, parallel) |
| Top-level regions | phase, animation |
| Total states | 23 |
| Leaf states | 17 |
| Total transitions | 82 |
| Named guards | 7 |
| Inline guards | 21 |
| Event types | 34 |
| Event test coverage | 100.0% |
| State-event test coverage | 100.0% |
| Reachability | 17/17 leaf states reachable |

## 7. Shadow State Detection

Scans `App.tsx` for `useState` patterns that control view rendering outside XState.
These are bugs — every full-screen view must be a machine state. See CLAUDE.md rule.

**⚠️ 3 shadow state(s) found:**

- `showOnboarding` — controls rendering in App.tsx but is NOT in the XState machine
- `showHistory` — controls rendering in App.tsx but is NOT in the XState machine
- `showSettings` — controls rendering in App.tsx but is NOT in the XState machine

**Action:** Move these into the XState machine as proper states or a parallel region.
