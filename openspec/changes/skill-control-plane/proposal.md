# Skill-as-Control-Plane: Showtime Director Integration Architecture

**Issue:** #156
**Type:** Architecture
**Status:** Design phase — no code changes until design is validated

## Problem Statement

The showtime-director skill needs to produce structured `showtime-lineup` JSON via the Claude subprocess. Currently:

1. **The subprocess (`claude -p`) has no skill context** — it doesn't know `showtime-lineup` is a legitimate output format
2. **The UI constructs a role-play prompt** ("You are Showtime...") which Claude's safety layer flags as prompt injection
3. **There is no architectural contract** between the skill, the subprocess, and the UI — the lineup format is hardcoded in `WritersRoomView.tsx`, duplicated from `SKILL.md`, and fragile

## Current Architecture

```
┌─ Renderer (React) ──────────────────────────────────────────────┐
│  WritersRoomView                                                 │
│    ├─ handleBuildLineup() — constructs prompt with JSON format   │
│    ├─ sendMessage(prompt) — sends via IPC                        │
│    └─ tryParseLineup(response) — extracts showtime-lineup JSON   │
└──────────────────────────────────────────────────────────────────┘
         │ IPC: showtime:prompt
         ▼
┌─ Main Process ──────────────────────────────────────────────────┐
│  ControlPlane                                                    │
│    ├─ Queues requests (one at a time per tab)                    │
│    └─ Delegates to RunManager                                    │
│  RunManager                                                      │
│    ├─ Spawns `claude -p --append-system-prompt CLUI_HINT`        │
│    ├─ Streams NDJSON response back                               │
│    └─ No skill loading — subprocess is a blank slate             │
└──────────────────────────────────────────────────────────────────┘
         │ stdout NDJSON
         ▼
┌─ Claude Subprocess ─────────────────────────────────────────────┐
│  - Sees CLUI_SYSTEM_HINT (markdown formatting guidance)          │
│  - Sees user message with "You are Showtime..." prompt           │
│  - Flags as PROMPT INJECTION — refuses to generate lineup        │
└──────────────────────────────────────────────────────────────────┘
```

## Design Constraints

- **No Anthropic SDK** — all Claude interaction goes through `claude -p` subprocess. Non-negotiable.
- **No role-play prompts in user messages** — triggers injection detection
- **The skill IS the source of truth** — lineup format, scheduling rules, ADHD guardrails all live in SKILL.md
- **The skill should be the control plane** — it should drive what the subprocess produces, not the UI
- **Optimistic UI pattern** — the UI should show immediate feedback while the subprocess works

## Proposed Architecture: Skill-as-Control-Plane

### Core Idea

The `showtime-director` SKILL.md content is injected into the subprocess via `--append-system-prompt`. This makes Claude aware that producing `showtime-lineup` JSON is its legitimate job — not injection. The skill becomes the control plane that defines the contract between Claude and the UI.

```
┌─ Renderer ──────────────────────────────────────────────────────┐
│  WritersRoomView                                                 │
│    ├─ Sends ONLY user intent ("plan my day, high energy,         │
│    │   2hr deep work, 45min gym")                                │
│    ├─ Shows optimistic UI: "Building your lineup..." skeleton    │
│    └─ Parses showtime-lineup JSON when response arrives          │
└──────────────────────────────────────────────────────────────────┘
         │ IPC: showtime:prompt (clean user message, no format instructions)
         ▼
┌─ Main Process ──────────────────────────────────────────────────┐
│  ControlPlane                                                    │
│    └─ RunManager                                                 │
│         ├─ --append-system-prompt: CLUI_HINT + SKILL.md content  │
│         │   (skill loaded ONCE at subprocess init, not per-call) │
│         └─ Skill defines: output format, scheduling rules,       │
│            ADHD guardrails, beat check prompts, verdict messages  │
└──────────────────────────────────────────────────────────────────┘
         │ stdout NDJSON
         ▼
┌─ Claude Subprocess ─────────────────────────────────────────────┐
│  System prompt includes:                                         │
│    1. CLUI_HINT (markdown rendering)                             │
│    2. SKILL.md (showtime-director — full skill content)          │
│  Claude KNOWS it should produce showtime-lineup JSON when asked  │
│  No injection detection — the skill is in the system prompt      │
└──────────────────────────────────────────────────────────────────┘
```

### Key Changes

1. **RunManager reads SKILL.md at init** and appends it to the system prompt
2. **WritersRoomView sends clean user messages** — no format instructions, no role-play
3. **The skill drives the contract** — if the lineup format changes, update SKILL.md, not the UI
4. **Optimistic UI** — show a lineup skeleton/spinner while waiting for Claude

### Research Questions (must answer before implementation)

1. **System prompt token budget**: How long is SKILL.md? Does appending it (~300 lines) to every subprocess call materially impact latency or cost? Should we truncate to essentials?

2. **Skill loading granularity**: Should we load the full SKILL.md or extract just the "Structured Output" section? The scheduling rules and beat check prompts are needed for conversation, but the JSON format spec is the critical piece for lineup generation.

3. **Prompt injection vs system prompt**: Does Claude treat `--append-system-prompt` content as trusted (system-level) or untrusted (user-level)? If it's trusted, the injection problem is solved. If not, we need a different approach.

4. **Subprocess lifecycle**: Currently each `claude -p` call is stateless. Should the lineup generation use the pre-warmed subprocess (which persists for 30s) to maintain conversation context? Or is stateless fine since we pass conversation history in the prompt?

5. **Optimistic UI design**: What should the user see while waiting?
   - Skeleton lineup cards with shimmer animation?
   - "Claude is writing your lineup..." with a progress indicator?
   - Show partial results as they stream in?

6. **Error handling**: What if Claude produces a response WITHOUT a showtime-lineup block? Currently `tryParseLineup` returns null and nothing happens — the user is stuck. We need a retry or fallback UX.

7. **Skill versioning**: If the skill changes (new categories, different JSON format), how do we ensure the subprocess loads the latest version? Does `--append-system-prompt` re-read the file on each spawn, or is it cached?

8. **Multi-turn context**: The Writer's Room has a conversation flow (energy → plan → conversation → lineup). Should the skill content be injected for ALL messages, or only when lineup generation is requested?

### What NOT to change

- The `claude -p` subprocess mechanism — it works, just needs skill context
- The NDJSON streaming protocol — working correctly
- The XState machine — lineup parsing and SET_LINEUP are fine
- The SKILL.md content itself — it's well-designed for this purpose

### Acceptance Criteria

- [ ] Claude subprocess produces valid `showtime-lineup` JSON without injection warnings
- [ ] User sends natural language ("I want to do deep work and gym today") — no format instructions needed
- [ ] SKILL.md is the single source of truth for lineup format — no duplication in UI code
- [ ] Optimistic UI shows feedback while Claude generates the lineup
- [ ] Error case handled: Claude doesn't produce lineup → user sees actionable feedback
- [ ] Hot-reload works: change SKILL.md → next subprocess call uses updated skill
