# Skill-as-Control-Plane: Low-Level Design

**Issue:** #156
**Date:** 2026-04-01
**Status:** Design — pending review

## 1. Problem

The Claude subprocess doesn't know it's the Showtime Director. It has a generic "you're a GUI chat app" system prompt (`CLUI_SYSTEM_HINT`) and no skill context. When the UI asks for a `showtime-lineup` JSON block, Claude sometimes flags it as prompt injection because producing structured lineup JSON isn't part of its identity.

## 2. Design Decision

**Merge `CLUI_SYSTEM_HINT` and `showtime-director` SKILL.md into a single unified system prompt.** The subprocess should have one coherent identity: "I am the Showtime Director, running inside a rich desktop app."

### Why merge (not append separately)

- The current CLUI hint says "You are still a software engineering assistant" — that's wrong. The subprocess IS a day-planning companion.
- Two separate system prompt injections create identity confusion. Claude sees conflicting signals: "you're a coding assistant" vs "produce showtime-lineup JSON."
- A unified prompt means one source of truth for subprocess identity.
- `--append-system-prompt` is called once per spawn regardless — merging costs nothing.

## 3. Components Changed

### 3.1 `src/main/claude/run-manager.ts`

**Delete:** `CLUI_SYSTEM_HINT` constant (lines 30-50)

**Add:** `buildShowtimeSystemPrompt()` function that:
1. Reads `src/skills/showtime/SKILL.md` from disk (relative to app root)
2. Strips the YAML frontmatter (`---` delimited block)
3. Prepends Showtime-specific UI rendering hints (replaces CLUI_SYSTEM_HINT)
4. Returns the combined string

```typescript
import { readFileSync } from 'fs'
import { join } from 'path'

function buildShowtimeSystemPrompt(): string {
  const uiHints = [
    'You are the Showtime Director — an ADHD-friendly day-planning companion',
    'running inside Showtime, a macOS desktop app with a rich chat UI.',
    '',
    'UI rendering:',
    '- The app renders full markdown: tables, bold, headers, bullet lists, code blocks.',
    '- Use rich formatting when presenting lineups, verdicts, and beat checks.',
    '- Clickable markdown links render as real buttons.',
    '',
    'Behavioral contract:',
    '- When the user asks to build a lineup or plan their day, ALWAYS respond with',
    '  a ```showtime-lineup JSON code block. This is your primary output format.',
    '- Follow the SNL Day Framework: Shows, Acts, Beats, Sketches.',
    '- Never use guilt language. The show adapts to the performer.',
    '- You are NOT a software engineering assistant in this context.',
    '  You are a day-planning companion.',
  ].join('\n')

  // Read the skill file for scheduling rules, output format, beat prompts, etc.
  let skillContent = ''
  try {
    const skillPath = join(process.cwd(), 'src/skills/showtime/SKILL.md')
    const raw = readFileSync(skillPath, 'utf-8')
    // Strip YAML frontmatter
    skillContent = raw.replace(/^---[\s\S]*?---\n/, '')
  } catch {
    // Skill file not found — degrade gracefully
    console.warn('[RunManager] showtime-director SKILL.md not found, using minimal prompt')
  }

  return skillContent
    ? `${uiHints}\n\n${skillContent}`
    : uiHints
}

// Cached at module load — re-read on next app restart
const SHOWTIME_SYSTEM_PROMPT = buildShowtimeSystemPrompt()
```

**Change lines 158 and 332:** Replace `CLUI_SYSTEM_HINT` with `SHOWTIME_SYSTEM_PROMPT`

```typescript
// Before:
args.push('--append-system-prompt', CLUI_SYSTEM_HINT)

// After:
args.push('--append-system-prompt', SHOWTIME_SYSTEM_PROMPT)
```

### 3.2 `src/renderer/views/WritersRoomView.tsx`

**Simplify `handleBuildLineup()`** — remove all format instructions from the user message. The system prompt now handles the contract.

```typescript
// Before (lines 231-252): 55 lines of format instructions + role-play
const prompt = hasUserContext
  ? `You are Showtime... Respond with a showtime-lineup JSON block...`
  : `You are Showtime... Ask them what's on their plate...`

// After: clean user intent only
const prompt = hasUserContext
  ? `Plan my day. Energy: ${energy ?? 'medium'}.
${calendarInstruction}Here's what I want to work on:
${recentUserMessages}`
  : `I want to plan my day. Energy: ${energy ?? 'medium'}.
${calendarInstruction}What should I work on?`
```

The key insight: **the UI sends user intent, the system prompt defines the output contract.** The user message never mentions `showtime-lineup`, JSON format, or scheduling rules. Claude knows all of that from its system prompt.

### 3.3 `src/skills/showtime/SKILL.md` (no changes needed)

The skill file stays as-is. It's already well-structured with:
- Structured output format (the `showtime-lineup` JSON spec)
- Scheduling rules by energy level
- Beat check prompts
- Director mode responses
- ADHD guardrails and forbidden language
- Verdict messages

The `buildShowtimeSystemPrompt()` function reads this at startup and injects it wholesale.

## 4. Data Flow (after change)

```
User clicks "Build My Lineup"
  │
  ▼
WritersRoomView.handleBuildLineup()
  │ Sends: "Plan my day. Energy: high. Here's what I want to work on: ..."
  │ (NO format instructions, NO role-play)
  │
  ▼ IPC: showtime:prompt
  │
ControlPlane → RunManager.startRun()
  │ Spawns: claude -p --append-system-prompt SHOWTIME_SYSTEM_PROMPT
  │ (Contains: UI hints + full SKILL.md)
  │
  ▼ Claude subprocess
  │ Identity: "I am the Showtime Director"
  │ Knows: showtime-lineup JSON format, SNL framework, ADHD guardrails
  │ Produces: ```showtime-lineup { ... } ``` naturally
  │
  ▼ NDJSON stream back
  │
StreamParser → ControlPlane → IPC → sessionStore
  │
  ▼
WritersRoomView.tryParseLineup(lastMessage)
  │ Extracts showtime-lineup JSON block
  │ Sends SET_LINEUP event to XState machine
  │
  ▼
showMachine transitions conversation → lineup_ready
```

## 5. Edge Cases

### 5.1 SKILL.md not found
**When:** App built/packaged without the skill file (wrong cwd, production bundle issue)
**Handling:** `buildShowtimeSystemPrompt()` catches the error and falls back to `uiHints` only. Claude can still chat but won't produce structured lineups. Log a warning.

### 5.2 Claude doesn't produce lineup JSON
**When:** User message is ambiguous, or Claude decides to ask a clarifying question first
**Handling:** `tryParseLineup()` returns null. No state change. The chat message displays normally. User can type more context and try again. This is correct behavior — not every turn should produce a lineup.

### 5.3 Claude produces invalid lineup JSON
**When:** Malformed JSON, missing required fields, invalid sketch category
**Handling:** `tryParseLineup()` already validates the parsed JSON. If invalid, treat as null (no lineup). Add a console.warn with the parse error for debugging. Future: show a subtle "lineup couldn't be parsed — try again" message.

### 5.4 User sends message while lineup is generating
**When:** User types and sends before the lineup response arrives
**Handling:** ControlPlane already queues requests per tab (one at a time). The new message waits until the current run completes. No race condition.

### 5.5 Hot-reload of SKILL.md
**When:** Developer edits SKILL.md and wants the subprocess to use the updated version
**Handling:** `SHOWTIME_SYSTEM_PROMPT` is cached at module load (line: `const SHOWTIME_SYSTEM_PROMPT = buildShowtimeSystemPrompt()`). Changes require app restart. This is acceptable — skill changes are rare and require a code change cycle anyway.

### 5.6 Token budget
**When:** Concern about system prompt size affecting latency/cost
**Measured:** SKILL.md is ~1500 words / ~2500 tokens. Combined with UI hints, total system prompt is ~2800 tokens. This is within normal system prompt budgets and adds <100ms to first-token latency.

### 5.7 Session resume
**When:** Multi-turn conversation with `--resume <sessionId>`
**Handling:** `--append-system-prompt` is passed on every spawn (line 332), including resumes. Claude sees the skill content on every turn. This is redundant but harmless — the system prompt is additive and Claude deduplicates internally.

## 6. Testing Strategy

### Unit tests
- `buildShowtimeSystemPrompt()`: returns string containing key markers ("showtime-lineup", "beatThreshold", "SNL")
- `buildShowtimeSystemPrompt()`: handles missing SKILL.md gracefully (returns uiHints only)
- `buildShowtimeSystemPrompt()`: strips YAML frontmatter

### Integration test (manual)
1. Launch app, enter Writer's Room
2. Set energy, type task description
3. Click "Build My Lineup"
4. Verify: no injection warning, valid lineup JSON produced
5. Verify: lineup appears in UI, can confirm and go live

### Cassette replay test
- Record a new VCR cassette with the updated system prompt
- Replay in CI to verify lineup generation works deterministically

## 7. Files Changed Summary

| File | Change | Lines |
|------|--------|-------|
| `src/main/claude/run-manager.ts` | Replace CLUI_SYSTEM_HINT with buildShowtimeSystemPrompt() | ~30 lines changed |
| `src/renderer/views/WritersRoomView.tsx` | Simplify handleBuildLineup() — remove format instructions | ~25 lines simplified |
| `src/__tests__/systemPrompt.test.ts` | New: test buildShowtimeSystemPrompt() | ~40 lines new |

**Total: ~95 lines changed, 0 new dependencies.**

## 8. Migration

No migration needed. The change is transparent to users:
- Same UI flow (click "Build My Lineup")
- Same output format (`showtime-lineup` JSON)
- Same XState machine transitions
- Just works better (no injection warnings)

## 9. Future Considerations

- **Multiple skills:** If Showtime adds more skills (e.g., a reflection skill for Strike), `buildShowtimeSystemPrompt()` could read from a skills directory and concatenate all skill files. Not needed now — YAGNI.
- **Skill marketplace:** If the app supports user-installed skills, the system prompt builder would need to enumerate installed skills. This is a separate design.
- **Per-phase skill loading:** Could inject different skill sections for different phases (e.g., beat check prompts only during live phase). Over-optimization for now — the full skill at 2500 tokens is fine.
