# Bug Batch: UX Wave 2 — History Diary + Tray Timer (#193, #195)

**Type:** Bug Batch
**Priority:** High — user-reported issues during manual testing

## Bug 1: Past Shows history is empty despite DB having shows (#193)

**Problem:** HistoryView shows "No past shows yet" even though the SQLite DB has 3 shows (March 28, 29, April 2). The `getShowHistory` IPC returns data but the UI renders empty. Additionally, shows that didn't reach Strike should still appear as a diary.

**Investigation needed:**
1. Debug why `window.showtime.getShowHistory(30)` returns empty in the renderer
2. Check if Drizzle ORM column mapping matches the raw SQLite schema (camelCase vs snake_case)
3. The `ShowRepository.getRecentShows()` uses Drizzle `select()` — verify it works with the actual DB

**Fix for the bug:** Fix the query/mapping so existing shows appear.

**Fix for the diary feature:** All shows should appear in history with status indicators:
- **Completed** (has verdict): Show full recap with verdict badge
- **In Progress** (live/intermission/director): "Show in progress"
- **Abandoned** (writers_room/going_live, past date): "Show planned but never aired"

**Files:**
- `src/main/data/ShowRepository.ts` — getRecentShows query
- `src/renderer/views/HistoryView.tsx` — rendering logic
- `src/main/ipc/showtime.ts` (line 189) — IPC handler

## Bug 2: Tray timer shows --:-- instead of actual remaining time (#195)

**Problem:** The tray menu shows `⏱ --:-- remaining` instead of the actual countdown (e.g., "⏱ 09:37 remaining"). The pill view shows the timer correctly but the tray doesn't receive the timer value.

**Investigation needed:**
1. Check `src/main/tray.ts` — how does `timerLabel` get populated?
2. The `TrayShowState` type — does it include timer fields?
3. The IPC that pushes state to the tray — is the timer value being sent?

**Fix:** Ensure the timer value (minutes:seconds remaining) is computed from `timerEndAt` and forwarded to the tray menu. The tray should update every second while a show is live.

**Bonus:** Consider showing the remaining time in the menu bar title itself (next to the tray icon) — this is the most glanceable spot on macOS.

**Files:**
- `src/main/tray.ts` — menu construction and timer display
- `src/main/index.ts` — tray state update mechanism
- The IPC that sends show state from renderer to main process

## Acceptance Criteria

- [ ] Past Shows displays all 3 existing shows from DB
- [ ] Incomplete shows appear with appropriate status labels
- [ ] Tray timer shows actual remaining time (e.g., "⏱ 09:37 remaining")
- [ ] Tray timer updates while show is live
- [ ] All existing tests pass
