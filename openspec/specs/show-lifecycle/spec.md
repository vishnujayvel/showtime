# Show Lifecycle Spec

## Overview

A Show moves through defined phases: no_show → writers_room → live → intermission → director → strike. Each transition maps to a theatrical production moment per the product context.

## Current State

The state machine is implemented in `src/renderer/stores/showStore.ts` with Zustand. All phases work. The Going Live transition, Beat Check modal, Director Mode, and Strike views are all rendered.

## Requirements

### Beat Check Celebration
- WHEN user clicks "Yes — Lock the Beat" THEN Showtime SHALL show a 1.5-2s celebration ("That moment was real" + beat ignite animation) BEFORE advancing to the next Act
- Currently: lockBeat() immediately sets beatCheckPending=false and starts next Act — no celebration visible

### App Close/Quit
- Showtime SHALL have a tray context menu with "Quit Showtime" option
- Cmd+Q SHALL actually quit the app on first press (not hide)
- The expanded view title bar SHALL have a close button that collapses to pill OR quits
- WHEN the user clicks the macOS red traffic light THEN the app SHALL minimize to tray, not hide invisibly

### Day Boundary
- WHEN midnight crosses THEN Showtime SHALL detect and offer to start a fresh Show
- Day boundary detection via 1-minute interval already implemented in main/index.ts

## Files

- `src/renderer/stores/showStore.ts` — lockBeat(), state machine
- `src/renderer/components/BeatCheckModal.tsx` — Beat Check UI
- `src/main/index.ts` — window management, tray, quit behavior
