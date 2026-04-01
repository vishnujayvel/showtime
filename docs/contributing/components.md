# Key Components

A reference guide to the most important UI components in Showtime. All components live in `src/renderer/components/`.

## Chat Components

### ChatMessage

**File:** `ChatMessage.tsx`

Renders a single message in the Writer's Room chat. Dispatches to sub-components based on `message.role`:

| Role | Renders | Description |
|------|---------|-------------|
| `user` | `UserBubble` | Right-aligned bubble with user's text |
| `assistant` | `AssistantBubble` | Left-aligned with Markdown + lineup detection |
| `assistant` (with `toolName`) | `ToolIndicator` | Spinner or checkmark with tool name |
| `tool` | `ToolIndicator` | Same as above |
| `system` | `SystemMessage` | Centered italic text |

**Lineup detection:** `AssistantBubble` calls `splitLineupFromContent()` to extract JSON from the response. Text before and after renders as Markdown; the JSON block renders as a `LineupCard`. While a lineup is still streaming, a "Building your lineup..." placeholder is shown.

### LineupCard

**File:** `LineupCard.tsx`

Interactive lineup editor that renders inside chat messages. Displays acts in a card with a "TODAY'S LINEUP" header, total duration, and act count.

**Props:**
- `lineup: ShowLineup` — The lineup data (acts, beatThreshold, openingNote)
- `onEdit: (updated: ShowLineup) => void` — Called on any edit

**Editable fields per act (via `ActRow`):**
- **Name** — Click to edit inline, Enter to commit, Escape to cancel
- **Duration** — Click the `45m` label to type a new number
- **Category** — Click the badge to open `CategoryPicker` dropdown

**Actions:**
- **Add Act** — "+" button at the bottom adds a default act
- **Remove Act** — "×" button appears on row hover

## Show Components

### TallyLight

**File:** `TallyLight.tsx`

The red pulsing dot that confirms the show is live. Used in PillView and sidebar.

**Props:**
- `isLive: boolean` — Pulsing red when live, dark when off
- `size?: 'sm' | 'lg'` — 8px or 10px dot

### BeatCounter

**File:** `BeatCounter.tsx`

Row of gold stars (locked beats) and gray stars (empty slots).

**Props:**
- `size?: 'sm' | 'md'` — Small for pill/compact, medium for expanded

### BeatCheckModal

**File:** `BeatCheckModal.tsx`

Spotlight modal that appears after each Act: "Did you have a moment of presence?" User can lock or skip the beat. Renders globally in `App.tsx`, triggered by the `beatCheckPending` state in the XState show machine.

### OnAirIndicator

**File:** `OnAirIndicator.tsx`

Red bordered box with "ON AIR" text in JetBrains Mono. Pulsing glow animation when live, dark gray when off. Used in ExpandedView and DashboardView.

### MiniRundownStrip

**File:** `MiniRundownStrip.tsx`

Horizontal timeline bar shown below the main PillView content. Each act is a colored segment proportional to its duration. A red marker tracks the current position in real time.

- Only renders during `live` and `intermission` phases
- Colors match act categories (Deep Work = purple, Exercise = green, etc.)
- Active act has full opacity + subtle glow; completed acts are slightly dimmed; upcoming acts are faded

### ActCard

**File:** `ActCard.tsx`

Individual act display in the lineup sidebar (ExpandedView, DashboardView). Shows:
- Clapperboard badge with category + act number
- Act name
- Duration
- Status indicator (active, completed, upcoming, skipped)
- Beat star (locked or empty)

### DirectorMode

**File:** `DirectorMode.tsx`

Modal with four compassionate options when the user is overwhelmed:
1. Skip to next Act
2. Take a longer break
3. Five-minute breathing exercise
4. Call the show early

None of these is presented as failure — they're production decisions.

## Utility Components

### CalendarToggle

**File:** `CalendarToggle.tsx`

Checkbox to enable/disable calendar event inclusion in lineup planning. Currently hidden in the chat-first UI — Claude handles calendar via MCP tools directly.

### CalendarBanner

**File:** `CalendarBanner.tsx`

Informational banner suggesting the user add Google Calendar MCP to their Claude Code settings. Shown when calendar is not available.

### HelpDialog

**File:** `HelpDialog.tsx`

Help overlay with keyboard shortcuts and quick reference. Triggered by the "?" button on Dark Studio.
