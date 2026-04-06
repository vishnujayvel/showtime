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

## Context (auto-generated)

### Exact line numbers (current main, c75279e)

**Shadow state declarations (App.tsx):**
- Line 66: `const [showOnboarding, setShowOnboarding] = useState(() => { ... })`
- Line 69: `const [showHistory, setShowHistory] = useState(false)`
- Line 70: `const [showSettings, setShowSettings] = useState(false)`
- Lines 78-81: IPC listener `onOpenSettings` calls `setShowSettings(true)` — must dispatch XState event instead
- Lines 146-153: Window resize logic reads `showHistory || showSettings` — must read from XState selector
- Lines 174-184: View routing conditional chain (`if showSettings`, `if showHistory`, `if showOnboarding`) — replace with overlay state selector

**showMachine.ts:**
- Line 503-505: Machine is `type: 'parallel'` with `id: 'show'`
- Line 510: `states: {` — this is where the new `overlay` region goes (sibling to `phase` and `animation`)
- Current parallel regions: `phase` (line 512) and `animation` (find after phase region ends)

**ViewMenu.tsx:**
- Lines 13-17: Props interface passes `onShowHistory?: () => void` and `onShowSettings?: () => void` as callbacks
- Lines 103-122: History and Settings menu items call `onShowHistory()` and `onShowSettings()` — must dispatch `send({ type: 'VIEW_HISTORY' })` etc. instead
- Line 21: Already has `const send = useShowSend()` — wiring is easy

**ShowMachineProvider.tsx hooks to export:**
- `useShowSelector` already exists — use it to read `state.value.overlay`
- Pattern: `const overlay = useShowSelector(state => state.value.overlay)`

**Views that pass callbacks:**
- `src/renderer/views/PillView.tsx:145` — passes `onShowHistory` to ViewMenu
- `src/renderer/views/ExpandedView.tsx:72` — passes `onShowHistory`, `onShowSettings` to ViewMenu
- `src/renderer/views/CompactView.tsx:96` — passes `onShowHistory`, `onShowSettings` to ViewMenu

### CLAUDE.md rules that apply
- "Every full-screen view MUST be a state in the XState machine" — this is the rule #205 violates
- "Never use useState for view routing — dispatch XState events and read phase state"
- "No inline styles — Tailwind only"
- "Spring physics only for animations"
- "IPC Bridge — Strict Typing" — onOpenSettings IPC must dispatch XState event

### Existing test patterns (src/__tests__/showMachine.test.ts)
```ts
const actor = createActor(showMachine).start()
actor.send({ type: 'ENTER_WRITERS_ROOM' })
expect(actor.getSnapshot().value).toMatchObject({ phase: 'writers_room' })
```
New tests should follow this pattern for overlay transitions.

### Recent git history for affected files
```
c75279e fix: remove dead HelpDialog code, update help button E2E test
8965e24 feat: add settings/menu button to all views (#201) (#204)
```

### Tech stack
- XState v5 (xstate@5.x), React 19, Electron, TypeScript, Tailwind CSS v4, Vitest, Playwright
