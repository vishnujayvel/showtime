# Design: Real Claude Testing Infrastructure

**Issue:** #67
**Date:** 2026-03-26
**Status:** Draft — awaiting review before implementation
**Type:** Architecture (design only)

---

## Problem Statement

Showtime's agent (me, Claude) confidently says "all tests pass" but has no proof the feature actually works in the running app. Unit tests mock the integration boundary. The single E2E test that touches Claude accepts both success and failure as passing. Multi-turn conversation — the critical path — has zero E2E coverage.

The root question: **How do we prevent an AI agent from hallucinating that its work is done when it hasn't been properly tested?**

## Industry Research Summary

Research covered: Cursor (CursorBench), Continue.dev, SWE-bench, OpenAI Codex, Block Engineering, AWS DevOps Agent, Langfuse, BAML VCR, llmock, Tool Receipts, Mokksy/AI-Mocks, promptfoo, DeepEval.

**Key finding:** [Block Engineering's Testing Pyramid](https://engineering.block.xyz/blog/testing-pyramid-for-ai-agents) is the most practical, production-proven framework for AI agent testing:

| Layer | Uncertainty | Speed | Where to Run |
|-------|------------|-------|-------------|
| 1. Deterministic | None | Fast (3s) | Every CI push |
| 2. Record/Playback | Low | Medium (30s) | Every CI push |
| 3. Real Claude | High | Slow (2-5min) | On-demand / nightly |
| 4. Log Verification | None | Fast | Every CI push |

## Architecture: Four Testing Layers

### Layer 1: Deterministic Unit Tests (DONE)

What we have today: 415 tests covering EventNormalizer, StreamParser, ControlPlane, RunManager, sessionStore. Pure logic, mocked dependencies.

**No changes needed.** This layer is solid.

### Layer 2: VCR Cassette Recording & Playback

**Pattern:** [VCR/cassette](https://anaynayak.medium.com/eliminating-flaky-tests-using-vcr-tests-for-llms-a3feabf90bc5) — record a real Claude interaction once, save the NDJSON event stream as a fixture, replay deterministically in CI.

**How it works for Showtime:**

```text
RECORD MODE (manual, on-demand):
  1. Run E2E test with SHOWTIME_RECORD=1
  2. App spawns real `claude -p` subprocess
  3. StreamParser intercepts NDJSON events
  4. Events saved to e2e/cassettes/<test-name>.ndjson
  5. Screenshots saved alongside
  6. Commit cassettes to git

PLAYBACK MODE (CI, every push):
  1. Run E2E test normally (no env var)
  2. Instead of spawning claude, RunManager reads cassette file
  3. Events fed to EventNormalizer at recorded pace
  4. UI renders from recorded events
  5. Assertions run against deterministic output
  6. Screenshots compared to recorded baselines
```

**Implementation approach:**

Showtime doesn't use HTTP to talk to Claude — it spawns `claude -p` as a child process and reads NDJSON from stdout. So HTTP-level tools like llmock and Mokksy don't apply directly. Instead, we intercept at the **RunManager level**:

```typescript
// src/main/claude/run-manager.ts — add cassette support
class RunManager {
  startRun(requestId: string, options: RunOptions) {
    if (process.env.SHOWTIME_PLAYBACK) {
      return this._playbackFromCassette(requestId, options)
    }

    const child = this._spawnClaude(requestId, options)

    if (process.env.SHOWTIME_RECORD) {
      this._recordToCassette(requestId, child)
    }
  }

  private _playbackFromCassette(requestId: string, options: RunOptions) {
    // Read NDJSON from e2e/cassettes/<requestId>.ndjson
    // Emit events at recorded timestamps
    // Simulate process exit
  }

  private _recordToCassette(requestId: string, child: ChildProcess) {
    // Tee stdout to cassette file alongside normal processing
    // Record timestamps for each event
  }
}
```

**Cassette format:**

```jsonl
{"ts": 0, "event": {"type": "system", "subtype": "init", "session_id": "sess-abc", ...}}
{"ts": 1200, "event": {"type": "stream_event", "event": {"type": "content_block_start", ...}}}
{"ts": 1250, "event": {"type": "stream_event", "event": {"type": "content_block_delta", ...}}}
...
{"ts": 28400, "event": {"type": "result", "result": "...", ...}}
```

Each line has a `ts` (milliseconds since start) so playback can optionally simulate real timing or fast-forward.

**Why this works for Showtime specifically:**
- Our Claude integration is subprocess-based (stdin/stdout), not HTTP
- Recording at the NDJSON level captures the exact event stream Claude produced
- Playback skips the real subprocess entirely — fast, deterministic, free
- The cassette IS the proof that Claude produced valid output at some point

### Layer 3: Real Claude E2E Tests

**These tests use real Claude with no mocks.** They exist to:
- Measure actual response times (product metric)
- Verify prompt templates produce valid lineup JSON
- Test multi-turn session continuity end-to-end
- Capture screenshots as evidence of what really happened

**Test suite:**

```typescript
// e2e/claude-real.test.ts

test.describe('Real Claude Integration', () => {
  test.setTimeout(180_000)  // 3 min — real Claude is real time

  test('happy path: plan → lineup → refinement → updated lineup', async ({ mainPage: page }) => {
    // 1. Enter Writer's Room, select energy, type plan
    // 2. Click "Build my lineup" — wait for REAL Claude response
    // 3. Assert: lineup appeared with >= 2 acts (FAIL if not)
    // 4. Screenshot: claude-real-01-lineup.png
    // 5. Send refinement: "Add a coffee break between act 1 and 2"
    // 6. Wait for lineup to UPDATE (not just re-render old one)
    // 7. Assert: act count increased (FAIL if same)
    // 8. Screenshot: claude-real-02-refined.png
    // 9. Assert: conversation shows both exchanges
    // 10. Screenshot: claude-real-03-conversation.png
    // 11. Record timing metrics
  })

  test('Claude error produces visible error state', async ({ mainPage: page }) => {
    // Verify the app handles Claude failures gracefully
    // (trigger by sending malformed prompt or checking rate limit handling)
  })

  test('session continuity across turns', async ({ mainPage: page }) => {
    // Verify Claude remembers context from turn 1 in turn 2
    // Ask about something from the lineup in the refinement
  })
})
```

**Playwright config:**

```typescript
{
  name: 'claude-real',
  testMatch: /claude-real/,
  timeout: 180_000,
  retries: 1,          // One retry for rate limits
  use: {
    trace: 'on',       // Always capture full trace
    video: 'on',       // Always record video
    screenshot: 'on',  // Screenshot after every action
  },
}
```

**When to run:**
- Manually during development: `npm run test:claude`
- Nightly CI job (scheduled)
- Before every release
- After any change to prompt templates or sessionStore

**Test evidence output:**

```text
e2e/evidence/
├── claude-real-01-lineup.png
├── claude-real-02-refined.png
├── claude-real-03-conversation.png
├── claude-real-trace.zip           ← Playwright trace (replayable)
├── claude-real-video.webm          ← Full screen recording
└── claude-real-metrics.json        ← Timing data
```

### Layer 4: Log-Based Verification

**Pattern:** Use Showtime's existing JSONL app logs (`~/Library/Logs/Showtime/`) as a test verification source. The logs capture the actual Claude interaction — they're an independent record that the agent can't fake.

**How it works:**

```typescript
// After any E2E test that involves Claude:

test.afterEach(async ({ mainPage: page }) => {
  // Read the app log from the test's userData directory
  const logPath = path.join(userDataDir, 'Library/Logs/Showtime/')
  const logContent = fs.readFileSync(latestLogFile(logPath), 'utf-8')
  const events = logContent.split('\n').filter(Boolean).map(JSON.parse)

  // Verify the log independently confirms what the UI showed
  const claudeEvents = events.filter(e => e.event.startsWith('claude.'))

  // Assert: session was established
  expect(claudeEvents.some(e => e.event === 'claude.session_init')).toBe(true)

  // Assert: lineup was generated
  expect(claudeEvents.some(e => e.event === 'claude.lineup_parsed')).toBe(true)

  // Assert: response time was recorded
  const timing = claudeEvents.find(e => e.event === 'claude.lineup_generation')
  expect(timing).toBeTruthy()
  expect(timing.data.durationMs).toBeLessThan(60_000)
})
```

**What this catches that other layers don't:**
- Agent claims "lineup generated" but log shows no `lineup_parsed` event → caught
- Agent claims "test passed" but log shows an error event → caught
- Agent claims "36s response time" but log shows 0ms → caught (no real Claude call happened)

**Log events to add to app-logger:**

| Event | When | Data |
|-------|------|------|
| `claude.session_start` | RunManager.startRun() | requestId, prompt length |
| `claude.session_init` | session_init event received | sessionId, model |
| `claude.lineup_parsed` | tryParseLineup() succeeds | act count, generation time |
| `claude.lineup_failed` | tryParseLineup() returns null | response snippet |
| `claude.refinement_sent` | handleRefinement() called | message text |
| `claude.refinement_parsed` | lineup updated from refinement | old act count → new act count |
| `claude.error` | error/session_dead event | error message, exit code |
| `claude.timing` | task_complete event | total duration, num turns |

## Commit Evidence Format

Every commit that touches Claude integration MUST include:

```text
## Test Evidence

Unit:        415/415 passed (3.1s)
Cassette:    playback matched (2 cassettes, 0.4s)
Claude Real: 3/3 passed (2m 14s)
  - Lineup: 5 acts generated in 28,400ms
  - Refinement: act count 5→6 in 22,100ms
  - Screenshots: e2e/evidence/claude-real-{01..03}.png
Log Verify:  session_init ✓ | lineup_parsed ✓ | timing 28,400ms ✓

Trace: e2e/evidence/claude-real-trace.zip
Video: e2e/evidence/claude-real-video.webm
```

## Anti-Hallucination Patterns

How we prevent the agent from claiming "done" when it's not:

### 1. Screenshot-gated assertions

Tests don't just check DOM elements — they capture screenshots that a human can inspect. Screenshots are committed to git. If the screenshot shows the wrong thing, the git diff makes it obvious.

### 2. Log cross-reference

The app log is an independent record. If the agent says "lineup generated in 28s" but the log says nothing happened, there's a discrepancy. Logs are checked automatically in afterEach hooks.

### 3. Tests must FAIL on failure

No more `claudePath = 'unavailable'` as a passing condition. If Claude doesn't produce a lineup, the test fails. Period. If the test is flaky, that's a product bug to fix, not a test to weaken.

### 4. Timing as evidence

Recording response times creates an unfakeable signal. A mock returns in 0ms. Real Claude takes 10-40s. If a "real Claude test" completes in 50ms, it didn't actually call Claude.

### 5. Cassette freshness

Cassettes have a recorded date. If a cassette is >30 days old, the test emits a warning. Stale cassettes may not reflect current Claude behavior or prompt template changes.

## Implementation Plan

| Phase | What | Files | Effort |
|-------|------|-------|--------|
| 1 | Add log events to app-logger | `src/renderer/views/WritersRoomView.tsx`, `src/main/app-logger.ts` | 2h |
| 2 | Write real Claude E2E tests | `e2e/claude-real.test.ts` | 4h |
| 3 | Add log verification hooks | `e2e/fixtures.ts` | 2h |
| 4 | Build cassette record/playback in RunManager | `src/main/claude/run-manager.ts` | 6h |
| 5 | Write cassette-based replay tests | `e2e/claude-cassette.test.ts` | 3h |
| 6 | Update Playwright config + CI | `playwright.config.ts`, `.github/workflows/` | 1h |
| 7 | Define commit evidence format in CLAUDE.md | `CLAUDE.md` | 30min |

**Total estimated effort:** ~18h across phases.

## Open Questions for Review

1. **Cassette storage** — Cassettes are ~50-200KB each (NDJSON). Store in git? Artifact storage? Git is simplest and provides history.

2. **How many real Claude scenarios?** — Starting with 3 (happy path, refinement, error). More over time?

3. **CI integration** — Real Claude tests as a separate GitHub Actions workflow triggered by `/test-claude` comment? Or nightly schedule?

4. **Log events granularity** — The proposed 8 events above sufficient? Or add more (permission requests, tool calls, etc.)?

5. **Cassette invalidation** — When prompt templates change, cassettes become stale. Auto-detect via hash of prompt template? Manual refresh?

## References

- [Block Engineering: Testing Pyramid for AI Agents](https://engineering.block.xyz/blog/testing-pyramid-for-ai-agents)
- [Tool Receipts (arXiv 2603.10060)](https://arxiv.org/abs/2603.10060) — HMAC-signed execution receipts
- [BAML VCR](https://github.com/gr-b/baml_vcr) — Record/replay LLM calls with streaming
- [llmock](https://github.com/CopilotKit/llmock) — Cross-process mock LLM server
- [Mokksy/AI-Mocks](https://github.com/mokksy/ai-mocks) — WireMock for LLM APIs
- [SWE-bench](https://github.com/SWE-bench/SWE-bench) — Agent benchmark with FAIL_TO_PASS pattern
- [Cursor: CursorBench](https://cursor.com/blog/cursorbench) — Real session-based evals
- [Anthropic: How Teams Use Claude Code](https://claude.com/blog/how-anthropic-teams-use-claude-code) — Self-verification insight
- [promptfoo](https://github.com/promptfoo/promptfoo) — Prompt testing + red teaming
- [Langfuse](https://langfuse.com/docs/observability/overview) — Tracing + replay
- [VCR Tests for LLMs](https://anaynayak.medium.com/eliminating-flaky-tests-using-vcr-tests-for-llms-a3feabf90bc5) — Cassette pattern adapted for LLMs
- [AWS: From AI Agent Prototype to Product](https://aws.amazon.com/blogs/devops/from-ai-agent-prototype-to-product-lessons-from-building-aws-devops-agent/)
