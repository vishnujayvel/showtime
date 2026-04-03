# Fix State Persistence on App Relaunch

**Issue:** #150
**Type:** Bug fix

## Problem

When reopening Showtime, the previous session (beats locked, lineup, current act) is lost. App starts fresh in `no_show` instead of restoring the in-progress show.

## Root Cause Analysis

State persistence lives in `src/renderer/machines/showActor.ts` (lines 20-57):

1. **Silent resolveState failure**: `getPersistedSnapshot()` wraps `showMachine.resolveState()` in a try/catch that returns `undefined` on any error. If the saved state shape doesn't match the current machine, restoration fails silently.

2. **Date check too strict**: `context.showDate !== today` clears state if the save was before midnight but restore is after.

3. **No schema versioning**: No way to detect when a machine change invalidates the saved state.

## Fix Plan

### 1. Add logging to getPersistedSnapshot()
Replace the silent catch with a console.warn so failures are visible in dev tools.

### 2. Add state schema version
Add a `PERSIST_VERSION` constant. Increment it when machine shape changes. Include in the persisted data and reject mismatches gracefully.

### 3. Fix date check logic
The date check should use the persisted `showDate`, not regenerate today(). If the user started a show today and reopens later today, it should restore. Only clear if the showDate is from a different day.

### 4. Validate state value against machine
Before calling `resolveState()`, validate that the saved `stateValue` keys exist in the current machine. If they don't, fall back to `no_show` with the saved context (acts, energy, etc.) rather than losing everything.

### 5. Add persistence tests
Test: save state → modify machine (simulate) → restore → verify graceful fallback.
Test: save state → same day restore → verify full restoration.
Test: save state → next day restore → verify clean start.

## Files to Change

- `src/renderer/machines/showActor.ts` — persistence functions
- `src/__tests__/statePersistence.test.ts` — existing test file, add new cases

## Non-Goals

- Migrating from localStorage to file-based storage (separate issue)
- SQLite-based persistence (already exists for timeline, not for live state)
