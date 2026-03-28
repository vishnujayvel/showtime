# Proposal: Audit Tray Menu Bar Implementation (#88)

## Context

The tray menu bar feature was implemented directly (without Loki) and needs a proper design + implementation audit. Fix any issues found.

## Audit 1: Design Audit

Compare the implementation against the definitive mockup at `docs/mockups/tray-menu-bar.html`.

Check each state:

### State 1: Idle (no_show)
- Does the menu show "SHOWTIME" header?
- Does it show "No show running"?
- Does it have "Enter Writer's Room" and "Past Shows"?
- Does it have "Preferences..." and "Quit Showtime"?

### State 2: Live (live phase)
- Does it show "ON AIR • {act name}"?
- Does it show timer with ⏱ prefix?
- Does it show beat stars (★★☆ format)?
- Does it show "COMING UP" with next acts?
- Does it have "Open Expanded View" and "Director Mode..."?
- Does `tray.setTitle()` display timer next to icon?
- Does the icon switch to red tally dot variant?

### State 3: Amber Warning (live, < 5 min)
- Does it show ⚡ prefix on timer?
- Does the icon switch to amber dot variant?

### State 4: Intermission
- Does it show "INTERMISSION"?
- Does it show act count and beat stars?
- Does it show next act preview?
- Does it have "Back to Show"?
- Does `tray.setTitle()` show "BREAK"?

### State 5: Writer's Room (writers_room phase)
- Does it show "Planning your show..."?

### State 6: Strike (strike phase)
- Does it show "Show Complete" + "View Results"?

## Audit 2: Implementation Quality

### IPC Bridge
- Is `TrayShowState` properly typed with all required fields?
- Does the renderer subscribe to showStore correctly?
- Is there proper cleanup (unsubscribe) on unmount?
- Does the `useTraySync` hook throttle updates? (rebuilding Menu on every Zustand tick is expensive)

### Icon Loading
- Do all 3 icon files exist? (trayTemplate.png, trayTemplate-live.png, trayTemplate-amber.png)
- Do @2x variants exist?
- What happens if an icon file is missing? (error handling)
- Are icons loaded once at startup or on every state change?

### Timer
- How frequently is the timer updated? Every second? Via interval or Zustand tick?
- `tray.setTitle()` on every tick will cause menu bar flicker — is there throttling?
- Is the timer accurate? (does it use timerEndAt countdown or stale timerSeconds?)

### E2E Tests
- Does the existing tray label test (`test:get-tray-menu`) still pass?
- Are there tests for live/intermission/amber tray states?
- Do tray labels update correctly in test fixtures?

### Process Cleanup
- Does the IPC listener (`ipcMain.on`) get cleaned up on app quit?
- Is there a memory leak from rebuilding Menu objects on every state update?

## Files to Audit

| File | What to check |
|------|--------------|
| `src/main/tray.ts` | Menu builders, icon loading, IPC listener, timer display |
| `src/shared/types.ts` | TrayShowState type, IPC channel constant |
| `src/preload/index.ts` | updateTrayState bridge |
| `src/renderer/hooks/useTraySync.ts` | Store subscription, throttling, cleanup |
| `src/renderer/App.tsx` | Hook usage |
| `resources/trayTemplate*.png` | Icon files exist and are correct format |
| `e2e/app-launch.test.ts` | Tray label test |

## Fix anything found — commit with "audit: " prefix.

## Testing

After fixes:
1. `npm run build` — zero errors
2. `npx vitest run` — unit tests pass
3. `npx playwright test e2e/app-launch.test.ts` — tray label test passes
4. Manual: verify tray menu shows correct state during live show
