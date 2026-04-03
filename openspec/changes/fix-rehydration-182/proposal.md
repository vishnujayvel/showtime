# Fix: Rehydration restores confirmed lineup into writers_room

**Issue:** #182
**Type:** Bug fix
**Risk:** Low — touches rehydration logic only, no UI changes

## Problem

When the app restarts after a lineup was confirmed but the show was never started, rehydration puts the machine in `writers_room.lineup_ready` with `lineupStatus: 'confirmed'`. This is an invalid state — a confirmed lineup should never be in Writer's Room. The user sees a dead "Finalize Lineup" button.

## Root Cause

**`showActor.ts:379-382`** — `hydrateFromDB()` infers `lineupStatus = 'confirmed'` from `acts.length > 0`, then passes `targetPhase = 'writers_room'` (from SQLite) unchanged.

**`showMachine.ts:484-492`** — `RESTORE_SHOW` handler routes `writers_room` + acts to `writers_room.lineup_ready` without checking `lineupStatus`.

## Fix

Two changes:

### 1. `showActor.ts` — Promote phase during rehydration

In `hydrateFromDB()`, after computing `lineupStatus`, promote `targetPhase` from `writers_room` to `live` when the lineup is confirmed:

```typescript
// After line 382:
// Confirmed lineup in writers_room is invalid — promote to live (go-live view)
let resolvedPhase = targetPhase
if (targetPhase === 'writers_room' && lineupStatus === 'confirmed') {
  resolvedPhase = 'live'
}
```

Then use `resolvedPhase` instead of `targetPhase` in the RESTORE_SHOW event (line 386).

### 2. `showMachine.ts` — Add guard for confirmed lineup promotion

In the `RESTORE_SHOW` handler, add a new guard BEFORE the existing `writers_room` cases:

```typescript
{
  // Confirmed lineup in writers_room → promote to live (go-live ready)
  target: '#show.phase.live.act_active',
  guard: ({ event }) =>
    event.type === 'RESTORE_SHOW' &&
    event.targetPhase === 'writers_room' &&
    event.context.lineupStatus === 'confirmed' &&
    (event.context.acts?.length ?? 0) > 0,
  actions: 'restoreShowContext',
},
```

### 3. Unit test

Add a test in `src/__tests__/` that verifies:
- GIVEN: RESTORE_SHOW with `targetPhase: 'writers_room'`, acts present, `lineupStatus: 'confirmed'`
- WHEN: Machine processes the event
- THEN: Machine lands in `live.act_active`, NOT `writers_room.lineup_ready`

## State invariant (retrospective)

**`writers_room` phase MUST NOT have `lineupStatus === 'confirmed'`.**

This invariant should be documented in CLAUDE.md under Known Pitfalls to prevent future regressions.

## Testing Strategy

- Unit test: RESTORE_SHOW with confirmed lineup → lands in live
- Unit test: RESTORE_SHOW with draft lineup → lands in writers_room.lineup_ready (existing behavior preserved)
- Manual: Create lineup, finalize, close app, reopen → should see go-live state
