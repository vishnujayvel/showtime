# Sync Google Calendar Events into Showtime Acts

GitHub Issue: #36

## Why

Users often have meetings and calendar blocks that should become acts in their show.
Currently they have to manually re-enter everything. Showtime should pull today's
Google Calendar events and suggest them as acts during Writer's Room.

## What Exists

- Claude subprocess has Google Calendar MCP access (`gcal_list_events`)
- The warm-up subprocess (implemented in #36/commit 659a12a) pre-spawns Claude during energy selection
- `sessionStore.sendMessage()` sends prompts to Claude and gets structured responses
- WritersRoomView's `tryParseLineup()` parses `showtime-lineup` JSON blocks from Claude

## What to Build

### 1. Calendar-Aware Prompt

During Writer's Room lineup generation, modify the prompt to include calendar context:

```
Today is {date}. The user's energy level is {energy}.

First, check the user's Google Calendar for today's events using the gcal_list_events tool.
Then create a showtime-lineup that incorporates their calendar events as acts,
filling gaps with productive tasks appropriate for their energy level.

For calendar events:
- Meeting titles → act names
- Event duration → planned duration
- Categorize: meetings → "admin", focus blocks → "deep", exercise → "exercise",
  creative sessions → "creative", social/1:1 → "social"
- Gaps between events → suggest intermissions or flexible work time

Return the lineup as a showtime-lineup JSON block.
```

### 2. Calendar Import UI

Add a toggle/option in WritersRoomView during energy selection phase:

```
[  ] Import today's calendar events as acts
```

- Default: checked (opt-out, not opt-in)
- When checked: the lineup prompt includes calendar instruction
- When unchecked: standard prompt without calendar
- Small checkbox, font-body text-xs text-txt-secondary

### 3. Calendar Event Preview

After Claude generates the lineup, calendar-sourced acts are visually distinct:
- Small calendar icon (📅) next to act name for calendar-sourced acts
- The `sketch` field in the act JSON includes "(from calendar)" marker
- Tooltip or subtitle showing original calendar event time

### 4. Time-Aware Planning

Calendar events have real clock times. When acts come from calendar:
- Store `plannedStartAt` and `plannedEndAt` as Unix timestamps in the act
- The RundownBar can optionally show real times: "2:00 PM - Design Review (30m)"
- Gaps between calendar events become suggested intermissions

### 5. Smart Categorization via Claude

Claude categorizes based on event titles:
- "Sprint Planning", "Standup", "1:1 with..." → `admin`
- "Focus Time", "Deep Work", "No meetings" → `deep`
- "Gym", "Run", "Yoga" → `exercise`
- "Design session", "Brainstorm", "Sketch" → `creative`
- "Coffee with...", "Team lunch", "Happy hour" → `social`

Claude handles ambiguous cases using context.

## Dependencies

- Claude subprocess warm-up (already implemented)
- Google Calendar MCP must be configured in Claude Code settings
- WritersRoomView lineup generation flow (existing)

## Technology

- Claude subprocess with MCP tool access (existing)
- WritersRoomView prompt engineering (modify existing prompt)
- showStore act model already has `plannedStartAt` field
- No new external dependencies

## Testing Strategy

- E2E: Verify lineup generation with calendar toggle checked produces acts with calendar markers
- E2E: Verify calendar toggle unchecked produces standard lineup
- Unit: Test categorization mapping logic
- Note: E2E tests won't have real Google Calendar access — test the UI toggle and prompt construction

## Non-Goals

- No two-way sync (Showtime → Google Calendar)
- No calendar event creation from Showtime
- No recurring event handling (just today's events)
- No multi-calendar support (use default calendar)
- No offline/cached calendar data
