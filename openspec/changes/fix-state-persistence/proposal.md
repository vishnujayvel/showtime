# Proposal: Fix State Persistence Regression (GitHub #136)

## Problem

The XState migration (PR #129) deleted `showStore.ts` which had Zustand's `persist` middleware. The app now loses all state on restart — shows, acts, lineup, everything resets to Dark Studio.

## Fix

Add persistence to `showActor.ts` via actor subscription + localStorage.

### 1. Save on every state change

In `showActor.ts`, add to the existing subscriber:

```typescript
// Persistence: save actor state to localStorage on every change
const PERSIST_KEY = 'showtime-show-state'
const TRANSIENT_KEYS = new Set(['beatCheckPending', 'celebrationActive'])

function persistState(ctx: ShowMachineContext, phase: string) {
  try {
    const persisted = Object.fromEntries(
      Object.entries(ctx).filter(([k]) => !TRANSIENT_KEYS.has(k))
    )
    localStorage.setItem(PERSIST_KEY, JSON.stringify({ phase, context: persisted, savedAt: Date.now() }))
  } catch { /* ignore storage errors */ }
}
```

Call `persistState(ctx, phase)` at the end of the existing subscriber.

### 2. Hydrate on startup

Before `showActor.start()`, check localStorage:

```typescript
function hydrateActor() {
  try {
    const raw = localStorage.getItem(PERSIST_KEY)
    if (!raw) return
    const { phase, context, savedAt } = JSON.parse(raw)
    // Only hydrate if same day
    const today = new Date().toISOString().slice(0, 10)
    if (context.showDate !== today) {
      localStorage.removeItem(PERSIST_KEY)
      return
    }
    // Jump to saved phase and patch context
    showActor.send({ type: '_JUMP_PHASE', phase })
    showActor.send({ type: '_PATCH_CONTEXT', patch: context })
  } catch { /* ignore parse errors, start fresh */ }
}
```

Call `hydrateActor()` right after `showActor.start()`.

### 3. Clear on RESET

When `RESET` is sent, also clear localStorage:

```typescript
// In subscriber, when phase becomes 'no_show' after RESET:
if (phase === 'no_show' && previousPhase !== 'no_show') {
  localStorage.removeItem(PERSIST_KEY)
}
```

## Files to modify

- `src/renderer/machines/showActor.ts` — add persistence + hydration

## Testing

- Unit test: save → hydrate round-trip
- Unit test: stale date → start fresh
- Unit test: transient fields excluded
- E2E test: build lineup → quit → relaunch → lineup still there
- Run evidence capture script to verify state injection works again
- All existing 569 tests must pass

## Verification

After implementing:
1. Run `npm test` — all tests pass
2. Run `npm run build`
3. Run `node e2e/capture-evidence.mjs` — state injection via localStorage works
4. Commit evidence screenshots to `e2e/screenshots/`
5. Create PR with screenshots attached
