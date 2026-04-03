# Bug Batch Wave 4: Pill Clipping + Edge Cases

**Issues:** #185, #181 (remaining items)
**Type:** Bug Batch
**Risk:** Low-Medium — touches PillView, showMachine, showActor, ActCard

## Triage Summary

#181 had 11 items. After code audit, 6 are already fixed (items 2,3,5,7,8,10).
5 remaining items + #185 pill clipping = 6 fixes total.

## Wave 1: Core Fixes (ship first)

### Fix A: Pill view timer clipping (#185)

**Problem:** `PillView.tsx:56` uses `w-80` (320px fixed). Long act titles push the timer off-screen.

**Fix:**
- Replace `w-80` with `min-w-80 w-auto max-w-[480px]`
- Add `shrink-0 whitespace-nowrap` to the timer span so it never clips
- Add `truncate` to the act title span so IT truncates (not the timer)
- Update `window-manager.ts` pill mode width to match (min 320, max 480)

**Files:** `src/renderer/views/PillView.tsx`, `src/main/window-manager.ts`

### Fix B: Paused timer round-trip (#181 item 6)

**Problem:** `hydrateFromDB()` sets `timerPausedRemaining: null` always, losing paused state.

**Fix:**
- In `showActor.ts` `hydrateFromDB()`, check if act status is 'active' but has no `timerEndAt` computed (indicating pause)
- If the DB has a paused timer state, reconstruct `timerPausedRemaining` from the act's elapsed vs planned duration
- Add test: RESTORE_SHOW with paused timer → timerPausedRemaining preserved

**Files:** `src/renderer/machines/showActor.ts`, `src/__tests__/restoreShow.test.ts`

### Fix C: Active act duration edit updates timer (#181 item 9)

**Problem:** UPDATE_ACT in showMachine.ts updates `durationMinutes` but doesn't recalculate `timerEndAt` when the act is currently active.

**Fix:**
- In showMachine's UPDATE_ACT action, if the updated act is the current active act and `timerEndAt` exists, recalculate: `timerEndAt = act.startedAt + newDuration * 60000`
- If timer was paused, recalculate `timerPausedRemaining` proportionally
- Add test: edit active act duration → timerEndAt recalculated

**Files:** `src/renderer/machines/showMachine.ts`, `src/__tests__/showMachine.test.ts`

### Fix D: Clamp inline duration input (#181 item 11)

**Problem:** `ActCard.tsx` `commitDuration()` accepts any integer > 0. The +/- buttons clamp to 5-240 but typed input does not.

**Fix:**
- In `commitDuration()`, apply `Math.max(5, Math.min(240, parsed))` before dispatching
- Add visual feedback if clamped (optional — just match the button behavior)

**Files:** `src/renderer/components/ActCard.tsx`

## Wave 2: Quality (after Wave 1 merges)

### Fix E: RestoreShow integration tests (#181 item 1)

**Problem:** Tests send RESTORE_SHOW directly; they don't test hydrateFromDB() pipeline.

**Fix:**
- Add integration-style tests that mock window.showtime.dataHydrate() return value
- Call hydrateFromDB() and verify the machine lands in the correct state
- Cover: paused timer, strike skip, confirmed lineup promotion

**Files:** `src/__tests__/restoreShow.test.ts`, `src/renderer/machines/showActor.ts`

### Fix F: ActCard accessibility (#181 item 4)

**Problem:** Missing aria-labels on inline edit inputs, duration buttons lack roles.

**Fix:**
- Add `aria-label` to duration input, name input, sketch input
- Add `aria-label` to +/- duration buttons
- Ensure focus management on edit mode toggle

**Files:** `src/renderer/components/ActCard.tsx`

## Testing Strategy

- Unit tests for each fix (machine transitions, context mutations)
- Type check: `npx tsc --noEmit`
- Full test suite: `npm run test` (754+ tests)
- Manual: launch app, create lineup, check pill view with long act names
