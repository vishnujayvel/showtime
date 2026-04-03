# Window Management Redesign

## Why

The Showtime window is not movable, shows a stuck transparent screen, and has inconsistent bounds across displays (GitHub #10). The root cause is `setIgnoreMouseEvents(true, { forward: true })` combined with a fixed 600x740 transparent canvas — forward-only events deliver `mousemove` but NOT `mousedown`, so `-webkit-app-region: drag` cannot work. Content-tight window sizing eliminates the need for click-through entirely.

## What Changes

- **BREAKING**: Remove the `setIgnoreMouseEvents` click-through toggle mechanism (main process + renderer). The renderer's mousemove handler that toggles click-through based on `[data-clui-ui]` element detection is deleted entirely.
- **BREAKING**: Remove fixed-canvas constants (`CANVAS_WIDTH=600`, `CANVAS_HEIGHT=740`). Replace with dynamic sizing: window resizes to match view content exactly (pill=320x48, expanded=560x620, full=560x740).
- Keep `transparent: true` (required for capsule pill shape, vibrancy through rounded corners, and no-flash resize). Remove my earlier proposal to drop transparency — the critic review identified this would break vibrancy and cause black resize flash.
- Add anchor-based position tracking (center-bottom point preserved across view transitions and user drags).
- Replace all inline `style={{ WebkitAppRegion: 'drag' }}` with CSS `.drag-region` / `.no-drag` classes.
- Remove `data-clui-ui` attribute from all views (no longer needed without click-through toggle).
- Change `hasShadow: false` to `hasShadow: true` for native macOS window shadow.
- Implement real `SET_VIEW_MODE` IPC handler (currently a no-op) that calls `setBounds()`.
- Add `isDragging` guard to prevent `setBounds()` during active user drag.
- Force-expand when `beatCheckPending` becomes true (BeatCheckModal needs 560x620 minimum, can't render in 320x48 pill).
- Use `screen.getDisplayMatching(bounds)` instead of cursor position for display detection in clamping logic.
- Update CLAUDE.md Section 4 to remove `transparent: true` from mandatory list (it stays but as implementation detail, not a rule — the rule is "vibrancy + frameless + native feel").
- Add `titleBarStyle: 'hiddenInset'` and `setWindowButtonPosition` to match CLAUDE.md.

## Capabilities

### Modified Capabilities
- `window-management` — Window creation, sizing, positioning, drag behavior, and IPC handlers in main process + renderer click-through handler removal + view drag region updates.

## Risks

1. **NSPanel + `-webkit-app-region: drag`** — Needs empirical verification. NSPanel is non-activating; drag uses `performWindowDragWithEvent:` inherited from NSWindow. Should work but has no test coverage. Fallback: custom IPC-based drag with mousedown tracking.
2. **PillView drag/click conflict** — `-webkit-app-region: drag` and `onClick` are mutually exclusive on the same element (Chromium intercepts mousedown for drag). Decision: PillView is click-only (no drag-region). Users reposition via expanded view title bar, then collapse back to pill.
3. **Resize timing** — `setBounds()` is synchronous but React re-render is async. `transparent: true` + `backgroundColor: '#00000000'` means transparent background during the gap, which is invisible. Framer Motion transitions mask the content change.
4. **StrikeView variable height** — Design uses 560x740 for all `full` views, but StrikeView content may only need 680px. Accept 60px waste; content has `max-h-[680px]` with overflow scroll.
