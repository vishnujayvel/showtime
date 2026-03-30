# ADR: Claude Subprocess Authentication — OAuth via CLI, Not API Key or Agent SDK

**Status:** Accepted
**Date:** 2026-03-30
**Context:** Showtime spawns `claude -p` as a subprocess for lineup generation and chat. This ADR documents why we use subscription OAuth via the CLI rather than API keys or the Agent SDK.

---

## Decision

Showtime spawns `claude -p` (without `--bare`) via `RunManager`, inheriting the user's subscription OAuth credentials from the macOS Keychain.

We do **not** use:
- `ANTHROPIC_API_KEY` (Console API billing)
- Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`)
- `--bare` flag

---

## Context

There are three ways to integrate Claude into a desktop app:

### Option A: Raw Anthropic SDK (`@anthropic-ai/sdk`)
Call `client.messages.create()` directly. You get full control and zero subprocess overhead, but lose all built-in tools (Read, Edit, Bash, Glob, Grep, WebSearch), the agent loop, session management, MCP integration, and the permission system. Requires `ANTHROPIC_API_KEY` — separate Console billing.

### Option B: Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`)
Same tools and agent loop as Claude Code. Production-ready (TS v0.2.71, Python v0.1.48). But: **requires `ANTHROPIC_API_KEY`**. Anthropic's docs explicitly state: *"Anthropic does not allow third party developers to offer claude.ai login or rate limits for their products, including agents built on the Claude Agent SDK."*

### Option C: CLI Subprocess (`claude -p`) — what we chose
Spawns the Claude Code binary as a child process. Inherits the user's existing subscription OAuth from the Keychain. No separate billing. ~600ms startup overhead per spawn, ~5-50K token context overhead depending on flags.

---

## Why Not API Keys?

1. **Separate billing:** API keys require a Console account at `console.anthropic.com` with funded credits. This is separate from Max/Pro subscriptions. Requiring users to pay twice defeats Showtime's value proposition.

2. **No subscription-linked API key exists:** Max plan users get OAuth tokens (`sk-ant-oat01-*`), not API keys (`sk-ant-api03-*`). There is no way to derive an API key from a subscription.

3. **Target user:** Showtime targets ADHD users with existing Max/Pro subscriptions. Adding "create a Console account and fund it" to the setup flow would lose most users at onboarding.

## Why Not the Agent SDK?

1. **Same billing problem:** Agent SDK requires `ANTHROPIC_API_KEY`. Same Console billing as Option A.

2. **Legal restriction:** Anthropic prohibits third-party developers from offering claude.ai login through the SDK.

3. **A spike worked but was shelved:** An Agent SDK v2 spike passed all 3 tests (2026-03-22), but was abandoned for economic reasons, not technical ones.

## Why Not `--bare`?

1. **Skips OAuth entirely:** `--bare` explicitly disables Keychain reads and OAuth token refresh. Auth is strictly `ANTHROPIC_API_KEY` or `apiKeyHelper` via `--settings`.

2. **Tested and confirmed broken:** On 2026-03-30, `claude -p --bare "say hello"` returned "Not logged in" because no `ANTHROPIC_API_KEY` was set. Without `--bare`, the same command works via subscription OAuth.

3. **Performance benefit is real but blocked:** `--bare` provides up to 10x faster startup by skipping CLAUDE.md discovery, MCP loading, hooks, LSP, and plugin sync. We cannot use it until either:
   - Anthropic adds subscription OAuth support to `--bare`
   - Or a subscription-linked API key becomes available

---

## Trade-off Summary

| Factor | Raw API SDK | Agent SDK | CLI Subprocess (chosen) |
|--------|-------------|-----------|------------------------|
| Auth | API key only | API key only | Subscription OAuth |
| Cost to user | Per-token billing | Per-token billing | Included in subscription |
| Built-in tools | None | All | All |
| Token overhead | Zero | Minimal | ~5-50K per spawn |
| Startup latency | Fastest | Fast | ~600ms |
| Legal for 3P apps | Yes | Yes (API key only) | Yes |

---

## Mitigations for CLI Overhead

1. **Session resumption:** Use `--resume` with session IDs for multi-turn conversations (already implemented in `RunManager`)
2. **VCR cassettes:** Replay recorded responses for deterministic testing without spawning Claude (implemented in Wave 4)
3. **Future `--bare` with OAuth:** Watch GitHub Issue #18340 for policy changes around subscription-linked API keys

---

## Consequences

- Users must run `claude login` (or have Claude Code installed) before using Showtime
- Each lineup generation spawns a new subprocess (~600ms overhead)
- Token overhead per spawn is ~50K tokens (mitigated by `--resume` for multi-turn)
- If Anthropic deprecates CLI subprocess spawning, we'd need to migrate to Agent SDK + API key billing

---

## References

- [Claude Code Authentication Docs](https://code.claude.com/docs/en/authentication)
- [Agent SDK Overview](https://platform.claude.com/docs/en/agent-sdk/overview)
- [Headless/Programmatic Usage](https://code.claude.com/docs/en/headless)
- [50K Token Overhead Analysis](https://dev.to/jungjaehoon/why-claude-code-subagents-waste-50k-tokens-per-turn-and-how-to-fix-it-41ma)
- [GitHub Issue #18340 — Subscription Auth for 3P Apps](https://github.com/anthropics/claude-code/issues/18340)
- [Community OAuth Demo (unofficial)](https://github.com/weidwonder/claude_agent_sdk_oauth_demo)
