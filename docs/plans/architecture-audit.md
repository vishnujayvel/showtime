# Architecture Audit: Claude Code ↔ Electron Integration

**Date:** 2026-03-26
**Scope:** Full integration surface between Claude Code subprocess and Showtime Electron GUI
**Issues:** #64, #65

---

## 1. Component Map

```text
┌─────────────────────────────────────────────────────────────────┐
│  RENDERER (React 19 + Zustand)                                  │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │ WritersRoom   │  │ sessionStore │  │ useClaudeEvents hook  │ │
│  │ View         │──│ (Zustand)    │──│ (IPC listener)        │ │
│  │              │  │              │  │                       │ │
│  │ offset-based │  │ tabs[]       │  │ onEvent → handleNorm  │ │
│  │ response     │  │ messages[]   │  │ onStatusChange        │ │
│  │ detection    │  │ status       │  │ onError               │ │
│  └──────────────┘  └──────┬───────┘  └──────────┬────────────┘ │
│                           │                      │              │
├───────────────────────────┼──────────────────────┼──────────────┤
│  PRELOAD (contextBridge)  │                      │              │
│                           │                      │              │
│  ┌────────────────────────┴──────────────────────┴────────────┐ │
│  │  window.clui API                                           │ │
│  │  60+ typed methods (invoke/send/on patterns)               │ │
│  │                                                            │ │
│  │  prompt() → IPC.PROMPT                                     │ │
│  │  respondPermission() → IPC.RESPOND_PERMISSION              │ │
│  │  onEvent(cb) ← 'clui:normalized-event'                    │ │
│  │  onTabStatusChange(cb) ← 'clui:tab-status-change'         │ │
│  └────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  MAIN PROCESS (Node.js)                                         │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │ IPC Handlers  │  │ ControlPlane │  │ PermissionServer      │ │
│  │ (core.ts +   │──│ (829 lines)  │──│ (HTTP hook on :19836) │ │
│  │  showtime.ts) │  │              │  │                       │ │
│  │              │  │ Tab registry  │  │ Per-run tokens        │ │
│  │ 35+ channels │  │ Request queue │  │ Safe Bash whitelist   │ │
│  │              │  │ Backpressure  │  │ Session-scoped allow  │ │
│  └──────────────┘  └──────┬───────┘  └───────────────────────┘ │
│                           │                                     │
│  ┌──────────────┐  ┌──────┴───────┐  ┌───────────────────────┐ │
│  │ StreamParser  │  │ RunManager   │  │ EventNormalizer       │ │
│  │ (NDJSON)     │──│ (393 lines)  │──│ (stateless transform) │ │
│  │              │  │              │  │                       │ │
│  │ line buffer  │  │ spawn claude │  │ raw → NormalizedEvent │ │
│  │ parse errors │  │ ring buffers │  │ 11 event types        │ │
│  │              │  │ diagnostics  │  │                       │ │
│  └──────────────┘  └──────────────┘  └───────────────────────┘ │
│                           │                                     │
│                    ┌──────┴───────┐                             │
│                    │ claude -p    │  (Claude Code CLI)          │
│                    │ subprocess   │                             │
│                    │ stream-json  │                             │
│                    └──────────────┘                             │
└─────────────────────────────────────────────────────────────────┘
```

## 2. Claude Subprocess Lifecycle

```text
Renderer                    Main Process                   Claude CLI
   │                           │                              │
   │ clui.prompt(tabId,reqId)  │                              │
   ├──────────────────────────>│                              │
   │                           │ ControlPlane.submitPrompt()  │
   │                           │ ├─ check queue/backpressure  │
   │                           │ ├─ await hookServerReady     │
   │                           │ ├─ inject --resume sessionId │
   │                           │ ├─ register run token        │
   │                           │ └─ RunManager.startRun()     │
   │                           │    ├─ spawn('claude', [...]) │
   │                           │    │──────────────────────────>
   │                           │    │ write user msg to stdin  │
   │                           │    │──────────────────────────>
   │                           │    │                          │
   │                           │    │   NDJSON on stdout       │
   │                           │    │<─────────────────────────│
   │                           │    │ StreamParser.feed()      │
   │                           │    │ normalize(raw)           │
   │                           │    │ emit('normalized',event) │
   │                           │                              │
   │ clui:normalized-event     │ broadcast(event)             │
   │<──────────────────────────│                              │
   │ sessionStore.handleEvent()│                              │
   │ tab.messages.push(...)    │                              │
   │ UI re-renders             │                              │
   │                           │                              │
   │                           │    process.exit(0)           │
   │                           │    │<─────────────────────────│
   │                           │ ControlPlane: tab→completed  │
   │                           │ _processQueue() → next req   │
   │ clui:tab-status-change    │                              │
   │<──────────────────────────│                              │
```

## 3. IPC Channel Inventory

### Renderer → Main (Request-Response)

| Channel | Purpose |
|---------|---------|
| `clui:start` | CLI version, auth, MCP servers, project path |
| `clui:create-tab` | Create new tab, return tabId |
| `clui:prompt` | Submit prompt to Claude |
| `clui:cancel` | Cancel request by requestId |
| `clui:stop-tab` | Cancel active request on tab |
| `clui:retry` | Retry prompt (clears session if dead) |
| `clui:status` | ControlPlane health report |
| `clui:tab-health` | Alias for status |
| `clui:close-tab` | Close tab + cleanup |
| `clui:respond-permission` | Answer permission prompt |
| `clui:get-theme` | System dark mode state |
| `showtime:reset-all-data` | Wipe SQLite |
| `showtime:data-hydrate` | Load show state from DB |
| `showtime:data-flush` | Force-flush show state |
| `showtime:timeline-events` | Query timeline for show |
| `showtime:timeline-drift` | Total schedule drift |
| `showtime:timeline-drift-per-act` | Per-act drift |
| `showtime:claude-context-get` | Load stored session context |
| `showtime:show-history` | Recent shows (limit 30) |
| `showtime:show-detail` | Single show detail |
| `showtime:metrics-summary` | Timing stats (avg, p95) |
| `showtime:is-visible` | Window visibility |

### Renderer → Main (Fire-and-Forget)

| Channel | Purpose |
|---------|---------|
| `clui:init-session` | Warmup session |
| `clui:reset-tab-session` | Clear sessionId |
| `clui:set-permission-mode` | Set 'ask' or 'auto' |
| `clui:hide-window` | Hide window |
| `app:quit` | Graceful shutdown |
| `showtime:set-view-mode` | Resize window |
| `showtime:force-repaint` | GPU repaint |
| `showtime:data-sync` | Queue state sync |
| `showtime:timeline-record` | Record lifecycle event |
| `showtime:claude-context-save` | Store session metadata |
| `showtime:metrics-record` | Record timing metric |
| `showtime:log-event` | Structured app log |

### Main → Renderer (Broadcast)

| Channel | Purpose |
|---------|---------|
| `clui:normalized-event` | All Claude stream events |
| `clui:tab-status-change` | Tab state transitions |
| `clui:enriched-error` | Subprocess error diagnostics |
| `clui:skill-status` | Skill install/uninstall |
| `clui:window-shown` | Window became visible |
| `clui:theme-changed` | Dark/light mode toggle |
| `showtime:day-boundary` | Midnight crossed |
| `showtime:toggle-expanded` | Shortcut triggered |
| `showtime:open-settings` | Show preferences |
| `showtime:reset-show` | DB truncated |

## 4. NormalizedEvent Catalog

| Type | Fields | When Emitted |
|------|--------|-------------|
| `session_init` | sessionId, tools[], model, mcpServers[], skills[], version, isWarmup? | Process starts, session handshake |
| `text_chunk` | text | Each text delta from Claude |
| `tool_call` | toolName, toolId, index | Tool use block starts |
| `tool_call_update` | toolId, partialInput | Tool input streaming |
| `tool_call_complete` | index | Tool use block ends |
| `task_update` | message (AssistantMessagePayload) | Full assistant message snapshot |
| `task_complete` | result, costUsd, durationMs, numTurns, usage, sessionId, permissionDenials? | Claude finishes |
| `error` | message, isError, sessionId? | Claude returns error result |
| `session_dead` | exitCode, signal, stderrTail[] | Process crashes |
| `rate_limit` | status, resetsAt, rateLimitType | Rate limited |
| `permission_request` | questionId, toolName, toolDescription?, toolInput?, options[] | Tool needs approval |

## 5. State Machines

### TabStatus (ControlPlane)

```text
idle ──submitPrompt()──> connecting (no sessionId)
idle ──submitPrompt()──> running    (has sessionId)

connecting ──session_init──> running
connecting ──error────────> idle (warmup) | failed

running ──exit(0)──────> completed
running ──exit(signal)─> failed
running ──error────────> dead

completed ──submitPrompt()──> running  (queue drains)
failed ────retry()──────────> idle
dead ──────retry(clearSess)─> idle
```

### Show Phase (showStore)

```text
no_show ──enterWritersRoom()──> writers_room
writers_room ──triggerGoingLive()──> going_live
going_live ──(animation)──> live
live ──completeAct()──> intermission | strike
intermission ──resumeShow()──> live
strike ──startNewShow()──> no_show
```

## 6. Naming Inconsistencies

| Concept | Names Used | Where |
|---------|-----------|-------|
| Claude session ID | `sessionId`, `claudeSessionId`, `session_id` | control-plane, run-manager, types |
| Process run | `runId` (RunManager), `requestId` (ControlPlane, IPC) | Different layers use different names for same concept |
| Tab container | `tab`, `tabId`, `TabRegistryEntry`, `TabState` | Different shapes in main vs renderer |
| Prompt/Message | `submitPrompt()`, `sendMessage()`, `prompt()` | ControlPlane, sessionStore, preload |
| Events | `'event'` (ControlPlane emitter), `'clui:normalized-event'` (IPC) | Same data, different names |

**Recommendation:** Standardize on `runId` (not `requestId`), add explicit comments distinguishing "tab" (renderer) from "session" (Claude Code).

## 7. Architecture Strengths

1. **Stateless EventNormalizer** — pure function, no side effects, trivially testable
2. **Request queue + backpressure** — MAX_QUEUE_DEPTH=32 prevents runaway spawns
3. **Idempotent requests** — duplicate requestId returns existing promise
4. **Per-run permission tokens** — prevents cross-run permission leaks
5. **Ring buffers for diagnostics** — 100-line stderr/stdout retained for crash reports
6. **Health reconciliation** — 1.5s polling unsticks renderer when backend diverges
7. **Session warmup** — silent `initSession()` pre-caches metadata

## 8. Architecture Weaknesses

1. **No request timeout** — if Claude hangs, request stays inflight forever
2. **Session metadata stored but never read** — `sessionModel`, `sessionTools`, `sessionSkills`, `sessionVersion` in sessionStore are write-only
3. **Single-tab assumption** — full multi-tab plumbing exists but WritersRoomView uses component-local refs (responseOffsetRef) not tab-scoped
4. **Permission server startup is silent** — failure falls back to `--allowedTools` without user notification
5. **StrikeView confetti uses inline styles** — only `style={{}}` violation in codebase

## 9. Test Coverage

> **Updated post-PR #66** — coverage gaps addressed by the integration test suite.

| Component | Lines | Unit | Integration | E2E |
|-----------|-------|------|-------------|-----|
| RunManager | 393 | 26 tests | NONE | NONE |
| ControlPlane | 829 | 39 tests | NONE | NONE |
| EventNormalizer | 173 | 23 tests | NONE | NONE |
| StreamParser | 62 | 14 tests | NONE | NONE |
| PermissionServer | ~400 | NONE | NONE | NONE |
| sessionStore event handling | 526 | 46 tests | NONE | NONE |
| Mock event stream library | N/A | (shared utility) | N/A | N/A |
| IPC round-trip | N/A | mocked | NONE | smoke |
| showStore | 763 | 825 tests | N/A | partial |
| dataLayer (SQLite) | N/A | 90 tests | N/A | N/A |

**Remaining gaps:** PermissionServer, IPC contract tests, E2E multi-turn with real Claude.

## 10. Future Test Recommendations

### Priority 1: PermissionServer Unit Tests
Hook server lifecycle, per-run token management, safe Bash whitelist.

### Priority 2: IPC Contract Tests
Verify main and renderer agree on types for every channel. Schema-driven.

### Priority 3: E2E Multi-Turn Scenario Tests
Replay recorded event streams through real Electron app with mocked Claude subprocess.

### Test Layer Strategy
- **Layer 1 (Fast, CI):** Unit tests — mocked everything — 3s (415 tests)
- **Layer 2 (Medium):** Integration — real SQLite, mock Claude streams — future
- **Layer 3 (Slow, Manual):** E2E — real Electron, real Claude — 10min+
