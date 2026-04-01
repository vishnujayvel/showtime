# Show Machine — Event × State Coverage Matrix

Tracks which event+state combinations are tested. Updated alongside `src/__tests__/showMachine.test.ts`.

**Legend:** ✅ Tested | ❌ Not tested | ⛔ Invalid (event not handled in this state) | 🔧 Fixed (was a bug, now blocked)

## Phase Transitions

| Event | no_show | cold_open | writers_room | going_live | live | intermission | director | strike |
|-------|---------|-----------|-------------|------------|------|-------------|----------|--------|
| ENTER_WRITERS_ROOM | ✅ → wr | ⛔ | ⛔ | ⛔ | ✅ no-op | ⛔ | ⛔ | ⛔ |
| TRIGGER_COLD_OPEN | ✅ → co | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| COMPLETE_COLD_OPEN | ⛔ | ✅ → wr | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| START_SHOW | ✅ no-op | ⛔ | ✅ → live | ⛔ | ⛔ | ⛔ | ⛔ | ✅ no-op |
| TRIGGER_GOING_LIVE | ⛔ | ⛔ | ✅ → gl | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| COMPLETE_GOING_LIVE | ⛔ | ⛔ | ⛔ | ✅ → live | ⛔ | ⛔ | ⛔ | ⛔ |
| ENTER_INTERMISSION | ✅ no-op | ⛔ | ✅ no-op | ⛔ | ✅ → int | ⛔ | ⛔ | ⛔ |
| EXIT_INTERMISSION | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ → live/strike | ⛔ | ⛔ |
| ENTER_DIRECTOR | ✅ no-op | ⛔ | ⛔ | ⛔ | ✅ → dir | ⛔ | ⛔ | ⛔ |
| EXIT_DIRECTOR | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ → live | ⛔ |
| SKIP_TO_NEXT | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ → live/strike | ⛔ |
| CALL_SHOW_EARLY | ⛔ | ⛔ | ⛔ | ⛔ | ✅ → strike | ⛔ | ✅ → strike | ⛔ |
| STRIKE | ⛔ | ⛔ | ⛔ | ⛔ | ✅ → strike | ✅ → strike | ⛔ | ⛔ |
| RESET | ⛔ | ⛔ | ✅ → ns | ⛔ | ✅ → ns | ✅ → ns | ✅ → ns | ✅ → ns |

## Live Substates

| Event | act_active | beat_check | celebrating |
|-------|-----------|------------|-------------|
| COMPLETE_ACT | ✅ → bc | ⛔ (parent handles) | ⛔ (parent handles) |
| SKIP_ACT | ✅ → aa/strike | ⛔ | ⛔ |
| LOCK_BEAT | 🔧 no-op (was bug) | ✅ → cel | ✅ stays (double-click) |
| SKIP_BEAT | 🔧 no-op (was bug) | ✅ → aa/strike | ⛔ |
| CELEBRATION_DONE | ⛔ | ⛔ | ✅ → aa/strike |
| EXTEND_ACT | ✅ (parent) | ✅ (parent) | ✅ (parent) |

## Writer's Room Substates

| Event | energy | plan | conversation | lineup_ready |
|-------|--------|------|-------------|-------------|
| SET_ENERGY | ✅ assigns | 🔧 no-op (was bypass) | 🔧 no-op (was bypass) | 🔧 no-op (was bypass) |
| SET_LINEUP | 🔧 no-op (was bypass) | 🔧 no-op (was bypass) | ✅ → lr | 🔧 no-op (was bypass) |
| SET_WRITERS_ROOM_STEP [plan] | ✅ → plan | ⛔ self | ⛔ | 🔧 no-op (was bypass) |
| SET_WRITERS_ROOM_STEP [conv] | 🔧 no-op (was bypass) | ✅ → conv | ⛔ self | 🔧 no-op (was bypass) |
| SET_WRITERS_ROOM_STEP [energy] | ⛔ self | ✅ → energy | ✅ → energy | 🔧 no-op (was bypass) |

## Intermission Substates

| Event | resting | breathing_pause |
|-------|---------|----------------|
| START_BREATHING_PAUSE | ✅ → bp | ⛔ |
| END_BREATHING_PAUSE | ⛔ | ✅ → resting |
| EXIT_INTERMISSION | ✅ (parent) | ✅ (parent) |

## Animation Region

| Event | idle | cold_open | going_live |
|-------|------|-----------|------------|
| TRIGGER_COLD_OPEN | ✅ → co | ⛔ | ⛔ |
| TRIGGER_GOING_LIVE | ✅ → gl | ⛔ | ⛔ |
| COMPLETE_COLD_OPEN | ⛔ | ✅ → idle | ⛔ |
| COMPLETE_GOING_LIVE | ⛔ | ⛔ | ✅ → idle |

## Global Events (phase root level)

| Event | All phases |
|-------|-----------|
| SET_VIEW_TIER | ✅ (tested in live) |

## Lineup Editing (parent-level, writers_room + live + intermission)

| Event | writers_room | live | intermission |
|-------|-------------|------|-------------|
| REORDER_ACT | ✅ | ✅ | ✅ |
| REMOVE_ACT | ✅ | ✅ | ✅ |
| ADD_ACT | ✅ | ✅ | ✅ |

## Bugs Fixed in This Change

### 1. LOCK_BEAT/SKIP_BEAT from `act_active` (was accepted, now blocked)

**Before:** `LOCK_BEAT`/`SKIP_BEAT` defined at `live` parent level. When sent during `act_active`, the parent handler accepted them — allowing beat locks without going through `beat_check`.

**After:** Removed from `live` parent. Only `beat_check` and `celebrating` substates handle them. Sending from `act_active` is now a no-op.

### 2. SET_ENERGY/SET_LINEUP/SET_WRITERS_ROOM_STEP bypassing substate guards

**Before:** All three events had unguarded handlers at `writers_room` parent level. When a substate's guarded transition rejected an event (e.g., trying to jump from `energy` → `conversation`), XState v5 event bubbling sent it to the parent, which accepted it unconditionally.

**After:** Removed from parent. `SET_ENERGY` handled in `energy` substate only. `SET_LINEUP` handled in `conversation` → `lineup_ready` only. `SET_WRITERS_ROOM_STEP` has guarded transitions in each substate enforcing sequential flow.
