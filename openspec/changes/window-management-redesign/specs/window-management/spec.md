# Window Management — Delta Spec

**Change:** window-management-redesign
**Capability:** window-management
**Status:** draft

---

## MODIFIED Requirements

### Requirement: Content-Tight Window Sizing

The main process SHALL dynamically resize the BrowserWindow to match the active view's content dimensions exactly. The fixed-canvas constants (`CANVAS_WIDTH = 600`, `CANVAS_HEIGHT = 740`) SHALL be removed and replaced with a view-mode-to-dimensions mapping.

The `SET_VIEW_MODE` IPC handler SHALL call `win.setBounds()` with the following dimensions:

| Mode | Width | Height | Used By |
|------|-------|--------|---------|
| `pill` | 320 | 48 | PillView |
| `expanded` | 560 | 620 | ExpandedView, IntermissionView, DirectorMode, OnboardingView |
| `full` | 560 | 740 | WritersRoomView, StrikeView, DarkStudioView, GoingLiveTransition |

The `SET_VIEW_MODE` handler MUST NOT be a no-op. It SHALL compute the new bounds, apply anchor-based positioning (see Requirement: Anchor-Based Position Tracking), and call `setBounds()`.

#### Scenario: Renderer sends pill mode on collapse

- **WHEN** the renderer calls `window.clui.setViewMode('pill')`
- **THEN** the main process SHALL call `setBounds()` with width=320, height=48, preserving the anchor point

#### Scenario: Renderer sends expanded mode on expand during live phase

- **WHEN** the renderer calls `window.clui.setViewMode('expanded')` during `phase=live`
- **THEN** the main process SHALL call `setBounds()` with width=560, height=620, preserving the anchor point

#### Scenario: Renderer sends full mode for writers room

- **WHEN** the renderer calls `window.clui.setViewMode('full')` during `phase=writers_room`
- **THEN** the main process SHALL call `setBounds()` with width=560, height=740, preserving the anchor point

#### Scenario: Window creation uses pill dimensions by default

- **WHEN** the app first creates the BrowserWindow
- **THEN** the initial dimensions SHALL NOT use fixed-canvas constants
- **THEN** the initial dimensions SHALL be the `full` mode size (560x740) since the app starts in DarkStudioView (expanded=true, phase=no_show)

---

### Requirement: Transparent Window Preservation

The BrowserWindow SHALL retain `transparent: true` and `backgroundColor: '#00000000'`. These properties are required for:

1. Capsule pill shape (320x48 rounded-full with transparent corners)
2. Vibrancy effect through rounded corners on macOS
3. No black flash during `setBounds()` resize (transparent background is invisible during the React re-render gap)

The `transparent` property SHALL remain in the BrowserWindow constructor. It is NOT listed as a mandatory rule in CLAUDE.md but SHALL be retained as an implementation detail.

#### Scenario: Pill view has transparent corners

- **WHEN** the window is in pill mode (320x48)
- **THEN** the rounded-full corners of the PillView SHALL show through to the desktop, not black rectangles

#### Scenario: No flash on resize

- **WHEN** the window transitions from pill (320x48) to expanded (560x620)
- **THEN** the transparent background SHALL prevent any visible flash or black rectangle during the resize

---

### Requirement: Remove Click-Through Toggle Mechanism

The `setIgnoreMouseEvents` click-through toggle mechanism SHALL be removed entirely from both the main process and the renderer.

**Main process removals:**
- The `mainWindow.setIgnoreMouseEvents(true, { forward: true })` call in the `ready-to-show` handler SHALL be deleted.
- The `IPC.SET_IGNORE_MOUSE_EVENTS` IPC handler SHALL be deleted.

**Renderer removals:**
- The `useEffect` block in `App.tsx` that adds `mousemove` and `mouseleave` event listeners to toggle click-through based on `[data-clui-ui]` element detection SHALL be deleted entirely (lines 63-95 of current `App.tsx`).

**Preload removals:**
- The `setIgnoreMouseEvents` method SHALL be removed from the `window.clui` API definition and the contextBridge implementation.

**Rationale:** Content-tight window sizing means every pixel of the window contains interactive content. There is no transparent dead zone that needs click-through.

#### Scenario: Mouse events reach all UI elements without toggle

- **WHEN** the user moves the cursor over any part of the Showtime window
- **THEN** mouse events (click, hover, drag) SHALL be received by the renderer without any `setIgnoreMouseEvents` toggling

#### Scenario: No mousemove handler on document

- **WHEN** the App component mounts
- **THEN** no `mousemove` or `mouseleave` event listeners SHALL be registered on `document` for click-through purposes

---

### Requirement: Native Drag via CSS Classes

All draggable regions SHALL use CSS classes instead of inline `style={{ WebkitAppRegion: 'drag' }}` objects. A `.drag-region` class and a `.no-drag` class SHALL be defined in the global CSS (e.g., `src/renderer/assets/main.css`).

```css
.drag-region {
  -webkit-app-region: drag;
}
.no-drag {
  -webkit-app-region: no-drag;
}
```

Every view that currently uses `style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}` SHALL replace it with `className="... drag-region"`. Every element that currently uses `style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}` SHALL replace it with `className="... no-drag"`.

**Affected files:**
- `src/renderer/views/ExpandedView.tsx` — title bar div (drag), Director button (no-drag), collapse button (no-drag), close button (no-drag)
- `src/renderer/views/WritersRoomView.tsx` — title bar div (drag), close button (no-drag)
- `src/renderer/views/StrikeView.tsx` — title bar div (drag)

#### Scenario: ExpandedView title bar is draggable via CSS class

- **WHEN** the ExpandedView renders its title bar
- **THEN** the title bar div SHALL have the `drag-region` class
- **THEN** the title bar div SHALL NOT have any inline `style` prop for WebkitAppRegion

#### Scenario: Interactive buttons within drag region use no-drag class

- **WHEN** a button (Director, collapse, close) renders inside a drag-region title bar
- **THEN** the button SHALL have the `no-drag` class
- **THEN** the button SHALL NOT have any inline `style` prop for WebkitAppRegion

#### Scenario: PillView has no drag region

- **WHEN** the PillView renders
- **THEN** no element within PillView SHALL have the `drag-region` class or `-webkit-app-region: drag`
- **THEN** the entire PillView SHALL remain click-only (clicking expands to ExpandedView)

---

### Requirement: Remove data-clui-ui Attribute

The `data-clui-ui` attribute SHALL be removed from all views. This attribute was used exclusively by the click-through toggle mechanism to identify interactive UI regions. Since the click-through mechanism is being removed, this attribute has no remaining purpose.

**Affected files:**
- `src/renderer/views/DarkStudioView.tsx` (line 10)
- `src/renderer/views/StrikeView.tsx` (line 22)
- `src/renderer/views/PillView.tsx` (line 73)
- `src/renderer/views/ExpandedView.tsx` (line 23)
- `src/renderer/views/WritersRoomView.tsx` (line 127)
- `src/renderer/views/OnboardingView.tsx` (line 64)

#### Scenario: No view renders data-clui-ui

- **WHEN** any Showtime view renders (DarkStudioView, StrikeView, PillView, ExpandedView, WritersRoomView, OnboardingView)
- **THEN** no DOM element SHALL have a `data-clui-ui` attribute

---

### Requirement: Anchor-Based Position Tracking

The main process SHALL track the window's anchor point as the center-bottom coordinate of the current bounds. When `setBounds()` is called for a view mode transition, the new bounds SHALL be computed so that the center-bottom point remains at the same screen position.

```
anchor.x = bounds.x + bounds.width / 2
anchor.y = bounds.y + bounds.height
```

When applying new dimensions `(newWidth, newHeight)`:
```
newBounds.x = anchor.x - newWidth / 2
newBounds.y = anchor.y - newHeight
newBounds.width = newWidth
newBounds.height = newHeight
```

The anchor point SHALL be updated whenever:
1. The user drags the window (read from `win.getBounds()` after drag ends)
2. A `setBounds()` call completes (computed from the new bounds)

On initial window creation, the anchor point SHALL be computed from the initial position (horizontally centered, bottom-aligned to work area with `PILL_BOTTOM_MARGIN`).

#### Scenario: Pill-to-expanded preserves bottom-center

- **WHEN** the pill is at screen position where its center-bottom is at (800, 1050)
- **THEN** after expanding to 560x620, the new bounds SHALL place the center-bottom at (800, 1050)
- **THEN** the new x SHALL be 800 - 280 = 520, the new y SHALL be 1050 - 620 = 430

#### Scenario: Expanded-to-pill preserves bottom-center

- **WHEN** the expanded view's center-bottom is at (800, 1050)
- **THEN** after collapsing to pill (320x48), the new bounds SHALL place the center-bottom at (800, 1050)
- **THEN** the new x SHALL be 800 - 160 = 640, the new y SHALL be 1050 - 48 = 1002

#### Scenario: Anchor updates after user drag

- **WHEN** the user drags the window to a new position
- **THEN** the stored anchor point SHALL update to the center-bottom of the new position
- **THEN** subsequent view mode transitions SHALL use the updated anchor

---

### Requirement: Display Detection via Bounds Matching

Display detection for clamping logic SHALL use `screen.getDisplayMatching(win.getBounds())` instead of `screen.getDisplayNearestPoint(screen.getCursorScreenPoint())`.

**Rationale:** The cursor may be on a different display than the window, especially after the user drags the window to one display and then moves the cursor elsewhere. The window's own bounds are the authoritative source for which display it occupies.

#### Scenario: Window on secondary display with cursor on primary

- **WHEN** the user has dragged the window to a secondary display
- **THEN** the cursor position SHALL NOT be used for display detection
- **THEN** `screen.getDisplayMatching(win.getBounds())` SHALL determine the correct display for clamping

#### Scenario: Clamping prevents window from going off-screen

- **WHEN** anchor-based positioning would place the window partially off-screen
- **THEN** the bounds SHALL be clamped to the display's `workArea` so the entire window remains visible

---

### Requirement: isDragging Guard

The main process SHALL track whether the user is actively dragging the window. While `isDragging` is true, no `setBounds()` call SHALL be made.

The drag state SHALL be detected using the BrowserWindow `will-move` and `moved` events (macOS):
- `will-move` sets `isDragging = true`
- `moved` sets `isDragging = false` and updates the stored anchor point from the new bounds

If a `setViewMode` IPC message arrives while `isDragging` is true, the resize SHALL be deferred until the `moved` event fires.

#### Scenario: setViewMode during drag is deferred

- **WHEN** the user is actively dragging the window AND a `setViewMode('pill')` IPC message arrives
- **THEN** the `setBounds()` call SHALL NOT execute immediately
- **THEN** after the drag ends (the `moved` event fires), the deferred `setBounds()` SHALL execute with the correct anchor from the new drag position

#### Scenario: Normal setViewMode without drag executes immediately

- **WHEN** the user is NOT dragging the window AND a `setViewMode('expanded')` IPC message arrives
- **THEN** the `setBounds()` call SHALL execute immediately

---

### Requirement: Force-Expand on Beat Check

When `beatCheckPending` becomes true in the renderer, the App component SHALL ensure the window is in expanded mode (minimum 560x620) so that the BeatCheckModal can render properly.

If the window is currently in pill mode when a beat check triggers, the renderer SHALL call `window.clui.setViewMode('expanded')` and set `isExpanded = true` in the showStore before the BeatCheckModal attempts to render.

#### Scenario: Beat check triggers while in pill view

- **WHEN** `beatCheckPending` transitions from false to true AND `isExpanded` is false
- **THEN** the renderer SHALL set `isExpanded = true` in the showStore
- **THEN** the renderer SHALL call `window.clui.setViewMode('expanded')`
- **THEN** the BeatCheckModal SHALL render in the 560x620 window

#### Scenario: Beat check triggers while already expanded

- **WHEN** `beatCheckPending` transitions from false to true AND `isExpanded` is true
- **THEN** no view mode change is needed
- **THEN** the BeatCheckModal SHALL render normally as an overlay

---

### Requirement: Native macOS Shadow

The BrowserWindow SHALL be created with `hasShadow: true` instead of `hasShadow: false`. This provides the native macOS window shadow that gives the floating window visual grounding against the desktop.

#### Scenario: Window has native shadow

- **WHEN** the BrowserWindow is created
- **THEN** the `hasShadow` option SHALL be `true`

---

### Requirement: Window Creation Settings

The BrowserWindow constructor SHALL include the following settings for macOS native feel:

- `frame: false`
- `transparent: true`
- `vibrancy: 'under-window'` (macOS only)
- `visualEffectState: 'active'` (macOS only)
- `backgroundColor: '#00000000'`
- `resizable: false`
- `movable: true`
- `alwaysOnTop: true`
- `hasShadow: true`
- `roundedCorners: true`
- `type: 'panel'` (macOS only, for NSPanel non-activating behavior)
- `titleBarStyle: 'hiddenInset'`

After creation, `win.setWindowButtonPosition({ x: 12, y: 14 })` SHALL be called.

The `setIgnoreMouseEvents(true, { forward: true })` call in the `ready-to-show` handler SHALL be removed.

#### Scenario: Window creation on macOS

- **WHEN** `createWindow()` executes on macOS
- **THEN** the BrowserWindow SHALL have all the listed settings
- **THEN** `setWindowButtonPosition` SHALL be called with `{ x: 12, y: 14 }`
- **THEN** no `setIgnoreMouseEvents` call SHALL occur in `ready-to-show`

---

### Requirement: showWindow Positioning Update

The `showWindow()` function SHALL use the stored anchor point (if one exists from a previous drag or view transition) instead of always re-centering the window on the cursor's display. If no anchor exists (first show after app launch), it SHALL compute the initial position using the cursor's display, centered horizontally with the bottom edge at `workArea.y + workArea.height - PILL_BOTTOM_MARGIN`.

The `showWindow()` function SHALL use `screen.getDisplayMatching(win.getBounds())` for display detection when the window already has a stored anchor point.

#### Scenario: First show after launch centers on cursor display

- **WHEN** `showWindow()` is called for the first time (no stored anchor)
- **THEN** the window SHALL be positioned on the display nearest the cursor, horizontally centered, bottom-aligned with margin

#### Scenario: Subsequent show preserves last anchor

- **WHEN** `showWindow()` is called after the user previously dragged the window
- **THEN** the window SHALL appear at the stored anchor position, not re-centered on the cursor's display

---

### Requirement: Update CLAUDE.md Section 4

CLAUDE.md Section 4 ("macOS Native Feel") SHALL be updated to:

1. Remove `transparent: true` from the "mandatory" settings code block. Transparency is an implementation detail retained for vibrancy and pill shape, not a rule for contributors.
2. Add `hasShadow: true` to the code block.
3. Add a note that drag regions SHALL use CSS classes (`.drag-region`, `.no-drag`), not inline styles.
4. Add a note that `setIgnoreMouseEvents` SHALL NOT be used.

#### Scenario: CLAUDE.md reflects new window management rules

- **WHEN** a contributor reads CLAUDE.md Section 4
- **THEN** the mandatory BrowserWindow settings SHALL include `hasShadow: true`
- **THEN** the mandatory BrowserWindow settings SHALL NOT list `transparent: true` (it is still used but not a rule)
- **THEN** the drag region guidance SHALL reference `.drag-region` / `.no-drag` CSS classes
- **THEN** there SHALL be a note prohibiting `setIgnoreMouseEvents`

---

## REMOVED Requirements

### Requirement: Fixed Canvas Sizing

The fixed-canvas approach (`CANVAS_WIDTH = 600`, `CANVAS_HEIGHT = 740`) is removed. The comment block explaining the rationale for fixed-canvas ("Dynamic setBounds() causes: click-through math errors, movability loss, display-scaling drift") no longer applies because click-through is being removed entirely.

**Removed constants:**
- `const CANVAS_WIDTH = 600`
- `const CANVAS_HEIGHT = 740`

**Removed usages:**
- `createWindow()` — initial `width`/`height` SHALL use the computed initial view mode dimensions
- `showWindow()` — SHALL NOT reference `CANVAS_WIDTH` or `CANVAS_HEIGHT`

#### Scenario: No reference to CANVAS_WIDTH or CANVAS_HEIGHT in codebase

- **WHEN** the change is complete
- **THEN** a search for `CANVAS_WIDTH` or `CANVAS_HEIGHT` in `src/` SHALL return zero results

---

### Requirement: Click-Through IPC Handler

The `IPC.SET_IGNORE_MOUSE_EVENTS` handler in the main process is removed. The corresponding preload bridge method `setIgnoreMouseEvents` is removed.

#### Scenario: No setIgnoreMouseEvents in IPC layer

- **WHEN** the change is complete
- **THEN** a search for `SET_IGNORE_MOUSE_EVENTS` in `src/` SHALL return zero results (except the IPC constant definition, which MAY be kept for backward compatibility or also removed)
- **THEN** a search for `setIgnoreMouseEvents` in `src/renderer/` and `src/preload/` SHALL return zero results

---

### Requirement: data-clui-ui Attribute System

The `data-clui-ui` attribute system is removed from all views. No code SHALL query for `[data-clui-ui]` elements.

#### Scenario: No data-clui-ui references remain

- **WHEN** the change is complete
- **THEN** a search for `data-clui-ui` in `src/` SHALL return zero results

---

### Requirement: No-Op SET_VIEW_MODE Handler

The current no-op `SET_VIEW_MODE` IPC handler (which only logs and does nothing) is removed and replaced by a functional handler (see MODIFIED Requirement: Content-Tight Window Sizing).

#### Scenario: SET_VIEW_MODE handler performs resize

- **WHEN** a `SET_VIEW_MODE` IPC message is received
- **THEN** the handler SHALL call `setBounds()` with the correct dimensions
- **THEN** the handler SHALL NOT merely log and return
