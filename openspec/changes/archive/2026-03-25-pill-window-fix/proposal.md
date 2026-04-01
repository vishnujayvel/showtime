# Pill View Black Bar / Ghost Frames — Window Management Fix

GitHub Issue: #43

## Why

When transitioning to pill view (or minimizing), the window sometimes renders as a black bar
with multiple overlapping ghost frames. The pill content disappears and the window becomes
completely unresponsive — can't close, can't drag, can't interact. Only force-quit recovers it.

This is a critical UX bug: the pill view is the primary always-on-top interface during a live show.
If it breaks, the user loses their timer and has to force-quit.

## Phase 1: Design Document

**Create a design doc first** at `docs/plans/pill-window-fix-design.md` covering:

### 1. Root Cause Investigation

Read and analyze these files to understand the current window management:
- `src/main/index.ts` — BrowserWindow creation, `setBounds()` calls
- `src/main/ipc/showtime.ts` — `applyViewMode()` handler
- `src/main/state.ts` — window state management

Document:
- How `setBounds()` is called during expanded → pill transition
- What the current BrowserWindow config is (`transparent`, `frame`, `hasShadow`, etc.)
- Whether `setContentSize()` vs `setBounds()` is used
- Whether there's a race between resize and content render
- Whether `webContents.invalidate()` is called after resize
- macOS-specific compositor behavior with `transparent: true`

### 2. Known Electron Issues

Research and document known Electron bugs:
- `transparent: true` + `setBounds()` ghosting on macOS
- NSPanel + non-activating window rendering issues (the log shows: "NSWindow does not support nonactivating panel styleMask")
- Retina display double-resolution rendering artifacts
- `vibrancy` interaction with transparency

### 3. Proposed Fix Strategy

Evaluate these approaches:

**Approach A: Force Repaint After Resize**
```typescript
win.setBounds(newBounds)
win.webContents.invalidate() // Force compositor refresh
```

**Approach B: Hide → Resize → Show**
```typescript
win.hide()
win.setBounds(newBounds)
setTimeout(() => win.show(), 50) // Small delay for compositor
```

**Approach C: Separate Windows Per View Tier**
- One BrowserWindow for pill (320x48, always-on-top)
- One BrowserWindow for expanded (560x620)
- Switch by hiding one and showing the other
- More complex but eliminates resize entirely

**Approach D: CSS-Only Resize (No setBounds)**
- Keep window at max size (expanded)
- Use CSS to render pill-sized content in the corner
- Eliminates native resize entirely
- Drawback: larger click-through area

### 4. Recovery Mechanism

Even if the fix reduces frequency, add a recovery path:
- Detect when pill content hasn't rendered for > 3 seconds
- Auto-trigger a window recreation or force-repaint
- Add "Stuck? Click here" overlay that appears after 5s of no interaction

## Phase 2: Implementation

Based on the design doc:

1. **Implement chosen fix** from the design investigation
2. **Add recovery mechanism** — detect stuck pill and auto-recover
3. **E2E test** — transition expanded → pill → verify content renders
4. **E2E test** — rapid pill ↔ expanded transitions (stress test)
5. **Visual regression** — screenshot pill view after transition

## Key Files

- `src/main/index.ts` — BrowserWindow config + setBounds
- `src/main/ipc/showtime.ts` — applyViewMode handler
- `src/main/state.ts` — window state
- `src/renderer/App.tsx` — view tier routing

## IMPORTANT RULES (from CLAUDE.md)
- Do NOT use `setIgnoreMouseEvents` — content-tight sizing instead
- Do NOT use Electron `vibrancy` — use CSS backgrounds
- Do NOT use `titleBarStyle: 'hiddenInset'` with `frame: false`
- Spring physics for all animations
- E2E test coverage required
