# Showtime Final Polish — Dynamic Window Sizing, Onboarding, Claude E2E Verification

## Why

Showtime v2.2 resolved 14 issues but 4 remain open. These span three categories: (1) the native window is a fixed 1040x720 transparent box that creates a floating-card-in-a-box effect instead of dynamically fitting each view, (2) E2E tests pass the UI flow but never verify that Claude actually generates a real lineup, and (3) there is no first-time onboarding experience to introduce new users to the SNL Day Framework concepts. These are the final gaps between "it works" and "it feels right."

GitHub issues: #10, #6, #13, #15 at https://github.com/vishnujayvel/showtime/issues

Note: #6 and #13 are the same issue (Claude E2E verification) filed from different angles.

## What Changes

### Window Sizing (#10)

The native BrowserWindow is fixed at 1040x720 (`BAR_WIDTH`/`PILL_HEIGHT` in `main/index.ts` lines 33-34). The UI panel is 560px wide. This creates a floating-card-in-a-box effect where views render at varying CSS sizes inside an invisible oversized frame. The transparent click-through system handles the dead zone functionally, but the approach prevents proper window shadow, accessibility tool detection, and macOS window snapping.

**Fix:** Dynamically resize the native window via IPC `setBounds()` when views change. The renderer sends `setViewMode('pill'|'expanded'|'full')` which triggers the main process to call `mainWindow.setBounds()` with view-specific dimensions. The existing `SET_VIEW_MODE` IPC handler (line 384 of `main/index.ts`) is already wired but currently no-ops — it needs to perform real resizing.

Dimension map per view:
- **Pill:** 340x60 (320x48 pill + 10px padding each side + 6px vertical padding)
- **Expanded/Live:** 580x640 (560px panel + 10px padding each side)
- **WritersRoom:** 580x700 (560x680 panel + 10px padding each side)
- **StrikeView:** 580x700 (560px panel + variable height, capped)
- **DarkStudio:** 580x400 (560px panel + 10px padding each side)

### Claude E2E Verification (#6, #13)

E2E tests pass the UI flow but never verify Claude generates a real lineup. The test clicks "Build my lineup" and checks that loading appears, but does not wait for a Claude response or validate that Act cards render with names, durations, and categories. This is the same issue filed as both #6 and #13.

**Fix:** Add a conditional E2E test that submits a plan via the Writer's Room and waits for Claude response with a 30-second timeout. If Claude responds, verify Act cards appear with names, durations, and category badges. If Claude is unavailable (CI, offline), verify the error/retry UI appears. The test passes in both scenarios.

### Onboarding Tutorial (#15)

New users launch Showtime and land on the Dark Studio with no context about what Shows, Acts, Beats, or the Writer's Room mean. The product context document (section 9) envisions that opening Showtime creates "a moment of possibility" — but that moment requires understanding the metaphor.

**Fix:** An `OnboardingView` that shows on first launch (no `showtime-onboarding-complete` in localStorage). The view walks through 4-5 interactive steps explaining the SNL Day Framework concepts using the existing animation system (spotlight, ON AIR, beat ignite). Ends with "Ready for your first show?" which enters the Writer's Room. Sets `showtime-onboarding-complete: true` after completion. Accessible later via a Help button in the title bar area.

## Capabilities

### New Capabilities
- **onboarding** — OnboardingView component with 5-step interactive tutorial, localStorage persistence, Help button re-entry

### Modified Capabilities
- **window-management** — Dynamic `setBounds()` per view mode, replacing the fixed 1040x720 frame
- **testing** — Conditional Claude E2E verification with timeout handling

## Impact

- **Code:** ~10 files modified/created (main/index.ts, preload/index.ts, App.tsx, OnboardingView.tsx [new], e2e/showtime.test.ts, showStore.ts, shared/types.ts, index.css)
- **Dependencies:** No new dependencies
- **Build:** Remains passing — all changes are incremental
- **Tests:** New E2E tests for Claude verification and onboarding flow; existing 128+ unit tests must continue passing

## Context Documents

- Product context: `docs/plans/product-context.md` (section 9 — onboarding vision)
- Design system: `docs/plans/design-system.md`
- UI mockup: `docs/mockups/direction-4-the-show.html`
- CLAUDE.md: mandatory rules (no inline styles, shadcn/ui, Tailwind, Playwright, spring physics)
- Previous changes: `openspec/changes/showtime-v2-bugfix/`, `openspec/changes/showtime-v22-all-fixes/`
- Current window management: `src/main/index.ts` lines 33-34 (BAR_WIDTH/PILL_HEIGHT), lines 384-399 (SET_VIEW_MODE handler)
- Current view routing: `src/renderer/App.tsx` (renderView function, phase-based routing)
