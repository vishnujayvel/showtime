# Wave 1: Core Flow Fixes

## Why

The core user flow — build a lineup in Writer's Room, finalize it, go live — is completely broken. Four interconnected issues block the app from being usable:

1. **XState silently drops events** (#169) — No detection when events have no handler, making bugs invisible
2. **SET_LINEUP dropped from energy substate** (#160) — The chat-first UI never advances to `conversation` substate where SET_LINEUP is accepted. Root cause of the broken flow.
3. **SKILL.md has non-functional database instructions** (#163) — Claude Code subprocess can't import TypeScript modules. It blindly searches the filesystem for the DB.
4. **No lineup finalization workflow** (#161) — Even if SET_LINEUP worked, there's no clear draft → confirmed → go live path

## What Changes

### 1. XState Event Drop Detection (#169)

**Files:** `src/renderer/machines/showMachine.ts`, `src/renderer/machines/showActor.ts`

Add a root-level wildcard `*` handler to showMachine that logs all dropped events:
```typescript
// Root level on: in the parallel machine
on: {
  '*': {
    actions: ({ event, self }) => {
      const snap = self.getSnapshot()
      // Log to structured log for QA monitoring
      window.showtime?.logEvent('WARN', 'xstate.event_dropped', {
        event: event.type,
        state: JSON.stringify(snap.value),
      })
      if (import.meta.env.DEV) {
        console.error(`[showMachine] DROPPED: "${event.type}" in state "${JSON.stringify(snap.value)}"`)
      }
    }
  }
}
```

Add inspect callback to showActor for observation-only drop detection using `snapshot.can()`.

Add test helper that fails tests on unexpected event drops.

### 2. Fix SET_LINEUP Acceptance (#160)

**Files:** `src/renderer/machines/showMachine.ts`

Move `SET_LINEUP` to the parent `writers_room` level so it's accepted from any substate (energy, plan, conversation, lineup_ready):

```typescript
writers_room: {
  on: {
    SET_LINEUP: { target: '.lineup_ready', actions: 'assignLineup' },
    TRIGGER_GOING_LIVE: { target: 'going_live', guard: 'hasActs' },
    // ... existing handlers
  },
}
```

Also: In `control-plane.ts`, query `readToday()` before spawning Claude and inject today's lineup state into the system prompt. This eliminates the 10+ Glob/Bash tool calls Claude currently runs.

### 3. Fix SKILL.md Database Instructions (#163)

**Files:** `src/skills/showtime/SKILL.md`

Replace the non-functional TypeScript imports with actual executable instructions:
- Exact DB path: `~/Library/Application Support/Showtime/app.db`
- `sqlite3` CLI one-liners for common queries
- Full schema reference (shows, acts, timeline_events, calendar_cache)
- Note that if lineup state is pre-loaded in the system prompt, Claude should use that directly

### 4. Lineup Finalization Workflow (#161)

**Files:** `src/renderer/machines/showMachine.ts`, `src/shared/types.ts`, `src/renderer/views/WritersRoomView.tsx`

Add `lineupStatus: 'draft' | 'confirmed'` to ShowMachineContext.

Add `FINALIZE_LINEUP` event that transitions from any writers_room substate to lineup_ready and sets status to confirmed.

Guard `TRIGGER_GOING_LIVE` to require `lineupStatus === 'confirmed'`.

Make the "Finalize Lineup" button always visible when a draft lineup exists. Show "Confirm & Go Live" only after finalization.

## Testing Strategy

- Unit tests: XState drop detection, SET_LINEUP from all substates, finalization guard
- E2E: Full chat-first flow — type plan → see lineup → finalize → go live
- Manual: Launch app, verify the flow works end-to-end

## Acceptance Criteria

1. `SET_LINEUP` works from `writers_room.energy` (the chat-first path)
2. Dropped events are logged with state and event name in dev mode
3. "Finalize Lineup" button appears when lineup exists
4. "Go Live" only available after finalization
5. SKILL.md contains working sqlite3 commands with correct DB path
6. Claude subprocess receives today's lineup state in system prompt (no Glob/Bash hunting)
