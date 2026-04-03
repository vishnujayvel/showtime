# XState Machine Bug Batch — Wave 1 (Machine Fixes)

**Issues:** #139, #140, #141, #142, #143, #144, #146
**Type:** Bug Batch (all fixes in showMachine.ts + WritersRoomView.tsx + tests)

## Bugs to Fix

### Critical

#### #140: cold_open missing RESET
Add `RESET` handler to `cold_open` phase → `no_show` with `resetContext`.

#### #141: going_live missing RESET + hasActs guard
1. Add `RESET` handler to `going_live` phase → `no_show` with `resetContext`.
2. Add `hasActs` guard to `TRIGGER_GOING_LIVE` in `writers_room`.

#### #139: lineup_ready dead-end — no backward navigation
Add to `lineup_ready` substate:
- `SET_WRITERS_ROOM_STEP` handlers: allow going back to `conversation`, `plan`, or `energy`
- `SET_ENERGY` handler for quick energy changes
- `SET_LINEUP` handler to accept a new/updated lineup (stay in `lineup_ready`)

### Medium

#### #142: COMPLETE_ACT leaks through live parent
Move `COMPLETE_ACT` from `live` parent level into `act_active` substate only. The parent-level handler currently fires from `beat_check` and `celebrating`, which is wrong.

#### #143: REMOVE_ACT on current act creates zombie state
When `REMOVE_ACT` removes the current act during `live`:
- If there are remaining upcoming acts → auto-start next act
- If no acts remain → transition to `strike`
This matches `SKIP_ACT` behavior.

#### #144: hasPausedTimer guard fragile
Tighten `hasPausedTimer` guard to also check that the current act is still active:
```ts
hasPausedTimer: ({ context }) => 
  context.timerPausedRemaining !== null && 
  context.currentActId !== null &&
  context.acts.some(a => a.id === context.currentActId && a.status === 'active')
```

#### #146: Lineup confirmation UX
In WritersRoomView.tsx, when `writersRoomStep === 'lineup_ready'`:
1. Show a distinct lineup confirmation panel (not just a button swap)
2. Display the draft lineup with reorder up/down controls (ActCard already has this)
3. Show a prominent "Confirm & Go Live" button
4. Show a "Refine" button that sends `SET_WRITERS_ROOM_STEP` back to `conversation`
5. Hide the "Build My Lineup" button once lineup exists

## Testing Strategy

Each fix needs:
1. Unit test proving the bug exists (send event in buggy state, assert it's a no-op or wrong)
2. Unit test proving the fix works (send event, assert correct transition/context)
3. Update the transition coverage matrix (`docs/plans/transition-coverage.md`)

## Non-Goals

- No changes to animation region
- No changes to E2E tests (unit tests sufficient for machine fixes)
- No changes to ActCard component (reorder UI already works)
