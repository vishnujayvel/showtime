# Proposal: Fix Tray Audit Items H1, H2, M1, M2

Audit report at `docs/plans/tray-audit-report.md` found these issues. Fix all four.

## H1: Icon load validation (High)

**File:** `src/main/tray.ts` — `loadIcons()` function

**Problem:** `nativeImage.createFromPath()` returns an empty image silently if the PNG is missing or corrupt. The tray icon disappears with no error.

**Fix:** After each `createFromPath`, check `.isEmpty()` and log a warning:
```typescript
iconDefault = nativeImage.createFromPath(join(base, 'trayTemplate.png'))
if (iconDefault.isEmpty()) {
  log('WARNING: trayTemplate.png not found or corrupt')
}
iconDefault.setTemplateImage(true)
```

Do the same for `iconLive` and `iconAmber`.

## H2: Separate timer updates from full menu rebuilds (High)

**File:** `src/main/tray.ts` — IPC handler, and `src/renderer/hooks/useTraySync.ts`

**Problem:** Every 1-second timer tick sends full `TrayShowState` over IPC, which triggers `Menu.buildFromTemplate()` + `tray.setContextMenu()`. The menu items only change on phase/act/beat transitions, not every second.

**Fix:** Split into two update paths:
1. **Timer-only** (every 1s): call `tray.setTitle(formatTimer(seconds))` directly. No menu rebuild. Add a new IPC channel `TRAY_TIMER_UPDATE` that sends just the seconds value.
2. **Full state** (on phase/act/beat change): rebuild the menu. Use the existing `TRAY_STATE_UPDATE`.

In `useTraySync.ts`:
- The 1-second interval sends timer-only updates via `window.clui.updateTrayTimer(seconds)`
- The store subscription sends full state only when phase, actIndex, beatsLocked, or totalActs change (not on every tick)

In `tray.ts`:
- Add `ipcMain.on(IPC.TRAY_TIMER_UPDATE)` that only calls `tray.setTitle()` and updates the icon state (live vs amber)
- Keep `ipcMain.on(IPC.TRAY_STATE_UPDATE)` for full menu rebuilds

In `src/shared/types.ts`:
- Add `TRAY_TIMER_UPDATE: 'showtime:tray-timer-update'`

In `src/preload/index.ts`:
- Add `updateTrayTimer: (seconds: number) => ipcRenderer.send(IPC.TRAY_TIMER_UPDATE, seconds)`

## M1: Use `currentActCategory` or remove it (Medium)

**File:** `src/main/tray.ts` — `buildLiveMenu()`, and `src/shared/types.ts` — `TrayShowState`

**Problem:** `currentActCategory` is sent in TrayShowState but never used in any menu builder.

**Fix:** Use it in the live menu label. Change:
```
{ label: 'ON AIR • API Refactor', enabled: false }
```
To:
```
{ label: 'ON AIR • DEEP WORK • API Refactor', enabled: false }
```

## M2: Add `director` phase to tray switch (Medium)

**File:** `src/main/tray.ts` — switch statement in IPC handler

**Problem:** `director` phase falls through to `default` (idle menu), showing "No show running" which is misleading — the show IS running during director mode.

**Fix:** Add explicit case that mirrors the live menu:
```typescript
case 'director':
  menu = buildLiveMenu(state, showWindow)
  setTrayIcon(tray, state.timerSeconds !== null && state.timerSeconds < 300 ? 'amber' : 'live')
  tray.setTitle(state.timerSeconds !== null ? formatTimer(state.timerSeconds) : '')
  break
```

## Testing

After fixes:
1. `npm run build` — zero errors
2. `npx vitest run` — unit tests pass
3. `npx playwright test e2e/app-launch.test.ts` — tray label test passes
