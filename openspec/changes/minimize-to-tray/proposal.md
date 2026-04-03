# Feature: Minimize Pill to Menu Bar (#186)

**Issue:** #186
**Type:** Feature
**Risk:** Low — extends existing tray infrastructure, no state machine changes

## Problem

The floating pill view is the default during a live show, but some users want to minimize it entirely and just see their status in the macOS menu bar. Currently there's no way to hide the pill without closing the app.

## Solution

Add a **minimize button** on the pill view that hides the floating window and shows the current act name + timer in the macOS menu bar.

### Changes Required

### 1. PillView.tsx — Add minimize button

Add a minimize button (a `−` icon) next to the existing close/collapse controls in the pill view header.

- Use a small button with `aria-label="Minimize to menu bar"`
- Style: same size/style as existing pill controls, positioned left of close button
- On click: send IPC to main process to hide the window
- Use Tailwind classes only (NEVER inline styles)
- Use spring physics for any animations (Framer Motion)

### 2. IPC Channel — MINIMIZE_TO_TRAY

Add a new IPC channel constant in `src/shared/types.ts`:
```typescript
MINIMIZE_TO_TRAY: 'showtime:minimize-to-tray'
```

Expose in `src/preload/index.ts`:
```typescript
minimizeToTray: () => ipcRenderer.send(IPC.MINIMIZE_TO_TRAY)
```

### 3. Main Process — Window hide handler

In `src/main/index.ts` (or appropriate IPC handler file):
```typescript
ipcMain.on(IPC.MINIMIZE_TO_TRAY, () => {
  const win = getMainWindow()
  if (win && !win.isDestroyed()) {
    win.hide()
  }
})
```

### 4. Tray — Extended title when window hidden

In `src/main/tray.ts`, when the window is hidden:
- Include act name in the title: `{Act Name} — {MM:SS}` (e.g., `Deep Work — 38:52`)
- When window is visible: keep current behavior (just timer or empty)
- Amber mode: `⚡ {Act Name} — {MM:SS}`
- Intermission: `BREAK` (unchanged)

Update the tray click handler to restore the window:
```typescript
tray.on('click', () => {
  const win = getMainWindow()
  if (win && !win.isDestroyed() && !win.isVisible()) {
    win.show()
    return
  }
  toggleWindow('tray click')
})
```

Update the live menu to show "Show Floating Pill" when the window is hidden.

### 5. TrayShowState — Track window visibility

Add `windowVisible: boolean` to the `TrayShowState` type in `src/shared/types.ts`.
The renderer sends this flag with each tray state update. The tray uses it to decide
whether to include the act name in the title.

## Design Rules (from CLAUDE.md)

- NO inline styles — Tailwind CSS only
- Spring physics for animations (Framer Motion)
- Use shadcn/ui for the button component
- Draggable regions via CSS classes `.drag-region` / `.no-drag`
- All IPC through typed `window.showtime` API

## Testing Strategy

- Unit test: IPC channel exists and is typed
- Unit test: TrayShowState includes windowVisible
- Manual: minimize pill → see act name + timer in menu bar → click tray → pill restores
- E2E: app launches, pill shows, minimize works (window.isVisible() === false)

## Non-goals

- Persistent "always minimize" preference (future work)
- Menu bar-only mode without pill ever showing
- Keyboard shortcut for minimize (future work)
