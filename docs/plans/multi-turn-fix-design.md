---
title: "Design: Fix Multi-Turn Conversation (Issue #62)"
status: current
last-verified: 2026-04-06
---
# Design: Fix Multi-Turn Conversation (Issue #62)

## Problem

Multi-turn lineup refinement is broken. When a user sends a refinement message (turn 2+),
the response watcher immediately detects the assistant message from the **previous turn**
and declares "Done — lineup updated" without waiting for the actual response.

### Root Cause

`WritersRoomView.tsx` line 172:
```ts
const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant' && !m.toolName)
```

This searches ALL messages in the tab — it has no concept of "messages from the current turn."
On turn 2, the previous turn's assistant message is still the last one (Claude hasn't responded yet),
so it gets re-detected and the same lineup is re-parsed.

### Proof the Pattern Works Elsewhere

The calendar prefetch watcher (same file, line 72-115) already solves this correctly:
```ts
calendarFetchMsgCountRef.current = tab.messages.length  // save offset before sending
// ...
const newMessages = tab.messages.slice(calendarFetchMsgCountRef.current)  // only new
const assistantMsg = newMessages.find(m => m.role === 'assistant' && !m.toolName)
```

## Fix

Apply the same offset-tracking pattern to the main response watcher.

### Changes

#### 1. Add `responseOffsetRef` (WritersRoomView.tsx)

```ts
const responseOffsetRef = useRef<number | null>(null)
```

Replaces `lineupStartRef` for response detection (keep `lineupStartRef` for timing metrics only,
or merge them into a single ref object).

#### 2. Set offset before sending — `handleBuildLineup()`

```ts
const handleBuildLineup = () => {
  // ...
  const tab = tabs.find(t => t.id === activeTabId)
  responseOffsetRef.current = tab ? tab.messages.length : 0
  // ... rest unchanged
  sendMessage(prompt)
}
```

#### 3. Set offset before sending — `handleRefinement()`

```ts
const handleRefinement = (message: string) => {
  const tab = tabs.find(t => t.id === activeTabId)
  responseOffsetRef.current = tab ? tab.messages.length : 0
  // ... rest unchanged
  sendMessage(prompt)
}
```

#### 4. Fix the response watcher effect

Replace the global search with offset-aware search:

```ts
useEffect(() => {
  if (!isWaiting) return
  if (responseOffsetRef.current === null) return

  const tab = tabs.find(t => t.id === activeTabId)
  if (!tab) return

  // Only look at messages AFTER the prompt was sent
  const newMessages = tab.messages.slice(responseOffsetRef.current)
  const lastAssistant = [...newMessages].reverse().find(m => m.role === 'assistant' && !m.toolName)

  if (lastAssistant) {
    const lineup = tryParseLineup(lastAssistant.content)
    if (lineup) {
      if (lineupStartRef.current) {
        window.clui.recordMetricTiming('claude.lineup_generation', Date.now() - lineupStartRef.current)
        lineupStartRef.current = null
      }
      setLineup(lineup)
      setWriterConversations(prev => [...prev, { role: 'writer', text: 'Done — lineup updated.' }])
      setIsWaiting(false)
      responseOffsetRef.current = null
      setError(null)
      return
    }

    // Claude responded but no lineup — show what Claude said
    if (tab.status === 'completed' || tab.status === 'idle') {
      const writerText = lastAssistant.content.slice(0, 300)
      setWriterConversations(prev => [...prev, { role: 'writer', text: writerText }])
      setIsWaiting(false)
      responseOffsetRef.current = null
      return
    }
  }

  if (tab.status === 'failed' || tab.status === 'dead') {
    setWriterConversations(prev => [...prev, { role: 'writer', text: 'The writer stepped out. Try again?' }])
    setIsWaiting(false)
    responseOffsetRef.current = null
    setError('subprocess')
  }
}, [tabs, activeTabId, isWaiting, setLineup])
```

### Why NOT in sessionStore?

The offset is view-specific state — it tracks which response a particular UI watcher is waiting for.
Multiple consumers of sessionStore could be watching for different responses (calendar watcher vs
lineup watcher). Keeping offsets in refs within the consuming component is the right boundary.

### Why NOT a more complex solution?

- No request-ID matching needed: each watcher only has one outstanding request at a time
- No message deduplication needed: the offset naturally excludes prior turns
- No changes to sessionStore, IPC, or the main process: purely a renderer-side fix
- Matches the existing pattern (calendarFetchMsgCountRef) — consistency over novelty

## Files Changed

| File | Change |
|------|--------|
| `src/renderer/views/WritersRoomView.tsx` | Add `responseOffsetRef`, update `handleBuildLineup`, `handleRefinement`, and response watcher |

## Testing

- **E2E**: Build lineup, send refinement "make act 1 shorter", verify lineup actually updates (not stale re-detection)
- **E2E**: Build lineup, send refinement, verify conversation shows both exchanges
- **E2E**: Build lineup, send refinement that doesn't produce lineup JSON, verify Claude's text response appears
- **E2E**: Verify calendar prefetch still works (regression)
- **Unit**: `tryParseLineup` with multi-turn response content (already covered)

## Risk

Low. Single-file change. No IPC or store modifications. Pattern proven by calendar prefetch.
