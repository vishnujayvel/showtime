---
title: "Pill View Black Bar / Ghost Frames — Design Document"
status: current
last-verified: 2026-04-06
---
# Pill View Black Bar / Ghost Frames — Design Document

**Issue:** #43
**Date:** 2026-03-24

## 1. Root Cause Investigation

### Current Window Management Architecture

The window lifecycle is managed in `src/main/window.ts`:

- **Single BrowserWindow** — all view tiers share one window, resized via `setBounds()`
- **Anchor-based positioning** — center-bottom point preserved across transitions (`window-geometry.ts`)
- **isDragging guard** — `will-move`/`moved` events defer `setBounds()` during user drags (5s safety valve)

### How `applyViewMode()` Works (lines 64-83)

```
1. Renderer calls window.clui.setViewMode('pill')
2. IPC handler calls applyViewMode('pill')
3. applyViewMode() looks up VIEW_DIMENSIONS['pill'] → { width: 320, height: 56 }
4. Computes new bounds from stored anchor point (center-bottom)
5. Calls mainWindow.setBounds(newBounds) — single atomic call
6. Updates anchor from resulting bounds
```

**No repaint trigger after `setBounds()`** — the compositor is not explicitly invalidated.

### BrowserWindow Configuration (createWindow, lines 85-183)

```typescript
transparent: true          // Enables rounded pill corners
frame: false               // No native title bar
roundedCorners: true       // macOS native rounded corners
backgroundColor: '#00000000' // Fully transparent
type: 'panel'              // macOS NSPanel — joins all spaces
resizable: false           // Content-tight sizing
hasShadow: true            // Native macOS shadow
```

### Critical Finding: Height Mismatch

**VIEW_DIMENSIONS defines pill as 320x56**, but `PillView.tsx` uses `flex-col` and conditionally renders a `MiniRundownStrip` below the main content row:

```tsx
// PillView.tsx line 87
{showStrip && <MiniRundownStrip />}
```

When `phase === 'live'` or `phase === 'intermission'`, the strip is rendered. If the strip's height pushes content beyond 56px, the window clips it — or worse, the transparent overflow creates ghost artifacts on the macOS compositor.

### Race Condition Path

The `useEffect` in `App.tsx` (lines 118-134) fires `window.clui.setViewMode()` on every `viewTier`/`phase` change. During rapid transitions (e.g., expanded → pill while a beat check arrives), multiple `applyViewMode()` calls can queue up:

1. User clicks pill → `setViewMode('pill')` fires
2. Beat check triggers → `setViewTier('dashboard')` → `setViewMode('dashboard')` fires
3. But `setBounds()` from step 1 hasn't completed rendering yet

The `isDragging` guard only handles user drags, not rapid programmatic resizes.

## 2. Known Electron Issues

### `transparent: true` + `setBounds()` Ghosting (macOS)

When a transparent window is resized via `setBounds()`, macOS's compositor may retain the previous frame buffer until the renderer paints the new content. On Retina displays, this manifests as:
- **Ghost frames** — the old content persists as a semi-transparent overlay
- **Black bars** — unfilled regions appear black instead of transparent
- **Double rendering** — content appears at both old and new sizes

This is a long-standing Electron issue on macOS. The compositor needs an explicit signal to discard the old buffer.

### NSPanel + Non-Activating Window

The log warning `"NSWindow does not support nonactivating panel styleMask"` indicates the `type: 'panel'` + `alwaysOnTop` combination creates an NSPanel that doesn't fully support all BrowserWindow APIs. This can affect `setBounds()` behavior since NSPanel has different reflow semantics than NSWindow.

### `roundedCorners: true` + Transparent Background

`roundedCorners: true` applies macOS native corner rounding at the window level. Combined with `transparent: true` and CSS `rounded-full` on the pill content, there are two competing rounding mechanisms. The native rounding may create a visible border artifact where the window corner mask doesn't align with the CSS border-radius.

## 3. Proposed Fix Strategy

### Recommended: Approach A + B Hybrid — Force Repaint with Staged Transition

```typescript
export function applyViewMode(mode: string): void {
  const mainWindow = getMainWindow()
  if (!mainWindow || mainWindow.isDestroyed()) return
  const dims = VIEW_DIMENSIONS[mode]
  if (!dims) return

  if (isDragging) {
    deferredViewMode = mode
    return
  }

  if (!anchorPoint) {
    anchorPoint = computeAnchorFromBounds(mainWindow.getBounds())
  }

  const newBounds = clampToDisplay(computeBoundsFromAnchor(anchorPoint, dims))

  // For transitions TO pill (shrinking), hide briefly to prevent ghost frames
  const currentBounds = mainWindow.getBounds()
  const isShrinking = newBounds.width < currentBounds.width || newBounds.height < currentBounds.height

  if (isShrinking) {
    // Opacity fade prevents the flash — smoother than hide/show
    mainWindow.setOpacity(0)
    mainWindow.setBounds(newBounds)
    // Give compositor one frame to render at new size
    setTimeout(() => {
      mainWindow.webContents.invalidate()
      mainWindow.setOpacity(1)
    }, 32) // ~2 frames at 60fps
  } else {
    mainWindow.setBounds(newBounds)
    mainWindow.webContents.invalidate()
  }

  anchorPoint = computeAnchorFromBounds(newBounds)
}
```

### Why Not Other Approaches

**Approach C (Separate Windows):** Too complex for MLP. Two BrowserWindows means two React roots, duplicated state, complex IPC routing. Would require a major architecture change.

**Approach D (CSS-Only Resize):** Leaves a large transparent window that interferes with click-through. Users would click "through" the invisible window area and hit it instead of the app behind it. `setIgnoreMouseEvents` is explicitly banned in CLAUDE.md.

### Additional Fix: MiniRundownStrip Height Accounting

Update `VIEW_DIMENSIONS.pill` to account for the strip, OR make the strip overlay inside the existing 56px:

**Option 1: Increase pill height when strip is visible**
```typescript
// Dynamic pill height based on whether strip is active
pill: { width: 320, height: 56 },      // base
pillWithStrip: { width: 320, height: 72 }, // with mini rundown
```

**Option 2 (Preferred): Make strip part of the 56px layout**
Keep the pill at exactly 56px. The strip should be an inline element within the flex row, not a stacked element. This eliminates the height mismatch entirely.

### Debounce Rapid View Mode Changes

Add a debounce to prevent multiple `setBounds()` calls from queuing:

```typescript
let pendingViewMode: string | null = null
let viewModeTimer: ReturnType<typeof setTimeout> | null = null

export function applyViewMode(mode: string): void {
  pendingViewMode = mode
  if (viewModeTimer) clearTimeout(viewModeTimer)
  viewModeTimer = setTimeout(() => {
    actuallyApplyViewMode(pendingViewMode!)
    pendingViewMode = null
    viewModeTimer = null
  }, 16) // One frame debounce
}
```

## 4. Recovery Mechanism

Even with the fix, add defensive recovery for edge cases:

### Stuck Pill Detection (Renderer Side)

```typescript
// In PillView.tsx — detect when pill content isn't visible
useEffect(() => {
  const timeout = setTimeout(() => {
    const el = document.querySelector('[data-pill-content]')
    if (el) {
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) {
        // Content not rendering — request re-layout
        window.clui.setViewMode('pill')
      }
    }
  }, 3000)
  return () => clearTimeout(timeout)
}, [])
```

### Force-Repaint IPC (Main Process)

```typescript
ipcMain.on('showtime:force-repaint', () => {
  const win = getMainWindow()
  if (win && !win.isDestroyed()) {
    const bounds = win.getBounds()
    win.setBounds({ ...bounds, width: bounds.width + 1 })
    setTimeout(() => {
      win.setBounds(bounds)
      win.webContents.invalidate()
    }, 16)
  }
})
```

## 5. Testing Strategy

1. **E2E: Expanded → Pill transition** — verify pill content renders, take screenshot
2. **E2E: Rapid pill <-> expanded transitions** — 10 rapid toggles, verify no ghost frames
3. **E2E: Pill with MiniRundownStrip** — seed live state, switch to pill, verify strip visible within bounds
4. **Visual regression** — screenshot pill view, compare against baseline
5. **Manual verification** — test on Retina display, test after hide/show cycles

## 6. Files to Modify

| File | Change |
|------|--------|
| `src/main/window.ts` | `applyViewMode()` — add opacity fade + invalidate for shrink transitions; add debounce |
| `src/main/window.ts` | `VIEW_DIMENSIONS` — verify pill height accounts for strip |
| `src/renderer/views/PillView.tsx` | Ensure content fits within 56px; add `data-pill-content` attribute |
| `src/renderer/components/MiniRundownStrip.tsx` | Ensure strip is within pill bounds, not overflowing |
| `src/main/ipc/showtime.ts` | Add `force-repaint` IPC handler |
| `src/preload/index.ts` | Expose `forceRepaint()` on `window.clui` |
| `e2e/view-tiers.test.ts` | Add pill transition + rapid toggle tests |
