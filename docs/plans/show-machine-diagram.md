---
title: "Show Machine — State Diagram"
status: current
last-verified: 2026-04-06
---
# Show Machine — State Diagram

Visual reference for the XState v5 show machine (`src/renderer/machines/showMachine.ts`).

The machine is **parallel** with two regions: **phase** (main lifecycle) and **animation** (transition effects).

## Phase Region

```mermaid
stateDiagram-v2
    [*] --> no_show

    %% ─── No Show ───
    no_show --> cold_open : TRIGGER_COLD_OPEN
    no_show --> writers_room : ENTER_WRITERS_ROOM

    %% ─── Cold Open ───
    cold_open --> writers_room : COMPLETE_COLD_OPEN

    %% ─── Writer's Room (compound, initial: energy) ───
    state writers_room {
        [*] --> energy

        energy --> plan : SET_WRITERS_ROOM_STEP [step=plan]

        plan --> conversation : SET_WRITERS_ROOM_STEP [step=conversation]
        plan --> energy : SET_WRITERS_ROOM_STEP [step=energy]

        conversation --> lineup_ready : SET_LINEUP
        conversation --> energy : SET_WRITERS_ROOM_STEP [step=energy]
        conversation --> plan : SET_WRITERS_ROOM_STEP [step=plan]

        lineup_ready
    }
    writers_room --> going_live : TRIGGER_GOING_LIVE
    writers_room --> live : START_SHOW [hasActs]
    writers_room --> no_show : RESET

    %% ─── Going Live ───
    going_live --> live : COMPLETE_GOING_LIVE [hasActs]

    %% ─── Live (compound, initial: act_active) ───
    state live {
        [*] --> act_active

        act_active --> beat_check : COMPLETE_ACT
        act_active --> act_active : SKIP_ACT [non‑current]
        act_active --> act_active : SKIP_ACT [current, next exists]
        act_active --> strike_from_skip : SKIP_ACT [current, no next]

        beat_check --> celebrating : LOCK_BEAT
        beat_check --> act_active : SKIP_BEAT [hasNextAct]
        beat_check --> strike_from_beat : SKIP_BEAT [noNextAct]

        celebrating --> celebrating : LOCK_BEAT (double‑click)
        celebrating --> act_active : CELEBRATION_DONE [hasNextAct]
        celebrating --> strike_from_celeb : CELEBRATION_DONE [noNextAct]

        state strike_from_skip <<choice>>
        state strike_from_beat <<choice>>
        state strike_from_celeb <<choice>>
    }
    strike_from_skip --> strike
    strike_from_beat --> strike
    strike_from_celeb --> strike
    live --> intermission : ENTER_INTERMISSION
    live --> director : ENTER_DIRECTOR
    live --> strike : STRIKE
    live --> strike : CALL_SHOW_EARLY
    live --> intermission_bp : START_BREATHING_PAUSE
    live --> no_show : RESET

    %% ─── Intermission (compound, initial: resting) ───
    state intermission {
        [*] --> resting

        resting --> breathing_pause : START_BREATHING_PAUSE

        breathing_pause --> resting : END_BREATHING_PAUSE
    }
    state intermission_bp <<choice>>
    intermission_bp --> breathing_pause
    intermission --> live : EXIT_INTERMISSION [hasPausedTimer]
    intermission --> live : EXIT_INTERMISSION [hasNextAct]
    intermission --> strike : EXIT_INTERMISSION [neither]
    intermission --> strike : STRIKE
    intermission --> no_show : RESET

    %% ─── Director ───
    director --> live : EXIT_DIRECTOR [hasCurrentAct]
    director --> live : SKIP_TO_NEXT [remaining acts]
    director --> strike : SKIP_TO_NEXT [no remaining]
    director --> strike : CALL_SHOW_EARLY
    director --> breathing_pause : START_BREATHING_PAUSE
    director --> no_show : RESET

    %% ─── Strike (terminal) ───
    strike --> no_show : RESET
```

## Animation Region (parallel)

```mermaid
stateDiagram-v2
    [*] --> idle

    idle --> anim_cold_open : TRIGGER_COLD_OPEN
    idle --> anim_going_live : TRIGGER_GOING_LIVE

    anim_cold_open --> idle : COMPLETE_COLD_OPEN
    anim_going_live --> idle : COMPLETE_GOING_LIVE
```

## Global Events (available across multiple phases)

| Event | Available In | Effect |
|-------|-------------|--------|
| `SET_VIEW_TIER` | All phases (phase root) | Updates `viewTier` context |
| `REORDER_ACT` | writers_room, live, intermission | Reorders act in lineup |
| `REMOVE_ACT` | writers_room, live, intermission | Removes act from lineup |
| `ADD_ACT` | writers_room, live, intermission | Adds act to lineup |
| `EXTEND_ACT` | live (parent) | Adds time to current timer |

## Guards

| Guard | Condition |
|-------|-----------|
| `hasActs` | `context.acts.length > 0` |
| `hasCurrentAct` | `context.currentActId !== null` |
| `hasNextAct` | `findNextUpcoming(acts) !== undefined` |
| `noNextAct` | `findNextUpcoming(acts) === undefined` |
| `hasTimerRunning` | `context.timerEndAt !== null` |
| `hasPausedTimer` | `context.timerPausedRemaining !== null && context.currentActId !== null` |

## Notes

- The machine is **parallel** (`type: 'parallel'`): `phase` and `animation` regions run independently.
- Animation region syncs with phase on `TRIGGER_COLD_OPEN`/`COMPLETE_COLD_OPEN` and `TRIGGER_GOING_LIVE`/`COMPLETE_GOING_LIVE`.
- `LOCK_BEAT`/`SKIP_BEAT` are restricted to `beat_check` and `celebrating` substates — they do NOT fire from `act_active`.
- `SET_ENERGY` is handled in the `energy` substate only. `SET_LINEUP` transitions from `conversation` → `lineup_ready`. `SET_WRITERS_ROOM_STEP` uses guarded transitions in each substate to enforce sequential flow.
