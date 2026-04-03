# Feature: Mid-Show Lineup Editing via Resumed Claude Chat (#190)

**Issue:** #190
**Type:** Feature
**Risk:** Medium — touches state machine transitions, Director Mode UI, and session resume
**Mockup:** `docs/mockups/edit-lineup-director-mode.html`

## Problem

Once a show goes live, the lineup is frozen. Director Mode only offers skip/end/break — no way to edit acts. Users need to adjust their day as it unfolds: reorder acts, add new ones, change durations, or drop blocks that no longer make sense.

## Solution

Add an "Edit the lineup" button to Director Mode that transitions to the Writer's Room conversation view with the previous Claude chat resumed. Claude Code already persists conversations by session ID — we don't need to build our own chat history storage.

## Implementation

### 1. State Machine — New EDIT_LINEUP event and transition

**File:** `src/renderer/machines/showMachine.ts`

Add a new event `EDIT_LINEUP` that transitions from `live` (or `director`) to `writers_room.conversation`:

```
live.act_active → (EDIT_LINEUP) → writers_room.conversation
director → (EDIT_LINEUP) → writers_room.conversation
```

The transition must:
- **Pause the current timer** — set `timerPausedRemaining` from the active act's remaining time, clear `timerEndAt`
- **Preserve all context** — acts, beats, currentActId, showDate, showStartedAt
- **Set a flag** `editingMidShow: true` in context so WritersRoomView knows to show the resume UI instead of the fresh start flow
- **Set `writersRoomStep: 'conversation'`** to skip energy/plan and go straight to chat

Add a `CONFIRM_LINEUP_EDIT` event that transitions back:
```
writers_room.conversation → (CONFIRM_LINEUP_EDIT) → live.act_active
```

This transition must:
- **Update acts** from the new lineup (merge: keep completed acts, replace upcoming acts)
- **Resume timer** — restore `timerEndAt` from `timerPausedRemaining` + Date.now()
- **Clear `editingMidShow`** flag
- **Set `lineupStatus: 'confirmed'`**

### 2. Director Mode UI — "Edit the lineup" button

**File:** `src/renderer/components/DirectorMode.tsx`

Add a new button at the TOP of the button list (most prominent position), styled with the accent color:

```tsx
<Button
  className="w-full py-3 rounded-xl bg-accent/10 text-accent text-sm font-medium border border-accent/20 hover:bg-accent/15 transition-colors"
  onClick={() => {
    send({ type: 'EDIT_LINEUP' })
  }}
>
  ✏️ Edit the lineup
</Button>
```

Position: first button, before "Skip this act, move on". This is the director's primary power — calling audibles on the lineup.

### 3. WritersRoomView — Mid-show editing mode

**File:** `src/renderer/views/WritersRoomView.tsx`

When `editingMidShow` is true:
- Skip energy selection and plan dump — go straight to conversation view
- Show a header banner: "✏️ Editing Lineup — Show Paused"
- Show a status indicator: "Session resumed" (green dot) if Claude subprocess is alive
- Show previous conversation messages (already in sessionStore from the initial Writer's Room chat)
- Show a bottom banner with act count + paused timer: "2 acts updated · Timer paused at 23:45"
- Show a "Confirm & Resume Show" button that sends `CONFIRM_LINEUP_EDIT`

### 4. Session Resume — Already built

**File:** `src/main/claude/control-plane.ts` (line 646)

The control plane already resumes sessions:
```typescript
if (tab.claudeSessionId && !options.sessionId) {
  options = { ...options, sessionId: tab.claudeSessionId }
}
```

Two scenarios:
- **Subprocess still alive:** Messages in sessionStore are current. Chat just shows.
- **Subprocess died:** When user sends a new message, control plane spawns `claude -p` with the stored `claudeSessionId`. Claude Code resumes the conversation with full history.

The `claudeSessionId` is stored in `uiStore` (persisted via Zustand). No new work needed here.

### 5. Context Types Update

**File:** `src/renderer/machines/showMachine.ts` (ShowMachineContext)

Add to context:
```typescript
editingMidShow: boolean  // true when in writers_room via EDIT_LINEUP from live
```

**File:** `src/shared/types.ts`

Add the new event types to ShowMachineEvent union if needed.

### 6. Lineup Merge Logic

When returning from edit mode, the lineup merge must:
- Keep all **completed** acts (status: 'completed') unchanged
- Keep the **currently active** act unchanged (it's still running)
- Replace all **upcoming** acts with the new lineup from Claude
- Recalculate act order numbers sequentially
- Write merged lineup to SQLite via the existing sync path

## UX Flow

1. User is mid-show, realizes they need to change the plan
2. Opens Director Mode (existing button in expanded view)
3. Clicks "Edit the lineup" (new button, top of list)
4. Timer pauses, transitions to Writer's Room conversation view
5. Previous chat with Claude is visible (session resumed)
6. User tells Claude: "Move Deep Work after lunch, drop admin"
7. Claude updates lineup, shows preview
8. User clicks "Confirm & Resume Show"
9. Back to live view with updated acts, timer resumes

## Design Rules (from CLAUDE.md)

- NO inline styles — Tailwind CSS only
- Spring physics for animations (Framer Motion)
- shadcn/ui for buttons and dialogs
- All IPC through typed `window.showtime` API
- State changes through XState machine only

## Testing Strategy

- Unit test: EDIT_LINEUP from live.act_active → writers_room.conversation (timer paused, context preserved)
- Unit test: CONFIRM_LINEUP_EDIT → live.act_active (timer resumed, acts merged)
- Unit test: editingMidShow flag set/cleared correctly
- Unit test: completed acts preserved during lineup merge
- Type check: `npx tsc --noEmit`
- Full suite: `npm run test`

## Non-goals

- Editing the currently active act's timer (use skip instead)
- Undo/redo for lineup changes
- Persistent "edit mode" preference
- Drag-to-reorder UI (future enhancement — chat-first for now)
