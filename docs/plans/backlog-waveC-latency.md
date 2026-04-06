---
title: "Wave C: Latency Reduction — Issues #118, #119, #120, #121"
status: archived
last-verified: 2026-04-06
---
# Wave C: Latency Reduction — Issues #118, #119, #120, #121

## IMPORTANT: Issue Closure Protocol
When closing issues, you MUST:
1. Add labels FIRST: `gh issue edit <N> --add-label "root-cause" --add-label "has-test-evidence"`
2. Then close with structured comment containing `Root cause:`, `Fix:`, `Test evidence:`
A GitHub Action will REOPEN issues missing required labels.

## State Machine Reference
Read `docs/plans/writers-room-state-machine.md` for the full state machine spec.
Read `docs/mockups/writers-room-loading.html` for the UX mockup.

## Issue #118: bug: pill view still shows "Tally" instead of "SHOWTIME"
- PillView.tsx line 72 has "SHOWTIME" text but users still see "Tally" in some states
- This is likely a conditional rendering issue — the SHOWTIME label may only appear in certain phases
- Read `PillView.tsx` carefully and check ALL render paths for each phase (live, intermission, dark_studio, writers_room)
- Ensure the "SHOWTIME" label appears in EVERY phase, not just some
- The TallyLight component might be getting its accessible name exposed by macOS if there's no visible text

## Issue #119: feat: cache calendar events locally for instant skeleton lineup
- Create a new SQLite table `calendar_cache` to store calendar events
- Read cache on Writer's Room enter, render skeleton lineup instantly (<50ms)
- Background sync: after rendering skeleton, trigger Claude to fetch fresh calendar
- Update cache when fresh data arrives
- Schema: id, title, start_time, end_time, is_fixed, category, last_synced
- Files: create `src/main/data/calendar-cache.ts`, update `WritersRoomView.tsx`
- Add IPC handlers for cache read/write

## Issue #120: perf: pre-warm Claude subprocess during Dark Studio
- When app enters Dark Studio phase, spawn `claude -p` in background with `--input-format stream-json`
- Store the pre-warmed process in RunManager as a "warm pool" (size 1)
- When Writer's Room sends first message, reuse the warm process instead of spawning new
- Kill the warm process after 30s if unused
- Files: `src/main/claude/run-manager.ts` — add `preWarm()` and `getWarmProcess()` methods
- Trigger pre-warm from main process when phase changes to dark_studio

## Issue #121: ux: unify loading states — progressive messages during lineup generation
- Replace the dual loading states ("writers working" then "thinking") with a single progressive sequence
- Timed messages: 0-1s "Checking your calendar..." → 1-3s "The writers are reading your schedule..." → 3-5s "Drafting tonight's lineup..."
- Hide messages and show streaming lineup when first act arrives
- Use spring animation for message transitions (fadeInUp)
- Suppress Claude's native "thinking" indicator when custom loading is active
- Files: `WritersRoomView.tsx` and/or `ChatPanel.tsx`

## Testing Strategy
- Run `npm test` — all tests must pass
- For #118: verify "SHOWTIME" appears in pill view across ALL phases (take screenshots)
- For #119: unit test CalendarCache CRUD, E2E test skeleton render
- For #120: verify subprocess is pre-warmed by checking process list during Dark Studio
- For #121: E2E test that loading messages appear in sequence
- Close each issue with labels + structured comment

## Constraints
- Follow CLAUDE.md rules: no inline styles, Tailwind only
- Spring physics for all animations
- Do not break existing calendar sync functionality
- Pre-warm must be safe — handle edge cases (user skips Dark Studio, rapid phase changes)
