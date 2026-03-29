# Tray Menu Bar Audit Report

## Summary

Audit of the dynamic tray implementation (#88) against the mockup at `docs/mockups/tray-menu-bar.html`. Produced by code-reviewer agent on 2026-03-28.

## Design Audit: Mockup vs Implementation

The mockup envisions a **rich custom dropdown** with styled text, progress bars, colored badges, and icons. The implementation uses **Electron's native `Menu`** which only supports plain-text labels. This is a valid tradeoff (reliability + macOS consistency) but was undocumented.

### State-by-State Comparison

| State | Element | Mockup | Implementation | Gap? |
|-------|---------|--------|---------------|------|
| Idle | Menu items | Full set with icons + shortcuts | Plain text labels | Minor — add accelerators |
| Live | ON AIR badge | Red pulsing box | Plain text "ON AIR • {name}" | Expected (native Menu limit) |
| Live | Timer | 28px styled countdown | `tray.setTitle()` text | OK |
| Live | Progress bar | Visual gradient | Not present | Expected (native Menu limit) |
| Live | Beat stars | Gold/gray visual stars | Text "★★☆ 2/3 beats" | OK |
| Live | Coming Up | Colored cards with category bars | Plain text "name — sketch — 30m" | Expected (native Menu limit) |
| Live | Act category badge | "DEEP WORK \| ACT 3" in purple | Not rendered | Gap — `currentActCategory` sent but unused |
| Amber | Timer color | Amber with glow | `⚡` prefix in setTitle | OK approximation |
| Amber | Icon | Red dot (same as live) | Amber dot (deviation) | Minor |
| Intermission | All items | Present | Present | OK |

### Architectural Decision: Native Menu vs Custom Rendering

**Chosen:** Native `Menu.buildFromTemplate()` — reliable, accessible, matches macOS conventions.
**Alternative:** Custom `BrowserWindow` anchored to tray — would support rich rendering but adds complexity, might not feel native.
**Recommendation:** Document this decision in `tray.ts` header. Consider custom rendering as Phase 2.

## Implementation Audit

### Issues Found

| # | Severity | File | Issue | Fix |
|---|----------|------|-------|-----|
| H1 | High | tray.ts | No icon load validation — `createFromPath` returns empty image silently if PNG missing | Add `.isEmpty()` checks after loading |
| H2 | High | useTraySync.ts | Menu rebuilt every 1s during live — only `setTitle()` changes per second, menu items change on phase/act/beat transitions | Separate timer-only updates from full menu rebuilds |
| H3 | High | tray.ts | Mockup vs implementation gap undocumented | Add architectural decision comment |
| M1 | Medium | types.ts | `currentActCategory` sent but never used in menu builders | Use it in live label or remove from type |
| M2 | Medium | tray.ts | `director` phase has no explicit case — falls through to idle menu ("No show running") which is misleading | Add explicit case mirroring live |
| M3 | Medium | tray.ts | No keyboard shortcut accelerators (Cmd+Q, Cmd+,) | Add `accelerator` props |
| M4 | Medium | useTraySync.ts | Store subscription may not restart timer on component remount during live | Low risk in production |
| M5 | Medium | E2E tests | Only idle state tray labels tested — no live/intermission/amber | Add test cases |
| L1 | Low | tray.ts | `ipcMain.on` listener never cleaned up | Return cleanup function |
| L2 | Low | tray.ts | `__trayMenuLabels` global write not guarded by NODE_ENV | Guard with test check |
| L3 | Low | tray.ts | `__dirname` path resolution may differ in packaged ASAR app | Use `app.getAppPath()` |
| L4 | Low | useTraySync.ts | Double `sendTrayState` possible when timer interval + store change fire simultaneously | Add timestamp guard |

### What Was Done Well

1. Clean 4-layer separation (types → preload → hook → tray)
2. Icon state tracking avoids redundant `setImage` swaps
3. GC prevention with `void tray` pattern
4. Defensive null checks throughout
5. Timer lifecycle with proper cleanup on unmount
6. @2x Retina icon variants for all states

## Recommended Follow-up

1. Fix H1-H3 and M1-M2 (targeted code changes)
2. Add E2E tests for live/intermission tray states (M5)
3. Document native Menu architectural decision
4. Consider Phase 2: custom BrowserWindow dropdown for rich rendering
