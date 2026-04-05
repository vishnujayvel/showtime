# Fix: Move Shadow States into XState Machine (#205)

**Issue:** #205
**Type:** Bug fix
**Priority:** P0

## Problem

Three full-screen views use React useState in App.tsx instead of XState:
- showOnboarding, showHistory, showSettings

The machine doesn't know these screens exist. State coverage report Section 7 flags all three.

## Fix

Add an overlay parallel region to showMachine:

```
show (parallel)
├── phase (existing)
├── animation (existing)
└── overlay (NEW)
    ├── none (initial)
    ├── history
    ├── settings
    └── onboarding
```

Events: VIEW_HISTORY, VIEW_SETTINGS, VIEW_ONBOARDING, CLOSE_OVERLAY

## Files to modify

- src/renderer/machines/showMachine.ts — add overlay region + events
- src/shared/types.ts — add event types
- src/renderer/App.tsx:70-72 — replace useState with useShowSelector
- src/renderer/components/ViewMenu.tsx — dispatch events not callbacks
- src/renderer/views/DarkStudioView.tsx — dispatch VIEW_HISTORY
- src/renderer/views/StrikeView.tsx — dispatch VIEW_HISTORY

## CLAUDE.md rules

- Every full-screen view MUST be a state in XState. Never useState for view routing.
- Spring physics only for animations
- No inline styles — Tailwind only

## Test patterns

Tests use createActor(showMachine).start(), send events, check snapshot.value.

## Build commands

- npx vitest run — 824 tests
- npx tsc --noEmit — type check
- npm run build — Electron build

## Acceptance Criteria

- [ ] overlay parallel region exists with 4 states
- [ ] App.tsx has zero useState for view routing
- [ ] ViewMenu dispatches XState events
- [ ] State coverage report shows 0 shadow states
- [ ] All tests pass + new overlay transition tests
