# Proposal: Chat-First UI with Rich Lineup Card (#80)

## Problem

The current Writer's Room has a rigid step machine (energy → plan → auto-build → lineup). This causes:
- MCP tool conflicts (Claude tries to use calendar, gets blocked)
- Raw JSON blobs in chat (#73)
- Brittle multi-turn prompts
- Go Live button issues (#74)

## Solution

Replace the step machine with a **free-form chat** backed by Claude. When Claude outputs a `showtime-lineup` code block, render it as an **editable LineupCard** component instead of raw text.

## What to Build

### 1. Install dependencies

```bash
npm install react-markdown remark-gfm
```

### 2. ChatMessage component (`src/renderer/components/ChatMessage.tsx`)

Renders a single message (user or assistant). For assistant messages, uses `react-markdown` with custom `components` prop:

```tsx
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// Custom code block renderer
const components = {
  code: ({ className, children }) => {
    // Intercept showtime-lineup blocks
    if (className === 'language-showtime-lineup') {
      const json = JSON.parse(String(children))
      return <LineupCard lineup={json} onEdit={handleEdit} />
    }
    // Default code rendering
    return <pre className="bg-studio-bg rounded-lg p-3 overflow-x-auto text-sm"><code>{children}</code></pre>
  },
  a: ({ href, children }) => (
    <button onClick={() => window.clui.openExternal(href)} className="text-accent underline">
      {children}
    </button>
  ),
}

<ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
  {message.content}
</ReactMarkdown>
```

### 3. LineupCard component (`src/renderer/components/LineupCard.tsx`)

Inline editable card matching the v3 mockup (Screen 3-4):

- Act rows with: number, category badge (color-coded), name, duration, calendar marker
- **Tap name to edit inline** (contentEditable or input field)
- **Tap duration to edit** (number input with "m" suffix)
- **Tap category to change** (dropdown: Deep Work, Exercise, Admin, Creative, Social)
- "＋ Add Act" button at bottom
- Opening note in italics
- Header: "TODAY'S LINEUP" + DRAFT/READY badge

When any field is edited, call `showStore.setLineup()` with the updated data.

All Tailwind classes. No inline styles. Use shadcn/ui Button, Popover for category picker.

### 4. Rewrite WritersRoomView (`src/renderer/views/WritersRoomView.tsx`)

**Remove:** energy step, plan step, step machine state, handleBuildLineup structured prompt, handleRefinement structured prompt.

**Replace with:**
- A chat message list rendering `ChatMessage` for each message in `tab.messages`
- Auto-scroll behavior (scroll to bottom when near bottom, < 60px threshold)
- Activity indicator ("Writing...", "Thinking...") when tab status is `running`

**Footer:**
- Chat input (text area + send button) — always visible
- "BUILD MY LINEUP" button (dashed border) — visible when no lineup exists yet. Sends a prompt like: "Based on our conversation, create a show lineup. Respond with a ```showtime-lineup JSON block with acts (name, sketch category, durationMinutes), beatThreshold, and openingNote."
- "WE'RE LIVE!" button — visible when lineup exists (hasLineup === true)

**Energy:** Show as a small chip at the top of the chat. User can tap to change. Energy level is passed in the "BUILD MY LINEUP" prompt.

### 5. Message rendering for different types

| Message role | Rendering |
|---|---|
| `user` | Right-aligned bubble, surface-hover background |
| `assistant` | Left-aligned, ReactMarkdown with custom components |
| `tool` | Compact indicator: icon + tool name + status (✓ or spinner) |
| `system` | Centered italic muted text |

Tool messages are already in `tab.messages` from the EventNormalizer. We just need to render them.

### 6. What stays the same

- `sessionStore.ts` — sendMessage, tab management, event handling (KEEP AS-IS)
- `ControlPlane` + `RunManager` — subprocess layer (KEEP AS-IS)
- `showStore.ts` — lineup state, goingLive, startShow (KEEP AS-IS)
- `lineup-parser.ts` — tryParseLineup (KEEP — used by LineupCard for initial parse)
- GoingLiveTransition, ExpandedView, PillView, BeatCheck, Intermission, Strike (ALL UNCHANGED)

## Non-Goals

- No tab strip (single tab, same as current)
- No attachment UI (Phase 2+)
- No slash command menu (Phase 2+)
- No session history resume UI (Phase 2+)
- No tool timeline collapse/expand (just show compact indicators for now)

## Testing Strategy

1. **Unit test:** LineupCard renders acts, edits name/duration/category
2. **Unit test:** ChatMessage renders markdown, intercepts showtime-lineup blocks
3. **E2E test:** Type message → Claude responds with markdown → verify rendering
4. **E2E test:** Claude generates lineup → LineupCard appears → edit act name → verify store updated
5. **Manual test:** Full flow — chat with Claude, ask about calendar, build lineup, edit acts, go live

## Performance

Must match CLUI CC speed. Same subprocess, same streaming. The only new overhead is react-markdown parsing, which is negligible (< 1ms per message).

## Reference Files

- Mockup: `docs/mockups/v3-chat-first-flow.html` (Screens 2-4)
- CLUI CC ConversationView: `~/workplace/cluicc/src/renderer/components/ConversationView.tsx`
- CLUI CC InputBar: `~/workplace/cluicc/src/renderer/components/InputBar.tsx`
- Current WritersRoomView: `src/renderer/views/WritersRoomView.tsx`
- Current sessionStore: `src/renderer/stores/sessionStore.ts`
