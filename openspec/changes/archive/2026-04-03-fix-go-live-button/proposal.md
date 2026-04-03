# Proposal: Fix Go Live Button (#74) — Button Below Scroll Fold

## Problem

The "WE'RE LIVE!" button in WritersRoomView is visible in the DOM but unreachable by real mouse clicks. Playwright E2E tests pass (auto-scroll) but manual testing fails.

## Root Cause

The button is at the BOTTOM of a scrollable `overflow-y-auto` container (line 301 of WritersRoomView.tsx). When the content above it (LineupPanel + conversation thread + chat input) exceeds the viewport height, the button is pushed below the visible area.

**DOM structure:**
```
div.overflow-hidden.flex.flex-col (outer frame)
  div (title bar — drag region)
  div.overflow-y-auto.flex-1 (SCROLLABLE — line 301)
    spotlight overlay (pointer-events-none — safe)
    LineupPanel (tall — shows all acts)
    Conversation thread
    LineupChatInput
    Button "WE'RE LIVE!"  ← BELOW THE FOLD
```

## Fix: Sticky Footer Button

Move the "WE'RE LIVE!" button and the LineupChatInput OUT of the scroll container into a sticky footer. Only the lineup + conversation content should scroll.

**New structure:**
```
div.overflow-hidden.flex.flex-col (outer frame)
  div (title bar)
  div.overflow-y-auto.flex-1 (scroll area — lineup + conversation ONLY)
    spotlight overlay
    LineupPanel
    Conversation thread
  div.px-8.py-4.border-t.border-surface-hover (STICKY FOOTER — always visible)
    LineupChatInput
    Button "WE'RE LIVE!"
```

## Files to Modify

| File | Change |
|------|--------|
| `src/renderer/views/WritersRoomView.tsx` | Move Button + LineupChatInput outside the scroll container into a sticky footer div |

## Non-Goals

- Do NOT change button styling, animation, or behavior
- Do NOT change the GoingLiveTransition or showStore logic
- Do NOT modify any other views

## Testing Strategy

1. **Manual test:** Launch app → energy → plan → lineup → verify "WE'RE LIVE!" button is VISIBLE without scrolling → click it → verify GoingLiveTransition fires
2. **E2E test:** The existing `e2e/writers-room.test.ts` "can go live" test should still pass
3. **E2E test:** The existing `e2e/live-show-go-live.test.ts` should still pass

## Key constraint

The footer must only appear during the `conversation` step when `hasLineup` is true. During `energy` and `plan` steps, no footer. The LineupChatInput already has its own `hasLineup` check internally.

## Also fix: control-plane.ts homedir import

The `initSession` warmup still uses `process.cwd()` on main. Change line 500 to `homedir()` and add the `import { homedir } from 'os'` import. This was the #72 fix that didn't land.
