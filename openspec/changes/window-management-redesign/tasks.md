# Window Management Redesign — Tasks

**Change:** window-management-redesign
**Spec:** `specs/window-management/spec.md`
**Design:** `design.md`

---

## 1. CSS foundation — drag classes and spotlight utility

- [ ] 1.1 Verify `.drag-region` and `.no-drag` classes exist in `src/renderer/index.css` (lines 257-262). No changes needed if already present.
- [ ] 1.2 Add `.spotlight-accent` class to `src/renderer/index.css` with `background: radial-gradient(ellipse 400px 350px at 50% 35%, rgba(217,119,87,0.06) 0%, transparent 70%)`. This replaces the inline gradient in DarkStudioView (Design Decision #9).

## 2. Main process — remove fixed canvas and click-through

- [ ] 2.1 In `src/main/index.ts`, delete the `CANVAS_WIDTH` and `CANVAS_HEIGHT` constants (lines 36-37) and the associated comment block (lines 33-37). Replace with a `VIEW_SIZES` map: `{ pill: { width: 320, height: 48 }, expanded: { width: 560, height: 620 }, full: { width: 560, height: 740 } }`.
- [ ] 2.2 In `src/main/index.ts`, update `createWindow()` to use `VIEW_SIZES.full` for initial window dimensions instead of `CANVAS_WIDTH`/`CANVAS_HEIGHT` (lines 107-108). Update the initial position computation (lines 103-104) accordingly.
- [ ] 2.3 In `src/main/index.ts`, change `hasShadow: false` to `hasShadow: true` in the BrowserWindow constructor (line 122). Add `titleBarStyle: 'hiddenInset'` to the constructor options. Add `mainWindow.setWindowButtonPosition({ x: 12, y: 14 })` after BrowserWindow creation (Spec: Window Creation Settings).
- [ ] 2.4 In `src/main/index.ts`, delete `mainWindow?.setIgnoreMouseEvents(true, { forward: true })` from the `ready-to-show` handler (line 144).
- [ ] 2.5 In `src/main/index.ts`, delete the `IPC.SET_IGNORE_MOUSE_EVENTS` handler (lines 246-253).

## 3. Main process — implement anchor-based positioning

- [ ] 3.1 In `src/main/index.ts`, add module-level state: `let windowAnchor: { cx: number; by: number } | null = null` and `let isDragging = false` and `let pendingViewMode: 'pill' | 'expanded' | 'full' | null = null`.
- [ ] 3.2 In `src/main/index.ts`, add a helper function `computeBoundsFromAnchor(anchor, viewMode)` that computes `{ x, y, width, height }` from the anchor point and the `VIEW_SIZES[viewMode]` dimensions. Clamp to the work area of `screen.getDisplayMatching()` (Spec: Display Detection via Bounds Matching).
- [ ] 3.3 In `src/main/index.ts`, compute the initial anchor in `createWindow()` after positioning: `windowAnchor = { cx: x + width/2, by: y + height }`.
- [ ] 3.4 In `src/main/index.ts`, register `will-move` and `moved` event listeners on `mainWindow` after creation. `will-move` sets `isDragging = true`. `moved` sets `isDragging = false`, updates `windowAnchor` from `mainWindow.getBounds()`, and flushes `pendingViewMode` if set (Design Decision #4).
- [ ] 3.5 In `src/main/index.ts`, add a 5-second `isDragging` timeout safety valve: if `isDragging` stays true for 5 seconds without a `moved` event, reset it to false (Design: Risk #5).

## 4. Main process — implement SET_VIEW_MODE handler

- [ ] 4.1 In `src/main/index.ts`, replace the no-op `SET_VIEW_MODE` handler (lines 389-392) with a real implementation: look up dimensions from `VIEW_SIZES[mode]`, check `isDragging` — if true, store `pendingViewMode = mode` and return. If false, compute bounds via `computeBoundsFromAnchor()`, call `mainWindow.setBounds()`, and update `windowAnchor` (Spec: Content-Tight Window Sizing).

## 5. Main process — update showWindow positioning

- [ ] 5.1 In `src/main/index.ts`, rewrite `showWindow()` (line 166+) to: (a) if `windowAnchor` exists and falls within a connected display, use `computeBoundsFromAnchor()` with the current view mode; (b) if no anchor or anchor is off-screen, fall back to cursor-display center-bottom positioning using `VIEW_SIZES.full` (Spec: showWindow Positioning Update).
- [ ] 5.2 In `showWindow()`, replace `screen.getDisplayNearestPoint(cursor)` with `screen.getDisplayMatching(mainWindow.getBounds())` for the case where `windowAnchor` exists (Spec: Display Detection via Bounds Matching). Keep cursor-based fallback for first launch.
- [ ] 5.3 Remove all references to `CANVAS_WIDTH` and `CANVAS_HEIGHT` from `showWindow()` (lines 176-179).

## 6. Preload — remove setIgnoreMouseEvents

- [ ] 6.1 In `src/preload/index.ts`, remove `setIgnoreMouseEvents` from the `CluiAPI` interface definition (line 47).
- [ ] 6.2 In `src/preload/index.ts`, remove the `setIgnoreMouseEvents` implementation from the `contextBridge.exposeInMainWorld` call (lines 119-120).

## 7. Shared types — remove IPC constant

- [ ] 7.1 In `src/shared/types.ts`, remove the `SET_IGNORE_MOUSE_EVENTS` constant (line 393). Alternatively, keep it commented out if backward compatibility is a concern.

## 8. Renderer — remove click-through handler from App.tsx

- [ ] 8.1 In `src/renderer/App.tsx`, delete the entire `useEffect` block for OS-level click-through (lines 63-95) that registers `mousemove`/`mouseleave` handlers and calls `setIgnoreMouseEvents`.

## 9. Renderer — force-expand on beatCheckPending

- [ ] 9.1 In `src/renderer/App.tsx`, add a new `useEffect` that watches `beatCheckPending` from `useShowStore`. When `beatCheckPending` becomes `true` and `isExpanded` is `false`, call `useShowStore.getState().setExpanded(true)` — this triggers the existing view-mode `useEffect` to send `setViewMode('expanded')` (Spec: Force-Expand on Beat Check).

## 10. Renderer views — remove data-clui-ui attributes

- [ ] 10.1 In `src/renderer/views/PillView.tsx`, remove `data-clui-ui` from line 73.
- [ ] 10.2 In `src/renderer/views/ExpandedView.tsx`, remove `data-clui-ui` from line 23.
- [ ] 10.3 In `src/renderer/views/WritersRoomView.tsx`, remove `data-clui-ui` from line 127.
- [ ] 10.4 In `src/renderer/views/StrikeView.tsx`, remove `data-clui-ui` from line 22.
- [ ] 10.5 In `src/renderer/views/DarkStudioView.tsx`, remove `data-clui-ui` from line 10.
- [ ] 10.6 In `src/renderer/views/OnboardingView.tsx`, remove `data-clui-ui` from line 64.

## 11. Renderer views — replace inline drag styles with CSS classes

- [ ] 11.1 In `src/renderer/views/ExpandedView.tsx`, replace `style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}` on the title bar div (line 32) with `drag-region` added to `className`.
- [ ] 11.2 In `src/renderer/views/ExpandedView.tsx`, replace `style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}` on the Director button (line 42), collapse button (line 49), and close button (line 56) with `no-drag` added to `className`.
- [ ] 11.3 In `src/renderer/views/WritersRoomView.tsx`, replace `style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}` on the title bar div (line 132) with `drag-region` added to `className`.
- [ ] 11.4 In `src/renderer/views/WritersRoomView.tsx`, replace `style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}` on the quit button (line 140) with `no-drag` added to `className`.
- [ ] 11.5 In `src/renderer/views/StrikeView.tsx`, replace `style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}` on the title bar div (line 30) with `drag-region` added to `className`.
- [ ] 11.6 In `src/renderer/views/StrikeView.tsx`, add a close/collapse button to the title bar (right side, matching ExpandedView pattern) with `no-drag` class. StrikeView currently has no way to collapse without a keyboard shortcut (Design: Risk #6).

## 12. Renderer views — add drag handles to views that lack them

- [ ] 12.1 In `src/renderer/views/DarkStudioView.tsx`, add an invisible `h-8 drag-region` div at the top of the component (inside the outer div, before the spotlight overlay). This enables window repositioning from DarkStudioView (Design Decision #8).
- [ ] 12.2 In `src/renderer/views/DarkStudioView.tsx`, replace the inline `style={{ background: 'radial-gradient(...)' }}` on the spotlight overlay div (lines 16-19) with the `spotlight-accent` CSS class created in task 1.2.
- [ ] 12.3 In `src/renderer/views/OnboardingView.tsx`, add an invisible `h-8 drag-region` div at the top of the component (inside the outer div, before the skip link). This enables window repositioning from OnboardingView (Design Decision #8).

## 13. Update CLAUDE.md Section 4

- [ ] 13.1 In `CLAUDE.md`, update the Section 4 ("macOS Native Feel") BrowserWindow code block: remove `transparent: true`, add `hasShadow: true`, add `titleBarStyle: 'hiddenInset'` (Spec: Update CLAUDE.md Section 4).
- [ ] 13.2 In `CLAUDE.md` Section 4, add a note that drag regions must use CSS classes (`.drag-region`, `.no-drag`), not inline styles.
- [ ] 13.3 In `CLAUDE.md` Section 4, add a note that `setIgnoreMouseEvents` must not be used.

## 14. Unit tests — store and anchor logic

- [ ] 14.1 Add a unit test in `src/__tests__/` verifying that when `beatCheckPending` becomes true and `isExpanded` is false, the force-expand logic sets `isExpanded` to true.
- [ ] 14.2 Add a unit test for the `computeBoundsFromAnchor` function: given an anchor `{ cx: 800, by: 1050 }` and mode `expanded` (560x620), verify output is `{ x: 520, y: 430, width: 560, height: 620 }` (Spec scenario: Pill-to-expanded preserves bottom-center).
- [ ] 14.3 Add a unit test for anchor computation from bounds: given bounds `{ x: 640, y: 1002, width: 320, height: 48 }`, verify anchor is `{ cx: 800, by: 1050 }`.
- [ ] 14.4 Add a unit test verifying that `computeBoundsFromAnchor` clamps to work area when the computed bounds would go off-screen.

## 15. E2E tests — window bounds verification

- [ ] 15.1 Add a Playwright E2E test that launches the app and verifies the initial window bounds are approximately 560x740 (full mode for DarkStudioView).
- [ ] 15.2 Add a Playwright E2E test that transitions from DarkStudioView to WritersRoom and verifies the window stays at 560x740 (both are full mode).
- [ ] 15.3 Add a Playwright E2E test that collapses to pill view and verifies the window bounds are approximately 320x48.
- [ ] 15.4 Add a Playwright E2E test that expands from pill to ExpandedView during live phase and verifies the window bounds are approximately 560x620.
- [ ] 15.5 Add a Playwright E2E test verifying that `data-clui-ui` attribute does not appear in the DOM for any view.
- [ ] 15.6 Add a Playwright E2E test verifying that no inline `WebkitAppRegion` style attributes exist in the DOM.
- [ ] 15.7 Add a Playwright E2E test verifying that the pill-to-expanded transition preserves the center-bottom anchor point (window y + height stays constant, window x + width/2 stays constant).

## 16. Verification — codebase-wide grep checks

- [ ] 16.1 Run `grep -r "CANVAS_WIDTH\|CANVAS_HEIGHT" src/` and verify zero results.
- [ ] 16.2 Run `grep -r "setIgnoreMouseEvents" src/` and verify zero results.
- [ ] 16.3 Run `grep -r "data-clui-ui" src/` and verify zero results.
- [ ] 16.4 Run `grep -r "WebkitAppRegion" src/renderer/views/` and verify zero results (all inline drag styles replaced with CSS classes).
- [ ] 16.5 Run `npm run test && npm run test:e2e` and verify all tests pass.
