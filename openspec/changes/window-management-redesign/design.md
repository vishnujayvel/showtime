# Window Management Redesign — Design

## Context

Showtime uses a single Electron BrowserWindow configured as an NSPanel (`type: 'panel'`) with `transparent: true`, `alwaysOnTop`, and `visibleOnAllWorkspaces`. The window serves multiple view modes — from a small 320x48 pill to a 560x740 full-size planner — all rendered by React within the same window.

### Current Architecture (Broken)

The window is created at a fixed 600x740 canvas size. Because most of that canvas is transparent dead space (e.g., the pill only occupies 320x48 of a 600x740 frame), the main process calls `setIgnoreMouseEvents(true, { forward: true })` so clicks pass through to apps behind. The renderer then toggles click-through off when the cursor enters UI elements via a `mousemove` handler checking for `[data-clui-ui]` ancestors.

This approach has three fatal flaws:

1. **Drag is broken.** `setIgnoreMouseEvents(true, { forward: true })` forwards `mousemove` but NOT `mousedown`. Since `-webkit-app-region: drag` requires `mousedown` to initiate a window drag, the drag regions in title bars never fire. The window is immovable (GitHub #10).

2. **Click-through is unreliable.** The `elementFromPoint` check races with Electron's native hit-testing. Users report "stuck transparent screen" where the window captures all input in its 600x740 frame.

3. **Display positioning is fragile.** `showWindow()` always repositions to cursor-display center using fixed `CANVAS_WIDTH/HEIGHT` constants. After a setBounds call (which the current SET_VIEW_MODE handler is a no-op anyway), position drift accumulates.

### Constraints

- NSPanel behavior must be preserved — non-activating, joins all Spaces, floats above other windows.
- `transparent: true` cannot be removed. It is required for: (a) capsule pill shape with rounded corners against a transparent background, (b) vibrancy rendering through non-rectangular shapes, (c) invisible background during `setBounds()` resize transitions (no black flash).
- The preload bridge (`window.clui`) is the only communication channel between renderer and main process. No new IPC patterns are introduced.
- macOS-only. No cross-platform concerns.

---

## Goals

1. **Make the window movable.** Users must be able to drag the window via title bars in expanded views. This is the primary motivation for the redesign.
2. **Eliminate `setIgnoreMouseEvents` entirely.** Content-tight sizing means no transparent dead space, so click-through is unnecessary.
3. **Implement dynamic window sizing.** `SET_VIEW_MODE` IPC becomes a real `setBounds()` call. Three sizes: pill (320x48), expanded (560x620), full (560x740).
4. **Preserve user position across view transitions.** The window grows/shrinks from a stable anchor point, not jumping to display center.
5. **Handle BeatCheckModal in pill mode.** The 380px modal cannot render in a 320x48 window. Force-expand when beat check fires.
6. **Remove all inline `style={{ WebkitAppRegion }}` in favor of CSS classes.** Aligns with CLAUDE.md rule #1 (no inline styles).
7. **Enable native macOS window shadow.** `hasShadow: true` instead of `false`.

## Non-Goals

- **Two-window architecture.** Creating separate windows for pill and expanded modes was considered and rejected. Coordination between windows (state sync, animation handoff, z-order) adds significant complexity for no user benefit.
- **Custom IPC-based drag.** Implementing mousedown/mousemove drag tracking via IPC as a fallback is out of scope unless NSPanel + `-webkit-app-region: drag` fails empirical testing.
- **Variable-height StrikeView.** StrikeView content may only need ~680px, but we allocate the full 740px (`full` mode). The 60px waste is acceptable; content uses `max-h-[680px]` with overflow scroll.
- **PillView drag.** The pill is click-only (see Decision #5).
- **Resizable window.** `resizable: false` stays. Users resize by switching views, not by dragging edges.

---

## Decisions

### 1. Content-tight single window with three size modes

**Choice:** One BrowserWindow, three sizes via `setBounds()`.

| Mode | Width | Height | Used by |
|------|-------|--------|---------|
| `pill` | 320 | 48 | PillView (collapsed) |
| `expanded` | 560 | 620 | ExpandedView (live, intermission, director) |
| `full` | 560 | 740 | WritersRoomView, StrikeView, GoingLive, DarkStudio, Onboarding |

**Why not fixed canvas?** The fixed-canvas approach requires click-through to handle the transparent dead space. Click-through breaks drag, making the window immovable. Content-tight sizing eliminates dead space entirely.

**Why not two windows?** A pill window + expanded window would avoid `setBounds()` entirely, but introduces: window lifecycle management, state synchronization between two renderers, z-order coordination (both must be alwaysOnTop panels), animation handoff between them, and double the platform quirk surface area.

**Implementation:** The `SET_VIEW_MODE` IPC handler (currently a no-op at line 390 of `index.ts`) becomes a real handler that calls `mainWindow.setBounds()` with the appropriate size constants and computed position.

### 2. Remove `setIgnoreMouseEvents` completely

**Choice:** Delete the entire click-through mechanism — both the main-process IPC handler and the renderer's `mousemove` toggle.

**What gets removed:**
- Main process: `ipcMain.on(IPC.SET_IGNORE_MOUSE_EVENTS, ...)` handler (line 248)
- Main process: `mainWindow.setIgnoreMouseEvents(true, { forward: true })` in `ready-to-show` (line 144)
- Renderer (App.tsx): The entire `useEffect` block (lines 64-95) with `onMouseMove`/`onMouseLeave` handlers
- Preload: `setIgnoreMouseEvents` from the CluiAPI interface and implementation
- Shared types: `SET_IGNORE_MOUSE_EVENTS` IPC constant
- All `data-clui-ui` attributes from views (6 files: PillView, ExpandedView, StrikeView, WritersRoomView, DarkStudioView, OnboardingView)

**Why this is safe:** With content-tight sizing, the window bounds exactly match the rendered UI. There is no transparent dead space for clicks to "pass through" to. Every pixel of the window frame contains clickable content.

**Risk:** If a future view has transparent areas within its bounds (e.g., rounded corners of the pill capsule), those few pixels will intercept clicks. This is the same behavior as every native macOS rounded-corner window and is acceptable.

### 3. Anchor-based positioning

**Choice:** Track a `windowAnchor: { cx: number, by: number }` (center-x, bottom-y) in main process state. The window grows upward and outward from this point.

**How it works:**
- **Initial position:** Computed from the work area of the display nearest to the cursor at launch time. `cx = workArea.x + workArea.width / 2`, `by = workArea.y + workArea.height - PILL_BOTTOM_MARGIN`.
- **On `setBounds()` (view transition):** Compute new bounds from anchor. `x = cx - width/2`, `y = by - height`. Clamp to work area bounds of the display containing the window.
- **On user drag (`moved` event):** Recompute anchor from new window bounds. `cx = bounds.x + bounds.width/2`, `by = bounds.y + bounds.height`.
- **On `showWindow()` (tray click, shortcut when hidden):** If the anchor falls outside all displays (e.g., external monitor disconnected), reset to cursor-display center. Otherwise, use the stored anchor.

**Why center-bottom?** The pill sits near the bottom of the screen. When expanding, the window should grow upward (content appears above the pill's position). Center-x keeps the window centered on its last-known horizontal position. This matches Raycast and Spotlight behavior.

**Why not top-left?** Expanding from top-left means the window grows downward and rightward, which would push the bottom of an expanded view off-screen if the pill was near the bottom.

### 4. `isDragging` guard for `setBounds()`

**Choice:** Track `isDragging` state in main process. Suppress `setBounds()` calls while the user is actively dragging.

**Mechanism:**
- `will-move` event: Set `isDragging = true`. (Fires once when macOS begins a window drag.)
- `moved` event: Set `isDragging = false`. Update anchor from new bounds. Flush any deferred `setBounds()` call.
- If `setBounds()` is requested while `isDragging` is true, store the pending resize and apply it when `moved` fires.

**Why this is needed:** If a timer-driven phase change (e.g., act completion triggering BeatCheckModal) fires `SET_VIEW_MODE` while the user is mid-drag, `setBounds()` would teleport the window. The guard defers the resize until the drag completes.

**Edge case:** `will-move` fires but `moved` never fires (user starts drag but doesn't actually move). A 5-second timeout resets `isDragging` to false as a safety valve.

### 5. PillView: click-only, no drag region

**Choice:** The pill has no `-webkit-app-region: drag`. It is purely a click target that expands to the full view.

**Why:** `-webkit-app-region: drag` and `onClick` are mutually exclusive on the same element. Chromium intercepts `mousedown` for drag initiation, which prevents the click event from firing. We cannot have both on the same 48px-tall capsule.

**User workflow for repositioning:** Expand (click pill) → drag via expanded view's title bar → collapse back to pill. The pill appears at the anchor position derived from wherever the user dragged the expanded view.

**Alternative considered:** Split the pill into drag zone (left half) and click zone (right half). Rejected because a 160px-wide drag zone on a 48px-tall element is an awkward affordance with no visual indication.

### 6. Force-expand on `beatCheckPending`

**Choice:** When `beatCheckPending` becomes `true` in the showStore, automatically set `isExpanded = true` before the BeatCheckModal renders.

**Why:** BeatCheckModal uses `fixed inset-0` overlay with a centered 380px card. In pill mode (320x48), the `fixed inset-0` overlay fills a 320x48 viewport and the 380px card clips entirely. The modal is invisible and inaccessible.

**Implementation:** This is a renderer-side concern. The `useEffect` in App.tsx that calls `setViewMode()` already derives the mode from `isExpanded` and `phase`. Adding a separate `useEffect` that watches `beatCheckPending` and calls `setExpanded(true)` when it becomes true ensures the window resizes to at least 560x620 before the modal renders.

**Why not resize in main process?** The main process doesn't know about `beatCheckPending`. It only receives `SET_VIEW_MODE` calls. Keeping the expansion logic in the renderer (where the store state lives) is simpler and avoids adding new IPC for beat check state.

### 7. Display detection via window bounds

**Choice:** Use `screen.getDisplayMatching(mainWindow.getBounds())` instead of `screen.getCursorScreenPoint()` for all display-relative calculations during `setBounds()`.

**Why:** The cursor may be on a different display than the window. If the user drags the window to display 2 but then moves their cursor to display 1, a timer-triggered resize using cursor-based display detection would teleport the window to display 1. Window-bounds-based detection always resolves to the display the window is actually on.

**Exception:** `showWindow()` (after hide) still uses cursor position if the anchor is outside all displays. This handles the "undocked external monitor" case where the anchor references a display that no longer exists.

### 8. CSS drag regions replace inline styles

**Choice:** Replace all `style={{ WebkitAppRegion: 'drag' }}` with the `drag-region` CSS class, and `style={{ WebkitAppRegion: 'no-drag' }}` with the `no-drag` CSS class.

Both classes already exist in `src/renderer/index.css` (lines 257-262):
```css
.drag-region { -webkit-app-region: drag; }
.no-drag { -webkit-app-region: no-drag; }
```

**Files affected:**
- `ExpandedView.tsx` — Title bar div (line 32) → `drag-region`; Director button, collapse button, close button (lines 42, 49, 56) → `no-drag`
- `WritersRoomView.tsx` — Title bar div (line 132) → `drag-region`; quit button (line 140) → `no-drag`
- `StrikeView.tsx` — Title bar div (line 30) → `drag-region`

**New drag bars needed:**
- `DarkStudioView.tsx` — Currently has no drag region. Add an invisible `h-8 drag-region` div at the top for window repositioning.
- `OnboardingView.tsx` — Same treatment. Invisible `h-8 drag-region` at the top.

### 9. DarkStudioView spotlight gradient

**Choice:** Move the inline `style={{ background: 'radial-gradient(...)' }}` on the spotlight overlay div (DarkStudioView.tsx line 17-19) to a CSS class.

**Options considered:**
- Tailwind arbitrary value: `bg-[radial-gradient(ellipse_400px_350px_at_50%_35%,rgba(217,119,87,0.06)_0%,transparent_70%)]` — technically works but is unreadable.
- CSS class in `index.css`: `.spotlight-accent { background: radial-gradient(...); }` — clean, readable, reusable.

**Choice:** CSS class in `index.css`. Consistent with the existing `.spotlight-golden` class used by BeatCheckModal.

### 10. Window creation configuration changes

**Changes to `createWindow()`:**
- Add `hasShadow: true` (was `false`). Native macOS shadow provides depth cue and visual grounding.
- Add `titleBarStyle: 'hiddenInset'`. CLAUDE.md mandates this but it's missing from the actual code. `hiddenInset` hides the native title bar but preserves the traffic light position for `setWindowButtonPosition()`.
- Add `mainWindow.setWindowButtonPosition({ x: 12, y: 14 })` per CLAUDE.md. (Traffic lights won't be visible since `frame: false` hides them, but the position is set for correctness if frame mode changes later.)
- Remove `CANVAS_WIDTH` and `CANVAS_HEIGHT` constants. Replace with a `VIEW_SIZES` map.
- Initial window size: `full` (560x740) since the app starts in DarkStudioView (expanded).

### 11. `showWindow()` positioning rework

**Current behavior:** Always repositions to cursor-display center with fixed canvas size. User position is never preserved.

**New behavior:**
1. Check if stored anchor is within any connected display's work area.
2. If yes: compute bounds from anchor using current view mode size. Clamp to that display's work area.
3. If no (display disconnected, first launch): fall back to cursor-display center, bottom-aligned.

This means `showWindow()` from tray click or keyboard shortcut returns the window to its last-known position, not display center. Users who carefully position their pill will find it where they left it.

### 12. CLAUDE.md Section 4 update

**Change:** Remove `transparent: true` from the "mandatory" BrowserWindow settings list. It stays in the implementation but should not be a rule that constrains future changes.

**Add:** `titleBarStyle: 'hiddenInset'` to the mandatory list (it's mandated in the text but was missing from the code block).

**Rationale:** `transparent: true` is an implementation detail required by the current design (pill shape, vibrancy, no-flash resize). It should not be elevated to a project rule because it has costs (no native window shadow compositing, requires careful background management) and a future design might not need it.

---

## Risks / Trade-offs

### 1. NSPanel + `-webkit-app-region: drag` — Untested combination
**Risk:** NSPanel is `NSPanel`, a subclass of `NSWindow`, configured as non-activating (`styleMask` includes `NSWindowStyleMaskNonactivatingPanel`). `-webkit-app-region: drag` triggers `performWindowDragWithEvent:` which is inherited from `NSWindow`. This should work, but Electron's NSPanel integration has had historical quirks with event handling.

**Mitigation:** Empirical test early in implementation. If drag doesn't work on NSPanel, fall back to IPC-based drag: renderer sends `mousedown` + `mousemove` deltas via IPC, main process calls `setBounds()` to move the window. This fallback is less smooth but functional.

**Likelihood:** Low. Electron's own frameless window drag tests pass on NSPanel. The issue was `setIgnoreMouseEvents` eating `mousedown`, not NSPanel blocking it.

### 2. `setBounds()` animation gap
**Risk:** `setBounds()` is synchronous at the native layer but React re-render is async. Between the native resize and React painting the new content, the window shows its transparent background (invisible, since `backgroundColor: '#00000000'`). On slow machines, this gap could show a brief "empty window" frame.

**Mitigation:** Framer Motion's `AnimatePresence` masks the content transition. The transparent background is invisible against the desktop. In practice, the gap is sub-frame (<16ms) on Apple Silicon. On Intel Macs, a 1-2 frame gap is possible but imperceptible due to the transparent background.

### 3. Pill click target is 320x48
**Risk:** After removing the fixed 600x740 canvas, the clickable area for the pill shrinks from 600x740 (with click-through heuristics) to exactly 320x48. This is the actual pill size, which is intentional, but if users were accidentally relying on clicking near the pill (in the transparent zone), they'll need to click more precisely.

**Mitigation:** 320x48 is a generous click target (larger than most macOS menu bar items). This is the correct behavior — only the visible UI should be clickable.

### 4. Deferred resize race with rapid phase changes
**Risk:** If the user is dragging and two phase transitions happen in quick succession (e.g., act completes + beat check fires), only the last deferred resize is kept. Earlier intermediate sizes are dropped.

**Mitigation:** This is correct behavior. The window should match the final state, not replay intermediate states. The deferred resize stores only the latest pending mode, not a queue.

### 5. `will-move` / `moved` event reliability
**Risk:** These events are macOS-specific Electron additions. `will-move` fires before the drag begins, `moved` fires after it ends. If Electron changes this behavior across versions, the isDragging guard could break.

**Mitigation:** Pin Electron version. The 5-second timeout safety valve ensures `isDragging` doesn't get stuck permanently even if `moved` never fires.

### 6. StrikeView close button omission
**Risk:** StrikeView's title bar currently has no close/collapse button. After removing click-through, the only way to collapse from StrikeView is the keyboard shortcut (Alt+Space). If the user doesn't know the shortcut, they're stuck.

**Mitigation:** Add a close/collapse button to StrikeView's title bar during this change, matching ExpandedView's pattern. This is a minimal addition (one button element) and falls within scope since we're already touching StrikeView to replace inline styles.
