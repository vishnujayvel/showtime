# Claude Subprocess Warm-Up Strategy

**Date:** 2026-03-24
**Goal:** Reduce perceived latency between "Build my lineup" click and lineup appearing.

---

## Current Architecture Trace

### What happens when the user clicks "Build my lineup"

```
WritersRoomView.handleBuildLineup()
  │
  ├─ 1. Constructs prompt string (energy + plan text)
  ├─ 2. Calls sessionStore.sendMessage(prompt)
  │     │
  │     ├─ 3. Generates requestId (UUID)
  │     ├─ 4. Sets tab status → 'connecting'
  │     ├─ 5. Calls window.clui.prompt(tabId, requestId, options)
  │     │     │
  │     │     └─ 6. IPC → ipcMain IPC.PROMPT handler (core.ts:49)
  │     │           │
  │     │           └─ 7. controlPlane.submitPrompt(tabId, requestId, options)
  │     │                 │
  │     │                 └─ 8. controlPlane._dispatch(tabId, requestId, options)
  │     │                       │
  │     │                       ├─ 9. Awaits hookServerReady (permission server)
  │     │                       ├─ 10. Registers per-run token with permission server
  │     │                       ├─ 11. Generates per-run settings file
  │     │                       └─ 12. runManager.startRun(requestId, options)
  │     │                             │
  │     │                             ├─ 13. Builds claude CLI args
  │     │                             ├─ 14. spawn() the claude process ← EXPENSIVE
  │     │                             ├─ 15. Attaches stream parser to stdout
  │     │                             └─ 16. Writes prompt JSON to stdin
  │     │
  │     └─ (async) Watches for response via useEffect on tabs/messages
  │
  └─ Shows "The writers are working..." loading state
```

### When is the Claude subprocess spawned?

**On every single prompt.** There is no pre-warming.

The full sequence from app launch:

1. **App launch** (`index.ts`): `ControlPlane` is constructed (module-level in `state.ts`), which starts the `PermissionServer` HTTP hook server. No Claude subprocess is spawned.
2. **Renderer mount** (`App.tsx useEffect`): Calls `initStaticInfo()` (runs `claude -v` and `claude auth status` via `execSync` -- blocking) then `createTab()` (creates a tab registry entry, no process).
3. **`initSession` exists but is never called.** The preload bridge exposes `window.clui.initSession(tabId)`, and the main process has `controlPlane.initSession()` which sends a minimal `'hi'` prompt to warm up a session. But the renderer **never invokes it**.
4. **First prompt** (when user clicks "Build my lineup"): `sendMessage()` → `window.clui.prompt()` → `controlPlane.submitPrompt()` → `_dispatch()` → `runManager.startRun()` → **`spawn('claude', ...)`** -- this is the first time a Claude subprocess is created.

### Subprocess is cold on every prompt

Looking at `RunManager.startRun()` (line 138-318), each call spawns a **brand new** `claude -p` subprocess. The `--resume` flag is used for subsequent prompts (reusing the session), but the **first prompt per session** always pays the full cold-start cost.

## Latency Breakdown

| Phase | Est. Time | Notes |
|-------|-----------|-------|
| Prompt construction | <1ms | String template in `handleBuildLineup` |
| IPC renderer→main | <5ms | Electron IPC, negligible |
| `hookServerReady` await | 0ms* | Already resolved by now (started at module load) |
| Permission server token registration | <5ms | In-memory map operations |
| Settings file generation | <10ms | Writes a temp JSON file |
| `spawn('claude', ...)` | **200-500ms** | OS process creation + node/binary startup |
| Claude CLI initialization | **1-3s** | CLI reads config, resolves API keys, loads settings, connects to API |
| API handshake + session creation | **1-2s** | Network round-trip, session setup on Anthropic's side |
| Model inference (thinking) | **3-10s** | Depends on prompt complexity and model |
| Response streaming + parsing | **0.5-2s** | NDJSON stream parsing + lineup JSON extraction |
| **Total cold path** | **~5-16s** | User sees "writers are working" for this entire duration |

*The hookServerReady promise resolves during app startup, well before any prompt.

### Where time is wasted

The first three items (spawn + CLI init + API handshake) cost **~2-5 seconds** and are **identical regardless of prompt content**. This is pure overhead that could be eliminated with a warm subprocess.

## The `initSession` Infrastructure Already Exists

The codebase already has the warm-up plumbing built but disconnected:

1. **`ControlPlane.initSession(tabId)`** (control-plane.ts:453-468): Sends `'hi'` prompt with `maxTurns: 1`, marks the request as `initRequestIds` so events are suppressed from the renderer.
2. **`initRequestIds` tracking** (control-plane.ts:69): Init requests are tagged so `session_init` events emit with `isWarmup: true`, and all other events are silently dropped.
3. **Renderer handles warmup** (sessionStore.ts:243): The `session_init` handler checks `event.isWarmup` and skips status changes, only storing the `sessionId`, `model`, `tools`, etc.
4. **Session resume on next prompt** (control-plane.ts:596-598): After init, `tab.claudeSessionId` is populated, so `_dispatch` automatically injects `--resume <sessionId>` on the next real prompt.
5. **IPC bridge exists** (preload/index.ts:78): `window.clui.initSession(tabId)` is exposed.

The only missing piece: **nobody calls `initSession`**.

## Warm-Up Options

### Option A: Spawn on App Launch (always hot)

**When:** Immediately after `createTab()` completes in `App.tsx`.

```tsx
// App.tsx useEffect, after createTab
window.clui.createTab().then(({ tabId }) => {
  // ... existing setState ...
  window.clui.initSession(tabId)  // ← add this
})
```

**Pros:**
- Claude subprocess is warm from the moment the app opens
- Zero latency penalty when user eventually hits "Build my lineup"
- Simplest implementation (one line)

**Cons:**
- Spawns a Claude process even if the user never plans (opens app to check pill view, or just checks history)
- `initSession` sends `'hi'` which costs a small amount of API credits
- Process stays alive holding a session; if user takes 30+ minutes before planning, session may be stale

**Resource cost:** One `claude -p` process (~50-100MB RSS) running idle. The `maxTurns: 1` means the init prompt completes quickly and the process exits, but the session ID is cached for `--resume`.

**Wait -- the init process actually exits.** Looking at the code more carefully: `initSession` sends `'hi'` with `maxTurns: 1`. The Claude process responds once, the `result` event closes stdin, the process exits, and the `exit` handler sets tab status to `idle`. The session ID is cached on the tab (`tab.claudeSessionId`). The next real prompt uses `--resume` which starts a new process but resumes the existing session -- this skips session creation overhead on the API side.

**Revised cost:** One short-lived process (~2-3s), negligible ongoing resource use. The only real cost is a small API call for `'hi'`.

### Option B: Spawn on Writer's Room Entry (phase change trigger)

**When:** When `phase` transitions to `writers_room` (user clicks "Let's write a show" from Dark Studio).

```tsx
// In showStore.enterWritersRoom(), or via useEffect in App.tsx watching phase
useEffect(() => {
  if (phase === 'writers_room') {
    const tabId = useSessionStore.getState().activeTabId
    window.clui.initSession(tabId)
  }
}, [phase])
```

**Pros:**
- Only warms up when user signals intent to plan
- 5-15 seconds head start (user still selecting energy + typing plan text)
- No wasted resources if user never enters Writer's Room

**Cons:**
- Still pays ~2-3s init cost, but it's hidden behind the energy selection step
- If user is very fast (selects energy + pastes plan in <3s), init may not be done

**Timing analysis:** User enters Writer's Room → selects energy (~2-5s) → types plan (~10-60s) → clicks "Build my lineup". The init subprocess (`'hi'` + `maxTurns: 1`) takes ~2-3s. By the time the user finishes typing, the session is warm with near certainty.

### Option C: Spawn on Energy Selection

**When:** When user selects their energy level (the step immediately before the plan text + "Build my lineup").

**Pros:**
- Even more targeted -- only warms when user is one step from needing Claude
- 3-30 seconds head start (typing time)

**Cons:**
- Least head start of all options
- If user types very quickly or pastes a plan, init may still be in progress
- Requires plumbing the trigger from EnergySelector through to session init

## Recommendation: Option B (Writer's Room Entry)

**Option B is the best trade-off** for these reasons:

1. **Reliable timing margin.** The Writer's Room has two steps before Claude is needed (energy + plan text). Even a fast user takes 5+ seconds. The init subprocess completes in 2-3 seconds.

2. **Clear intent signal.** Entering Writer's Room is an unambiguous signal that the user wants to plan. Unlike app launch (Option A), there's no wasted work.

3. **The `initSession` infrastructure already works.** The ControlPlane correctly handles init requests (suppresses events, caches session ID, transitions to idle). The session resume path (`--resume`) is proven.

4. **Minimal API cost.** The `'hi'` prompt with `maxTurns: 1` uses negligible tokens. It only fires once per planning session.

5. **Option A is also viable as a "belt and suspenders" approach** since the init process is short-lived and exits quickly. If the team decides the ~$0.001 API cost per app launch is acceptable, Option A is simpler and guarantees zero cold-start latency. The process exits after the init completes, so there's no ongoing resource drain.

## Implementation Plan

### Change 1: Trigger `initSession` on Writer's Room entry

**File:** `/Users/vishnu/workplace/showtime/src/renderer/App.tsx`

Add a `useEffect` that watches for `phase === 'writers_room'` and calls `initSession`:

```tsx
// After the existing session initialization useEffect
useEffect(() => {
  if (phase === 'writers_room') {
    const tabId = useSessionStore.getState().activeTabId
    if (tabId) {
      window.clui.initSession(tabId)
    }
  }
}, [phase])
```

**Why App.tsx:** This is where the phase is already watched for view routing and window sizing. Adding the warm-up trigger here keeps session management co-located with the existing `createTab` + `initStaticInfo` initialization logic.

### Change 2: Guard against double-init

**File:** `/Users/vishnu/workplace/showtime/src/main/claude/control-plane.ts`

The current `initSession` method has no guard against being called when a session is already initialized or an init is in progress. Add a check:

```typescript
initSession(tabId: string): void {
  const tab = this.tabs.get(tabId)
  if (!tab) return

  // Skip if session already warm or init in progress
  if (tab.claudeSessionId) return
  if (tab.activeRequestId?.startsWith('init-')) return

  const requestId = `init-${tabId}`
  // ... rest unchanged
}
```

### Change 3: Ensure `sendMessage` waits for init to complete

**File:** `/Users/vishnu/workplace/showtime/src/renderer/stores/sessionStore.ts`

No changes needed here. The existing flow already handles this correctly:

- `initSession` submits a prompt to the ControlPlane, which sets `tab.activeRequestId`.
- If `sendMessage` is called while the init is still running, `submitPrompt` sees the tab is busy and **queues the request** (control-plane.ts:564-581).
- When the init completes, `_processQueue` dispatches the queued real prompt, now with `--resume <sessionId>`.

This means even if the user clicks "Build my lineup" before init finishes, the prompt is queued (not dropped) and dispatched as soon as the warm-up completes. The loading state ("The writers are working...") covers this seamlessly.

### Change 4 (Optional): Add progress indicator awareness

If the init is still running when the user clicks "Build my lineup", the UX is already fine (loading spinner shows). But optionally, the Writer's Room could show a subtle "warming up..." indicator during the energy/plan steps to manage expectations:

```tsx
const tab = tabs.find(t => t.id === activeTabId)
const isWarming = tab?.status === 'connecting' || tab?.status === 'running'
```

This is cosmetic and low priority.

## Expected Latency Improvement

| Scenario | Before | After |
|----------|--------|-------|
| First "Build my lineup" click | 5-16s (cold spawn + API + inference) | 3-10s (inference only, session pre-warmed) |
| Warm-up hidden behind UX | 0s overlap | 2-3s of init hidden during energy selection + typing |
| Net perceived wait | 5-16s | **3-10s** (2-5s faster) |

The improvement is most dramatic for the **first prompt** of a session. Subsequent prompts already use `--resume` and benefit from the warm session regardless.

## Files Involved

| File | Change |
|------|--------|
| `src/renderer/App.tsx` | Add `useEffect` for `initSession` on `writers_room` phase |
| `src/main/claude/control-plane.ts` | Add idempotency guard to `initSession` |
| `src/renderer/stores/sessionStore.ts` | No changes needed (queue handles overlap) |
| `src/main/claude/run-manager.ts` | No changes needed |
| `src/main/ipc/core.ts` | No changes needed (IPC handler already exists) |
| `src/preload/index.ts` | No changes needed (bridge already exposed) |

## Risks and Mitigations

1. **Init fails silently.** The existing `initSession` has a `.catch()` that logs but doesn't surface errors. If init fails, the next real prompt falls through to cold start. No user-visible impact.

2. **Session becomes stale.** If the user takes a very long time in Writer's Room (>30 min), the cached session might expire. The 20-minute nudge timer already exists in `WritersRoomView`. If needed, a session health check could be added, but this is unlikely to matter in practice.

3. **API cost of `'hi'` prompt.** With `maxTurns: 1`, this costs ~$0.001-0.005. Negligible.

4. **Race with createTab.** The init must happen after `createTab` resolves (tab needs to exist in ControlPlane registry). Since `enterWritersRoom` can only be triggered after the app loads (and `createTab` runs on mount), this ordering is guaranteed.
