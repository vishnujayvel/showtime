# XState Inspect Integration — Live Visualization + Drop Detection

**Issues:** #172, #176
**Type:** Feature
**Origin:** Retro action items #2 and #4 from `docs-internal/retro-xstate-silent-drop-bug.md`

## Problem

The XState show machine is the core of Showtime's lifecycle (8 phases, 32 events, 6 guards, parallel regions). Two gaps exist:

1. **No live visualization (#172):** A manually-written Mermaid diagram exists at `docs/plans/show-machine-diagram.md` but goes stale the moment anyone edits the machine. Contributors and agents have no way to see the current state tree without reading 800+ lines of machine config.

2. **No runtime drop detection layer (#176):** A wildcard `logDroppedEvent` handler was added in PR #169 to catch dropped events at the machine level. But the `@statelyai/inspect` callback provides a second observation layer using `snapshot.can()` — deferred from Wave 1.

## Goals

1. **Layer 1 — Runtime inspect callback:** Add XState v5's built-in `inspect` option to `createActor()` in `showActor.ts`. Use `snapshot.can(event)` to detect and log events that would be dropped. Observation-only — no machine behavior changes.

2. **Layer 2 — Live dev visualization:** Install `@statelyai/inspect` and wire `createBrowserInspector()` into the actor. DEV mode only. This opens the Stately Inspector in the browser showing a live, interactive state chart that updates in real-time as the machine transitions. Inherently evergreen — it reads the running machine, not a static file.

## Non-Goals

- No static Mermaid diagram generation (the live inspector replaces this need)
- No changes to the machine itself (states, transitions, guards, actions)
- No production bundle impact (inspector is dev-only, tree-shaken out)
- No removal of the existing wildcard `logDroppedEvent` handler (it stays as Layer 0)

## Scope

### File changes

| File | Change |
|------|--------|
| `src/renderer/machines/showActor.ts` | Add `inspect` callback to `createActor()` options. In DEV mode, compose built-in drop detection + browser inspector. |
| `src/renderer/machines/devInspector.ts` | NEW — Encapsulate dev-only inspector setup. Lazy-imports `@statelyai/inspect` to avoid production bundling. |
| `package.json` | Add `@statelyai/inspect` as devDependency. |
| `CLAUDE.md` | Add rule: "Machine visualization is live via `@statelyai/inspect` — do not maintain static diagrams." |
| `src/__tests__/inspect-drop-detection.test.ts` | NEW — Unit tests for the inspect callback's drop detection logic. |

### Implementation details

**Layer 1 — Built-in inspect callback (`showActor.ts` lines 129-131):**
```typescript
export const showActor = createActor(showMachine, {
  ...(persistedSnapshot ? { snapshot: persistedSnapshot } : {}),
  inspect: (inspectionEvent) => {
    if (inspectionEvent.type === '@xstate.event') {
      const snapshot = showActor.getSnapshot()
      const event = inspectionEvent.event as ShowMachineEvent
      // Check if this event would be handled (not dropped)
      if (!snapshot.can(event)) {
        // Log via existing IPC bridge
        window.showtime?.logEvent?.('WARN', 'xstate.inspect_drop', {
          event: event.type,
          state: JSON.stringify(snapshot.value),
        })
        if (import.meta.env.DEV) {
          console.warn(`[inspect] Event "${event.type}" not handled in state`, snapshot.value)
        }
      }
    }
  },
})
```

**Layer 2 — Browser inspector (`devInspector.ts`):**
```typescript
// Only imported in DEV mode
export async function createDevInspector() {
  if (!import.meta.env.DEV) return undefined
  const { createBrowserInspector } = await import('@statelyai/inspect')
  return createBrowserInspector()
}
```

Then in `showActor.ts`, compose both inspectors:
```typescript
const devInspector = import.meta.env.DEV ? await createDevInspector() : undefined

export const showActor = createActor(showMachine, {
  inspect: (event) => {
    dropDetectionInspector(event)     // Layer 1: always active
    devInspector?.inspect?.(event)    // Layer 2: dev only
  },
})
```

**Important consideration:** `showActor` is currently created synchronously at module load (line 129). The `@statelyai/inspect` dynamic import is async. Options:
- (a) Make the actor creation async (requires refactoring all consumers)
- (b) Start actor immediately with only Layer 1, then attach Layer 2 after async import resolves
- (c) Use synchronous import for `@statelyai/inspect` in dev (acceptable since it's dev-only)

Recommend **(b)** — start with drop detection immediately, hot-swap the composed inspector once the browser inspector loads. No consumer changes needed.

## Technology Choices

- **`@statelyai/inspect`** — Official Stately package for XState v5 visual debugging. Maintained by the XState team.
- **Built-in `inspect` callback** — Part of XState v5 core, zero additional dependencies.
- **`@xstate/graph` v3** — Already installed (`devDependency`). Available for future test generation but not used in this change.

## Testing Strategy

1. **Unit tests:** Test the inspect callback fires for dropped events using a test actor with known unhandled events.
2. **Unit tests:** Verify `snapshot.can()` correctly identifies handleable vs unhandled events.
3. **Unit tests:** Confirm inspector is NOT initialized in production mode (`import.meta.env.DEV === false`).
4. **E2E test:** Launch app in dev mode, verify Stately Inspector opens (or at minimum, that the inspect callback fires during a normal show flow).
5. **Manual verification:** Open the app, see live state chart in Stately Inspector, walk through a show flow, confirm transitions render in real-time.

## Acceptance Criteria

- [ ] `createActor()` has an `inspect` callback that logs dropped events via `snapshot.can()`
- [ ] In DEV mode, Stately Inspector browser window opens showing the live state chart
- [ ] In production builds, no inspector code is bundled (verify with build output)
- [ ] Existing wildcard `logDroppedEvent` handler still works (not removed)
- [ ] Unit tests cover drop detection logic
- [ ] CLAUDE.md updated with evergreen visualization rule
