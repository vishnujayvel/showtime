# Pre-fetch Calendar Events on App Launch (#58)

GitHub Issue: #58

## Why

Calendar event import currently delegates to Claude mid-lineup-generation via MCP tool calls. This is slow (3-10s tool call latency) and fragile (tool failures crash the entire lineup). The fix in #55 added fallback handling, but the root problem remains: fetching data during lineup generation is the wrong time.

## What Changes

### 1. Pre-fetch on Writer's Room Entry

When the user enters the Writer's Room (phase transitions to `writers_room`), fire a background Claude message to fetch today's calendar events:

```typescript
// In sessionStore or a new calendarStore
async function prefetchCalendarEvents(tabId: string) {
  // Send a focused message to the existing Claude session
  const prompt = `List all of today's Google Calendar events as a JSON array.
  Each event: {"title": "...", "start": "HH:MM", "end": "HH:MM", "allDay": boolean}.
  If no calendar access or no events, return: []
  Return ONLY the JSON array, nothing else.`

  // Parse response, cache in Zustand
  setCalendarEvents(parsed)
  setCalendarFetchStatus('ready') // or 'unavailable' or 'fetching'
}
```

Trigger this when:
- Phase transitions to `writers_room` (primary trigger)
- App launches and a Claude session is available (opportunistic)
- User manually clicks a "Refresh" button on the calendar toggle

### 2. Cache in Zustand Store

Add to `showStore` or a new `calendarStore`:

```typescript
calendarEvents: CalendarEvent[]       // cached events
calendarFetchStatus: 'idle' | 'fetching' | 'ready' | 'unavailable' | 'error'
calendarFetchedAt: number | null      // timestamp of last fetch
```

Events are valid for the current day. If the date changes (midnight crossing), clear the cache.

### 3. Inject Cached Data into Lineup Prompt

Replace the current "use your calendar tools" instruction with direct data injection:

```typescript
// In WritersRoomView.tsx buildLineup function
const events = useShowStore.getState().calendarEvents

if (calendarEnabled && events.length > 0) {
  calendarBlock = `
Here are today's calendar events (already fetched):
${JSON.stringify(events, null, 2)}
Incorporate these as acts in the lineup. Use event title as act name,
event duration for planned duration. Categorize appropriately.
Add "(from calendar)" to the sketch field for calendar-sourced acts.
Fill remaining time with tasks from the user's text input.`
}
```

No MCP tool call during lineup generation. Claude just reads the data.

### 4. Calendar Toggle Status UI

Update `CalendarToggle.tsx` to show fetch status:
- Fetching: "Checking calendar..." with a subtle spinner
- Ready with events: "3 events today" (clickable to see list)
- Ready with no events: "No events today"
- Unavailable: "Calendar not available" (checkbox disabled, tooltip explains)
- Error: "Couldn't reach calendar" (checkbox disabled)

### 5. Background Fetch Lifecycle

```
App launches → Claude session initializes → detect MCP tools (existing logic)
  ↓
Phase → writers_room → prefetchCalendarEvents()
  ↓
calendarFetchStatus = 'fetching' (toggle shows spinner)
  ↓
Claude responds with JSON → parse → cache in Zustand
  ↓
calendarFetchStatus = 'ready' (toggle shows "3 events today")
  ↓
User clicks "Build my lineup" → inject cached events into prompt
  ↓
No tool call needed. Fast. Reliable.
```

If the fetch fails:
- Set status to 'unavailable'
- Disable checkbox with tooltip: "Calendar access not available in this Claude session"
- Lineup generation works fine without calendar — no degradation

## Files to Modify

| File | Change |
|------|--------|
| `src/renderer/stores/showStore.ts` | Add calendarEvents, calendarFetchStatus, prefetchCalendarEvents() |
| `src/renderer/views/WritersRoomView.tsx` | Trigger prefetch on mount, inject cached events into prompt (replace MCP instruction) |
| `src/renderer/components/CalendarToggle.tsx` | Show fetch status (spinner, event count, unavailable) |
| `src/renderer/stores/sessionStore.ts` | Expose method to send a background message to Claude |
| `src/__tests__/calendarPrefetch.test.ts` | Unit tests for fetch, cache, status transitions |
| `e2e/writers-room.test.ts` | E2E test for calendar prefetch flow |

## Testing Strategy

1. **Unit test**: prefetchCalendarEvents parses valid JSON, handles empty array, handles errors
2. **Unit test**: Status transitions: idle → fetching → ready/unavailable
3. **Unit test**: Cache invalidation on date change
4. **E2E test**: Writer's Room mount triggers calendar fetch (mock Claude response)
5. **E2E test**: Lineup generation with cached events uses direct injection, not MCP

## IMPORTANT RULES (from CLAUDE.md)
- No inline styles — Tailwind only
- Feature branch + PR workflow
- CodeRabbit reviews before merge
- Spring physics for animations (spinner, status transitions)
