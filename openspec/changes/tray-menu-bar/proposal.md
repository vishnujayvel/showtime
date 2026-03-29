# Proposal: Tray Menu Bar with Live Show Status (#88)

## Problem

Users want a way to see their show status without the floating pill window. The clapperboard tray icon exists but only has static menu items (Show, Reset, Quit).

## Solution

Make the tray icon dynamic — update its menu and title based on the current show state. 4 states matching the mockup at `docs/mockups/tray-menu-bar.html`.

## What to Build

### 1. Dynamic Tray Manager (`src/main/tray.ts`)

Rewrite `createTray()` to accept show state updates and rebuild the menu dynamically.

**State 1: No Show Running (phase === 'no_show')**
```
SHOWTIME
─────────────
No show running
─────────────
Enter Writer's Room
Past Shows
─────────────
Preferences…
Quit Showtime
```
- `tray.setTitle('')` — no title text next to icon

**State 2: Live (phase === 'live')**
```
ON AIR • API Refactor
─────────────
⏱ 01:23:45 remaining
★★☆ 2/3 beats
─────────────
COMING UP
  Email Triage — Admin — 30m
  Personal Training — Exercise — 90m
─────────────
Open Expanded View
Director Mode…
─────────────
Quit Showtime
```
- `tray.setTitle('01:23:45')` — timer in menu bar next to icon
- Tray icon: add red tally dot overlay via `tray.setImage()` with a different icon

**State 3: Under 5 Minutes (phase === 'live', timerSeconds < 300)**
- Same as State 2 but title shows amber warning: `tray.setTitle('⚡ 04:32')`

**State 4: Intermission (phase === 'intermission')**
```
INTERMISSION
─────────────
Between acts • 3/8 complete
★★☆ 2/3 beats
─────────────
Next: Email Triage — Admin — 30m
─────────────
Back to Show
Director Mode…
─────────────
Quit Showtime
```
- `tray.setTitle('BREAK')` or empty

### 2. IPC Bridge: Show State → Main Process

The show state lives in the renderer (Zustand showStore). The tray lives in the main process. Need IPC to sync.

Add a new IPC channel `IPC.SHOW_STATE_UPDATE` that the renderer sends whenever show state changes:

```typescript
// In showStore — subscribe to state changes
showStore.subscribe((state) => {
  window.clui.updateShowState({
    phase: state.phase,
    currentActName: state.acts[state.currentActIndex]?.name,
    currentActCategory: state.acts[state.currentActIndex]?.sketch,
    timerSeconds: state.timerSeconds,
    beatsLocked: state.beatsLocked,
    beatThreshold: state.beatThreshold,
    actIndex: state.currentActIndex,
    totalActs: state.acts.length,
    nextActs: state.acts.slice(state.currentActIndex + 1, state.currentActIndex + 3),
  })
})
```

In main process, listen for this and call `updateTray(state)`.

### 3. Tray Icon Variants

Create 3 icon variants in `resources/`:
- `trayTemplate.png` — default clapperboard (idle)
- `trayTemplate-live.png` — clapperboard with red tally dot (live)
- `trayTemplate-amber.png` — clapperboard with amber dot (< 5 min)

All must be macOS template images (black on transparent, 22x22 @1x, 44x44 @2x).

### 4. Timer Update Interval

Use `setInterval(1000)` in main process to update `tray.setTitle()` with the countdown. The renderer sends timer updates via IPC, and the main process formats and displays.

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/main/tray.ts` | REWRITE — dynamic menu builder, state-based icon switching |
| `src/main/index.ts` | MODIFY — register new IPC handler for show state |
| `src/shared/types.ts` | MODIFY — add IPC.SHOW_STATE_UPDATE channel + TrayShowState type |
| `src/preload/index.ts` | MODIFY — add `updateShowState()` to clui API |
| `src/renderer/App.tsx` | MODIFY — subscribe to showStore and send state to main via IPC |
| `resources/trayTemplate-live.png` | CREATE — icon with red tally dot |
| `resources/trayTemplate-live@2x.png` | CREATE — @2x version |
| `resources/trayTemplate-amber.png` | CREATE — icon with amber dot |
| `resources/trayTemplate-amber@2x.png` | CREATE — @2x version |

## Non-Goals

- Custom BrowserWindow dropdown (use native Menu for now)
- Click-on-act to expand (native Menu doesn't support this well)
- Drag-to-reorder acts from tray

## Testing Strategy

1. E2E: verify tray menu labels include "Quit Showtime" (existing test)
2. E2E: seed live state, verify tray title contains timer format (HH:MM:SS)
3. E2E: seed intermission state, verify tray menu includes "Back to Show"
4. Manual: watch timer update in menu bar during live show

## Reference

- Mockup: `docs/mockups/tray-menu-bar.html`
- Existing tray: `src/main/tray.ts` (38 lines)
- Show state: `src/renderer/stores/showStore.ts`
