---
title: "Tray Menu Bar — Audit Report"
status: current
last-verified: 2026-04-06
---
# Tray Menu Bar — Audit Report

> Audit date: 2026-03-28
> Mockup: `docs/mockups/tray-menu-bar.html`
> Implementation: `src/main/tray.ts`, `src/renderer/App.tsx` (tray sync), `src/shared/types.ts`, `src/preload/index.ts`

> **Note:** Findings #1, #3, and #4 were resolved in PR #90. This report preserves the original audit for reference.

## Summary of Findings

| # | Severity | Status | File | Description | Suggested Fix |
|---|----------|--------|------|-------------|---------------|
| 1 | **Critical** | **Fixed** | `useTraySync.ts` | Tray index derived from `currentActId` via `findIndex`. | Resolved in PR #90 — `useTraySync` hook handles this correctly. |
| 2 | **Critical** | Open | `e2e/app-launch.test.ts:51-53` | Test asserts `Show Showtime` and `Reset Show` labels exist in tray menu at app launch. `Show Showtime` only appears in `writers_room` phase (not idle). `Reset Show` does not exist in any tray menu. | Update test to assert against actual idle menu labels: `Enter Writer's Room`, `Past Shows`, `Preferences…`, `Quit Showtime`. |
| 3 | **Major** | **Fixed** | `useTraySync.ts` | Timer ticks now use lightweight `updateTrayTimer` IPC (title + icon only) — no menu rebuild per tick. Full menu rebuild only on phase/act/beat changes. | Resolved in PR #90. |
| 4 | **Major** | **Fixed** | `src/main/tray.ts` | Timer-only handler (`trayTimerHandler`) updates title/icon without rebuilding the native menu. | Resolved in PR #90. |
| 5 | **Major** | Open | `src/main/tray.ts:14-25` | `loadIcons()` does not validate that images loaded. If a PNG is missing or corrupt, `nativeImage.createFromPath()` returns an empty image silently. | Check `icon.isEmpty()` after each load; log a warning or fall back to a default if empty. |
| 6 | **Major** | Open | `src/preload/index.ts:143,189` | `updateTrayState` is defined twice in the API object. The second definition (line 189) silently overwrites the first (line 143). Harmless but indicates copy-paste drift. | Remove the duplicate at line 189. |
| 7 | **Major** | Open | `src/main/tray.ts:50-68` | Idle menu is missing keyboard accelerators. Mockup shows `⌘,` for Preferences and `⌘Q` for Quit. | Add `accelerator: 'Command+,'` on Preferences and `accelerator: 'Command+Q'` on Quit. |
| 8 | **Minor** | `src/main/tray.ts:151` | IPC listener `ipcMain.on(IPC.TRAY_STATE_UPDATE, ...)` is never cleaned up. While the tray lives for the app lifetime, best practice is to remove it in a cleanup path (e.g., `app.on('before-quit')`). | Store the handler ref and call `ipcMain.removeListener()` on tray destruction. |
| 9 | **Minor** | `src/main/tray.ts:174-182` | Writer's Room menu is minimal: only "Planning your show..." + "Show Showtime" + "Quit". No energy level, no step indicator. Mockup does not define this state, but it could be richer. | Low priority — revisit if Writer's Room tray state is designed in a future mockup. |
| 10 | **Minor** | `src/main/tray.ts:186-193` | Strike menu is minimal: "Show Complete" + "View Results" + "Quit". No verdict, no stats. | Same as above — design in a future mockup pass. |
| 11 | **Minor** | `e2e/showtime.test.ts:445-447` | Duplicate of finding #2 — same incorrect tray label assertions in a second test file. | Fix alongside finding #2. |
| 12 | **Minor** | `src/renderer/App.tsx:100` | `currentActCategory` is set to `currentAct?.sketch` — "sketch" is the task description, not the category. The `Act` type has no `category` field; the clapperboard badge in the mockup uses category (e.g., "DEEP WORK"). | Either add a `category` field to `Act` or document that `sketch` is used as a proxy. |

## Design Gap Analysis: Mockup vs Native Menu

The mockup (`tray-menu-bar.html`) envisions a rich, custom-rendered dropdown panel with custom typography, animations, progress bars, and color-coded badges. Electron's native `Menu` API provides plain text menu items only.

### What the mockup shows (impossible with native Menu)

| Mockup Element | Why Impossible |
|----------------|----------------|
| ON AIR badge with pulsing red glow animation | Native menu items are plain text — no custom rendering, no animations |
| Clapperboard badge (`DEEP WORK | ACT 3`) with category-colored border | No colored borders, no inline styled badges |
| Large monospace timer (28px JetBrains Mono) | Menu items use system font at system size |
| Progress bar with accent-to-amber gradient | No custom drawing in menu items |
| Beat stars with golden glow (`text-shadow`) | No styled Unicode — stars render in system font, no glow |
| "⚡ Almost done!" amber warning text | Partially possible (emoji + text label), but no amber color or pulse animation |
| Color-coded vertical category bars on coming-up items | No custom drawing |
| SVG icons on menu items (play button, clock, grid) | Native Menu supports `NativeImage` icons, but not inline SVGs. Could approximate with PNGs. |
| Backdrop blur, rounded corners, custom shadows on dropdown | The dropdown IS the native OS menu — no custom styling |

### What the implementation does well (good native Menu approximation)

| Feature | Implementation | Quality |
|---------|---------------|---------|
| Menu bar icon | Three PNG states (default, live, amber) as template images | Good — matches mockup intent (clapperboard icon with state variants) |
| Timer in menu bar | `tray.setTitle()` with formatted time + ⚡ prefix for amber | Good — native macOS menu bar title, visible at a glance |
| Beat progress | `★★☆ 2/3 beats` as text label | Adequate — conveys information, lacks visual polish |
| Coming Up section | Text labels: `  Name — Sketch — Nm` | Adequate — no category color coding |
| Phase-specific menus | 5 distinct builders (idle, live, intermission, writers_room, strike) | Good — covers all phases |
| ON AIR indicator | `ON AIR • ActName` as disabled label | Adequate — loses the visual impact of the badge |

### What's missing but possible with native Menu

| Missing Feature | Difficulty | Notes |
|----------------|------------|-------|
| Keyboard accelerators (`⌘,` for Prefs, `⌘Q` for Quit) | Easy | Just add `accelerator` property to menu items |
| NativeImage icons on actionable items | Medium | Render small PNGs for Enter Writer's Room, Open Expanded View, etc. |
| `BREAK` title during intermission | Already done | `tray.setTitle('BREAK')` at line 171 — good |
| Retina icon variants | Already handled | `@2x` PNGs exist in `/resources/`; Electron auto-selects |
| Preferences shortcut | Easy | `accelerator: 'Command+,'` |

### Recommendation

The current native Menu approach is the right architectural choice. A custom-rendered BrowserWindow-based dropdown (to match the mockup pixel-perfect) would introduce significant complexity: hit testing, focus management, click-away dismissal, screen edge detection, and multi-monitor support. The native Menu provides all of this for free.

The mockup should be treated as a **design aspiration** document, not a pixel-perfect implementation target. The native Menu implementation captures the information hierarchy and interaction model correctly.

## Recommended Follow-up Issues

### Critical (must fix)

1. **Fix `currentActIndex` → `currentActId` bug in tray sync** — `src/renderer/App.tsx:91`. The tray is fundamentally broken during live state. Derive index via `state.acts.findIndex(a => a.id === state.currentActId)`.

2. **Fix E2E tray label assertions** — `e2e/app-launch.test.ts:46-53` and `e2e/showtime.test.ts:445-447`. Tests assert labels (`Show Showtime`, `Reset Show`) that don't exist in the idle menu. Either fix the test to match actual labels or add the missing labels to the idle menu.

### Major (should fix)

3. **Add throttling to tray state sync** — `src/renderer/App.tsx:89`. Throttle IPC sends to 1-2s during live state to avoid 60+ menu rebuilds/minute.

4. **Add menu label diffing** — `src/main/tray.ts:201`. Skip `setContextMenu` when labels haven't changed. The `menuLabels()` helper already exists (line 129).

5. **Validate icon loading** — `src/main/tray.ts:14-25`. Check `isEmpty()` after `createFromPath()`.

6. **Remove duplicate `updateTrayState`** — `src/preload/index.ts:189`.

7. **Add keyboard accelerators** — Preferences (`⌘,`), Quit (`⌘Q`).

### Minor (nice to have)

8. **Clarify `currentActCategory` semantics** — Either add a `category` field to `Act` or rename to reflect that `sketch` is used.

9. **Clean up IPC listener on tray destruction** — `src/main/tray.ts:151`.

10. **Enrich Writer's Room and Strike tray menus** — Design mockups for these states, then implement.

11. **Add E2E tests for all tray states** — Currently only idle state labels are tested (and incorrectly). Add tests for live, amber, intermission, writers_room, and strike menu states.
