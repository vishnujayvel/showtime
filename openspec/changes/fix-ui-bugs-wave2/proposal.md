# Proposal: Fix UI Bugs Wave 2 (#86, #85, #84, #83)

## Bug #86: Pill view collapses to tiny size after zoom out/in

**Problem:** Pill view becomes an empty thin bar after zooming out then back in. Content-tight window sizing loses minimum bounds.

**Fix:** Add minimum width/height constraints to the pill window sizing in `src/main/window.ts`. When `setViewMode('micro')` is called, enforce `minWidth: 320, minHeight: 64` (the pill dimensions from the design system). Also check `src/renderer/views/PillView.tsx` for any CSS that could collapse content.

**Files:** `src/main/window.ts`, `src/renderer/views/PillView.tsx`

## Bug #85: JSON flickers before lineup card renders (ALREADY FIXED)

**Status:** Fix already committed in `3a2c844`. Detects partial lineup JSON during streaming and shows "Building your lineup..." placeholder. Verify it works — no action needed unless broken.

## Bug #83: Dark Studio CTA button not working

**Status:** Need to verify. The `triggerColdOpen` handler in `DarkStudioView.tsx` calls `set({ coldOpenActive: true })`. The same class of spotlight overlay bug that blocked Go Live may exist here — check `ColdOpenTransition.tsx` for `pointer-events` issues on overlays.

**Files:** `src/renderer/views/DarkStudioView.tsx`, `src/renderer/views/ColdOpenTransition.tsx`

## Issue #84: Limit parallel Electron instances to max 2

**Problem:** Playwright tests and repeated `npm run dev` leave zombie Electron processes. 80+ instances making laptop slow.

**Fix:**
1. In `src/main/index.ts` or app entry point, add a singleton lock using `app.requestSingleInstanceLock()` — Electron's built-in mechanism to prevent multiple instances
2. In `playwright.config.ts`, add `globalTeardown` that kills orphaned Electron processes
3. Set `workers: 2` max in Playwright config (not 4 — reduces process count)

**Files:** `src/main/index.ts`, `playwright.config.ts`

## Testing Strategy

- E2E: pill view dimensions test should verify min bounds
- E2E: Dark Studio → Writer's Room transition test (already exists)
- Manual: zoom out/in on pill, verify it maintains minimum size
- Verify no zombie processes after E2E run completes
