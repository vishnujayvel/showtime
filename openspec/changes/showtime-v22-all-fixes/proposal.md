# Showtime v2.2 — All Fixes (14 Issues)

## Why

Showtime v2.1 bugfix addressed 9 issues (#1-#9) at the design level but implementation gaps remain, and 5 new issues surfaced during continued testing (#10-#14). The core problems fall into three categories: (1) critical UX issues that break the core flow (window sizing inconsistency, missing loading indicator during Claude processing, Beat celebration race condition), (2) verification gaps where fixes exist in code but have never been visually confirmed with Playwright MCP screenshots, and (3) test infrastructure that needs Playwright MCP integration for reliable visual validation.

GitHub issues: #1-#14 at https://github.com/vishnujayvel/showtime/issues

## What Changes

### Wave 1: Critical UX (Parallel)

- **Window sizing inconsistency (#10)** — The native window is fixed at 1040x720 (`BAR_WIDTH`/`PILL_HEIGHT` in main/index.ts line 33-34) with `resizable: false`. Views render at different CSS sizes (Pill: 320x48, Writer's Room: 560x680, Expanded: 560x620, Strike: 560xvariable). This works because the window is transparent and click-through handles the invisible area. However, views that exceed the fixed frame height get clipped, and transitions between drastically different sizes (Pill 48px tall vs Expanded 620px) create awkward transparent dead zones. Fix: either implement dynamic `setBounds()` via IPC to resize the native window per view, or ensure all views fit comfortably within the 1040x720 frame using proper CSS layout with vertical centering.

- **Loading indicator during Claude processing (#14)** — When the user clicks "Build my lineup" in Writer's Room, the button text changes to "Planning..." but there is no theatrical loading animation. For an ADHD user, a text-only spinner feels broken after 3 seconds. Add a "The writers are working..." animation with a spotlight sweep, consistent with the show metaphor.

- **Beat celebration race condition (#11)** — `lockBeat()` uses a bare `setTimeout(() => { ... }, 1800)` to delay advancement after celebration. If the user triggers lockBeat multiple times quickly (double-click), or if the component unmounts and remounts (e.g., Zustand rehydration from localStorage), the timeout fires into stale state. The setTimeout has no cleanup and no guard against re-entry. Fix: add a `celebrationTimeoutId` ref or store field, clear on re-entry, and guard the callback against stale state.

### Wave 2: Test Infrastructure (Sequential)

- **Playwright MCP visual validation (#12)** — Current E2E tests use `page.screenshot()` for manual inspection but never assert visual properties. Integrate Playwright MCP (`browser_snapshot`, `browser_take_screenshot`) for automated visual validation of every view transition.

- **E2E tests do not verify Claude lineup generation (#6, #13)** — Tests click "Show me the lineup" (wrong button text — actual is "Build my lineup"), never verify Claude subprocess produces valid Acts. When Claude is available, the test should wait for lineup and verify act cards appear. When unavailable, it should verify the error/retry UI.

### Wave 3: Visual Verification (Parallel)

Each of the original 9 issues needs Playwright MCP screenshot verification:

- **#1: Claude integration in WritersRoom** — Verify `sendMessage()` is called, Claude responds, lineup parses and renders Act cards.
- **#2: Beat Check celebration** — Verify the 1800ms "That moment was real" text is visible, beat-ignite animation plays, modal stays open during celebration.
- **#3: Close/quit** — Verify tray context menu has "Quit Showtime", Cmd+Q triggers `app.quit()`, traffic light hides window.
- **#4: macOS vibrancy** — Verify `vibrancy: 'under-window'` is in BrowserWindow config (already present at line 113).
- **#5: PermissionCard Tailwind migration** — Verify no `style={{}}` objects remain in PermissionCard.tsx (already migrated — file uses only Tailwind classes).
- **#7: GoingLive ON AIR animation** — Verify `onair-glow` class is applied to ON AIR indicator during transition (already present at line 30 of GoingLiveTransition.tsx).
- **#8: Spotlight gradient CSS class** — Verify no inline gradient styles in WritersRoomView (already migrated to `spotlight-warm` CSS class at line 131).
- **#9: Playwright process cleanup** — Verify `afterAll` kills process tree (already implemented at lines 43-52 of e2e/showtime.test.ts).

### Wave 4: Polish (Parallel)

Fix any issues discovered during Wave 3 screenshot verification.

## Issue Status Assessment

After reading the current codebase, several issues appear already resolved:

| Issue | Status | Evidence |
|-------|--------|----------|
| #1 Claude integration | DONE | WritersRoomView.tsx uses `sendMessage()`, `tryParseLineup()`, full error/timeout handling |
| #2 Beat celebration | DONE (race risk) | `lockBeat()` sets `celebrationActive: true`, 1800ms setTimeout, BeatCheckModal renders celebration |
| #3 Close/quit | DONE | Tray with "Quit Showtime" at line 1076, `before-quit` handler at line 149 |
| #4 macOS vibrancy | DONE | `vibrancy: 'under-window'` at line 113 of main/index.ts |
| #5 PermissionCard | DONE | Zero inline styles, all Tailwind classes, `getButtonClasses()` helper |
| #6 E2E Claude verification | PARTIAL | Tests exist but button text mismatch ("Show me the lineup" vs "Build my lineup") |
| #7 GoingLive ON AIR | DONE | `onair-glow` class at line 30 of GoingLiveTransition.tsx |
| #8 Spotlight CSS | DONE | `spotlight-warm` class used at line 131 of WritersRoomView.tsx |
| #9 Process cleanup | DONE | `afterAll` kills PID at lines 43-52 of showtime.test.ts |
| #10 Window sizing | OPEN | Fixed 1040x720 frame, no dynamic resizing, potential clipping |
| #11 Beat race condition | OPEN | No timeout cleanup, no re-entry guard in `lockBeat()` |
| #12 Playwright MCP | OPEN | No MCP integration in E2E tests |
| #13 Claude lineup E2E | OPEN | Same as #6 — tests do not verify Claude produces valid lineup |
| #14 Loading indicator | OPEN | Only "Planning..." button text, no theatrical animation |

## Capabilities

### New Capabilities
- **testing** — Playwright MCP visual validation framework for all views

### Modified Capabilities
- **window-management** — Dynamic sizing or CSS layout fix for view transitions
- **show-lifecycle** — Beat celebration race condition fix, theatrical loading indicator

## Impact

- **Code:** ~8-10 files modified (showStore.ts, WritersRoomView.tsx, main/index.ts, e2e/showtime.test.ts, new test files)
- **Dependencies:** None new (Playwright MCP is test-only)
- **Build:** Remains passing — all changes are incremental
- **Tests:** New Vitest unit tests, component tests, and expanded E2E coverage via Playwright MCP

## Context Documents

- Product context: `docs/plans/product-context.md`
- Design system: `docs/plans/design-system.md`
- UI mockup: `docs/mockups/direction-4-the-show.html`
- CLAUDE.md: mandatory rules (no inline styles, shadcn/ui, Tailwind, Playwright)
- Previous change: `openspec/changes/showtime-v2-bugfix/`
