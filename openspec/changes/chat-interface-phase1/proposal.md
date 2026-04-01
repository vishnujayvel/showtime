# Proposal: Phase 1 — CLUI CC Chat Interface in Showtime (#80)

## Goal

Bring back the CLUI CC tab-based chat interface inside Showtime. A user opens the app and can freely chat with Claude — full markdown, streaming, tool use, permissions, everything. No lineup logic, no energy selection. Just a clean, fast chat that matches CLUI CC's speed exactly.

## CLUI CC Audit Reference

Source: `~/workplace/cluicc/src/renderer/`

### Components to replicate (in Tailwind, no inline styles)

| CLUI CC Component | Lines | What it does | Showtime approach |
|---|---|---|---|
| `ConversationView.tsx` | 925 | Message list: user bubbles, assistant markdown, tool timeline, permission cards, queued messages, activity footer | Replicate in Tailwind. Use `react-markdown` + `remark-gfm`. Group messages same way. |
| `InputBar.tsx` | 705 | Text input with auto-resize, send button, slash commands | Simplify: text input + send button. Skip voice, attachments, slash commands for Phase 1. |
| `PermissionCard.tsx` | 191 | Shows tool permission requests with Allow/Deny | Replicate — essential for tool use. |
| `PermissionDeniedCard.tsx` | 129 | Shows when tools are denied by permission mode | Replicate. |

### Components NOT needed for Phase 1

- `TabStrip.tsx` — single tab for now (Showtime already simplified to single tab)
- `MarketplacePanel.tsx` — no plugins
- `HistoryPicker.tsx` — no session resume UI
- `SettingsPopover.tsx` — settings can come later
- `AttachmentChips.tsx` — no file attachments
- `SlashCommandMenu.tsx` — no slash commands
- `StatusBar.tsx` — model picker, token display can come later

### Key architecture to match exactly

1. **Streaming via RAF batching** — CLUI CC batches `text_chunk` events per animation frame. Showtime must do the same for matching speed. The hook is `useClaudeEvents.ts`.

2. **Message types** — `{ id, role, content, toolName?, toolInput?, toolStatus?, timestamp }`

3. **Markdown rendering** — `react-markdown` v9 + `remark-gfm`. Custom renderers for `a` (openExternal), `img` (ImageCard with fallback), `table` (horizontal scroll wrapper).

4. **Tool timeline** — Collapsible cards showing tool name, input (truncated), status (running/completed/error). This is how CLUI CC shows Claude using tools.

5. **Permission flow** — Inline cards in conversation with Allow/Deny buttons. Queue indicator for multiple pending requests.

6. **Activity indicator** — "Writing...", "Running bash...", "Thinking..." with animated dots during `running` status.

7. **Auto-scroll** — Track if user is near bottom (< 60px). Auto-scroll on new content only if near bottom.

8. **Queued prompts** — When tab is `running`, new messages queue as dashed bubbles. Auto-sent when run completes.

## What Showtime already has (KEEP)

- `sessionStore.ts` — tab state, message array, sendMessage, handleNormalizedEvent. **This is 90% of CLUI CC's store already.**
- `ControlPlane` + `RunManager` + `EventNormalizer` — subprocess layer. **Identical to CLUI CC.**
- `useClaudeEvents` hook — **already exists in Showtime** if ported from CLUI CC. Check and verify.
- `preload/index.ts` — IPC bridge. **Already has the channels needed.**

## What Showtime needs to BUILD

1. **ChatView.tsx** — New view replacing WritersRoomView for Phase 1. Renders:
   - Message list (user + assistant + tool groups)
   - Markdown assistant messages
   - Tool timeline (collapsible)
   - Permission cards
   - Activity indicator
   - Auto-scroll behavior

2. **ChatInput.tsx** — Simple text input + send button. Auto-resize textarea clamped 20px-140px.

3. **PermissionCard.tsx** — Allow/Deny inline card.

4. **Markdown custom renderers** — Links open external, images with fallback, table scroll wrapper.

## Routing

In Phase 1, the app flow is:
- Dark Studio → click CTA → ChatView (replaces WritersRoomView)
- No energy selection, no plan input, no lineup
- Just a chat with Claude

WritersRoomView stays in the codebase but is not rendered. ChatView is the new default for `writers_room` phase.

## Performance Target

**Must match CLUI CC speed.** Same subprocess layer, same streaming, same RAF batching. If Showtime chat is slower than CLUI CC, investigate why.

## Testing Strategy

1. App launches, shows Dark Studio
2. Click CTA → ChatView appears with input bar
3. Type message, press Enter → message appears, Claude responds with streaming markdown
4. Claude uses a tool → tool timeline appears with running/completed status
5. Permission request → card appears with Allow/Deny
6. Send message while Claude is running → queued bubble appears
7. Compare latency: first token time should match CLUI CC (< 2s for sonnet)

## Files to create/modify

| File | Action |
|------|--------|
| `src/renderer/views/ChatView.tsx` | CREATE — main chat view |
| `src/renderer/components/ChatInput.tsx` | CREATE — simple input bar |
| `src/renderer/components/ChatMessage.tsx` | CREATE — message rendering (user/assistant/tool) |
| `src/renderer/components/PermissionCard.tsx` | CREATE — permission request card |
| `src/renderer/App.tsx` | MODIFY — route to ChatView instead of WritersRoomView |
| `src/renderer/stores/sessionStore.ts` | VERIFY — ensure all CLUI CC event handlers are present |

## Dependencies to add

- `react-markdown` (if not already present)
- `remark-gfm` (if not already present)

## IMPORTANT: Styling rules

- ALL Tailwind, NO inline styles (CLAUDE.md rule #1)
- Use shadcn/ui Button, Dialog, Card where applicable
- Spring physics only for animations (Framer Motion)
- Match the dark theme: `bg-studio-bg`, `bg-surface`, `text-txt-primary`
