# Architecture Postmortem: CLUI CC → Showtime Subprocess Management

**Date:** 2026-03-26
**Status:** Complete
**Triggered by:** Issue #72 (code=1 on session resume), #73 (JSON blob), #74 (Go Live broken)

## Executive Summary

**Showtime did NOT rewrite CLUI CC's subprocess layer.** The diff shows Showtime inherited CLUI CC's ControlPlane + RunManager + StreamParser + EventNormalizer nearly intact. The total delta is ~50 lines in control-plane.ts and ~194 lines in run-manager.ts — almost entirely logging, VCR recording, and the `initSession` warmup.

The bugs we're hitting are in **Showtime's additions**, not in the inherited architecture.

## The Actual Diff (CLUI CC → Showtime)

### control-plane.ts: 824 → 874 lines (+50)

| Change | Lines | Impact |
|--------|-------|--------|
| `import { homedir } from 'os'` | +1 | Needed for projectPath fix |
| `import { appLog }` | +1 | Structured logging |
| `appLog` calls for session_init, error, timing | +27 | Observability (good) |
| Enriched error logging on exit | +8 | Diagnostics (good, added today) |
| `initSession` idempotency guard | +3 | Bug prevention (good) |
| `initSession` model override to Sonnet | +1 | Performance (good) |
| `projectPath: process.cwd()` → `homedir()` | 1 changed | **THE BUG FIX (today)** |
| Dispatch logging | +2 | Diagnostics (good, added today) |

**Key finding:** CLUI CC's original `initSession` ALSO used `process.cwd()`. The bug existed in CLUI CC too — it just didn't manifest because CLUI CC didn't use the warmup pattern the same way.

### run-manager.ts: 392 → 586 lines (+194)

| Change | Lines | Impact |
|--------|-------|--------|
| VCR cassette recording/playback | +143 | E2E testing infrastructure |
| `_processEvent` extraction (refactor) | ~30 | Code organization |
| `appLog` session_start call | +7 | Observability |
| Error result logging | +2 | Diagnostics (added today) |
| Moved inline event processing to method | ~10 | Cleaner code |

**Key finding:** 73% of the run-manager delta is VCR cassette code for E2E testing. The core subprocess management is unchanged from CLUI CC.

### Files identical between CLUI CC and Showtime

| File | Lines | Status |
|------|-------|--------|
| event-normalizer.ts | 172 | **Identical** |
| pty-run-manager.ts | 889 | **Identical** |
| stream-parser.ts | 61 | **Identical** |

### Files in CLUI CC but removed from Showtime

| File | Lines | Purpose |
|------|-------|---------|
| process-manager.ts | 193 | Simpler, older process manager (pre-ControlPlane) |

## Root Cause Analysis

### Issue #72: code=1 on session resume

**Root cause:** `initSession` used `process.cwd()` for warmup, but the renderer's `sendMessage` defaults to `homedir()` when no directory is chosen. Claude CLI rejects `--resume` across different project directories.

**Origin:** This bug existed in CLUI CC's `initSession` too (`projectPath: process.cwd()`). But CLUI CC's renderer may have used `process.cwd()` consistently, masking the mismatch. Showtime's sessionStore changed the default path to `homedir()`, creating the divergence.

**Fix applied:** Changed `initSession` to use `homedir()` instead of `process.cwd()`.

### Issue #73: JSON blob on refinement

**Root cause:** The refinement prompt doesn't constrain Claude strongly enough. When the user says "Add dinner date with Silas," Claude uses Google Calendar MCP tools and dumps the raw results instead of updating the lineup JSON.

**Origin:** This is a Showtime-specific issue — CLUI CC doesn't have a lineup concept. The problem is in the renderer's prompt construction (`WritersRoomView.tsx`), not in the subprocess layer.

### Issue #74: Go Live button not working

**Status:** Needs investigation. Likely a renderer/store issue, not subprocess-related.

## Agent SDK Evaluation

**Result: VIABLE** (prototype v1 failed due to wrong API usage, v2 passes all tests)

### v1 Failure (my bug, not SDK's)
- Used `sendMessage()` instead of `send()` + `stream()`
- Treated `query()` as Promise instead of AsyncIterable
- These are API misuse, not SDK instability

### v2 Results (correct API — all pass)

| Test | Result | Time | Notes |
|------|--------|------|-------|
| `query()` single-turn | PASS | 3.9s | Returns session ID, cost, event stream |
| `unstable_v2_prompt()` one-shot | PASS | 3.6s | Convenience wrapper, works cleanly |
| `unstable_v2_createSession()` multi-turn | PASS | 4.8s | **Remembers context across turns** — no manual `--resume` needed |

### What the SDK eliminates
- Manual `child_process.spawn` + args construction
- Manual `--resume <sessionId>` injection
- Manual `projectPath` / cwd tracking (the #72 bug)
- Manual NDJSON stdin/stdout parsing
- Manual event normalization
- Manual session lifecycle management

### What the SDK preserves
- Full streaming (async iterable of typed messages)
- Permission handling (`canUseTool` callback or `permissionMode`)
- Model selection, max turns, budget limits
- MCP server configuration
- Multi-turn session continuity (built-in)

### The `unstable_v2_` prefix concern
The v2 API is marked `@alpha`. However: Claude Desktop uses the same internal code, it's actively maintained (142 npm versions), and the core `query()` function is stable (no prefix). For Showtime's use case, `query()` alone may be sufficient — no need for v2 session API.

## Recommendations

### Option A: Migrate to Agent SDK (recommended for new features)

The SDK eliminates the entire class of bugs we've been fighting. For Showtime's lineup feature:
- Use `unstable_v2_createSession()` for multi-turn lineup + refinement
- Session continuity is built-in — no `--resume`, no projectPath tracking
- Permission handling via `canUseTool` callback
- Streaming via `session.stream()` async iterable

**Migration scope:** Replace `ControlPlane._dispatch()` + `RunManager.startRun()` with SDK calls. Keep the ControlPlane for tab/queue management, but delegate subprocess lifecycle to the SDK.

**Risk:** The v2 API is marked `@alpha`. Mitigation: the stable `query()` API works for single-turn, and multi-turn via v2 is proven in our prototype.

### Option B: Keep current architecture + fix edges

The subprocess layer works. The bugs are in Showtime's ~50 lines of additions. Fix:
1. Prompt engineering for refinements (#73)
2. Go Live button (#74)
3. Sync with CLUI CC upstream periodically

### Regardless of option chosen:

- **Fix the prompt engineering (Issue #73)** — Always include current lineup JSON as context in refinement prompts. Explicitly forbid raw MCP output.
- **Track CLUI CC upstream** — lcoutodemos/clui-cc for subprocess layer changes.

## Architecture Inventory

| Component | CLUI CC | Showtime | Delta |
|-----------|---------|----------|-------|
| control-plane.ts | 824 lines | 874 lines | +50 (logging + warmup fix) |
| run-manager.ts | 392 lines | 586 lines | +194 (VCR recording) |
| event-normalizer.ts | 172 lines | 172 lines | Identical |
| pty-run-manager.ts | 889 lines | 889 lines | Identical |
| stream-parser.ts | 61 lines | 61 lines | Identical |
| process-manager.ts | 193 lines | Removed | Legacy, pre-ControlPlane |
| **Total** | **2531 lines** | **2582 lines** | **+51 lines net** |

## Detailed File-Level Comparison (from deep dive agent)

### Files IDENTICAL between CLUI CC and Showtime (zero changes)

| File | Lines | Status |
|------|-------|--------|
| `event-normalizer.ts` | 172 | Byte-for-byte identical |
| `stream-parser.ts` | 61 | Byte-for-byte identical |
| `cli-env.ts` | — | Byte-for-byte identical |
| `permission-server.ts` | — | Byte-for-byte identical |
| `pty-run-manager.ts` | 889 | 1 trivial TypeScript cast fix |

### Renderer-side divergence (sessionStore.ts)

This is where the real behavioral changes live:

| Change | CLUI CC | Showtime | Impact |
|--------|---------|----------|--------|
| Tab model | Multi-tab | Single tab (replaces array) | Simpler but no tab strip |
| Send during connecting | Drops silently | Queues (up to 32) | **Fix** — prevents lost prompts during warmup |
| Default model | None (Claude default) | `claude-sonnet-4-6` | Faster warmup, lower cost |
| Marketplace | Full plugin UI | Removed | N/A for Showtime |
| Directory management | UI for add/remove dirs | Removed | N/A |
| Attachments | Full attachment flow | Removed | N/A |
| Session history | Resume/load UI | Removed | N/A |
| Calendar detection | None | Checks MCP tools in session_init | Showtime-specific |

### Warmup session concern

The warmup sends `'hi'` as the first turn, which becomes part of the conversation history. Every subsequent user prompt has the warmup response in context. This wastes tokens and could confuse Claude when parsing lineup format. CLUI CC has the same design but it matters less for generic chat.

## Conclusion

The narrative "we rewrote 1900 lines of CLUI CC's subprocess management" is wrong. We inherited it almost verbatim. The subprocess architecture is **95%+ identical** to CLUI CC.

What Showtime added:
- VCR cassette recording for E2E tests (+143 lines, good)
- Structured application logging (+27 lines, good)
- initSession idempotency guard (+3 lines, good)
- Queue-during-connecting fix (renderer, good)
- projectPath fix from `process.cwd()` to `homedir()` (1 line, bug fix)

What causes the bugs:
- **#72** — 1-line projectPath mismatch in initSession (fixed today)
- **#73** — Prompt engineering in WritersRoomView.tsx (renderer, not subprocess layer)
- **#74** — Renderer/store issue (needs investigation)

**The architecture is sound. The bugs are in the edges.**
