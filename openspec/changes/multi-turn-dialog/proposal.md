# Multi-Turn Claude Dialog — Edit Lineup Through Conversation

GitHub Issue: #39

## Why

After Claude generates a lineup in Writer's Room, the only way to modify it is manual editing.
Users should be able to refine through conversation: "Move deep work to after lunch,"
"Make act 3 shorter," "Add a break between acts 2 and 3." This feels natural — like
talking to your show's writer.

## What Exists

The Claude subprocess already supports multi-turn conversations:
- `sessionStore.sendMessage(prompt)` calls `window.clui.prompt(tabId, requestId, { sessionId })`
- `claudeSessionId` is cached on the tab after `session_init` event
- Subsequent messages with the same `sessionId` resume the conversation
- The lineup is parsed from Claude's response via `tryParseLineup()` in WritersRoomView

The infrastructure is there. What's missing is:
1. A chat input in WritersRoomView after lineup is generated
2. Logic to detect updated lineup JSON in Claude's follow-up response
3. Smooth animation when the lineup updates in place

## What to Build

### 1. Chat Input Component

Add a small text input below the lineup in WritersRoomView's "lineup-ready" phase:

```
[Lineup cards showing acts...]

┌─────────────────────────────────────────┐
│ Tell the writers to change something... │
└─────────────────────────────────────────┘
```

- Appears only after lineup is generated (phase: lineup-ready or later)
- Placeholder: "Tell the writers to change something..."
- Submit on Enter, clear on submit
- Disabled while Claude is processing (status === 'running')
- Small, unobtrusive — 1 line, font-body text-sm

### 2. Follow-Up Message Handling

When user submits a refinement:
1. Show "The writers are revising..." indicator (reuse existing loading animation)
2. Call `sendMessage()` with the user's instruction — it auto-resumes via cached sessionId
3. Parse Claude's response for updated `showtime-lineup` JSON block
4. If found: update the lineup in place with animation (acts reorder, durations change)
5. If not found: show Claude's text response as a brief toast (e.g., "I can't do that" or clarification)

### 3. Prompt Engineering

The follow-up prompt to Claude should be:
```
The user wants to change the lineup: "{user instruction}"

Please respond with the complete updated lineup as a showtime-lineup JSON block.
Keep the same format as before. Only modify what the user asked for.
```

This ensures Claude returns structured JSON, not just conversational text.

### 4. Lineup Update Animation

When the lineup updates:
- Acts that moved: slide to new position (spring physics)
- Acts that changed duration: pulse the duration badge
- New acts: fade in from below
- Removed acts: fade out

Use Framer Motion's `layoutId` on each ActCard for automatic layout animation.

### 5. Conversation History (Light)

Show the last 2-3 exchanges below the lineup as small text:
```
You: "Move deep work to after lunch"
Writers: "Done — moved Deep Work to Act 4, after your lunch break."
```

This gives context without cluttering the view.

## Technology

- React component: `ChatInput` (new, small)
- Zustand: `sessionStore.sendMessage()` (existing)
- Framer Motion: `layoutId` for act reordering animation
- IPC: existing prompt/event pipeline

## Testing Strategy

- E2E: After lineup generates, type refinement, verify lineup updates
- E2E: Verify chat input appears only after lineup
- E2E: Verify disabled state while Claude processes
- Unit: Test tryParseLineup with follow-up response format

## Non-Goals

- No persistent chat history across sessions
- No multi-turn for things other than lineup editing
- No voice input
- No undo/redo for lineup changes (future enhancement)
