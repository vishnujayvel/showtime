# Writer's Room State Machine

## Terminology Bridge

This doc uses UX-level names. Here's how they map to XState machine states (`showMachine.ts`):

| UX Name | XState State Path | Phase |
|---------|-------------------|-------|
| DARK_STUDIO | `phase.no_show` | `no_show` |
| WRITERS_ROOM_INIT | `phase.writers_room.energy` | `writers_room` |
| SKELETON_LINEUP | `phase.writers_room.plan` | `writers_room` |
| WRITERS_WORKING | `phase.writers_room.plan` (Claude streaming) | `writers_room` |
| CLAUDE_STREAMING | `phase.writers_room.plan` (lineup parsing) | `writers_room` |
| LINEUP_READY | `phase.writers_room.lineup_ready` | `writers_room` |
| GOING_LIVE | `phase.going_live` | `going_live` |
| ON_AIR | `phase.live` | `live` |

The XState machine groups SKELETON_LINEUP, WRITERS_WORKING, and CLAUDE_STREAMING into a single `plan` substate — the UX distinctions exist in component rendering logic, not in the state machine.

## States

```text
DARK_STUDIO
  → [user clicks "Enter the Writer's Room"]

WRITERS_ROOM_INIT
  → [read calendar cache from SQLite, <50ms]

SKELETON_LINEUP
  - Cached calendar events rendered instantly
  - Fixed events shown with category colors
  - Gaps marked with dashed placeholders
  - Status: "Checking your calendar..."
  → [Claude subprocess connects, first NDJSON event]

WRITERS_WORKING
  - Progressive messages: "The writers are reading your schedule..."
  - Fixed events already colored
  - Gap slots shimmer while Claude fills them
  - Generated acts appear one by one
  → [all acts generated, showtime-lineup JSON parsed]

CLAUDE_STREAMING
  - Acts sliding in with staggered animations
  - Opening note visible
  - DRAFT badge on lineup card
  - Last slot still loading
  → [lineup JSON complete]

LINEUP_READY
  - All acts rendered with full colors
  - READY badge (green)
  - Acts hoverable/clickable for editing
  - "+ Add an Act" button
  - Chat input for refinement
  - "Finalize Lineup" CTA
  → [user clicks "Finalize Lineup" / "Go Live"]

GOING_LIVE
  - Transition animation
  → ON_AIR
```

## Error States

```text
SKELETON_LINEUP
  → [Claude subprocess fails to boot after 10s]
CLAUDE_ERROR
  - Show cached lineup as-is with "Go with cached lineup?" option
  - Retry button
  → [retry] WRITERS_ROOM_INIT
  → [go with cache] LINEUP_READY (with cached data only)

WRITERS_WORKING
  → [Claude stream disconnects mid-generation]
PARTIAL_LINEUP
  - Show what we have so far
  - "Some acts are missing — continue anyway?"
  → [continue] LINEUP_READY (partial)
  → [retry] WRITERS_WORKING

SKELETON_LINEUP
  → [cache is empty, no calendar events]
EMPTY_STATE
  - "No cached events — tell me about your day"
  - Chat input focused
  → [user sends message] WRITERS_WORKING
```

## Timing Targets

| Transition | Target | Notes |
|------------|--------|-------|
| Init → Skeleton | < 50ms | SQLite read only |
| Skeleton → Writers Working | 600ms - 2s | Subprocess boot time |
| Writers Working → Streaming | 1-3s | Claude processes prompt |
| Streaming → Ready | 3-8s | Depends on act count |
| Total: Init → Ready | < 10s | With pre-warm: < 5s |

## Pre-warm Optimization (#120)

With subprocess pre-warming during Dark Studio:

```text
DARK_STUDIO (subprocess booting in background)
  → WRITERS_ROOM_INIT
  → SKELETON_LINEUP (cached events)
  → WRITERS_WORKING (subprocess already warm, <100ms)
  → ...rest same
```

Expected total: Init → Ready in < 5s (vs < 10s without pre-warm)

## Mockup Reference

Interactive mockup: `docs/mockups/writers-room-loading.html`
Click tabs to see each state.
