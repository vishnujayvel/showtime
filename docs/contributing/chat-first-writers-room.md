# Chat-First Writer's Room

The Writer's Room is a unified chat interface where the user plans their day by talking to Claude. This page documents the architecture for contributors.

## How It Works

The old Writer's Room had three discrete steps (Energy Check, Plan Dump, Lineup Preview) as separate UI panels. The current implementation replaces all of that with a single chat conversation.

```
User opens Writer's Room
  └─ Chat is empty. Prompt: "What do you want to accomplish today?"
  └─ Energy chip in title bar (defaults to Medium, tap to change)

User types a brain dump and sends it
  └─ Message appears in chat
  └─ User clicks BUILD MY LINEUP
  └─ sendMessage() sends a structured prompt to Claude (hidden from chat)
  └─ "Building your lineup..." placeholder shown while streaming

Claude responds with a ```showtime-lineup JSON block
  └─ tryParseLineup() detects the lineup in the response
  └─ ChatMessage renders it as an interactive LineupCard (no raw JSON shown)
  └─ setLineup() stores acts via XState machine (showStore bridge)

User refines via follow-up messages
  └─ buildRefinementPrompt() wraps user text with current lineup context
  └─ sendMessage(prompt, undefined, displayText) sends full prompt but shows only user's text
  └─ Claude responds with updated lineup → re-parsed → LineupCard updates

User clicks WE'RE LIVE!
  └─ triggerGoingLive() → GoingLiveTransition → ON AIR
```

## Key Source Files

| File | Purpose |
|------|---------|
| `src/renderer/views/WritersRoomView.tsx` | The view component — chat UI, energy picker, action buttons |
| `src/renderer/components/ChatMessage.tsx` | Renders messages; detects lineup JSON and renders LineupCard |
| `src/renderer/components/LineupCard.tsx` | Interactive lineup editor (inline edit name/duration/category) |
| `src/renderer/lib/lineup-parser.ts` | Parses `showtime-lineup` JSON blocks from Claude responses |
| `src/renderer/lib/refinement-prompt.ts` | Builds the hidden refinement prompt with current lineup context |
| `src/renderer/stores/sessionStore.ts` | Manages Claude subprocess, tabs, messages |
| `src/renderer/machines/showMachine.ts` | XState v5 phase machine — source of truth for acts, energy, phase |
| `src/renderer/stores/showStore.ts` | Zustand bridge — backward-compatible API, delegates to XState |

## The Three-Argument sendMessage Pattern

When the user refines a lineup, we need to send Claude a detailed prompt (including the full current lineup as JSON) but only show the user's short message in the chat.

```ts
// sendMessage(actualPrompt, undefined, displayText)
sendMessage(prompt, undefined, trimmed)
```

- **`prompt`** — The full refinement prompt sent to Claude (includes current acts, energy level, instructions)
- **`undefined`** — Reserved parameter (unused)
- **`trimmed`** — The text shown in the chat as the user's message

This separation prevents system prompts from cluttering the conversation.

## Lineup Detection in Chat Messages

`ChatMessage.tsx` uses `splitLineupFromContent()` to extract lineup JSON from assistant messages before rendering:

1. **Fenced block** — Looks for ` ```showtime-lineup ` or ` ```json ` blocks containing `acts` array
2. **Bare JSON fallback** — Uses `tryParseLineup()` for JSON without fences
3. **Partial streaming** — Detects incomplete lineup JSON and shows "Building your lineup..." placeholder

The text before and after the JSON block is rendered as Markdown. The JSON itself is replaced with an interactive `LineupCard`.

## LineupCard Editing

The `LineupCard` component renders the parsed lineup and supports inline editing:

- **Act name** — Click to edit in place, Enter to commit, Escape to cancel
- **Duration** — Click the `45m` label to edit, type a number
- **Category** — Click the category badge to open a `CategoryPicker` dropdown
- **Add Act** — Button at the bottom adds a new default act
- **Remove Act** — Hover over a row to reveal the × button

All edits call `onEdit(updatedLineup)` which flows back to `showStore.setLineup()` (which delegates to the XState machine via `SET_LINEUP` event).

## Calendar Integration

Calendar events are **not** pre-fetched by the app. Claude accesses calendar data directly via MCP tools when the user asks. The `CalendarToggle` component existed for the old prefetch flow and is currently hidden.

If calendar events are available (user enabled + events fetched), they are included in the `handleBuildLineup()` prompt for Claude to incorporate into the lineup.
