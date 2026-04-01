# Chat-First Writer's Room (#60)

GitHub Issue: #60

## Why

The Writer's Room has a split personality. During initial lineup generation, the user sees a loading spinner and gets generic error messages. During lineup refinement, they see a rich chat with Claude where they can refine the lineup conversationally. These should be the same experience.

Claude is "The Writer" in the room. The user is the Head Writer. The entire Writer's Room — from plan dump to "We're live" — should be a single continuous conversation.

## What Changes

### The Core Change: One Conversation Thread

Replace the current three disconnected steps (plan → loading → lineup) with a single conversation that evolves:

**Current flow:**
```
Energy → Plan textarea → [LOADING SPINNER] → Lineup preview OR error
                                                  ↓
                                             Chat refinement
```

**New flow:**
```
Energy → Plan textarea + "Build my lineup" → Chat shows Claude's response
                                               ↓
                                          Lineup auto-extracted when detected
                                               ↓
                                          Same chat continues for refinement
                                               ↓
                                          "We're live!"
```

The plan step doesn't disappear — it merges into the conversation. After the user types their plan and hits "Build my lineup", the plan text becomes the first user message in the chat. Claude's response appears as a writer message. If it contains a valid lineup, the lineup preview appears alongside the chat. If it doesn't, the user sees what Claude said and can respond.

### UI Layout

**Plan Step (before "Build my lineup"):**
- Energy selector at top (unchanged)
- Calendar toggle (unchanged)
- Plan text area (unchanged)
- "Build my lineup" button (unchanged)

**Conversation Step (after "Build my lineup"):**
- Top: compact energy badge + calendar status
- Middle: conversation thread (scrollable)
  - User's plan dump as first message
  - Claude's response(s) as writer bubbles
  - User's follow-ups
- Right/below: lineup preview card (appears when lineup is detected in any message)
- Bottom: chat input (same as current LineupChatInput)
- Bottom-right: "We're live!" button (appears once lineup is previewed)

The conversation and lineup preview coexist. The lineup updates live as Claude refines it. The chat stays visible even after the lineup appears.

### Conversation State

Merge `refinementConversations` and the initial generation into one array:

```typescript
// In WritersRoomView
const [writerConversations, setWriterConversations] = useState<Conversation[]>([])

// When user clicks "Build my lineup":
setWriterConversations([{ role: 'user', text: planText }])
sendMessage(buildPrompt(planText, energy, calendarEvents))
setWritersRoomStep('conversation') // new step name

// When Claude responds:
// - Add to writerConversations as 'writer' message
// - If tryParseLineup succeeds, also update lineup state
// - Chat stays visible either way

// When user types in chat:
setWriterConversations(prev => [...prev, { role: 'user', text: message }])
sendMessage(refinementPrompt(message))
```

### What Happens at Each Conversation Turn

Every time Claude responds:
1. Add the response text to `writerConversations` as a 'writer' message
2. Run `tryParseLineup()` on the response
3. If a lineup is found → update `lineup` state → show lineup preview card
4. If no lineup → that's fine, user sees what Claude said and can respond
5. If Claude asked a question → user answers in the chat

The lineup preview appears/updates whenever a valid lineup exists. It doesn't require a separate "step".

### Writer's Room Steps (Simplified)

| Current | New |
|---------|-----|
| `energy` | `energy` (unchanged) |
| `plan` | `plan` (unchanged — textarea + button) |
| `lineup` (separate step) | `conversation` (chat + lineup preview coexist) |

The `lineup` step is absorbed into `conversation`. The LineupPanel renders when `lineup !== null`, alongside the chat.

### Calendar Integration

Calendar events are pre-fetched (PR #59). When the user hits "Build my lineup" with calendar enabled, the cached events are injected into the prompt as data. If Claude says "I see 3 calendar events today, I've added them as acts" — the user sees this in the chat. If Claude says "no calendar events found" — the user sees this too and can respond.

### Error Elimination

No more generic "couldn't generate a lineup" errors. Every possible outcome is visible in the chat:
- Claude responds with lineup → lineup preview appears
- Claude asks a question → user answers
- Claude says "I can't access calendar" → user responds "skip it"
- Claude responds with non-JSON → user says "format it as showtime-lineup JSON"
- Claude subprocess fails → show "The writer stepped out. Try again?" with retry

### Multi-Turn Dialog Mockup

Reference: `docs/mockups/multi-turn-dialog.html` — already has the visual design for this exact flow.

## Files to Modify

| File | Change |
|------|--------|
| `src/renderer/views/WritersRoomView.tsx` | Merge plan/lineup steps into conversation flow, unified conversation state |
| `src/renderer/components/LineupChatInput.tsx` | Minor: update placeholder text per conversation stage |
| `src/renderer/stores/showStore.ts` | Add 'conversation' step to writersRoomStep type |
| `src/shared/types.ts` | Update WritersRoomStep type |
| `e2e/writers-room.test.ts` | Update tests for conversation-based flow |

## Testing Strategy

1. **E2E**: Build lineup → verify chat shows Claude's response + lineup preview
2. **E2E**: Claude asks clarifying question → user responds → lineup generated
3. **E2E**: Lineup refinement via chat → lineup preview updates
4. **Unit**: Conversation state management (add messages, detect lineup)
5. **Manual**: Test with actual Claude subprocess — verify MCP tools, calendar, multi-turn

## IMPORTANT RULES (from CLAUDE.md)
- No inline styles — Tailwind only
- Spring physics for all animations
- Feature branch + PR workflow
- CodeRabbit reviews before merge
- Reference `docs/mockups/multi-turn-dialog.html` for visual design
