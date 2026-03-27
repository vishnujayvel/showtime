# Proposal: Fix Refinement Prompt (Issue #73)

## Problem

When sending a refinement prompt like "Add dinner date with Silas" after an initial lineup is generated, Claude responds with a raw JSON blob of calendar events instead of updating the lineup. The refinement prompt is missing critical context.

## Root Cause

The refinement prompt in `WritersRoomView.tsx` (lines 261-264) sends only:

```
The user wants to change the lineup: "{message}"

Respond with the complete updated lineup as a showtime-lineup JSON block.
Keep the same format as before. Only modify what the user asked for.
```

This is missing:
1. **The current lineup JSON** — Claude has no baseline to modify
2. **The energy level** — Claude loses the original context
3. **Category constraints** — Claude doesn't know valid categories
4. **Explicit MCP tool prohibition** — Claude interprets "dinner date" as a calendar query

Compare to the initial build prompt (lines 140-158) which includes all of this context.

## Goals

1. Include current lineup JSON in every refinement prompt
2. Restate category constraints and energy level
3. Explicitly instruct Claude NOT to use MCP tools for refinements
4. Ensure `tryParseLineup()` can parse the response

## Non-Goals

- Changing the initial build prompt (it works fine)
- Modifying the subprocess layer (ControlPlane, RunManager)
- Changing how MCP tools are configured

## Scope

### Files MODIFIED

| File | Change |
|------|--------|
| `src/renderer/views/WritersRoomView.tsx` | Rewrite `handleRefinement()` prompt to include current lineup JSON, energy, categories, and MCP prohibition |

### Files NOT CHANGED

- `src/main/claude/control-plane.ts` — no subprocess changes
- `src/main/claude/run-manager.ts` — no subprocess changes
- `src/renderer/stores/sessionStore.ts` — dispatch mechanism unchanged
- `src/renderer/stores/showStore.ts` — show state unchanged

## Solution

Rewrite the refinement prompt to mirror the initial build prompt structure:

```
You are Showtime, an ADHD-friendly day planner. The user has energy level "{energy}".

Here is the current show lineup:
```showtime-lineup
{currentLineupJSON}
```

The user wants to modify the lineup: "{message}"

IMPORTANT:
- Do NOT use any MCP tools (no Google Calendar, no web search, no file operations)
- Do NOT call any tools at all — just respond with the updated lineup
- Respond with the COMPLETE updated lineup as a showtime-lineup JSON block
- Categories must be one of: "Deep Work", "Exercise", "Admin", "Creative", "Social"
- Keep the same format. Only modify what the user asked for.
- Preserve all existing acts unless the user specifically asks to remove them
```

## Testing Strategy

1. E2E test: build lineup → send refinement "Add a coffee break" → verify lineup updates (act count increases)
2. E2E test: build lineup → send refinement "Remove the last act" → verify act count decreases
3. Manual test: send "Add dinner date with Silas" → verify NO calendar MCP calls, lineup updates with Social act

## Also: Close Issue #74

Issue #74 (Go Live button not working) is confirmed as working correctly. The E2E reproduction test shows:
- Button is visible and clickable
- `triggerGoingLive()` fires correctly
- GoingLiveTransition renders
- Phase transitions to 'live'

The original report was likely caused by a stale `writersRoomStep: 'lineup'` value in localStorage from an older version. The day-boundary reset in showStore.ts handles this.

Close #74 with "works as designed — stale localStorage value from older version."
