# Test Infrastructure for Claude Code Integration

GitHub Issue: #65
Depends on: #64 (architecture audit — completed, see docs/plans/architecture-audit.md)

## Problem

The entire Claude Code ↔ Electron integration pipeline has **zero test coverage**:
- RunManager (393 lines) — NO TESTS
- ControlPlane (829 lines) — NO TESTS
- EventNormalizer (173 lines) — NO TESTS
- StreamParser (62 lines) — NO TESTS
- sessionStore event handling (526 lines) — NO TESTS
- Multi-turn conversation flow — NO TESTS

This is the highest-risk surface in the architecture. Issue #62 (stale message re-detection on multi-turn) shipped because there were no tests for message offset tracking across turns.

## Goals

1. Create a mock Claude event stream library (NDJSON generator)
2. Write unit tests for EventNormalizer (stateless, fixture-driven)
3. Write unit tests for StreamParser (line buffering, parse errors)
4. Write unit tests for ControlPlane (tab lifecycle, queue, backpressure, idempotency)
5. Write unit tests for RunManager (process lifecycle, ring buffers, diagnostics)
6. Write integration tests for sessionStore event handling (all 11 NormalizedEvent types)

## Non-Goals

- No E2E tests with real Claude process (existing E2E suite handles that)
- No permission server tests (lower priority, medium risk)
- No PtyRunManager tests (feature-flagged off)
- No IPC contract tests (future work)

## Technology

- **Vitest** for all tests (already configured)
- **Mock event stream**: TypeScript generator functions yielding NDJSON objects
- **Test environment**: `node` (main process tests) — not Electron
- **EventEmitter mocking**: Standard Node.js EventEmitter for RunManager/ControlPlane

## Architecture Reference

Read `docs/plans/architecture-audit.md` for the complete component map, event catalog, and state machines.

## Key Files to Test

| Source | Test File |
|--------|-----------|
| `src/main/claude/event-normalizer.ts` | `src/__tests__/event-normalizer.test.ts` |
| `src/main/claude/stream-parser.ts` | `src/__tests__/stream-parser.test.ts` |
| `src/main/claude/control-plane.ts` | `src/__tests__/control-plane.test.ts` |
| `src/main/claude/run-manager.ts` | `src/__tests__/run-manager.test.ts` |
| `src/renderer/stores/sessionStore.ts` | `src/__tests__/session-store-events.test.ts` |
| (shared test utilities) | `src/__tests__/mocks/claude-event-stream.ts` |

## Testing Strategy

### EventNormalizer (Priority 1 — stateless, highest ROI)
Fixture-driven snapshot tests. One raw event in, expected NormalizedEvent[] out.
Cover all 11 event types + malformed input + unknown event types.

### StreamParser (Priority 2 — simple, foundational)
Feed chunks of varying sizes. Verify complete JSON objects emitted.
Test partial lines, empty lines, non-JSON lines (parse-error events).

### ControlPlane (Priority 3 — complex, high risk)
Mock RunManager (no real subprocess). Test:
- Tab create/close lifecycle
- submitPrompt queuing when tab is busy
- Backpressure: reject at MAX_QUEUE_DEPTH
- Idempotent requestId handling
- Session ID storage and reuse
- Tab status transitions: idle → connecting → running → completed

### RunManager (Priority 4 — subprocess management)
Mock child_process.spawn. Test:
- startRun creates process with correct args
- NDJSON events flow through normalize()
- Ring buffer overflow (>100 lines)
- Cancel: SIGINT then SIGKILL fallback
- getEnrichedError diagnostics after crash

### sessionStore event handling (Priority 5 — renderer integration)
Create a bare Zustand store instance. Fire NormalizedEvent sequences.
Verify messages[] accumulation, status transitions, permission queue.
Test multi-turn: send prompt, receive response, send refinement, verify offset-based detection works.

## Acceptance Criteria

- All new tests pass: `npm run test`
- Existing 267 tests still pass (no regressions)
- EventNormalizer: 100% of event types covered
- StreamParser: chunked parsing, partial lines, parse errors
- ControlPlane: tab lifecycle, queue depth, idempotency, session reuse
- RunManager: spawn args, event flow, ring buffer, cancel
- sessionStore: all 11 event types + multi-turn message accumulation
