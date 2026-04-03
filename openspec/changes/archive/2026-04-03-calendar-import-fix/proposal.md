# Fix Calendar Event Import — Graceful Fallback + MCP Detection (#55)

GitHub Issue: #55

## Why

Calendar event import fails silently when Claude can't access Google Calendar MCP tools. The entire lineup generation breaks instead of falling back to text-only mode. The user sees "Claude couldn't generate a lineup" with no indication that the calendar part is what failed.

## Root Cause

The prompt tells Claude "check the user's Google Calendar using your calendar tools" but provides no fallback instruction. When the MCP tool call fails:
1. Claude's response contains error text + partial JSON
2. `tryParseLineup()` can't extract a valid `showtime-lineup` block
3. The app shows a generic error

## What Changes

### Fix 1: Prompt Fallback (WritersRoomView.tsx)

Update the calendar instruction block to include an explicit fallback:

```
IMPORTANT: First, try to check the user's Google Calendar for today's events using your calendar tools.
If the calendar tool is unavailable, fails, or returns an error:
- DO NOT mention the failure to the user
- Generate the lineup from the user's text input only
- This is normal — not all setups have calendar access

If calendar events are found: incorporate them as acts...
```

This makes Claude gracefully degrade instead of producing unparseable output.

### Fix 2: Lineup Parser Resilience (lineup-parser.ts)

The parser uses regex to find `` ```showtime-lineup ... ``` `` blocks. When Claude outputs tool calls interleaved with the lineup, the regex fails. Fix:

1. Strip tool call blocks from Claude's response before parsing
2. Try parsing from the last `showtime-lineup` block (not the first) — Claude may retry after a tool failure
3. If no `showtime-lineup` block found, try parsing any JSON object with `acts` array as a fallback

### Fix 3: Runtime MCP Check (sessionStore.ts)

Current detection happens once at session init via `event.tools` substring matching. Improve:

1. Add a lightweight "probe" — on Writer's Room mount, send a quick message asking Claude to list available tools
2. If no calendar tool in response, set `calendarAvailable = false` and disable the checkbox
3. Cache the result for the session (don't probe every time)

### Fix 4: Better Error Messages (WritersRoomView.tsx)

Instead of generic "Claude couldn't generate a lineup", show context:
- If calendar was enabled: "Lineup generation failed. Try unchecking 'Import calendar events' and trying again."
- If calendar was not enabled: "Claude couldn't generate a lineup. Try again?"
- Add a "Generate without calendar" quick action button on failure

### Fix 5: Timeout Handling

The Writer's Room has a timeout for Claude responses. When calendar tool calls are involved, they add 3-10 seconds. Either:
- Increase timeout when calendar is enabled (from 30s to 60s)
- Or add a "Still working..." indicator after 15s

## Testing Strategy

1. **Unit test**: `tryParseLineup()` handles tool call output mixed with lineup JSON
2. **Unit test**: Prompt includes fallback instruction when calendar enabled
3. **E2E test**: Build lineup with calendar checkbox checked (mock Claude response with calendar events)
4. **E2E test**: Build lineup fails gracefully when calendar is unavailable
5. **Manual test**: Actually test with Google Calendar MCP configured

## Key Files

| File | Change |
|------|--------|
| `src/renderer/views/WritersRoomView.tsx` | Prompt fallback, better error messages, timeout adjustment |
| `src/renderer/lib/lineup-parser.ts` | Strip tool calls, fallback JSON parsing |
| `src/renderer/stores/sessionStore.ts` | Runtime MCP probe on Writer's Room mount |
| `src/renderer/components/CalendarToggle.tsx` | Disable with tooltip when MCP unavailable |
| `e2e/writers-room.test.ts` | Calendar fallback E2E test |

## IMPORTANT RULES (from CLAUDE.md)
- No inline styles — Tailwind only
- Feature branch + PR workflow
- E2E test coverage required
- CodeRabbit reviews before merge
